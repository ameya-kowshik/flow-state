# Implementation Plan: Flow State App

## Overview

Incremental build following the agreed phase order: Auth → Timer → Tags → Analytics → Boards/Columns/Cards → Drag-and-Drop → Card Detail → List View → Task-Timer Integration → Today View → Task Analytics → Command Palette → Calendar View. Each phase wires into the previous one. All code is TypeScript; tests use Vitest + fast-check.

## Tasks

---

## Phase 1: Auth + DB Schema + User Sync

- [x] 1. Set up Prisma schema and database connection
  - Install and configure Prisma with the Neon PostgreSQL connection string
  - Define all models: `User`, `PomodoroLog`, `Tag`, `Board`, `Column`, `Card`, `Subtask`, `Label`, `CardLabel`, `Comment`, `CardActivity`
  - Include all fields, relations, indexes, and constraints described in the design (position as `Float`, soft-delete `isArchived`, `CardStatus` enum, etc.)
  - Add `lastSeenAt DateTime?` to the `User` model; update `verifyAuth` upsert to set this field on every login
  - Run `prisma migrate dev` to create the initial migration
  - _Requirements: 1.2, 1.3, 6.1_

- [x] 2. Configure Auth.js v5 (NextAuth) with Google OAuth and Prisma adapter
  - Install `next-auth@beta` and `@auth/prisma-adapter`
  - Create `src/lib/auth.ts` — Auth.js config with Google provider, Prisma adapter, and a `signIn` callback that upserts the `User` row with `lastSeenAt` on every login
  - Create `src/app/api/auth/[...nextauth]/route.ts` — the Auth.js catch-all route handler
  - Create `src/lib/prisma.ts` — Prisma client singleton with global caching for dev hot-reload
  - _Requirements: 1.1, 1.2, 1.3, 1.7, 6.4_

  - [ ]* 2.1 Write property test for user upsert round-trip
    - **Property 1: User upsert round-trip**
    - **Validates: Requirements 1.2**

  - [ ]* 2.2 Write property test for unauthenticated request rejection
    - **Property 2: Unauthenticated requests are rejected**
    - **Validates: Requirements 1.7, 6.4**

- [x] 3. Implement sign-in UI on the landing page
  - Create `src/app/(marketing)/page.tsx` — landing/marketing page with a "Sign in with Google" button using Auth.js `signIn('google')` client action
  - Map Auth.js error codes to user-friendly messages
  - On successful sign-in redirect to `/today`
  - _Requirements: 1.1, 1.4, 1.5, 1.6_

- [x] 4. Implement the `(app)` layout with auth guard
  - Create `src/app/(app)/layout.tsx` — calls `auth()` from Auth.js; redirects unauthenticated users to `/`
  - Wrap layout with `TimerProvider` (stub for now) and render `<Sidebar />` and `<FloatingWidget />` placeholders
  - _Requirements: 1.7, 2.1, 2.4_

- [x] 5. Implement the Settings page and `PUT /api/settings`
  - Create `src/app/(app)/settings/page.tsx` — renders controls for default Pomodoro durations (focus, shortBreak, longBreak), longBreak interval, sound toggle, and browser notification toggle
  - Create `src/app/api/settings/route.ts` — `GET` (fetch user settings from DB) and `PUT` (persist updated settings to DB); use `auth()` from Auth.js for session; store settings as fields on the `User` model
  - On save, update the DB and immediately sync the new values into `TimerContext` via `setSettings` / `setSoundEnabled` / `setNotificationsEnabled`
  - On app load, server-fetched settings take precedence over localStorage
  - WHEN the User enables browser notifications, call `requestNotificationPermission()` from `src/lib/audio.ts`
  - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5_

- [x] 6. Checkpoint — ensure Prisma migrations apply cleanly and `verifyAuth` unit tests pass
  - Ensure all tests pass, ask the user if questions arise.

---

## Phase 2: Timer (Pomodoro + Stopwatch) + Session Save + localStorage Persistence

- [x] 6. Implement `TimerContext` and `TimerProvider`
  - Create `src/contexts/TimerContext.tsx` with the full `TimerState` and `TimerContextValue` interfaces from the design
  - Implement all actions: `start`, `pause`, `resume`, `stop`, `reset`, `skipPhase`, `setMode`, `setSettings`, `setSoundEnabled`, `setNotificationsEnabled`, `setSelectedTagId`, `setSelectedTaskId`
  - Implement the 1-second `setInterval` tick that recomputes `totalElapsed` and `remainingSeconds`
  - Implement phase-transition logic: focus → shortBreak / longBreak based on `cycleCount % longBreakInterval`
  - Implement `serializeTimerState` / `deserializeTimerState` helpers for localStorage
  - On mount, read from localStorage and recalculate elapsed from `startedAt + Date.now()` to handle page-closed case
  - _Requirements: 3.1, 3.3, 3.4, 3.5, 3.12, 4.1, 4.3, 4.4_

  - [ ]* 6.1 Write property test for timer phase transition
    - **Property 3: Timer phase transition — focus to break**
    - **Validates: Requirements 3.3, 3.4**

  - [ ]* 6.2 Write property test for timer state persistence round-trip
    - **Property 4: Timer state persistence round-trip**
    - **Validates: Requirements 3.12, 4.4**

  - [ ]* 6.3 Write property test for timer duration settings validation
    - **Property 6: Timer duration settings are positive integers**
    - **Validates: Requirements 3.13**

  - [ ]* 6.4 Write property test for stopwatch monotonicity
    - **Property 7: Stopwatch elapsed time is non-negative and monotonically increasing**
    - **Validates: Requirements 4.1**

  - [ ]* 6.5 Write property test for stopwatch max duration stop
    - **Property 8: Stopwatch stops at max duration**
    - **Validates: Requirements 4.2**

- [ ] 7. Implement `TimerDisplay` and `FloatingWidget` components
  - Create `src/components/timer/TimerDisplay.tsx` — SVG circular progress ring computing arc angle as `(elapsed / duration) * 2π`; render Start/Pause/Resume/Stop/Reset/Skip controls
  - Create `src/components/timer/FloatingWidget.tsx` — bottom-right fixed overlay showing remaining time and phase; visible only when timer status is `running` or `paused`
  - Wire both components to `TimerContext`
  - _Requirements: 3.2, 3.5, 3.9, 2.4, 2.5_

  - [ ]* 7.1 Write property test for SVG progress ring proportion
    - **Property 5: Timer progress ring proportion**
    - **Validates: Requirements 3.2**

- [ ] 8. Implement `src/lib/audio.ts` and browser notifications
  - Implement `playTransitionTone()` using the Web Audio API (oscillator + gain envelope)
  - Implement `requestNotificationPermission()` and `sendPhaseNotification(phase)` helpers
  - Call these from `TimerProvider` on phase transition, guarded by `soundEnabled` / `notificationsEnabled`
  - _Requirements: 3.7, 3.8, 18.3, 18.4_

- [ ] 9. Implement `SessionCompleteModal` and `POST /api/focus-sessions`
  - Create `src/components/timer/SessionCompleteModal.tsx` — shown when a focus phase completes; collects `focusScore` (1–10) and optional notes; preserves session data in state until successfully submitted
  - Create `src/app/api/focus-sessions/route.ts` — `GET` (paginated, filterable by date range / tagId / sessionType) and `POST` (validate payload, return 422 with field errors on failure, 201 on success)
  - On successful POST, if session has a `taskId`, run a Prisma transaction to increment `card.actualMinutes` and (if POMODORO) `card.completedPomodoros`
  - _Requirements: 3.10, 3.11, 6.1, 6.2, 6.3, 6.4, 6.5, 16.2, 16.3_

  - [ ]* 9.1 Write property test for session POST/GET round-trip
    - **Property 12: Session POST/GET round-trip**
    - **Validates: Requirements 6.1, 6.2**

  - [ ]* 9.2 Write property test for session filter correctness
    - **Property 13: Session filter correctness**
    - **Validates: Requirements 6.3**

  - [ ]* 9.3 Write property test for invalid session payload returning 422
    - **Property 14: Invalid session payload returns 422**
    - **Validates: Requirements 6.5**

- [ ] 10. Implement the Focus page
  - Create `src/app/(app)/focus/page.tsx` — renders `<TimerDisplay />` with mode toggle (Pomodoro / Stopwatch), settings panel for durations, and a tag selector (stub for now, wired in Phase 3)
  - _Requirements: 3.1, 3.13, 4.1, 4.2, 4.3, 5.5_

- [ ] 11. Checkpoint — timer runs, persists across refresh, session saves to DB
  - Ensure all tests pass, ask the user if questions arise.

---

## Phase 3: Tags + Tag Selector

- [ ] 12. Implement Tags API
  - Create `src/app/api/tags/route.ts` — `GET` (all tags for user) and `POST` (create tag with name + hex color; enforce unique name per user, return 422 on duplicate)
  - Create `src/app/api/tags/[id]/route.ts` — `PUT` (rename / recolor) and `DELETE` (hard delete; Prisma cascade sets `PomodoroLog.tagId = null`)
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.6_

  - [ ]* 12.1 Write property test for tag creation round-trip
    - **Property 9: Tag creation round-trip**
    - **Validates: Requirements 5.1, 5.2**

  - [ ]* 12.2 Write property test for tag deletion disassociating sessions
    - **Property 10: Tag deletion disassociates sessions**
    - **Validates: Requirements 5.4**

  - [ ]* 12.3 Write property test for tag name uniqueness per user
    - **Property 11: Tag names are unique per user**
    - **Validates: Requirements 5.6**

- [ ] 13. Implement `TagManager` modal and tag selector component
  - Create `src/components/tags/TagManager.tsx` — modal listing all tags with inline edit (name + color picker) and delete; create-new form at the bottom
  - Create `src/components/tags/TagSelector.tsx` — dropdown/popover for selecting one tag; used in the Focus page and `SessionCompleteModal`
  - Wire `TagSelector` into `TimerContext` via `setSelectedTagId`; wire into the Focus page (replacing the stub from Phase 2)
  - _Requirements: 5.1, 5.2, 5.3, 5.5_

- [ ] 14. Checkpoint — tags CRUD works, tag selector wired to timer
  - Ensure all tests pass, ask the user if questions arise.

---

## Phase 4: Analytics (All 5 Tabs, Client-Side)

- [ ] 15. Implement `src/lib/analytics.ts` — pure computation functions
  - Implement all functions: `computeStreaks`, `computeTagDistribution`, `computeCalendarData`, `computeDailyBreakdown`, `computeMonthlyBreakdown`, `computeQuarterlyBreakdown`, `computeGrowthRate`, `computeConsistencyScore`
  - All functions are pure — no side effects, no DB calls
  - _Requirements: 7.1, 7.2, 8.1, 8.2, 9.1, 9.2, 10.1, 10.2, 10.3, 11.1, 11.2_

  - [ ]* 15.1 Write property test for analytics aggregation correctness
    - **Property 15: Analytics aggregation correctness**
    - **Validates: Requirements 7.1, 8.1, 9.1, 10.1, 11.1**

  - [ ]* 15.2 Write property test for calendar heatmap coverage
    - **Property 16: Calendar heatmap covers trailing 12 months**
    - **Validates: Requirements 7.2**

  - [ ]* 15.3 Write property test for tag distribution sums to total
    - **Property 17: Tag distribution sums to total**
    - **Validates: Requirements 8.2, 9.2, 10.3**

- [ ] 16. Implement SVG chart components
  - Create `src/components/analytics/DonutChart.tsx` — pure SVG donut chart accepting `segments: { value, color, label }[]`; compute arc paths with `Math.sin`/`Math.cos`; render centered total label
  - Create `src/components/analytics/CalendarHeatmap.tsx` — pure SVG 53×7 grid; accept `cells: CalendarCell[]` and a `colorScale` function; render week/month labels; show tooltip on hover
  - Create `src/components/analytics/SessionTimeline.tsx` — renders each session as a time-positioned block for the Day tab
  - Create `src/components/analytics/BarChart.tsx` — bar chart for weekly daily breakdown (Week tab)
  - Create `src/components/analytics/LineChart.tsx` — monthly trend line for Year tab
  - _Requirements: 7.2, 7.3, 8.2, 8.3, 9.2, 9.3, 10.2, 10.3, 11.2, 11.3_

- [ ] 17. Implement the Analytics page with all 5 tabs
  - Create `src/app/(app)/analytics/page.tsx` — fetches all sessions and tags for the user; passes raw arrays to analytics functions; renders tabs: Overview, Day, Week, Month, Year using shadcn/ui `Tabs`
  - Overview tab: total today, sessions today, current streak, longest streak, lifetime total, `<CalendarHeatmap />`
  - Day tab: date picker, totals, `<DonutChart />` by tag, `<SessionTimeline />`
  - Week tab: week picker, totals, `<DonutChart />` by tag, `<BarChart />` daily breakdown
  - Month tab: month picker, totals, monthly heatmap, `<DonutChart />` by tag, auto-generated insight
  - Year tab: year picker, totals, quarterly breakdown, `<LineChart />` monthly trend, yearly highlights
  - Show skeleton/error state with retry button on fetch failure
  - _Requirements: 7.1, 7.2, 7.3, 8.1, 8.2, 8.3, 9.1, 9.2, 9.3, 10.1, 10.2, 10.3, 10.4, 11.1, 11.2, 11.3, 11.4_

- [ ] 18. Checkpoint — all 5 analytics tabs render correctly with real session data
  - Ensure all tests pass, ask the user if questions arise.

---

## Phase 5: Boards + Columns + Cards (Kanban, No DnD Yet)

- [ ] 19. Implement Boards API
  - Create `src/app/api/boards/route.ts` — `GET` (all active boards for user, starred first) and `POST` (create board with name + color; return 201)
  - Create `src/app/api/boards/[id]/route.ts` — `GET` (single board with columns + cards), `PUT` (rename, recolor, toggle `isStarred`, toggle `isArchived`), `DELETE` (hard delete, owner-only)
  - _Requirements: 12.1, 12.2, 12.3, 12.6_

  - [ ]* 19.1 Write property test for board creation round-trip
    - **Property 18: Board creation round-trip**
    - **Validates: Requirements 12.1**

  - [ ]* 19.2 Write property test for starred boards ordering
    - **Property 19: Starred boards appear before non-starred boards**
    - **Validates: Requirements 12.2**

  - [ ]* 19.3 Write property test for archived boards exclusion
    - **Property 20: Archived boards are excluded from active list**
    - **Validates: Requirements 12.3**

- [ ] 20. Implement Columns API
  - Create `src/app/api/boards/[id]/columns/route.ts` — `POST` (create column with name + optional `cardLimit`; append at end with next integer position)
  - Create `src/app/api/columns/[id]/route.ts` — `PUT` (rename, update `cardLimit`, toggle `isCollapsed`) and `DELETE` (prompt handled client-side; if cards exist, require `destinationColumnId` in body to move cards before deleting)
  - _Requirements: 13.1, 13.2, 13.3, 13.4_

- [ ] 21. Implement Cards API (CRUD only, no move endpoint yet)
  - Create `src/app/api/cards/[id]/route.ts` — `GET` (card with subtasks, labels, comments, activity), `PUT` (update title, description, dueDate, status, estimatedMinutes), `DELETE` (set `isArchived = true`)
  - Add card creation to `src/app/api/boards/[id]/columns/route.ts` or create a dedicated `POST /api/columns/[id]/cards` endpoint — create card with title, append at end of column
  - Enforce WIP limit on card creation: if column's `cardLimit` is set and current card count ≥ limit, return 422
  - _Requirements: 14.1, 13.2, 15.3_

  - [ ]* 21.1 Write property test for WIP limit enforcement
    - **Property 21: WIP limit enforcement**
    - **Validates: Requirements 13.2, 15.3**

  - [ ]* 21.2 Write property test for card overdue detection
    - **Property 22: Card overdue detection**
    - **Validates: Requirements 14.8**

- [ ] 22. Implement Boards page and Boards list
  - Create `src/app/(app)/boards/page.tsx` — fetches all active boards; renders board cards in a grid; starred boards first; "New Board" button opens a creation dialog
  - Create `src/components/boards/BoardCard.tsx` — displays board name, color swatch, star toggle, archive action
  - Update `src/app/(app)/layout.tsx` sidebar to list boards under the Boards nav item (Requirement 2.3)
  - _Requirements: 2.3, 12.1, 12.2, 12.3, 12.6_

- [ ] 23. Implement Kanban view (static, no DnD)
  - Create `src/app/(app)/boards/[id]/page.tsx` — fetches board with columns + cards; renders `<KanbanView />`
  - Create `src/components/boards/KanbanView.tsx` — horizontal scroll container of `<Column />` components; "Add Column" button at the end
  - Create `src/components/boards/Column.tsx` — renders column header (name, card count, WIP indicator, collapse toggle, add-card button), list of `<Card />` components; collapsed state hides cards
  - Create `src/components/boards/Card.tsx` — renders card title, due date (overdue highlight when `dueDate < now` and status not terminal), label chips, subtask progress, `completedPomodoros` count
  - _Requirements: 12.4, 13.1, 13.2, 13.3, 14.1, 14.7, 14.8_

- [ ] 24. Checkpoint — boards, columns, and cards render; CRUD operations work end-to-end
  - Ensure all tests pass, ask the user if questions arise.

---

## Phase 6: Drag-and-Drop on Board

- [ ] 25. Implement card move API with fractional indexing
  - Create `src/app/api/cards/[id]/move/route.ts` — `POST` accepting `{ columnId, position }`; update card's `columnId` and `position` in a single transaction; enforce WIP limit on destination column (return 422 if exceeded); update `CardStatus` if destination column name matches a terminal state
  - Implement position rebalancing helper: when the gap between adjacent positions falls below 0.001, renumber all positions in the affected column as integers `1, 2, 3, ...`
  - _Requirements: 15.4, 13.2_

  - [ ]* 25.1 Write property test for card move round-trip
    - **Property 23: Card move round-trip**
    - **Validates: Requirements 15.4**

- [ ] 26. Wire `@dnd-kit` into `KanbanView`
  - Install `@dnd-kit/core` and `@dnd-kit/sortable`
  - Wrap `KanbanView` in `<DndContext>` with `onDragStart`, `onDragOver`, and `onDragEnd` handlers
  - Make each `Column` a `<SortableContext>` with vertical list strategy; make each `Card` a `useSortable` item
  - `onDragOver`: check destination column WIP limit; if exceeded, cancel the drag and show a shadcn/ui toast warning
  - `onDragEnd`: compute new fractional position between neighbors; optimistically update local state; call `POST /api/cards/[id]/move`; revert optimistic update on error and show toast
  - Create `src/components/boards/DragOverlay.tsx` — renders the dragged card's title during drag
  - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5_

- [ ] 27. Checkpoint — drag-and-drop works across columns and within columns; WIP limit blocks drops
  - Ensure all tests pass, ask the user if questions arise.

---

## Phase 7: Card Detail Modal (Subtasks, Labels, Activity, Comments)

- [ ] 28. Implement subtasks, labels, and comments APIs
  - Create `src/app/api/cards/[id]/subtasks/route.ts` — `POST` (create subtask with title)
  - Create `src/app/api/subtasks/[id]/route.ts` — `PUT` (toggle `isCompleted`, rename) and `DELETE`
  - Create `src/app/api/boards/[id]/labels/route.ts` — `POST` (create board-scoped label with name + color)
  - Create `src/app/api/labels/[id]/route.ts` — `PUT` (rename, recolor) and `DELETE`
  - Create `src/app/api/cards/[id]/labels/route.ts` — `POST` (attach label to card)
  - Create `src/app/api/cards/[id]/labels/[labelId]/route.ts` — `DELETE` (detach label from card)
  - Create `src/app/api/cards/[id]/comments/route.ts` — `POST` (create comment with body)
  - Create `src/app/api/comments/[id]/route.ts` — `PUT` (edit body) and `DELETE`
  - _Requirements: 14.2, 14.4, 14.5, 14.7_

- [ ] 29. Implement `CardDetailModal`
  - Create `src/components/boards/CardDetailModal.tsx` — full-screen overlay triggered by clicking a card
  - Editable fields: title (inline), description (`@uiw/react-md-editor` in edit/preview toggle), due date (date picker), labels (multi-select from board labels), subtasks (checklist with add/delete), comments (chronological list with author + timestamp + edit/delete)
  - Activity log section: display `CardActivity` records in chronological order showing field changes
  - Install `@uiw/react-md-editor` for Markdown editing and preview
  - All edits call the relevant API endpoints; optimistic updates with revert on error
  - _Requirements: 14.2, 14.3, 14.4, 14.5, 14.6, 14.7, 19.1, 19.2, 19.3_

  - [ ]* 29.1 Write property test for Markdown description round-trip
    - **Property 26: Markdown description round-trip**
    - **Validates: Requirements 19.4**

- [ ] 30. Wire `CardDetailModal` into `KanbanView` and `Card` component
  - Clicking a `<Card />` opens `<CardDetailModal cardId={id} />` via local state
  - After modal closes, refetch the board data to reflect any changes
  - _Requirements: 14.1, 14.2_

- [ ] 31. Checkpoint — card detail modal opens, all fields editable, activity log updates
  - Ensure all tests pass, ask the user if questions arise.

---

## Phase 8: List View

- [ ] 32. Implement `ListView` component and board view toggle
  - Create `src/components/boards/ListView.tsx` — flat, sortable table/list of all cards across all columns; columns: title, column name, due date (overdue highlight), labels, subtask progress, `completedPomodoros`; clicking a row opens `<CardDetailModal />`
  - Add a view-toggle control (Kanban / List) to the board page header; persist the selected view in `localStorage` keyed by board ID
  - Wire `ListView` into `src/app/(app)/boards/[id]/page.tsx` alongside `KanbanView`
  - _Requirements: 12.4, 12.5_

- [ ] 33. Checkpoint — list view renders all cards; toggle switches between Kanban and List
  - Ensure all tests pass, ask the user if questions arise.

---

## Phase 9: Task-Timer Integration (Task Picker, Session Linking, actualMinutes)

- [ ] 34. Implement task picker on the Focus page
  - Create `src/components/timer/TaskPicker.tsx` — searchable dropdown/popover listing all non-archived, non-terminal cards across all boards; shows board name + column name as context; selecting a card calls `setSelectedTaskId` on `TimerContext`
  - Wire `TaskPicker` into `src/app/(app)/focus/page.tsx`
  - _Requirements: 16.1_

- [ ] 35. Wire session linkage through `SessionCompleteModal` and `POST /api/focus-sessions`
  - Pass `selectedTaskId` from `TimerContext` into `SessionCompleteModal` and include it in the POST payload
  - The `POST /api/focus-sessions` handler (already implemented in Phase 2) runs the Prisma transaction to increment `card.actualMinutes` and `card.completedPomodoros` — verify this path is exercised end-to-end
  - _Requirements: 16.2, 16.3_

  - [ ]* 35.1 Write property test for session linkage incrementing card counters
    - **Property 24: Session linkage increments card counters**
    - **Validates: Requirements 16.2, 16.3**

- [ ] 36. Display linked card title in `FloatingWidget`
  - When `TimerContext.selectedTaskId` is non-null and timer is running, fetch the card title (from a local cache or a lightweight API call) and display it in `<FloatingWidget />`
  - _Requirements: 16.4, 16.5_

- [ ] 37. Checkpoint — selecting a task on Focus page links session; card counters increment after session completes
  - Ensure all tests pass, ask the user if questions arise.

---

## Phase 10: Today View

- [ ] 38. Implement `GET /api/cards/today`
  - Create `src/app/api/cards/today/route.ts` — returns all non-archived cards for the user satisfying at least one of: `dueDate` is today, `dueDate` is in the past with non-terminal status, or `status === 'IN_PROGRESS'`
  - _Requirements: 17.2_

  - [ ]* 38.1 Write property test for Today view filter correctness
    - **Property 25: Today view filter correctness**
    - **Validates: Requirements 17.2**

- [ ] 39. Implement the Today page
  - Create `src/app/(app)/today/page.tsx` — two-column layout: left panel is the task list from `GET /api/cards/today`; right panel is `<TimerDisplay />`
  - Task list items show card title, board/column context, due date, overdue indicator; clicking a card opens `<CardDetailModal />`
  - Selecting a card and starting the timer links the session to that card (calls `setSelectedTaskId` then `start()`)
  - _Requirements: 17.1, 17.2, 17.3, 17.4_

- [ ] 40. Checkpoint — Today view shows correct cards; starting timer from Today links session
  - Ensure all tests pass, ask the user if questions arise.

---

## Phase 11: Task Analytics Tab + Additions to Existing Tabs

- [ ] 41. Extend `src/lib/analytics.ts` with task-level aggregations
  - Add `computeTaskTimeBreakdown(logs, cards)` — returns per-card focus time totals
  - Add `computeEstimatedVsActual(cards)` — returns `{ cardId, estimatedMinutes, actualMinutes }[]` for cards with both fields set
  - _Requirements: 7.1, 8.1, 9.1, 10.1, 11.1_ (task data enriches existing analytics)

- [ ] 42. Add task analytics data to existing analytics tabs
  - Overview tab: add "top tasks by focus time" section using `computeTaskTimeBreakdown`
  - Day/Week/Month tabs: add per-task breakdown table showing `actualMinutes` vs `estimatedMinutes` for sessions in the period
  - Year tab: add most-worked-on tasks highlight
  - _Requirements: 7.1, 8.1, 9.1, 10.1, 11.1_

- [ ] 43. Checkpoint — analytics tabs show task-level data alongside session data
  - Ensure all tests pass, ask the user if questions arise.

---

## Phase 12: Command Palette + Keyboard Shortcuts

- [ ] 44. Implement command palette data layer
  - Create `src/lib/command-palette.ts` — `buildCommandIndex(boards, cards, navItems)` returns a flat array of `CommandItem` objects with `id`, `type`, `name`, `href | action`
  - Implement `searchCommands(index, query)` — returns items whose `name` contains `query` as a case-insensitive substring; empty query returns all items
  - _Requirements: 20.2_

  - [ ]* 44.1 Write property test for command palette search completeness
    - **Property 27: Command palette search completeness**
    - **Validates: Requirements 20.2**

- [ ] 45. Implement `CommandPalette` component and keyboard shortcut
  - Create `src/components/CommandPalette.tsx` — modal overlay with a search input and scrollable results list; renders board, card, and navigation result types distinctly; selecting a result navigates or triggers the associated action; `Escape` closes the palette
  - Add a `useEffect` in `src/app/(app)/layout.tsx` that listens for `Cmd+K` / `Ctrl+K` and opens the palette via shared state or a context
  - Fetch boards and cards once on layout mount and pass to `buildCommandIndex`; re-fetch on board/card mutations
  - _Requirements: 20.1, 20.2, 20.3, 20.4_

- [ ] 46. Implement remaining keyboard shortcuts
  - `N` on the boards page → open "New Card" dialog for the first column
  - `B` anywhere → focus the boards sidebar section
  - `F` anywhere → navigate to `/focus`
  - Document shortcuts in a `src/lib/shortcuts.ts` registry consumed by the command palette's help section
  - _Requirements: 20.1_

- [ ] 47. Checkpoint — command palette opens with Cmd+K, search filters results, Escape closes it
  - Ensure all tests pass, ask the user if questions arise.

---

## Phase 13: Calendar View

- [ ] 48. Implement calendar view data helpers
  - Extend `src/lib/analytics.ts` with `computeCalendarMonthView(logs, cards, year, month)` — returns a grid of weeks × days, each cell containing sessions and cards due on that day
  - _Requirements: 7.2_ (reuses calendar infrastructure from analytics)

- [ ] 49. Implement `CalendarView` component
  - Create `src/components/analytics/CalendarView.tsx` — monthly calendar grid; each day cell shows: total focus minutes (color-coded), due cards as chips; clicking a day opens a day detail panel showing sessions and cards
  - Day detail panel: lists sessions (duration, tag, linked card) and cards due that day with their status
  - Clicking a card in the day detail panel opens `<CardDetailModal />`
  - _Requirements: 7.2, 7.3_

- [ ] 50. Wire `CalendarView` into the Analytics page
  - Add a "Calendar" tab to the Analytics page `<Tabs>` component
  - Render `<CalendarView />` with month navigation (previous/next month arrows)
  - _Requirements: 7.2_

- [ ] 51. Final checkpoint — calendar view renders sessions and due cards; all features integrated end-to-end
  - Ensure all tests pass, ask the user if questions arise.

---

## Notes

- Tasks marked with `*` are optional and can be skipped for a faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation at the end of each phase
- Property tests use fast-check with `numRuns: 100`; each must include the comment `// Feature: flow-state-app, Property N: <title>`
- Unit tests use Vitest; test files live alongside the source files they test
- Auth is handled by Auth.js v5 — use `auth()` from `@/lib/auth` in all route handlers and server components; no Firebase, no manual token verification
- The `(app)` route group layout wraps all authenticated pages — changes to it affect every page
- Read `node_modules/next/dist/docs/` before writing any Next.js route or layout code to account for breaking changes in Next.js 16
