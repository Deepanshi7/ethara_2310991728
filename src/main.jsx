import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  AlertCircle,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  CirclePlus,
  ClipboardList,
  Gauge,
  LayoutDashboard,
  Loader2,
  Lock,
  LogOut,
  Plus,
  Shield,
  Sparkles,
  Trash2,
  UserPlus,
  Users,
  X
} from "lucide-react";
import { api, priorityLabels, statusLabels } from "./lib/api";
import "./styles.css";

const emptyTask = {
  title: "",
  description: "",
  assigneeId: "",
  status: "TODO",
  priority: "MEDIUM",
  dueDate: ""
};

function classNames(...items) {
  return items.filter(Boolean).join(" ");
}

function formatDate(value) {
  if (!value) return "No date";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric" }).format(new Date(value));
}

function toDateTime(value) {
  return value ? new Date(value).toISOString() : null;
}

function App() {
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({ name: "", email: "", password: "" });
  const [projects, setProjects] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [users, setUsers] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [projectForm, setProjectForm] = useState({ name: "", description: "" });
  const [memberEmail, setMemberEmail] = useState("");
  const [taskForm, setTaskForm] = useState(emptyTask);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const isAdmin = user?.role === "ADMIN";
  const selectedProject = projects.find((project) => project.id === selectedProjectId) || projects[0];

  function notify(message, type = "success") {
    setToast({ id: Date.now(), message, type });
    if (type === "error") {
      setError(message);
    }
  }

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(null), 3600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  async function loadApp() {
    setError("");
    try {
      const [projectsData, dashboardData, usersData] = await Promise.all([
        api("/projects"),
        api("/dashboard"),
        api("/users")
      ]);
      setProjects(projectsData.projects);
      setDashboard(dashboardData);
      setUsers(usersData.users);
      setSelectedProjectId((current) => current || projectsData.projects[0]?.id || null);
    } catch (err) {
      notify(err.message, "error");
    }
  }

  useEffect(() => {
    const token = localStorage.getItem("ethara_token");
    if (!token) {
      setLoading(false);
      return;
    }

    api("/auth/me")
      .then(({ user: currentUser }) => {
        setUser(currentUser);
        return loadApp();
      })
      .catch(() => localStorage.removeItem("ethara_token"))
      .finally(() => setLoading(false));
  }, []);

  async function submitAuth(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload =
        authMode === "signup"
          ? authForm
          : { email: authForm.email, password: authForm.password };
      const { user: nextUser, token } = await api(`/auth/${authMode}`, {
        method: "POST",
        body: JSON.stringify(payload)
      });
      localStorage.setItem("ethara_token", token);
      setUser(nextUser);
      await loadApp();
      notify(authMode === "login" ? `Welcome back, ${nextUser.name}` : "Account created successfully");
    } catch (err) {
      notify(err.message, "error");
    } finally {
      setSaving(false);
    }
  }

  function logout() {
    localStorage.removeItem("ethara_token");
    setUser(null);
    setProjects([]);
    setDashboard(null);
    notify("Logged out successfully");
  }

  async function createProject(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      await api("/projects", { method: "POST", body: JSON.stringify(projectForm) });
      notify("Project created successfully");
      setProjectForm({ name: "", description: "" });
      await loadApp();
    } catch (err) {
      notify(err.message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function addMember(event) {
    event.preventDefault();
    if (!selectedProject) return;
    setSaving(true);
    setError("");
    try {
      await api(`/projects/${selectedProject.id}/members`, {
        method: "POST",
        body: JSON.stringify({ email: memberEmail })
      });
      notify("Member added to project");
      setMemberEmail("");
      await loadApp();
    } catch (err) {
      notify(err.message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function createTask(event) {
    event.preventDefault();
    if (!selectedProject) return;
    setSaving(true);
    setError("");
    try {
      await api(`/projects/${selectedProject.id}/tasks`, {
        method: "POST",
        body: JSON.stringify({
          ...taskForm,
          assigneeId: taskForm.assigneeId || null,
          dueDate: toDateTime(taskForm.dueDate)
        })
      });
      notify("Task created and added to the board");
      setTaskForm(emptyTask);
      await loadApp();
    } catch (err) {
      notify(err.message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function updateTask(taskId, patch) {
    setError("");
    try {
      await api(`/tasks/${taskId}`, {
        method: "PATCH",
        body: JSON.stringify(patch)
      });
      notify("Task status updated");
      await loadApp();
    } catch (err) {
      notify(err.message, "error");
    }
  }

  async function deleteTask(taskId) {
    setError("");
    try {
      await api(`/tasks/${taskId}`, { method: "DELETE" });
      notify("Task deleted");
      await loadApp();
    } catch (err) {
      notify(err.message, "error");
    }
  }

  const statusCounts = useMemo(() => {
    const base = { TODO: 0, IN_PROGRESS: 0, REVIEW: 0, DONE: 0 };
    dashboard?.byStatus?.forEach((item) => {
      base[item.status] = item.count;
    });
    return base;
  }, [dashboard]);

  if (loading) {
    return (
      <main className="screen center-screen">
        <Toast toast={toast} onClose={() => setToast(null)} />
        <div className="loader-panel">
          <Loader2 className="spin" size={34} />
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="screen auth-screen">
        <Toast toast={toast} onClose={() => setToast(null)} />
        <section className="auth-brand">
          <div className="brand-mark">
            <Sparkles size={26} />
          </div>
          <h1>Ethara Teams</h1>
          <p>Projects, people, tasks, and progress in one polished workspace.</p>
          <div className="auth-proof">
            <span><Shield size={16} /> Role access</span>
            <span><Gauge size={16} /> Live status</span>
            <span><CalendarClock size={16} /> Overdue tracking</span>
          </div>
        </section>

        <form className="glass-panel auth-card" onSubmit={submitAuth}>
          <div className="segmented">
            <button type="button" className={authMode === "login" ? "active" : ""} onClick={() => setAuthMode("login")}>
              Login
            </button>
            <button type="button" className={authMode === "signup" ? "active" : ""} onClick={() => setAuthMode("signup")}>
              Signup
            </button>
          </div>

          {authMode === "signup" && (
            <label>
              Name
              <input value={authForm.name} onChange={(event) => setAuthForm({ ...authForm, name: event.target.value })} required />
            </label>
          )}
          <label>
            Email
            <input type="email" value={authForm.email} onChange={(event) => setAuthForm({ ...authForm, email: event.target.value })} required />
          </label>
          <label>
            Password
            <input type="password" minLength={6} value={authForm.password} onChange={(event) => setAuthForm({ ...authForm, password: event.target.value })} required />
          </label>
          {error && <p className="form-error">{error}</p>}
          <button className="primary-button" type="submit" disabled={saving}>
            {saving ? <Loader2 className="spin" size={18} /> : <Lock size={18} />}
            {authMode === "login" ? "Enter workspace" : "Create account"}
          </button>
        </form>
      </main>
    );
  }

  return (
    <main className="screen app-shell">
      <Toast toast={toast} onClose={() => setToast(null)} />
      <aside className="sidebar glass-panel">
        <div className="brand-row">
          <div className="brand-mark small"><Sparkles size={20} /></div>
          <div>
            <strong>Ethara</strong>
            <span>{user.role === "ADMIN" ? "Admin" : "Member"}</span>
          </div>
        </div>

        <nav className="project-list">
          <span className="nav-kicker"><LayoutDashboard size={16} /> Projects</span>
          {projects.map((project) => (
            <button
              key={project.id}
              className={classNames("project-tab", selectedProject?.id === project.id && "active")}
              onClick={() => setSelectedProjectId(project.id)}
            >
              <span>{project.name}</span>
              <small>{project._count?.tasks || project.tasks.length}</small>
            </button>
          ))}
        </nav>

        <button className="ghost-button" onClick={logout}>
          <LogOut size={18} />
          Logout
        </button>
      </aside>

      <section className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Team Task Manager</p>
            <h1>{selectedProject?.name || "Workspace"}</h1>
          </div>
          <div className="profile-chip">
            <span>{user.name}</span>
            <strong>{user.role}</strong>
          </div>
        </header>

        {error && <div className="toast">{error}</div>}

        <section className="metrics-grid">
          <Metric icon={ClipboardList} label="Tasks" value={dashboard?.stats.totalTasks || 0} />
          <Metric icon={Users} label="Projects" value={dashboard?.stats.projects || 0} />
          <Metric icon={CalendarClock} label="Overdue" value={dashboard?.stats.overdueTasks || 0} tone="danger" />
          <Metric icon={CheckCircle2} label="Complete" value={`${dashboard?.stats.completionRate || 0}%`} tone="success" />
        </section>

        <section className="content-grid">
          <div className="main-column">
            <div className="glass-panel status-panel">
              {Object.entries(statusCounts).map(([status, count]) => (
                <div key={status}>
                  <span>{statusLabels[status]}</span>
                  <strong>{count}</strong>
                </div>
              ))}
            </div>

            <div className="board">
              {["TODO", "IN_PROGRESS", "REVIEW", "DONE"].map((status) => (
                <TaskColumn
                  key={status}
                  status={status}
                  tasks={(selectedProject?.tasks || []).filter((task) => task.status === status)}
                  user={user}
                  onStatusChange={updateTask}
                  onDelete={deleteTask}
                />
              ))}
            </div>
          </div>

          <aside className="side-column">
            {isAdmin && (
              <form className="glass-panel control-panel" onSubmit={createProject}>
                <PanelTitle icon={CirclePlus} title="New Project" />
                <input placeholder="Project name" value={projectForm.name} onChange={(event) => setProjectForm({ ...projectForm, name: event.target.value })} required />
                <textarea placeholder="Short description" value={projectForm.description} onChange={(event) => setProjectForm({ ...projectForm, description: event.target.value })} />
                <button className="primary-button compact" disabled={saving}>
                  <Plus size={17} /> Create
                </button>
              </form>
            )}

            {selectedProject && isAdmin && (
              <form className="glass-panel control-panel" onSubmit={addMember}>
                <PanelTitle icon={UserPlus} title="Team" />
                <div className="member-stack">
                  {selectedProject.members.map(({ user: member }) => (
                    <span key={member.id}>{member.name}<small>{member.role}</small></span>
                  ))}
                </div>
                <input type="email" placeholder="member@email.com" value={memberEmail} onChange={(event) => setMemberEmail(event.target.value)} required />
                <button className="secondary-button compact" disabled={saving}>
                  <UserPlus size={17} /> Add
                </button>
              </form>
            )}

            {selectedProject && isAdmin && (
              <form className="glass-panel control-panel" onSubmit={createTask}>
                <PanelTitle icon={ClipboardList} title="New Task" />
                <input placeholder="Task title" value={taskForm.title} onChange={(event) => setTaskForm({ ...taskForm, title: event.target.value })} required />
                <textarea placeholder="Task details" value={taskForm.description} onChange={(event) => setTaskForm({ ...taskForm, description: event.target.value })} />
                <select value={taskForm.assigneeId} onChange={(event) => setTaskForm({ ...taskForm, assigneeId: event.target.value })}>
                  <option value="">Unassigned</option>
                  {users.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
                <div className="split-inputs">
                  <select value={taskForm.priority} onChange={(event) => setTaskForm({ ...taskForm, priority: event.target.value })}>
                    {Object.keys(priorityLabels).map((priority) => (
                      <option key={priority} value={priority}>{priorityLabels[priority]}</option>
                    ))}
                  </select>
                  <input type="datetime-local" value={taskForm.dueDate} onChange={(event) => setTaskForm({ ...taskForm, dueDate: event.target.value })} />
                </div>
                <button className="primary-button compact" disabled={saving}>
                  <Plus size={17} /> Add task
                </button>
              </form>
            )}

            <div className="glass-panel control-panel">
              <PanelTitle icon={CalendarClock} title="Priority" />
              <div className="urgent-list">
                {(dashboard?.urgentTasks || []).map((task) => (
                  <div key={task.id} className="urgent-row">
                    <strong>{task.title}</strong>
                    <span>{task.project.name} - {formatDate(task.dueDate)}</span>
                  </div>
                ))}
                {!dashboard?.urgentTasks?.length && <span className="empty-text">All clear</span>}
              </div>
            </div>
          </aside>
        </section>
      </section>
    </main>
  );
}

function Toast({ toast, onClose }) {
  if (!toast) return null;
  const Icon = toast.type === "error" ? AlertCircle : CheckCircle2;

  return (
    <div className={classNames("toast-stack", toast.type)} role="status" aria-live="polite">
      <Icon size={19} />
      <span>{toast.message}</span>
      <button type="button" onClick={onClose} aria-label="Dismiss notification">
        <X size={15} />
      </button>
    </div>
  );
}

function Metric({ icon: Icon, label, value, tone = "" }) {
  return (
    <div className={classNames("metric-card glass-panel", tone)}>
      <Icon size={21} />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function PanelTitle({ icon: Icon, title }) {
  return (
    <div className="panel-title">
      <Icon size={18} />
      <strong>{title}</strong>
    </div>
  );
}

function TaskColumn({ status, tasks, user, onStatusChange, onDelete }) {
  return (
    <section className="task-column glass-panel">
      <header>
        <span>{statusLabels[status]}</span>
        <strong>{tasks.length}</strong>
      </header>
      <div className="task-stack">
        {tasks.map((task) => {
          const canUpdate = user.role === "ADMIN" || task.assigneeId === user.id;
          return (
            <article className={classNames("task-card", `priority-${task.priority.toLowerCase()}`)} key={task.id}>
              <div className="task-card-header">
                <strong>{task.title}</strong>
                {user.role === "ADMIN" && (
                  <button title="Delete task" className="icon-button" onClick={() => onDelete(task.id)}>
                    <Trash2 size={15} />
                  </button>
                )}
              </div>
              {task.description && <p>{task.description}</p>}
              <div className="task-meta">
                <span>{priorityLabels[task.priority]}</span>
                <span>{formatDate(task.dueDate)}</span>
              </div>
              <div className="task-footer">
                <span>{task.assignee?.name || "Unassigned"}</span>
                {canUpdate && (
                  <select value={task.status} onChange={(event) => onStatusChange(task.id, { status: event.target.value })}>
                    {Object.keys(statusLabels).map((item) => (
                      <option key={item} value={item}>{statusLabels[item]}</option>
                    ))}
                  </select>
                )}
              </div>
            </article>
          );
        })}
        {!tasks.length && (
          <div className="empty-column">
            <ArrowRight size={18} />
          </div>
        )}
      </div>
    </section>
  );
}

createRoot(document.getElementById("root")).render(<App />);
