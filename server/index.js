import "dotenv/config";
import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import { z } from "zod";

const app = express();
const PORT = process.env.PORT || 8080;
const JWT_SECRET = process.env.JWT_SECRET || "dev-secret-change-me";
const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/team-task-manager";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(cors());
app.use(express.json({ limit: "1mb" }));

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["ADMIN", "MEMBER"], default: "MEMBER" }
  },
  { timestamps: true }
);

const projectMemberSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    joinedAt: { type: Date, default: Date.now }
  },
  { _id: false }
);

const projectSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true, minlength: 3, maxlength: 100 },
    description: { type: String, trim: true, maxlength: 500 },
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    members: [projectMemberSchema]
  },
  { timestamps: true }
);

const taskSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, minlength: 3, maxlength: 140 },
    description: { type: String, trim: true, maxlength: 700 },
    status: { type: String, enum: ["TODO", "IN_PROGRESS", "REVIEW", "DONE"], default: "TODO" },
    priority: { type: String, enum: ["LOW", "MEDIUM", "HIGH", "URGENT"], default: "MEDIUM" },
    dueDate: Date,
    project: { type: mongoose.Schema.Types.ObjectId, ref: "Project", required: true },
    assignee: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }
  },
  { timestamps: true }
);

userSchema.index({ email: 1 }, { unique: true });
projectSchema.index({ "members.user": 1 });
taskSchema.index({ project: 1, status: 1 });
taskSchema.index({ assignee: 1, status: 1 });
taskSchema.index({ dueDate: 1 });

const User = mongoose.model("User", userSchema);
const Project = mongoose.model("Project", projectSchema);
const Task = mongoose.model("Task", taskSchema);

const idSchema = z.string().refine((value) => mongoose.Types.ObjectId.isValid(value), "Invalid id");
const optionalIdSchema = z
  .string()
  .optional()
  .nullable()
  .refine((value) => !value || mongoose.Types.ObjectId.isValid(value), "Invalid id");
const authSchema = z.object({
  email: z.string().email().trim().toLowerCase(),
  password: z.string().min(6).max(80)
});

function cleanUser(user) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt
  };
}

function cleanMember(member) {
  return {
    user: cleanUser(member.user),
    joinedAt: member.joinedAt
  };
}

function cleanTask(task) {
  return {
    id: task._id.toString(),
    title: task.title,
    description: task.description || "",
    status: task.status,
    priority: task.priority,
    dueDate: task.dueDate,
    projectId: task.project?._id?.toString?.() || task.project?.toString?.(),
    project: task.project?.name
      ? { id: task.project._id.toString(), name: task.project.name }
      : undefined,
    assigneeId: task.assignee?._id?.toString?.() || task.assignee?.toString?.() || null,
    assignee: task.assignee?.name ? cleanUser(task.assignee) : null,
    createdAt: task.createdAt,
    updatedAt: task.updatedAt
  };
}

function cleanProject(project, tasks = []) {
  return {
    id: project._id.toString(),
    name: project.name,
    description: project.description || "",
    owner: cleanUser(project.owner),
    members: project.members.map(cleanMember),
    tasks: tasks.map(cleanTask),
    _count: { members: project.members.length, tasks: tasks.length },
    createdAt: project.createdAt,
    updatedAt: project.updatedAt
  };
}

const signToken = (user) =>
  jwt.sign({ id: user._id.toString(), role: user.role }, JWT_SECRET, { expiresIn: "7d" });

const asyncRoute = (handler) => (req, res, next) =>
  Promise.resolve(handler(req, res, next)).catch(next);

const requireAuth = asyncRoute(async (req, _res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    const error = new Error("Authentication required");
    error.status = 401;
    throw error;
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    const user = await User.findById(payload.id);
    if (!user) {
      const error = new Error("User no longer exists");
      error.status = 401;
      throw error;
    }
    req.user = user;
    next();
  } catch {
    const error = new Error("Invalid or expired session");
    error.status = 401;
    throw error;
  }
});

const requireAdmin = (req, _res, next) => {
  if (req.user.role !== "ADMIN") {
    const error = new Error("Admin access required");
    error.status = 403;
    throw error;
  }
  next();
};

async function ensureProjectAccess(user, projectId) {
  const project = await Project.findById(projectId);
  if (!project) {
    const error = new Error("Project not found");
    error.status = 404;
    throw error;
  }

  const isMember = project.members.some((member) => member.user.toString() === user._id.toString());
  if (user.role !== "ADMIN" && !isMember) {
    const error = new Error("You do not have access to this project");
    error.status = 403;
    throw error;
  }

  return project;
}

async function ensureAssignableUser(project, assigneeId) {
  if (!assigneeId) return null;

  const assignee = await User.findById(assigneeId);
  if (!assignee) {
    const error = new Error("Assignee not found");
    error.status = 404;
    throw error;
  }

  const isProjectMember = project.members.some((member) => member.user.toString() === assigneeId);
  if (!isProjectMember) {
    const error = new Error("Assignee must be a member of this project");
    error.status = 400;
    throw error;
  }

  return assignee;
}

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, name: "Ethara Teams API" });
});

app.post(
  "/api/auth/signup",
  asyncRoute(async (req, res) => {
    const input = authSchema
      .extend({ name: z.string().min(2).max(80).trim() })
      .parse(req.body);

    const existing = await User.findOne({ email: input.email });
    if (existing) {
      const error = new Error("An account with this email already exists");
      error.status = 409;
      throw error;
    }

    const usersCount = await User.countDocuments();
    const passwordHash = await bcrypt.hash(input.password, 12);
    const user = await User.create({
      name: input.name,
      email: input.email,
      passwordHash,
      role: usersCount === 0 ? "ADMIN" : "MEMBER"
    });

    res.status(201).json({ user: cleanUser(user), token: signToken(user) });
  })
);

app.post(
  "/api/auth/login",
  asyncRoute(async (req, res) => {
    const input = authSchema.parse(req.body);
    const user = await User.findOne({ email: input.email });
    const valid = user && (await bcrypt.compare(input.password, user.passwordHash));

    if (!valid) {
      const error = new Error("Invalid email or password");
      error.status = 401;
      throw error;
    }

    res.json({ user: cleanUser(user), token: signToken(user) });
  })
);

app.get("/api/auth/me", requireAuth, (req, res) => {
  res.json({ user: cleanUser(req.user) });
});

app.get(
  "/api/users",
  requireAuth,
  asyncRoute(async (_req, res) => {
    const users = await User.find({}, "name email role createdAt").sort({ name: 1 });
    res.json({ users: users.map(cleanUser) });
  })
);

app.get(
  "/api/dashboard",
  requireAuth,
  asyncRoute(async (req, res) => {
    const visibleProjectFilter =
      req.user.role === "ADMIN" ? {} : { "members.user": req.user._id };
    const visibleProjects = await Project.find(visibleProjectFilter).select("_id");
    const projectIds = visibleProjects.map((project) => project._id);
    const taskFilter =
      req.user.role === "ADMIN"
        ? {}
        : { $or: [{ assignee: req.user._id }, { project: { $in: projectIds } }] };

    const now = new Date();
    const [projects, totalTasks, overdueTasks, byStatus, urgentTasks] = await Promise.all([
      Project.countDocuments(visibleProjectFilter),
      Task.countDocuments(taskFilter),
      Task.countDocuments({ ...taskFilter, dueDate: { $lt: now }, status: { $ne: "DONE" } }),
      Task.aggregate([
        { $match: taskFilter },
        { $group: { _id: "$status", count: { $sum: 1 } } }
      ]),
      Task.find({
        ...taskFilter,
        status: { $ne: "DONE" },
        $or: [{ priority: "URGENT" }, { dueDate: { $lt: now } }]
      })
        .sort({ dueDate: 1, priority: -1 })
        .limit(5)
        .populate("project", "name")
        .populate("assignee", "name email role createdAt")
    ]);

    const completed = byStatus.find((item) => item._id === "DONE")?.count || 0;
    res.json({
      stats: {
        projects,
        totalTasks,
        overdueTasks,
        completionRate: totalTasks ? Math.round((completed / totalTasks) * 100) : 0
      },
      byStatus: byStatus.map((item) => ({ status: item._id, count: item.count })),
      urgentTasks: urgentTasks.map(cleanTask)
    });
  })
);

app.get(
  "/api/projects",
  requireAuth,
  asyncRoute(async (req, res) => {
    const filter = req.user.role === "ADMIN" ? {} : { "members.user": req.user._id };
    const projects = await Project.find(filter)
      .sort({ updatedAt: -1 })
      .populate("owner", "name email role createdAt")
      .populate("members.user", "name email role createdAt");
    const tasks = await Task.find({ project: { $in: projects.map((project) => project._id) } })
      .sort({ updatedAt: -1 })
      .populate("assignee", "name email role createdAt");

    const tasksByProject = tasks.reduce((map, task) => {
      const key = task.project.toString();
      map.set(key, [...(map.get(key) || []), task]);
      return map;
    }, new Map());

    res.json({
      projects: projects.map((project) => cleanProject(project, tasksByProject.get(project._id.toString()) || []))
    });
  })
);

app.post(
  "/api/projects",
  requireAuth,
  requireAdmin,
  asyncRoute(async (req, res) => {
    const input = z
      .object({
        name: z.string().min(3).max(100).trim(),
        description: z.string().max(500).optional().nullable()
      })
      .parse(req.body);

    const project = await Project.create({
      name: input.name,
      description: input.description || "",
      owner: req.user._id,
      members: [{ user: req.user._id }]
    });
    const populated = await project.populate([
      { path: "owner", select: "name email role createdAt" },
      { path: "members.user", select: "name email role createdAt" }
    ]);

    res.status(201).json({ project: cleanProject(populated, []) });
  })
);

app.post(
  "/api/projects/:projectId/members",
  requireAuth,
  requireAdmin,
  asyncRoute(async (req, res) => {
    const projectId = idSchema.parse(req.params.projectId);
    const input = z.object({ email: z.string().email().trim().toLowerCase() }).parse(req.body);
    const [project, user] = await Promise.all([
      Project.findById(projectId),
      User.findOne({ email: input.email })
    ]);

    if (!project) {
      const error = new Error("Project not found");
      error.status = 404;
      throw error;
    }
    if (!user) {
      const error = new Error("No user found with that email");
      error.status = 404;
      throw error;
    }

    if (!project.members.some((member) => member.user.toString() === user._id.toString())) {
      project.members.push({ user: user._id });
      await project.save();
    }

    await project.populate("members.user", "name email role createdAt");
    res.status(201).json({ members: project.members.map(cleanMember) });
  })
);

app.delete(
  "/api/projects/:projectId/members/:userId",
  requireAuth,
  requireAdmin,
  asyncRoute(async (req, res) => {
    const projectId = idSchema.parse(req.params.projectId);
    const userId = idSchema.parse(req.params.userId);
    const project = await Project.findById(projectId);
    if (!project) {
      const error = new Error("Project not found");
      error.status = 404;
      throw error;
    }

    project.members = project.members.filter((member) => member.user.toString() !== userId);
    await project.save();
    res.status(204).end();
  })
);

app.post(
  "/api/projects/:projectId/tasks",
  requireAuth,
  requireAdmin,
  asyncRoute(async (req, res) => {
    const projectId = idSchema.parse(req.params.projectId);
    const project = await ensureProjectAccess(req.user, projectId);
    const input = z
      .object({
        title: z.string().min(3).max(140).trim(),
        description: z.string().max(700).optional().nullable(),
        status: z.enum(["TODO", "IN_PROGRESS", "REVIEW", "DONE"]).optional(),
        priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
        dueDate: z.string().datetime().optional().nullable(),
        assigneeId: optionalIdSchema
      })
      .parse(req.body);
    await ensureAssignableUser(project, input.assigneeId);

    const task = await Task.create({
      title: input.title,
      description: input.description || "",
      status: input.status || "TODO",
      priority: input.priority || "MEDIUM",
      dueDate: input.dueDate ? new Date(input.dueDate) : null,
      assignee: input.assigneeId || null,
      project: projectId,
      createdBy: req.user._id
    });
    await task.populate([
      { path: "project", select: "name" },
      { path: "assignee", select: "name email role createdAt" }
    ]);

    res.status(201).json({ task: cleanTask(task) });
  })
);

app.patch(
  "/api/tasks/:taskId",
  requireAuth,
  asyncRoute(async (req, res) => {
    const taskId = idSchema.parse(req.params.taskId);
    const task = await Task.findById(taskId);
    if (!task) {
      const error = new Error("Task not found");
      error.status = 404;
      throw error;
    }
    const project = await ensureProjectAccess(req.user, task.project.toString());

    const isAssignee = task.assignee?.toString() === req.user._id.toString();
    const input = z
      .object({
        title: z.string().min(3).max(140).trim().optional(),
        description: z.string().max(700).optional().nullable(),
        status: z.enum(["TODO", "IN_PROGRESS", "REVIEW", "DONE"]).optional(),
        priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
        dueDate: z.string().datetime().optional().nullable(),
        assigneeId: optionalIdSchema
      })
      .parse(req.body);

    if (req.user.role !== "ADMIN") {
      if (!isAssignee || Object.keys(input).some((key) => key !== "status")) {
        const error = new Error("Members can only update the status of their own assigned tasks");
        error.status = 403;
        throw error;
      }
    }

    if (input.title !== undefined) task.title = input.title;
    if (input.description !== undefined) task.description = input.description || "";
    if (input.status !== undefined) task.status = input.status;
    if (input.priority !== undefined) task.priority = input.priority;
    if (input.dueDate !== undefined) task.dueDate = input.dueDate ? new Date(input.dueDate) : null;
    if (input.assigneeId !== undefined) {
      await ensureAssignableUser(project, input.assigneeId);
      task.assignee = input.assigneeId || null;
    }
    await task.save();
    await task.populate([
      { path: "project", select: "name" },
      { path: "assignee", select: "name email role createdAt" }
    ]);

    res.json({ task: cleanTask(task) });
  })
);

app.delete(
  "/api/tasks/:taskId",
  requireAuth,
  requireAdmin,
  asyncRoute(async (req, res) => {
    const taskId = idSchema.parse(req.params.taskId);
    await Task.findByIdAndDelete(taskId);
    res.status(204).end();
  })
);

const clientDist = path.join(__dirname, "..", "dist", "client");
app.use(express.static(clientDist));
app.get(/.*/, (_req, res) => {
  res.sendFile(path.join(clientDist, "index.html"));
});

app.use((err, _req, res, _next) => {
  if (err instanceof z.ZodError) {
    return res.status(400).json({
      message: "Validation failed",
      issues: err.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message
      }))
    });
  }

  if (err.name === "CastError") {
    return res.status(400).json({ message: "Invalid id" });
  }

  if (err.code === 11000) {
    return res.status(409).json({ message: "Duplicate value already exists" });
  }

  const status = err.status || 500;
  res.status(status).json({ message: err.message || "Something went wrong" });
});

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Ethara Teams running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("MongoDB connection failed", error.message);
    process.exit(1);
  });
