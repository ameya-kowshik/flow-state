# Requirements Document

## Introduction

Flow State is a focus and productivity web application built on Next.js 16, React 19, TypeScript 5, Tailwind v4, shadcn/ui, Prisma + PostgreSQL (Neon), Auth.js v5 (NextAuth) with Google OAuth, @dnd-kit, Recharts, and the Web Audio API. The app provides a Pomodoro/stopwatch timer, Kanban task boards, session analytics, and a Today view — all integrated so that focus sessions link directly to tasks and surface meaningful productivity insights.

---

## Glossary

- **App**: The Flow State web application.
- **User**: An authenticated person using the App.
- **Auth_Service**: The Auth.js v5 (NextAuth) subsystem handling Google OAuth identity.
- **DB**: The Prisma + PostgreSQL (Neon) data layer.
- **Timer**: The focus timer component supporting Pomodoro and Stopwatch modes.
- **Session**: A completed or in-progress focus interval recorded in the DB.
- **Tag**: A user-defined label with a hex color used to categorize Sessions.
- **Board**: A Kanban board owned by a User, containing Columns and Cards.
- **Column**: An ordered list of Cards within a Board, with an optional WIP limit.
- **Card**: A task item within a Column, carrying metadata such as due date, labels, subtasks, and description.
- **Today_View**: The dashboard page showing tasks due today alongside the Timer panel.
- **Analytics_View**: The multi-tab analytics page rendering charts from Session data.
- **Sidebar**: The persistent dark navigation panel present on all authenticated pages.
- **Widget**: The floating timer overlay displayed in the bottom-right corner while the Timer is running.
- **Session_Complete_Modal**: The dialog shown after a focus phase ends, collecting a focus score and notes.
- **Tag_Manager**: The modal UI for creating, editing, and deleting Tags.
- **Card_Detail_Modal**: The full-screen or overlay dialog showing all Card fields and activity.
- **Focus_Page**: The /focus route where the User configures and runs the Timer.
- **Boards_Page**: The /boards route listing all Boards.
- **Kanban_View**: The drag-and-drop column layout for a Board.
- **List_View**: The flat, sortable list layout for a Board.
- **Command_Palette**: The keyboard-triggered global search and action overlay.
- **Pretty_Printer**: The component that serializes structured data back to its canonical text format.

---

## Requirements

### Requirement 1: User Authentication

**User Story:** As a visitor, I want to sign in with Google or email/password, so that my data is private and persisted across devices.

#### Acceptance Criteria

1. THE Auth_Service SHALL support Google OAuth sign-in.
2. WHEN a User completes sign-in for the first time, THE DB SHALL create a User row linked to the Firebase UID.
3. WHEN a User completes sign-in on a subsequent visit, THE DB SHALL update the User's last-seen timestamp.
4. IF sign-in fails due to invalid credentials, THEN THE Auth_Service SHALL return a descriptive error message to the UI.
5. WHEN a User is unauthenticated, THE App SHALL display the landing/marketing page at the `/` route.
6. WHEN a User successfully authenticates, THE App SHALL redirect the User to `/today`.
7. WHILE a User is authenticated, THE App SHALL protect all routes under `/today`, `/focus`, `/boards`, `/analytics`, and `/settings` from unauthenticated access.

---

### Requirement 2: App Shell and Navigation

**User Story:** As a User, I want a persistent sidebar and consistent layout, so that I can navigate between features without losing context.

#### Acceptance Criteria

1. WHILE a User is authenticated, THE Sidebar SHALL display navigation links for Today, Focus, Boards, Analytics, and Settings.
2. THE Sidebar SHALL render in a dark theme consistent with the Linear-style design reference.
3. WHEN the User expands the Boards section in the Sidebar, THE Sidebar SHALL list all Boards owned by the User.
4. WHILE the Timer is running, THE Widget SHALL be visible in the bottom-right corner on all authenticated pages.
5. WHEN the User navigates between pages while the Timer is running, THE Widget SHALL persist without resetting the Timer state.

---

### Requirement 3: Pomodoro Timer

**User Story:** As a User, I want a Pomodoro timer with automatic phase transitions, so that I can follow structured focus/break cycles.

#### Acceptance Criteria

1. THE Timer SHALL support three phases: focus, shortBreak, and longBreak.
2. THE Timer SHALL render an SVG circular progress ring reflecting the proportion of elapsed time in the current phase.
3. WHEN the Timer is in the focus phase and the configured duration elapses, THE Timer SHALL automatically transition to the shortBreak phase.
4. WHEN a longBreak interval is reached (after a configurable number of focus phases), THE Timer SHALL automatically transition to the longBreak phase instead of shortBreak.
5. THE Timer SHALL provide Start, Pause, Resume, Stop, Reset, and Skip Phase controls.
6. WHEN the User activates Skip Phase, THE Timer SHALL immediately transition to the next phase in the cycle.
7. WHERE the User has enabled sound, THE Timer SHALL play a programmatic tone via the Web Audio API at each phase transition.
8. WHERE the User has granted browser notification permission, THE Timer SHALL send a browser notification at each phase transition.
9. THE Timer SHALL support fullscreen mode, expanding to fill the viewport.
10. WHEN a focus phase completes, THE Session_Complete_Modal SHALL be displayed, prompting the User to enter a focus score between 1 and 10 and optional notes.
11. WHEN the User submits the Session_Complete_Modal, THE App SHALL POST the Session data to `/api/focus-sessions`.
12. THE Timer SHALL persist its running state, current phase, and elapsed time in React context and localStorage so that a page refresh does not reset the Timer.
13. THE Timer SHALL allow the User to configure focus, shortBreak, and longBreak durations in whole minutes.

---

### Requirement 4: Stopwatch Timer

**User Story:** As a User, I want a stopwatch mode that counts up, so that I can track open-ended work sessions.

#### Acceptance Criteria

1. WHEN the User selects Stopwatch mode, THE Timer SHALL count elapsed time upward from zero.
2. THE Timer SHALL allow the User to configure a maximum duration for the Stopwatch; WHEN the maximum duration is reached, THE Timer SHALL stop and display the Session_Complete_Modal.
3. THE Timer SHALL provide Start, Pause, Resume, Stop, and Reset controls in Stopwatch mode.
4. THE Timer SHALL persist Stopwatch state in React context and localStorage consistent with Requirement 3.12.

---

### Requirement 5: Tags

**User Story:** As a User, I want to create and manage colored tags, so that I can categorize my focus sessions.

#### Acceptance Criteria

1. THE Tag_Manager SHALL allow the User to create a Tag with a name and a hex color value.
2. THE Tag_Manager SHALL allow the User to edit the name and hex color of an existing Tag.
3. THE Tag_Manager SHALL allow the User to delete a Tag.
4. WHEN a Tag is deleted, THE DB SHALL disassociate the Tag from all Sessions that referenced it.
5. WHEN the User is on the Focus_Page, THE App SHALL display a tag selector allowing the User to associate one or more Tags with the upcoming Session.
6. THE Tag SHALL be stored in the DB with a unique name per User.

---

### Requirement 6: Sessions API

**User Story:** As a User, I want my focus sessions saved and retrievable, so that analytics and history are accurate.

#### Acceptance Criteria

1. THE App SHALL expose a `POST /api/focus-sessions` endpoint that accepts a Session payload and persists it to the DB.
2. THE App SHALL expose a `GET /api/focus-sessions` endpoint that returns a paginated list of Sessions for the authenticated User.
3. WHEN the `GET /api/focus-sessions` endpoint receives filter parameters (date range, tag, mode), THE App SHALL return only Sessions matching all supplied filters.
4. IF a request to either Sessions endpoint is made without a valid authentication token, THEN THE App SHALL return an HTTP 401 response.
5. IF the `POST /api/focus-sessions` payload fails validation, THEN THE App SHALL return an HTTP 422 response with field-level error details.

---

### Requirement 7: Analytics — Overview Tab

**User Story:** As a User, I want an overview of my productivity, so that I can understand my daily habits and long-term streaks.

#### Acceptance Criteria

1. THE Analytics_View SHALL display an Overview tab containing: total focus time today, number of Sessions today, current streak in days, longest streak in days, and lifetime total focus time.
2. THE Analytics_View SHALL render a calendar heatmap showing daily focus time for the trailing 12 months.
3. WHEN the User hovers over a heatmap cell, THE Analytics_View SHALL display a tooltip with the date and total focus minutes for that day.

---

### Requirement 8: Analytics — Day Tab

**User Story:** As a User, I want a detailed breakdown of a single day, so that I can review how I spent my focus time.

#### Acceptance Criteria

1. THE Analytics_View SHALL display a Day tab containing: total focus time, number of Sessions, and average focus score for the selected date.
2. THE Analytics_View SHALL render a donut chart showing focus time distribution by Tag for the selected date.
3. THE Analytics_View SHALL render a session timeline showing each Session as a block positioned by start time for the selected date.

---

### Requirement 9: Analytics — Week Tab

**User Story:** As a User, I want a weekly summary, so that I can identify which days I was most productive.

#### Acceptance Criteria

1. THE Analytics_View SHALL display a Week tab containing: total focus time, number of Sessions, and average focus score for the selected week.
2. THE Analytics_View SHALL render a donut chart showing focus time distribution by Tag for the selected week.
3. THE Analytics_View SHALL render a bar chart showing daily focus time for each day of the selected week.

---

### Requirement 10: Analytics — Month Tab

**User Story:** As a User, I want a monthly summary with insights, so that I can track progress over longer periods.

#### Acceptance Criteria

1. THE Analytics_View SHALL display a Month tab containing: total focus time, number of Sessions, and average focus score for the selected month.
2. THE Analytics_View SHALL render a heatmap of daily focus time for the selected month.
3. THE Analytics_View SHALL render a donut chart showing focus time distribution by Tag for the selected month.
4. THE Analytics_View SHALL display at least one auto-generated insight (e.g., most productive day of week) derived from the selected month's Session data.

---

### Requirement 11: Analytics — Year Tab

**User Story:** As a User, I want a yearly summary, so that I can see long-term productivity trends.

#### Acceptance Criteria

1. THE Analytics_View SHALL display a Year tab containing: total focus time and number of Sessions for the selected year.
2. THE Analytics_View SHALL render a quarterly breakdown showing focus time per quarter.
3. THE Analytics_View SHALL render a monthly trend line chart showing total focus time per month for the selected year.
4. THE Analytics_View SHALL display yearly highlights (e.g., most productive month, longest streak).

---

### Requirement 12: Boards

**User Story:** As a User, I want to create and manage Kanban boards, so that I can organize my work visually.

#### Acceptance Criteria

1. THE App SHALL allow the User to create a Board with a name and a color.
2. THE App SHALL allow the User to star a Board, causing it to appear at the top of the Boards list.
3. THE App SHALL allow the User to archive a Board, hiding it from the active Boards list without deleting it.
4. WHEN the User views a Board, THE App SHALL display the Board in Kanban_View by default.
5. THE App SHALL allow the User to switch a Board to List_View.
6. THE Boards_Page SHALL list all active (non-archived) Boards owned by the User.

---

### Requirement 13: Columns

**User Story:** As a User, I want to manage columns within a board, so that I can define workflow stages.

#### Acceptance Criteria

1. THE App SHALL allow the User to create, rename, and delete Columns within a Board.
2. THE App SHALL allow the User to set a WIP limit on a Column; WHEN the number of Cards in the Column meets or exceeds the WIP limit, THE App SHALL visually indicate the limit has been reached.
3. THE App SHALL allow the User to collapse a Column, hiding its Cards while keeping the Column header visible.
4. WHEN a Column is deleted and contains Cards, THE App SHALL prompt the User to confirm deletion and specify a destination Column for the Cards.

---

### Requirement 14: Cards

**User Story:** As a User, I want rich task cards, so that I can capture all relevant information for a piece of work.

#### Acceptance Criteria

1. THE App SHALL allow the User to create a Card within a Column with at minimum a title.
2. THE Card_Detail_Modal SHALL allow the User to edit: title, description (Markdown), due date, labels, subtasks, and comments.
3. THE App SHALL render Markdown descriptions using `@uiw/react-md-editor` in preview mode within the Card_Detail_Modal.
4. THE App SHALL allow the User to add, check off, and delete subtasks on a Card.
5. THE App SHALL allow the User to add comments to a Card; comments SHALL be displayed in chronological order with author and timestamp.
6. THE App SHALL display an activity log on the Card showing field changes in chronological order.
7. THE App SHALL allow the User to assign one or more labels (distinct from Tags) to a Card.
8. WHEN a Card's due date is in the past and the Card is not in a completed Column, THE App SHALL visually indicate the Card is overdue.

---

### Requirement 15: Drag and Drop

**User Story:** As a User, I want to drag cards between columns and reorder them, so that I can manage my workflow intuitively.

#### Acceptance Criteria

1. WHILE in Kanban_View, THE App SHALL allow the User to drag a Card from one Column to another using @dnd-kit.
2. WHILE in Kanban_View, THE App SHALL allow the User to reorder Cards within a Column by dragging.
3. WHEN a Card is dropped into a Column whose WIP limit would be exceeded, THE App SHALL prevent the drop and display a warning message.
4. WHEN a drag operation completes, THE DB SHALL be updated to reflect the Card's new Column and position.
5. WHILE a Card is being dragged, THE App SHALL render a drag overlay showing the Card's title.

---

### Requirement 16: Focus–Task Integration

**User Story:** As a User, I want to link focus sessions to specific cards, so that I can track how much time I spend on each task.

#### Acceptance Criteria

1. WHEN the User is on the Focus_Page, THE App SHALL display a task picker allowing the User to select a Card to associate with the upcoming Session.
2. WHEN a Session completes and is linked to a Card, THE DB SHALL increment the Card's `actualMinutes` by the Session duration.
3. WHEN a Pomodoro focus phase completes and is linked to a Card, THE DB SHALL increment the Card's `completedPomodoros` by one.
4. WHILE the Timer is running and linked to a Card, THE Widget SHALL display the linked Card's title.
5. WHEN the User is viewing a Board page and the Timer is running, THE Widget SHALL be visible in the bottom-right corner.

---

### Requirement 17: Today View

**User Story:** As a User, I want a Today view showing my most relevant tasks alongside the timer, so that I can stay focused on what matters now.

#### Acceptance Criteria

1. THE Today_View SHALL display a task list and the Timer panel side by side.
2. THE Today_View task list SHALL include Cards that are: due today, overdue, in-progress (in a non-terminal Column), or pinned by the User.
3. WHEN the User selects a Card in the Today_View task list, THE App SHALL open the Card_Detail_Modal.
4. WHEN the User selects a Card in the Today_View task list and starts the Timer, THE App SHALL link the Session to that Card consistent with Requirement 16.

---

### Requirement 18: Settings

**User Story:** As a User, I want to configure app-wide preferences, so that the app behaves according to my workflow.

#### Acceptance Criteria

1. THE App SHALL provide a Settings page at `/settings`.
2. THE App SHALL allow the User to configure default Pomodoro durations (focus, shortBreak, longBreak) and the number of focus phases before a longBreak.
3. THE App SHALL allow the User to toggle sound notifications on or off.
4. THE App SHALL allow the User to toggle browser notifications on or off; WHEN the User enables browser notifications, THE App SHALL request the browser notification permission.
5. WHEN the User saves Settings, THE App SHALL persist the preferences to the DB and update the local React context immediately.

---

### Requirement 19: Markdown Description Serialization

**User Story:** As a developer, I want Card descriptions to round-trip through parse and render without data loss, so that formatting is always preserved.

#### Acceptance Criteria

1. WHEN a Card description is saved, THE DB SHALL store the raw Markdown string.
2. WHEN a Card description is loaded, THE App SHALL pass the raw Markdown string to `@uiw/react-md-editor` for rendering.
3. THE Pretty_Printer SHALL format a Markdown string into a canonical representation suitable for display.
4. FOR ALL valid Markdown description strings, saving then loading then rendering SHALL produce output equivalent to rendering the original string (round-trip property).

---

### Requirement 20: Command Palette

**User Story:** As a User, I want a keyboard-triggered command palette, so that I can navigate and act without using the mouse.

#### Acceptance Criteria

1. WHEN the User presses the configured keyboard shortcut (default: `Cmd+K` / `Ctrl+K`), THE Command_Palette SHALL open.
2. THE Command_Palette SHALL support searching for Boards, Cards, and navigation destinations by name.
3. WHEN the User selects a result in the Command_Palette, THE App SHALL navigate to or open the selected item.
4. WHEN the Command_Palette is open and the User presses `Escape`, THE Command_Palette SHALL close.
