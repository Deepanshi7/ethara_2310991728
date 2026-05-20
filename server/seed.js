import "dotenv/config";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/team-task-manager";

const userSchema = new mongoose.Schema(
  {
    name: String,
    email: { type: String, unique: true, lowercase: true, trim: true },
    passwordHash: String,
    role: { type: String, enum: ["ADMIN", "MEMBER"], default: "MEMBER" }
  },
  { timestamps: true }
);

const projectSchema = new mongoose.Schema(
  {
    name: String,
    description: String,
    owner: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    members: [
      {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        joinedAt: { type: Date, default: Date.now }
      }
    ]
  },
  { timestamps: true }
);

const taskSchema = new mongoose.Schema(
  {
    title: String,
    description: String,
    status: { type: String, enum: ["TODO", "IN_PROGRESS", "REVIEW", "DONE"], default: "TODO" },
    priority: { type: String, enum: ["LOW", "MEDIUM", "HIGH", "URGENT"], default: "MEDIUM" },
    dueDate: Date,
    project: { type: mongoose.Schema.Types.ObjectId, ref: "Project" },
    assignee: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
  },
  { timestamps: true }
);

const User = mongoose.model("User", userSchema);
const Project = mongoose.model("Project", projectSchema);
const Task = mongoose.model("Task", taskSchema);

async function main() {
  await mongoose.connect(MONGODB_URI);

  const adminPassword = await bcrypt.hash("Admin@123", 12);
  const memberPassword = await bcrypt.hash("Member@123", 12);

  const admin = await User.findOneAndUpdate(
    { email: "admin@ethara.app" },
    {
      name: "Aarav Admin",
      email: "admin@ethara.app",
      passwordHash: adminPassword,
      role: "ADMIN"
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const member = await User.findOneAndUpdate(
    { email: "member@ethara.app" },
    {
      name: "Mira Member",
      email: "member@ethara.app",
      passwordHash: memberPassword,
      role: "MEMBER"
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  let project = await Project.findOne({ name: "Placement Launch Board" });
  if (!project) {
    project = await Project.create({
      name: "Placement Launch Board",
      description: "A polished sample workspace showing project planning, task ownership, and delivery tracking.",
      owner: admin._id,
      members: [{ user: admin._id }, { user: member._id }]
    });
  }

  const taskCount = await Task.countDocuments({ project: project._id });
  if (taskCount === 0) {
    await Task.create([
      {
        title: "Finalize Railway deployment",
        description: "Connect production MongoDB, set env variables, and verify the live build.",
        priority: "URGENT",
        status: "IN_PROGRESS",
        dueDate: new Date(Date.now() + 1000 * 60 * 60 * 24),
        project: project._id,
        assignee: admin._id,
        createdBy: admin._id
      },
      {
        title: "Record walkthrough video",
        description: "Capture signup, project creation, member assignment, and dashboard analytics.",
        priority: "HIGH",
        status: "TODO",
        dueDate: new Date(Date.now() + 1000 * 60 * 60 * 48),
        project: project._id,
        assignee: member._id,
        createdBy: admin._id
      },
      {
        title: "QA role permissions",
        description: "Confirm members cannot manage team settings but can update their assigned task status.",
        priority: "MEDIUM",
        status: "REVIEW",
        dueDate: new Date(Date.now() + 1000 * 60 * 60 * 12),
        project: project._id,
        assignee: member._id,
        createdBy: admin._id
      }
    ]);
  }

  console.log(`Seeded ${project.name}`);
  console.log("Admin: admin@ethara.app / Admin@123");
  console.log("Member: member@ethara.app / Member@123");
  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error(error);
  await mongoose.disconnect();
  process.exit(1);
});
