# Design Document: Flow State App

## Overview

Flow State is a focus and productivity web application that integrates a Pomodoro/stopwatch timer, Kanban task boards, session analytics, and a Today view into a single cohesive experience. The core value proposition is the tight coupling between focus sessions and tasks — every session can be linked to a card, and that linkage surfaces in both the card detail and the analytics dashboard.

The app is built on Next.js 16 (App Router), React 19, TypeScript 5, Tailwind CSS v4, shadcn/ui + Radix UI, Prisma + PostgreSQL (Neon), and Auth.js v5 (NextAuth) with Google OAuth. The timer state lives in a React context that persists to localStorage, enabling the floating widget to survive page navigation without losing state.

### Key Design Decisions

- **Client-side analytics computation**: All analytics metrics are derived from raw `PomodoroLog` arrays on the client. This avoids complex server-side aggregation queries and keeps the analytics layer purely functional and testable.
- **Timer in React context, not server state**: The timer is inherently ephemeral and device-local. Persisting it to the DB would introduce latency and complexity with no benefit. localStorage + context rehydration on mount is the right model.
- **Auth.js v5 (NextAuth) + Prisma user row**: Auth.js handles Google OAuth, session cookies, and the JWT/session lifecycle. On first sign-in the Auth.js `signIn` callback upserts a `User` row in Prisma. All subsequent DB queries use the internal `User.id` (cuid). No Firebase project, no Admin SDK, no manual token verification — Auth.js handles all of it via the Prisma adapter.
- **Session access in route handlers**: Use `auth()` from `@/lib/auth` (the Auth.js handler) to get the current session. Returns `null` if unauthenticated — handlers return 401 in that case.

---

## Architecture

### Route Groups and File Structure

```
src/app/
├── (marketing)/
│   └── page.tsx                    # Landing page (Server Component, unauthenticated)
├── (app)/
│   ├── layout.tsx                  # App shell layout: sidebar + TimerProvider + FloatingWidget
│   ├── today/
│   │   └── page.tsx
│   ├── focus/
│   │   └── page.tsx
│   ├── boards/
│   │   ├── page.tsx
│   │   └── [id]/
│   │       └── page.tsx
│   ├── analytics/
│   │   └── page.tsx
│   └── settings/
│       └── page.tsx
├── api/
│   ├── focus-sessions/
│   │   └── route.ts                # GET, POST
│   ├── tags/
│   │   ├── route.ts                # GET, POST
│   │   └── [id]/
│   │       └── route.ts            # PUT, DELETE
│   ├── boards/
│   │   ├── route.ts                # GET, POST
│   │   └── [id]/
│   │       ├── route.ts            # GET, PUT, DELETE
│   │       ├── columns/
│   │       │   └── route.ts        # POST
│   │       └── labels/
│   │           └── route.ts        # POST
│   ├── columns/
│   │   └── [id]/
│   │       └── route.ts            # PUT, DELETE
│   ├── cards/
│   │   ├── today/
│   │   │   └── route.ts            # GET
│   │   └── [id]/
│   │       ├── route.ts            # GET, PUT, DELETE
│   │       ├── move/
│   │       │   └── route.ts        # POST
│   │       ├── subtasks/
│   │       │   └── route.ts        # POST
│   │       ├── labels/
│   │       │   ├── route.ts        # POST
│   │       │   └── [labelId]/
│   │       │       └── route.ts    # DELETE
│   │       └── comments/
│   │           └── route.ts        # POST
│   ├── subtasks/
│   │   └── [id]/
│   │       └── route.ts            # PUT, DELETE
│   ├── labels/
│   │   └── [id]/
│   │       └── route.ts            # PUT, DELETE
│   └── comments/
│       └── [id]/
│           └── route.ts            # PUT, DELETE
└── layout.tsx                      # Root layout (html/body, no providers)

src/
├── components/
│   ├── sidebar/
│   ├── timer/
│   │   ├── TimerProvider.tsx       # 'use client' — TimerContext
│   │   ├── TimerDisplay.tsx        # SVG ring + controls
│   │   ├── FloatingWidget.tsx      # Bottom-right overlay
│   │   └── SessionCompleteModal.tsx
│   ├── boards/
│   │   ├── KanbanView.tsx
│   │   ├── ListView.tsx
│   │   ├── Column.tsx
│   │   ├── Card.tsx
│   │   └── CardDetailModal.tsx
│   ├── analytics/
│   │   ├── CalendarHeatmap.tsx     # Raw SVG
│   │   ├── DonutChart.tsx          # Raw SVG
│   │   ├── SessionTimeline.tsx
│   │   └── tabs/
│   └── ui/                         # shadcn/ui re-exports
├── lib/
│   ├── auth.ts                     # Auth.js config + helper
│   ├── analytics.ts                # Pure computation functions
│   ├── prisma.ts                   # Prisma client singleton
│   └── audio.ts                    # Web Audio API helpers
└── contexts/
    └── TimerContext.tsx            # Timer state shape + actions
```

### Data Flow

```mermaid
graph TD
    A[Google OAuth] -->|sign-in callback| B[Auth.js]
    B -->|upsert User row| C[Prisma DB]
    B -->|session cookie| D[Browser]
    D -->|cookie on request| E[API Route Handler]
    E -->|auth()| B
    B -->|session.user.id| F[Prisma DB Query]
    F -->|data| G[JSON Response]
    G -->|fetch| H[Client Component]

    I[TimerContext] -->|elapsed/phase| J[FloatingWidget]
    I -->|on complete| K[SessionCompleteModal]
    K -->|POST /api/focus-sessions| E

    L[PomodoroLog array] -->|analytics.ts functions| M[Computed Metrics]
    M -->|props| N[Chart Components]
```

### Authentication Flow

1. User clicks "Sign in with Google" on the landing page.
2. Auth.js redirects to Google OAuth, handles the callback at `/api/auth/callback/google`.
3. On first sign-in, the Auth.js `signIn` callback upserts a `User` row in Prisma (keyed on the Google account ID).
4. Auth.js sets an encrypted session cookie (`next-auth.session-token`).
5. In API route handlers, `const session = await auth()` retrieves the session. If `session` is null, return 401.
6. All DB queries use `session.user.id` (the internal Prisma `User.id`).

Route protection for pages is handled in the `(app)` layout via `auth()` — redirects to `/` if no session.

---

## Components and Interfaces

### TimerContext

The `TimerProvider` is a `'use client'` component that wraps the entire `(app)` layout. It owns all timer state and exposes it via context.

```typescript
type TimerMode = 'pomodoro' | 'stopwatch'
type TimerPhase = 'focus' | 'shortBreak' | 'longBreak'
type TimerStatus = 'idle' | 'running' | 'paused'

interface PomodoroSettings {
  focusDuration: number       // minutes
  shortBreakDuration: number
  longBreakDuration: number
  longBreakInterval: number   // focus phases before long break
  maxStopwatchDuration: number | null
}

interface TimerState {
  mode: TimerMode
  phase: TimerPhase
  status: TimerStatus
  startedAt: number | null    // Date.now() when last started/resumed
  elapsed: number             // seconds accumulated before last pause
  settings: PomodoroSettings
  soundEnabled: boolean
  notificationsEnabled: boolean
  selectedTagId: string | null
  selectedTaskId: string | null
  cycleCount: number          // completed focus phases in current cycle
}

interface TimerContextValue extends TimerState {
  start: () => void
  pause: () => void
  resume: () => void
  stop: () => void
  reset: () => void
  skipPhase: () => void
  setMode: (mode: TimerMode) => void
  setSettings: (settings: Partial<PomodoroSettings>) => void
  setSoundEnabled: (enabled: boolean) => void
  setNotificationsEnabled: (enabled: boolean) => void
  setSelectedTagId: (id: string | null) => void
  setSelectedTaskId: (id: string | null) => void
  currentDuration: number     // seconds for current phase/mode
  remainingSeconds: number    // computed: currentDuration - totalElapsed
  totalElapsed: number        // elapsed + (running ? Date.now()/1000 - startedAt/1000 : 0)
}
```

On mount, `TimerProvider` reads from `localStorage` and recalculates `totalElapsed` from `startedAt + Date.now()` to account for time that passed while the page was closed. A `setInterval` of 1 second updates a `tick` counter that triggers recomputation of `totalElapsed` and `remainingSeconds`.

### API Route Pattern

All authenticated route handlers follow this exact pattern:

```typescript
// src/app/api/focus-sessions/route.ts
import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const sessions = await prisma.pomodoroLog.findMany({
    where: { userId: session.user.id },
    orderBy: { startedAt: 'desc' },
  })
  return Response.json(sessions)
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  // validate body, return 422 on failure
  const log = await prisma.pomodoroLog.create({ data: { ...body, userId: session.user.id } })
  return Response.json(log, { status: 201 })
}
```

For routes with dynamic segments:

```typescript
// src/app/api/boards/[id]/route.ts
import type { NextRequest } from 'next/server'

export async function GET(_req: NextRequest, ctx: RouteContext<'/api/boards/[id]'>) {
  const { id } = await ctx.params
  // ...
}
```

### Analytics Functions (`src/lib/analytics.ts`)

All functions are pure — they take a `PomodoroLog[]` and return computed values. No side effects.

```typescript
interface StreakResult {
  current: number   // days
  longest: number   // days
}

interface TagDistribution {
  tagId: string | null
  tagName: string
  tagColor: string
  minutes: number
  percentage: number
}

interface CalendarCell {
  date: string      // ISO date string YYYY-MM-DD
  minutes: number
}

interface DailyBreakdown {
  date: string
  totalMinutes: number
  sessionCount: number
  avgFocusScore: number | null
  tags: TagDistribution[]
  sessions: PomodoroLog[]
}

function computeStreaks(logs: PomodoroLog[]): StreakResult
function computeTagDistribution(logs: PomodoroLog[], tags: Tag[]): TagDistribution[]
function computeCalendarData(logs: PomodoroLog[], months: number): CalendarCell[]
function computeDailyBreakdown(logs: PomodoroLog[], date: Date, tags: Tag[]): DailyBreakdown
function computeMonthlyBreakdown(logs: PomodoroLog[], year: number, month: number, tags: Tag[]): MonthlyBreakdown
function computeQuarterlyBreakdown(logs: PomodoroLog[], year: number): QuarterlyBreakdown[]
function computeGrowthRate(logs: PomodoroLog[], periodA: DateRange, periodB: DateRange): number
function computeConsistencyScore(logs: PomodoroLog[], days: number): number
```

### Drag and Drop

The Kanban board uses `@dnd-kit/core` with `@dnd-kit/sortable`. Each `Column` is a `SortableContext` with a vertical list strategy. Cards are `useSortable` items. The board-level `DndContext` handles cross-column drops via `onDragEnd`:

1. Identify source column and destination column from `active` and `over` IDs.
2. Compute new `position` value (fractional indexing between neighbors).
3. Optimistically update local state.
4. `POST /api/cards/[id]/move` with `{ columnId, position }`.
5. On error, revert optimistic update.

WIP limit enforcement happens in `onDragOver`: if the destination column's card count equals its `cardLimit`, the drop is cancelled and a toast warning is shown.

### SVG Chart Components

**DonutChart**: Accepts `segments: { value: number; color: string; label: string }[]`. Computes arc paths using `Math.sin`/`Math.cos` with a configurable inner radius ratio. Renders a centered label showing total.

**CalendarHeatmap**: Accepts `cells: CalendarCell[]` and a `colorScale` function mapping minutes to a fill color. Renders a 53-column × 7-row SVG grid with week labels and month separators. Tooltip on hover via a `title` element or a positioned `div`.

---

## Data Models

The Prisma schema is defined in the technical context. Key relationships and constraints relevant to the design:

### Position Fields (Fractional Indexing)

`Column.position` and `Card.position` use `Float` to support fractional indexing. When a card is moved between positions A and B, its new position is `(A + B) / 2`. When the gap becomes too small (< 0.001), a rebalance operation renumbers all positions in the affected column as integers `1, 2, 3, ...`.

### Session–Card Linkage

`PomodoroLog` has optional `taskId` and `tagId` foreign keys. When a session completes linked to a card:
- `Card.actualMinutes += session.duration`
- If `sessionType === 'POMODORO'`: `Card.completedPomodoros += 1`

These increments are applied in the `POST /api/focus-sessions` handler atomically using a Prisma transaction.

### Card Status vs Column

`CardStatus` is a denormalized field on `Card` that mirrors the card's logical state. It is updated when a card is moved to a column whose name matches a known terminal state (e.g. "Done" → `DONE`, "Cancelled" → `CANCELLED`). This allows the Today view to filter "in-progress" cards without joining through columns.

### Soft Deletion

Boards and Cards use `isArchived: Boolean` rather than hard deletion. Archived items are excluded from all list queries by default via a `where: { isArchived: false }` clause. Tags use hard deletion with a `SET NULL` cascade on `PomodoroLog.tagId`.

### Settings Persistence

User settings (Pomodoro durations, sound/notification toggles) are stored in the `TimerContext` and persisted to `localStorage` for immediate access. They are also synced to the DB via `PUT /api/settings` so they survive across devices. On app load, the server-fetched settings take precedence over localStorage.

---

## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*


### Property 1: User upsert round-trip

*For any* valid Firebase UID and user profile, calling the first-login upsert handler and then querying the DB for that `firebaseUid` should return exactly one `User` row with matching `email` and `name` fields.

**Validates: Requirements 1.2**

---

### Property 2: Unauthenticated requests are rejected

*For any* API route in the application and any request that omits or provides an invalid `Authorization` header, the response status code should be 401.

**Validates: Requirements 1.7, 6.4**

---

### Property 3: Timer phase transition — focus to break

*For any* valid `PomodoroSettings` and `cycleCount`, when the timer's elapsed time reaches the focus duration, the computed next phase should be `shortBreak` when `cycleCount % longBreakInterval !== 0`, and `longBreak` when `cycleCount % longBreakInterval === 0`.

**Validates: Requirements 3.3, 3.4**

---

### Property 4: Timer state persistence round-trip

*For any* valid `TimerState` object, serializing it to a JSON string (as stored in localStorage) and then deserializing and rehydrating it should produce a `TimerState` with equivalent `mode`, `phase`, `status`, `elapsed`, `settings`, `selectedTagId`, `selectedTaskId`, and `cycleCount` fields.

**Validates: Requirements 3.12, 4.4**

---

### Property 5: Timer progress ring proportion

*For any* timer phase with a configured duration D and elapsed time E where 0 ≤ E ≤ D, the SVG progress ring's filled arc should represent exactly the proportion E/D of the full circle (i.e., the arc angle equals `(E / D) * 2π` radians).

**Validates: Requirements 3.2**

---

### Property 6: Timer duration settings are positive integers

*For any* settings update, the `focusDuration`, `shortBreakDuration`, and `longBreakDuration` values should be positive integers (≥ 1). Any attempt to set a non-positive or non-integer value should be rejected or clamped.

**Validates: Requirements 3.13**

---

### Property 7: Stopwatch elapsed time is non-negative and monotonically increasing

*For any* stopwatch session in the `running` state, `totalElapsed` should be ≥ 0 and should never decrease between consecutive ticks.

**Validates: Requirements 4.1**

---

### Property 8: Stopwatch stops at max duration

*For any* stopwatch with a configured `maxStopwatchDuration` M, when `totalElapsed` reaches M, the timer status should transition to `idle` (stopped).

**Validates: Requirements 4.2**

---

### Property 9: Tag creation round-trip

*For any* valid tag name and hex color string, creating a tag via the API and then fetching it by ID should return a tag with the same `name` and `color` values.

**Validates: Requirements 5.1, 5.2**

---

### Property 10: Tag deletion disassociates sessions

*For any* set of `PomodoroLog` records referencing a given `tagId`, after that tag is deleted, none of those sessions should have a non-null `tagId` pointing to the deleted tag (i.e., `tagId` should be `null`).

**Validates: Requirements 5.4**

---

### Property 11: Tag names are unique per user

*For any* user, no two tags owned by that user should share the same `name`. Attempting to create a duplicate tag name should return an error.

**Validates: Requirements 5.6**

---

### Property 12: Session POST/GET round-trip

*For any* valid `PomodoroLog` payload, POSTing it to `/api/focus-sessions` and then GETting the session by its returned ID should yield a record with equivalent `duration`, `sessionType`, `startedAt`, `completedAt`, `tagId`, and `taskId` fields.

**Validates: Requirements 6.1, 6.2**

---

### Property 13: Session filter correctness

*For any* collection of `PomodoroLog` records and any combination of filter parameters (date range, tagId, sessionType), the sessions returned by `GET /api/focus-sessions` with those filters should be exactly the subset of records that satisfy all filter predicates simultaneously — no more, no fewer.

**Validates: Requirements 6.3**

---

### Property 14: Invalid session payload returns 422

*For any* POST request to `/api/focus-sessions` with a payload that is missing required fields or contains out-of-range values (e.g., `focusScore` outside 1–10, negative `duration`), the response status should be 422 and the body should contain field-level error details.

**Validates: Requirements 6.5**

---

### Property 15: Analytics aggregation correctness

*For any* array of `PomodoroLog` records and a target date/period, the values computed by `computeDailyBreakdown`, `computeMonthlyBreakdown`, and `computeStreaks` should equal the results of a naive reference implementation that iterates over the same records and sums/counts directly.

**Validates: Requirements 7.1, 8.1, 9.1, 10.1, 11.1**

---

### Property 16: Calendar heatmap covers trailing 12 months

*For any* `PomodoroLog` array, `computeCalendarData(logs, 12)` should return a cell for every calendar day in the trailing 365 (or 366) days, with each cell's `minutes` equal to the sum of `duration` for all sessions whose `completedAt` falls on that day.

**Validates: Requirements 7.2**

---

### Property 17: Tag distribution sums to total

*For any* `PomodoroLog` array and `Tag` array, the `minutes` values in the result of `computeTagDistribution` should sum to the total minutes across all logs in the input, and the `percentage` values should sum to 100 (within floating-point tolerance).

**Validates: Requirements 8.2, 9.2, 10.3**

---

### Property 18: Board creation round-trip

*For any* valid board name and color, creating a board via the API and then fetching it by ID should return a board with the same `name`, `color`, `isArchived: false`, and `isStarred: false`.

**Validates: Requirements 12.1**

---

### Property 19: Starred boards appear before non-starred boards

*For any* list of boards returned by `GET /api/boards`, all boards where `isStarred === true` should appear before all boards where `isStarred === false`.

**Validates: Requirements 12.2**

---

### Property 20: Archived boards are excluded from active list

*For any* board, after it is archived (`isArchived` set to `true`), it should not appear in the results of `GET /api/boards` (the active boards list).

**Validates: Requirements 12.3**

---

### Property 21: WIP limit enforcement

*For any* column with a `cardLimit` of N, when the column already contains N cards, both (a) the UI drag-and-drop drop handler and (b) the `POST /api/columns/[id]/cards` endpoint should reject the addition of another card and signal an error.

**Validates: Requirements 13.2, 15.3**

---

### Property 22: Card overdue detection

*For any* card where `dueDate < Date.now()` and `status` is not `DONE` or `CANCELLED`, the `isOverdue` computed property should be `true`. For any card where `dueDate >= Date.now()` or `status` is `DONE` or `CANCELLED`, `isOverdue` should be `false`.

**Validates: Requirements 14.8**

---

### Property 23: Card move round-trip

*For any* card and target column, after `POST /api/cards/[id]/move` with `{ columnId, position }`, fetching the card by ID should return a card with the updated `columnId` and `position` values.

**Validates: Requirements 15.4**

---

### Property 24: Session linkage increments card counters

*For any* card and any completed session of duration D linked to that card: after the session is persisted, `card.actualMinutes` should increase by exactly D. Additionally, if `sessionType === 'POMODORO'`, `card.completedPomodoros` should increase by exactly 1.

**Validates: Requirements 16.2, 16.3**

---

### Property 25: Today view filter correctness

*For any* set of cards, `GET /api/cards/today` should return exactly the cards satisfying at least one of: `dueDate` is today, `dueDate` is in the past with non-terminal status, or `status === 'IN_PROGRESS'`. No card outside these criteria should appear.

**Validates: Requirements 17.2**

---

### Property 26: Markdown description round-trip

*For any* valid Markdown string S, storing S as a card description and then retrieving it should return the identical string S (byte-for-byte), such that rendering the retrieved string produces output equivalent to rendering S directly.

**Validates: Requirements 19.4**

---

### Property 27: Command palette search completeness

*For any* search query string Q and any collection of boards, cards, and navigation items, the command palette search results should include every item whose `name` contains Q as a case-insensitive substring, and should not include items whose `name` does not contain Q.

**Validates: Requirements 20.2**

---

## Error Handling

### API Layer

All route handlers use a consistent error response shape:

```typescript
// Success
Response.json(data, { status: 200 | 201 })

// Auth failure
Response.json({ error: 'Unauthorized' }, { status: 401 })

// Validation failure
Response.json({ error: 'Validation failed', fields: { fieldName: 'message' } }, { status: 422 })

// Not found
Response.json({ error: 'Not found' }, { status: 404 })

// Server error
Response.json({ error: 'Internal server error' }, { status: 500 })
```

`auth()` from Auth.js returns `null` when unauthenticated. All handlers check this at the top and return 401 immediately:

```typescript
import { auth } from '@/lib/auth'

// In any route handler:
const session = await auth()
if (!session?.user?.id) return Response.json({ error: 'Unauthorized' }, { status: 401 })
```

### Client Layer

- **Optimistic updates** (drag-and-drop, card edits) revert on API error and show a toast notification via shadcn/ui `toast`.
- **Timer errors** (e.g., failed session POST) are surfaced in the `SessionCompleteModal` with a retry option. The session data is preserved in state until successfully submitted.
- **Network errors** during analytics data fetch show a skeleton/error state with a retry button.
- **Auth errors** (e.g., Google sign-in popup closed) are mapped to user-friendly messages on the landing page.

### Timer Edge Cases

- **Page closed while timer running**: On remount, `startedAt` is read from localStorage and `elapsed` is recalculated as `(Date.now() - startedAt) / 1000 + previousElapsed`. If the computed elapsed exceeds the phase duration, the phase is marked as completed and the session modal is shown immediately.
- **Multiple tabs**: The last-write-wins on localStorage. No cross-tab synchronization is implemented (out of scope).
- **Browser notification permission denied**: The toggle is silently disabled; no error is thrown.

### Drag and Drop Edge Cases

- **Concurrent moves**: If two rapid moves occur before the first API response, the second move is queued and applied after the first resolves.
- **Position collision**: Fractional indexing handles this gracefully; rebalancing is triggered when the gap between adjacent positions falls below 0.001.

---

## Testing Strategy

### Dual Testing Approach

Both unit tests and property-based tests are required. They are complementary:
- **Unit tests** verify specific examples, integration points, and error conditions.
- **Property-based tests** verify universal properties across randomly generated inputs.

### Property-Based Testing

**Library**: [fast-check](https://github.com/dubzzz/fast-check) (TypeScript-native, excellent arbitrary generators, runs in Vitest/Jest).

**Configuration**: Each property test runs a minimum of **100 iterations** (`numRuns: 100`).

**Tag format**: Each property test must include a comment referencing the design property:
```typescript
// Feature: flow-state-app, Property 15: Analytics aggregation correctness
```

Each correctness property defined above maps to exactly one property-based test. Examples:

```typescript
// Feature: flow-state-app, Property 4: Timer state persistence round-trip
it('timer state survives localStorage round-trip', () => {
  fc.assert(
    fc.property(arbitraryTimerState(), (state) => {
      const serialized = JSON.stringify(serializeTimerState(state))
      const deserialized = deserializeTimerState(JSON.parse(serialized))
      expect(deserialized).toMatchTimerState(state)
    }),
    { numRuns: 100 }
  )
})

// Feature: flow-state-app, Property 15: Analytics aggregation correctness
it('computeDailyBreakdown matches naive aggregation', () => {
  fc.assert(
    fc.property(fc.array(arbitraryPomodoroLog()), fc.date(), (logs, date) => {
      const result = computeDailyBreakdown(logs, date, [])
      const naive = naiveDailyAggregate(logs, date)
      expect(result.totalMinutes).toBe(naive.totalMinutes)
      expect(result.sessionCount).toBe(naive.sessionCount)
    }),
    { numRuns: 100 }
  )
})

// Feature: flow-state-app, Property 26: Markdown description round-trip
it('markdown description round-trips through storage', () => {
  fc.assert(
    fc.property(fc.string(), (markdown) => {
      const stored = storeDescription(markdown)
      const retrieved = retrieveDescription(stored)
      expect(retrieved).toBe(markdown)
    }),
    { numRuns: 100 }
  )
})
```

### Unit Testing

**Framework**: Vitest (already compatible with Next.js 16 + TypeScript 5).

Unit tests focus on:
- Specific examples for API route handlers (mock Prisma, mock `verifyAuth`)
- Edge cases: empty log arrays, cards with no due date, columns with no WIP limit
- Error conditions: 401 on missing token, 422 on invalid payload, 404 on missing resource
- Integration between `TimerContext` actions and state transitions
- `computeStreaks` with boundary conditions (no sessions, single session, gap in streak)

### Test File Organization

```
src/
├── lib/
│   ├── analytics.test.ts       # Property + unit tests for all analytics functions
│   └── timer.test.ts           # Property + unit tests for timer state logic
├── app/api/
│   ├── focus-sessions/
│   │   └── route.test.ts       # Unit tests for POST/GET handlers
│   └── cards/[id]/
│       └── route.test.ts       # Unit tests for card CRUD + move
└── components/
    ├── timer/
    │   └── TimerProvider.test.tsx
    └── boards/
        └── KanbanView.test.tsx  # DnD logic, WIP limit enforcement
```
