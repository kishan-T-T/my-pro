# 🚀 Project Board - Backend (Supabase Edition)

Live Frontend: https://projectboard-application.vercel.app/  
Backend Repository: https://github.com/kishan-T-T/PRODUCT-BOARD  

---

## 🛠️ Setting Up with Supabase

### 0. Connect the Supabase CLI (one time)
```bash
npm install -g supabase        # or: npx supabase <command>
supabase login                 # opens browser to authenticate
supabase init                  # creates supabase/config.toml (keeps existing schema + migrations)
supabase link --project-ref huklxqcwsgmuqohwkrme
supabase db push               # applies supabase/migrations/* to the linked project
```
`supabase db push` asks for your **database password** (Dashboard -> Project Settings -> Database).
Project URL: `https://huklxqcwsgmuqohwkrme.supabase.co`

### 1. Create Your Supabase Tables (alternative to `db push`)
1. Open your project in the [Supabase Dashboard](https://supabase.com/dashboard).
2. Navigate to **SQL Editor** -> **New Query**.
3. Copy and paste the contents of [`supabase/schema.sql`](./supabase/schema.sql) and click **Run**.
   - This creates the `users`, `projects`, `members`, `tasks`, `history`, and `comments` tables, indexes, `updated_at` triggers, and an automatic trigger (`on_auth_user_created`) that syncs new Supabase Auth signups into `public.users`.

### 2. Configure Environment Variables
Create a `.env` file in the project root (see `.env.example`):

```env
PORT=5000
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
SUPABASE_ANON_KEY=your-supabase-anon-key
CLIENT_ORIGIN_URL=http://localhost:3000

# Optional: Only needed if you use Auth0 instead of Supabase Auth
AUTH0_AUDIENCE=
AUTH0_DOMAIN=
```

> **Note:** Use your `service_role` key for `SUPABASE_SERVICE_ROLE_KEY` on the backend so the Express server can manage project memberships, tasks, and history across project members while enforcing permissions through the API middlewares.

### 3. Install Dependencies & Run
```bash
npm install
# or
yarn install

# Start in development mode
npm run dev

# Start in production mode
npm start
```

---

## ✅ Summary of Fixes & Improvements
- **Supabase Database Migration**: Replaced Mongoose/MongoDB models (`User`, `Project`, `Member`, `Task`, `History`, `Comment`) with Supabase (`@supabase/supabase-js`) while preserving `_id`/`id` and nested populated response structures for full compatibility with the existing frontend.
- **Supabase Auth + Auth0 Support**: `authMiddleware.js` and `authorizeMiddleware.js` validate Supabase Auth JWTs (UUID `sub`) out of the box and remain backward-compatible with Auth0 JWTs (`provider|id` `sub`).
- **Fixed Middleware Bugs**:
  - `authorizeMiddleware.js`: Fixed missing `else` branch that caused requests without a `Bearer` header to hang indefinitely, and added missing `return` when the token string is empty.
  - `isAdminInProjectMiddleware.js`: Fixed premature `req.user.isAdmin = true` assignment before verifying admin membership, and added `:id` route parameter support.
  - `projectRoutes.js`, `memberRoutes.js`, `historyRoutes.js`: Added missing project access and admin authorization checks on project detail, update, delete, member list, and history routes.
- **Fixed Controller Bugs**:
  - `memberController.js`: Fixed missing `return` and misplaced `404` status argument in `addMemberToProject`, aligned member limit error message (`5` members), and added null check before reading `member.access` in `deleteAmemberFromProject`.
  - `tasksController.js`: Fixed `getTaskById` populate logic, fixed `updateTask` passing the wrapper `history` object instead of individual history entries to `User.populate`, guarded `updatedTask.assignee` against null dereference, replaced deprecated `.remove()`, and fixed same-column drag-and-drop task ordering in `updateTaskStatusInBoard`.
  - `projectController.js`: Added missing `404` check in `updateProject` and replaced deprecated `project.remove()`.
  - `errorController.js`: Preserved non-enumerable `Error` properties (`name`, `message`) in production error handling, guarded duplicate-field regex match against null, and ensured JSON error responses are always returned.
  - `app.js` & `initDB.js`: Awaited `connectDB()` before starting the HTTP/Socket.io server, added default port fallback (`5000`), and guarded Socket.io event handlers against malformed payloads.
