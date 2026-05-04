# Flow State — Product Documentation

Flow State is a focus and productivity web app that combines a Pomodoro/stopwatch timer, Kanban task boards, session analytics, and a Today view into one cohesive experience. The core idea is that every focus session can be linked to a specific task card, and that linkage surfaces in both the card detail and the analytics dashboard.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| UI | React 19, Tailwind CSS v4, shadcn/ui + Radix UI |
| Auth | Auth.js v5 (NextAuth) — Google OAuth |
| Database | PostgreSQL (Neon) via Prisma ORM |
| Drag and drop | @dnd-kit/core + @dnd-kit/sortable |
| Markdown | @uiw/react-md-editor |
| Audio | Web Audio API (no external library) |
| Testing | Vitest + fast-check (property-based testing) |

---

## Authentication

Sign-in is handled entirely by Auth.js v5 with Google OAuth. There is no email/password option.

**Flow:**
1. Unauthenticated users land on the marketing page at `/`.
2. Clicking "Sign in with Google" triggers the Auth.js OAuth redirect.
3. On first sign-in, a `User` row is created in the database (keyed on the Google account ID).
4. On every subsequent sign-in, `lastSeenAt` is updated on the `User` row.
5. After successful authentication, the user is redirected to `/today`.

All routes under `/(app)` — `/today`, `/focus`, `/boards`, `/analytics`, `/settings` — are protected by an auth check in the layout. Unauthenticated requests are redirected to `/`. All API routes return `401` if the session is missing.

User settings (timer durations, sound/notification preferences) are stored on the `User` model in the database and synced to the client on load.

---

## App Shell

The authenticated app wraps all pages in a shared layout that includes:

- **Sidebar** — a fixed dark navigation panel on the left
- **TimerProvider** — a React context that owns all timer state
- **FloatingWidget** — a bottom-right overlay that appears when the timer is running or paused
- **SessionCompleteModal** — a dialog that appears when a focus phase ends
- **CommandPalette** — a global search overlay triggered by `Cmd+K` / `Ctrl+K`

### Sidebar

The sidebar shows navigation links for Today, Focus, Analytics, and Settings. The Boards section is expandable — clicking the chevron fetches and lists all active boards. The active route is highlighted. The sidebar is always visible on authenticated pages.

---

## Timer

The timer is the central feature of the app. It lives in `TimerContext` and is persisted to `localStorage` so it survives page navigation and browser refreshes.

### Modes

**Pomodoro** — structured focus/break cycles:
- Focus phase (default 25 min)
- Short break (default 5 min)
- Long break (default 15 min), triggered after every N focus phases (default 4)

**Stopwatch** — counts up from zero. An optional maximum duration can be configured; when reached, the timer stops and the session modal appears.

### State

The timer tracks:
- `mode` — `pomodoro` or `stopwatch`
- `phase` — `focus`, `shortBreak`, or `longBreak`
- `status` — `idle`, `running`, or `paused`
- `elapsed` — seconds accumulated before the last pause
- `startedAt` — `Date.now()` timestamp when the timer was last started or resumed
- `cycleCount` — number of completed focus phases in the current cycle
- `selectedTagId` — tag to associate with the next session
- `selectedTaskId` — card to link the next session to
- `settings` — all duration and interval values

`totalElapsed` is computed as `elapsed + (Date.now() - startedAt) / 1000` while running. `remainingSeconds` is `currentDuration - totalElapsed`.

### Controls

- **Start** — begins the timer from idle
- **Pause** — freezes elapsed time
- **Resume** — continues from paused
- **Stop** — resets elapsed to 0, returns to idle
- **Reset** — stops and resets phase and cycle count
- **Skip Phase** — immediately transitions to the next phase (Pomodoro only)

### Phase Transitions

When elapsed time reaches the phase duration:
1. A tone plays via the Web Audio API (if sound is enabled)
2. A browser notification is sent (if permission was granted)
3. If the completed phase was a focus phase, the `SessionCompleteModal` appears
4. The timer transitions to the next phase and returns to idle

Phase sequence: focus → shortBreak (or longBreak every N cycles) → focus → ...

### Persistence

On every state change, the full timer state is serialized to `localStorage`. On mount, the state is rehydrated. If the timer was running when the page was closed, the elapsed time is recalculated from `startedAt + Date.now()` so the timer picks up where it left off. If the recalculated elapsed exceeds the phase duration, the phase is immediately marked complete.

### Visual Display

The `TimerDisplay` component renders an SVG circular progress ring. The arc angle is computed as `(elapsed / duration) * 2π`. The ring color changes by phase: amber for focus, violet for short break, indigo for long break, cyan for stopwatch.

### Floating Widget

The `FloatingWidget` is a fixed bottom-right overlay visible whenever the timer is running or paused. It shows the remaining time, phase label, and — when a task is linked — the card title (fetched from `/api/cards/[id]` and cached in a ref).

---

## Session Complete Modal

When a focus phase (Pomodoro or Stopwatch) ends, the `SessionCompleteModal` appears. It collects:
- **Tag** — optional, via the tag selector
- **Focus score** — optional, 1–10 rating
- **Notes** — optional free text

On submit, the session is POSTed to `/api/focus-sessions`. If the POST fails, the modal stays open with an error message and a retry button — the session data is preserved in context state until successfully submitted. The user can also skip without saving.

---

## Tags

Tags are user-defined labels with a name and a hex color. They are used to categorize focus sessions.

**CRUD:**
- `GET /api/tags` — list all tags for the user
- `POST /api/tags` — create a tag (name must be unique per user)
- `PUT /api/tags/[id]` — rename or recolor
- `DELETE /api/tags/[id]` — hard delete; all sessions that referenced the tag have their `tagId` set to `null`

The `TagManager` modal provides a UI for creating, editing, and deleting tags. The `TagSelector` dropdown is used on the Focus page and in the Session Complete Modal to associate a tag with the upcoming session.

---

## Focus Page

The Focus page (`/focus`) is the primary timer interface. It renders:
- The `TimerDisplay` component with mode toggle (Pomodoro / Stopwatch)
- A **Task Picker** — searchable dropdown listing all non-archived, non-terminal cards across all boards; selecting a card calls `setSelectedTaskId` on the timer context
- A **Tag Selector** — associates a tag with the session
- A collapsible **Timer Settings** panel for adjusting durations inline

---

## Boards

Boards are Kanban-style workspaces. Each board has a name, a color, and can be starred or archived.

**Board list (`/boards`):**
- Shows all active (non-archived) boards, starred boards first
- "New Board" button opens a creation dialog
- Each board card shows the name, color swatch, star toggle, and archive action

**Board view (`/boards/[id]`):**
- Defaults to Kanban view; can be toggled to List view (persisted in `localStorage` per board)
- The board page fetches the full board with all columns and cards on load

### Columns

Each board contains an ordered list of columns. Columns have:
- A name
- An optional WIP (work-in-progress) limit — when the card count meets or exceeds the limit, the column header shows a visual indicator and new cards/drops are blocked
- A collapse toggle — hides cards while keeping the header visible
- A `position` (Float) for ordering

**API:**
- `POST /api/boards/[id]/columns` — create a column
- `PUT /api/columns/[id]` — rename, update WIP limit, toggle collapse
- `DELETE /api/columns/[id]` — delete; if cards exist, a `destinationColumnId` must be provided to move them first

### Cards

Cards are the task items within columns. Each card has:
- Title
- Description (Markdown, stored as raw string)
- Status (`TODO`, `IN_PROGRESS`, `IN_REVIEW`, `DONE`, `CANCELLED`)
- Due date (overdue cards are highlighted in red when status is not terminal)
- Estimated minutes
- Actual minutes (incremented when a linked session completes)
- Completed Pomodoros count
- Labels (board-scoped, distinct from tags)
- Subtasks
- Comments
- Activity log

**API:**
- `POST /api/columns/[id]/cards` — create a card (enforces WIP limit)
- `GET /api/cards/[id]` — fetch card with subtasks, labels, comments, activity
- `PUT /api/cards/[id]` — update title, description, due date, status, estimated minutes
- `DELETE /api/cards/[id]` — soft delete (`isArchived = true`)
- `POST /api/cards/[id]/move` — move card to a new column/position

### Kanban View

The Kanban view renders columns in a horizontal scrollable container. Each column shows its cards as a vertical list. Cards display the title, due date (with overdue highlight), label chips, subtask progress bar, and completed Pomodoro count.

### Drag and Drop

Drag and drop is powered by `@dnd-kit`. Cards can be dragged within a column (reorder) or between columns.

**Position system:** Card positions use fractional indexing (`Float`). When a card is moved between positions A and B, its new position is `(A + B) / 2`. When the gap between adjacent positions falls below `0.001`, all positions in the affected column are rebalanced to integers `1, 2, 3, ...`.

**WIP limit enforcement:** In `onDragOver`, if the destination column's card count equals its `cardLimit`, the drop is blocked and a toast warning is shown.

**Optimistic updates:** Local state is updated immediately on drag end. The `POST /api/cards/[id]/move` call happens in the background. On error, the state is reverted and a toast is shown.

**Drag overlay:** While dragging, a `DragOverlay` renders the card title floating under the cursor.

### List View

The List view renders all cards across all columns in a flat, sortable table. Columns: title, column name, due date (overdue highlight), labels, subtask progress, completed Pomodoros. Clicking a row opens the Card Detail Modal.

### Card Detail Modal

Clicking any card opens the `CardDetailModal` — a full-screen overlay with all card fields editable:

- **Title** — inline edit, saves on blur or Enter
- **Description** — `@uiw/react-md-editor` with edit/preview toggle; raw Markdown is stored and retrieved byte-for-byte
- **Due date** — date picker; overdue cards show the field in red
- **Labels** — multi-select from board-scoped labels; labels can be created inline
- **Subtasks** — checklist with add/delete; progress bar shows completion ratio
- **Comments** — chronological list with author avatar, timestamp, edit, and delete
- **Activity log** — read-only chronological list of field changes (title, description, due date, status, estimated time)

All mutations use optimistic updates — the UI updates immediately and reverts on API error with a toast notification.

---

## Today View

The Today page (`/today`) shows a two-column layout: a task list on the left and the timer on the right.

**Task list** shows cards that satisfy at least one of:
- Due date is today
- Due date is in the past with a non-terminal status (overdue)
- Status is `IN_PROGRESS`

Each task item shows the card title, board/column context, due date, overdue indicator, and subtask progress. Clicking the title opens the Card Detail Modal. Clicking the item selects it (radio-style).

When a card is selected and the timer is idle, a "Start timer with selected task" button appears at the bottom of the list. Clicking it calls `setSelectedTaskId` and `start()` on the timer context, linking the session to that card.

---

## Analytics

The Analytics page (`/analytics`) has six tabs. All computation is done client-side using pure functions in `src/lib/analytics.ts` — the page fetches raw session and tag data once on mount and passes it to these functions.

### Overview Tab
- Total focus time today
- Sessions today
- Current streak (days) and longest streak
- Lifetime total focus time
- Calendar heatmap — 53×7 SVG grid showing daily focus minutes for the trailing 12 months; color intensity scales with minutes
- Top 5 tasks by focus time

### Day Tab
- Date picker
- Total focus time, session count, average focus score for the selected day
- Donut chart — focus time distribution by tag
- Session timeline — each session rendered as a time-positioned block
- Per-task breakdown table (actual vs estimated minutes)

### Week Tab
- Week picker (ISO week)
- Total focus time, session count, average focus score for the selected week
- Donut chart by tag
- Bar chart — daily focus time for each day of the week
- Per-task breakdown table

### Month Tab
- Month picker
- Total focus time, session count, average focus score
- Auto-generated insight (e.g. "Most productive day: Wednesday. Active 18 of 31 days (58% consistency).")
- Monthly heatmap grid
- Donut chart by tag
- Per-task breakdown table

### Year Tab
- Year picker
- Total focus time and session count
- Quarterly breakdown (Q1–Q4)
- Monthly trend line chart
- Yearly highlights: most productive month, longest streak, top 5 tasks

### Calendar Tab
- Monthly calendar grid (weeks × days, Sunday–Saturday)
- Each day cell shows total focus minutes (color-coded) and due cards as chips
- Clicking a day opens a day detail panel showing sessions and due cards
- Clicking a card in the day detail panel opens the Card Detail Modal
- Previous/next month navigation

### Chart Components

All charts are custom SVG — no charting library:
- **DonutChart** — arc paths computed with `Math.sin`/`Math.cos`; centered total label
- **CalendarHeatmap** — 53×7 grid with week/month labels; tooltip on hover
- **BarChart** — vertical bars with Y-axis grid lines and hover tooltips
- **LineChart** — monthly trend line with data point markers
- **SessionTimeline** — sessions rendered as time-positioned blocks within a day

---

## Settings

The Settings page (`/settings`) lets users configure:

- **Focus duration** (minutes)
- **Short break duration** (minutes)
- **Long break duration** (minutes)
- **Long break interval** (focus phases before a long break)
- **Sound** — toggle; plays a Web Audio API tone at phase transitions
- **Browser notifications** — toggle; requests browser permission when enabled; sends a notification at each phase transition

On save, settings are persisted to the database via `PUT /api/settings` and immediately synced into `TimerContext`. Server-fetched settings take precedence over `localStorage` values on app load.

---

## Command Palette

The command palette opens with `Cmd+K` (macOS) or `Ctrl+K` (Windows/Linux) from anywhere in the app.

It searches across:
- **Boards** — by name; selecting navigates to the board
- **Cards** — by title; selecting navigates to the board containing the card
- **Navigation** — Today, Focus, Analytics, Settings

Results are filtered as a case-insensitive substring match. Arrow keys navigate the list; Enter selects; Escape closes.

When the query is empty, the palette shows a keyboard shortcuts reference.

**Keyboard shortcuts registered in the app:**
- `Cmd+K` / `Ctrl+K` — open command palette
- `N` on the boards page — open "New Card" form on the first column
- `B` anywhere — focus the Boards section in the sidebar
- `F` anywhere — navigate to `/focus`

---

## Data Model

Key relationships in the Prisma schema:

```
User
  ├── PomodoroLog[]   (focus sessions)
  ├── Tag[]           (session categories)
  ├── Board[]
  │     ├── Column[]
  │     │     └── Card[]
  │     │           ├── Subtask[]
  │     │           ├── CardLabel[]  → Label
  │     │           ├── Comment[]
  │     │           ├── CardActivity[]
  │     │           └── PomodoroLog[]  (linked sessions)
  │     └── Label[]
  └── Comment[]
```

**Notable design choices:**
- `Card.position` and `Column.position` are `Float` for fractional indexing
- Cards use soft deletion (`isArchived`) rather than hard delete
- `CardStatus` is a denormalized enum on `Card` — updated when a card is moved to a column whose name matches a terminal state (e.g. "Done" → `DONE`)
- `PomodoroLog.tagId` uses `SET NULL` on tag deletion (no orphaned references)
- `PomodoroLog.taskId` links sessions to cards; the `POST /api/focus-sessions` handler atomically increments `card.actualMinutes` and (for Pomodoro sessions) `card.completedPomodoros`

---

## API Overview

All API routes are under `src/app/api/`. Every handler calls `auth()` from Auth.js at the top and returns `401` if the session is missing. Validation failures return `422` with field-level error details.

| Route | Methods | Purpose |
|---|---|---|
| `/api/focus-sessions` | GET, POST | List/create focus sessions |
| `/api/tags` | GET, POST | List/create tags |
| `/api/tags/[id]` | PUT, DELETE | Update/delete a tag |
| `/api/boards` | GET, POST | List/create boards |
| `/api/boards/[id]` | GET, PUT, DELETE | Single board CRUD |
| `/api/boards/[id]/columns` | POST | Create a column |
| `/api/boards/[id]/labels` | POST | Create a board label |
| `/api/columns/[id]` | PUT, DELETE | Update/delete a column |
| `/api/columns/[id]/cards` | POST | Create a card |
| `/api/cards/today` | GET | Cards due today / overdue / in-progress |
| `/api/cards/tasks` | GET | All non-archived, non-terminal cards (for task picker) |
| `/api/cards/[id]` | GET, PUT, DELETE | Single card CRUD |
| `/api/cards/[id]/move` | POST | Move card to new column/position |
| `/api/cards/[id]/subtasks` | POST | Create a subtask |
| `/api/cards/[id]/labels` | POST | Attach a label to a card |
| `/api/cards/[id]/labels/[labelId]` | DELETE | Detach a label from a card |
| `/api/cards/[id]/comments` | POST | Create a comment |
| `/api/subtasks/[id]` | PUT, DELETE | Toggle/rename/delete a subtask |
| `/api/labels/[id]` | PUT, DELETE | Update/delete a board label |
| `/api/comments/[id]` | PUT, DELETE | Edit/delete a comment |
| `/api/settings` | GET, PUT | Fetch/update user settings |

---

## Running Locally

1. Copy `.env.example` to `.env` and fill in:
   - `DATABASE_URL` — Neon PostgreSQL connection string
   - `NEXTAUTH_SECRET` — any random string (e.g. `openssl rand -base64 32`)
   - `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` — from Google Cloud Console

2. Install dependencies:
   ```bash
   npm install
   ```

3. Apply database migrations:
   ```bash
   npx prisma migrate deploy
   ```

4. Start the development server:
   ```bash
   npm run dev
   ```

5. Open `http://localhost:3000`.

### Running Tests

```bash
npx vitest run
```

Tests use Vitest + fast-check. Property-based tests run 100 iterations each and cover timer state persistence, phase transitions, analytics aggregation, tag uniqueness, WIP limit enforcement, card move round-trips, and command palette search completeness.
