# Ethara Teams - Team Task Manager

Ethara Teams is a full-stack team task manager built for project planning, task ownership, and progress tracking. It supports authentication, Admin/Member access control, project teams, task assignment, deadline tracking, and a responsive liquid-glass dashboard.

## Live Submission

Add these after deployment:

- Live URL: `YOUR_RAILWAY_URL`
- GitHub Repository: `[YOUR_GITHUB_REPO_URL](https://github.com/Deepanshi7/ethara_2310991728.git)`
- Demo Video: `YOUR_DEMO_VIDEO_URL`

## Highlights

- Full-stack MERN-style architecture using React, Express, MongoDB, and Mongoose
- JWT authentication with hashed passwords
- Role-based access control for Admin and Member workflows
- Project and team management
- Task assignment with status, priority, and due dates
- Dashboard analytics for progress and overdue work
- Responsive liquid-glass UI inspired by modern Apple surfaces
- Toast notifications for success and error feedback
- Hover animations, visible focus states, and improved contrast
- Railway-ready deployment configuration

## Features

### Authentication

- User signup
- User login
- JWT session persistence
- Password hashing with bcrypt
- First registered user is automatically assigned `ADMIN`
- Later users are assigned `MEMBER`

### Role-Based Access

- Admins can create projects
- Admins can add members to a project
- Admins can create, assign, and delete tasks
- Admins can assign tasks only to valid project members
- Members can view projects they belong to
- Members can update only the status of tasks assigned to them

### Project Management

- Create projects with name and description
- Add team members by email
- View project members
- View all project tasks in a Kanban-style board

### Task Management

- Create tasks inside a project
- Assign tasks to members
- Set task priority: `LOW`, `MEDIUM`, `HIGH`, `URGENT`
- Set due dates
- Track task status: `TODO`, `IN_PROGRESS`, `REVIEW`, `DONE`
- Delete tasks as Admin

### Dashboard

- Total tasks
- Active projects
- Overdue tasks
- Completion percentage
- Status breakdown
- Urgent and overdue task list

### Frontend Experience

- Dark liquid-glass visual design
- Responsive layout for desktop, tablet, and mobile
- Toast notifications
- Hover animations
- Keyboard focus states
- Higher contrast controls and text
- Polished cards, panels, sidebar, and task board

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React, Vite, CSS |
| Icons | Lucide React |
| Backend | Node.js, Express |
| Database | MongoDB |
| ODM | Mongoose |
| Auth | JWT, bcrypt |
| Validation | Zod |
| Deployment | Railway |

## Folder Structure

```text
team-task-manager/
  server/
    index.js        # Express API, MongoDB models, auth, RBAC, REST routes
    seed.js         # Demo data seeding script
  src/
    lib/api.js      # Frontend API helper
    main.jsx        # React app
    styles.css      # Liquid-glass responsive UI
  index.html
  package.json
  railway.json
  README.md
```

## Local Setup

Install dependencies:

```bash
npm install
```

Create a `.env` file:

```env
MONGODB_URI="mongodb+srv://USER:ENCODED_PASSWORD@CLUSTER/team-task-manager?retryWrites=true&w=majority&appName=Cluster0"
JWT_SECRET="replace-with-a-long-random-secret"
PORT=8080
```

If your MongoDB password contains special characters, URL-encode them. For example, `@` becomes `%40`.

Seed demo data:

```bash
npm run db:seed
```

Start development:

```bash
npm run dev
```

Open:

```text
http://localhost:5173
```

## Demo Accounts

After running `npm run db:seed`:

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@ethara.app` | `Admin@123` |
| Member | `member@ethara.app` | `Member@123` |

## Production Build

```bash
npm run build
npm start
```

Open:

```text
http://localhost:8080
```

## Railway Deployment

1. Push the project to GitHub.
2. Create a new Railway project.
3. Select "Deploy from GitHub repo".
4. Add these environment variables in Railway:

```env
MONGODB_URI=your_mongodb_connection_string
JWT_SECRET=your_long_random_secret
PORT=8080
```

5. Railway will use `railway.json`:

```json
{
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm run build"
  },
  "deploy": {
    "startCommand": "npm start"
  }
}
```

6. Deploy and copy the live URL.

## API Routes

### Auth

| Method | Route | Access | Description |
| --- | --- | --- | --- |
| POST | `/api/auth/signup` | Public | Create account |
| POST | `/api/auth/login` | Public | Login user |
| GET | `/api/auth/me` | Authenticated | Get current user |

### Dashboard

| Method | Route | Access | Description |
| --- | --- | --- | --- |
| GET | `/api/dashboard` | Authenticated | Get task/project analytics |

### Users

| Method | Route | Access | Description |
| --- | --- | --- | --- |
| GET | `/api/users` | Authenticated | List users for assignment |

### Projects

| Method | Route | Access | Description |
| --- | --- | --- | --- |
| GET | `/api/projects` | Authenticated | List visible projects |
| POST | `/api/projects` | Admin | Create project |
| POST | `/api/projects/:projectId/members` | Admin | Add project member |
| DELETE | `/api/projects/:projectId/members/:userId` | Admin | Remove project member |

### Tasks

| Method | Route | Access | Description |
| --- | --- | --- | --- |
| POST | `/api/projects/:projectId/tasks` | Admin | Create task |
| PATCH | `/api/tasks/:taskId` | Admin/Assigned Member | Update task |
| DELETE | `/api/tasks/:taskId` | Admin | Delete task |

## Demo Video Script

Use this flow for a 2-5 minute submission video:

1. Open the live Railway URL.
2. Login as Admin.
3. Show the dashboard metrics.
4. Create a new project.
5. Add a Member by email.
6. Create a task with priority and due date.
7. Assign the task to the Member.
8. Logout and login as Member.
9. Update the assigned task status.
10. Login as Admin again and show the dashboard progress update.

## Validation And Security

- Passwords are never stored directly.
- JWT is required for protected routes.
- Admin-only APIs are protected on the backend.
- Members cannot edit other members' task details.
- Task assignees must be valid project members.
- Zod validates request bodies.
- Mongoose schemas define relationships and constraints.

## Submission Checklist

- Live Railway URL added above
- GitHub repository URL added above
- README completed
- Demo video recorded
- MongoDB password rotated if it was shared anywhere
- Strong production `JWT_SECRET` configured in Railway
