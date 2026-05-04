import Link from 'next/link'
import { cn } from '@/lib/utils'

export const metadata = {
  title: 'Tutorial — Flow State',
  description: 'Learn how to use Flow State to its fullest: timer, boards, analytics, and more.',
}

const SECTIONS = [
  { id: 'getting-started', label: 'Getting started' },
  { id: 'timer', label: 'Timer' },
  { id: 'boards', label: 'Boards & cards' },
  { id: 'today', label: 'Today view' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'tags', label: 'Tags' },
  { id: 'settings', label: 'Settings' },
  { id: 'shortcuts', label: 'Keyboard shortcuts' },
]

function SectionHeading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="text-2xl font-bold text-white mb-4 scroll-mt-20">
      {children}
    </h2>
  )
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return <h3 className="text-base font-semibold text-[oklch(0.88_0.01_265)] mb-2 mt-6">{children}</h3>
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex gap-3 rounded-xl border border-violet-400/20 bg-violet-400/5 p-4 my-4">
      <svg viewBox="0 0 20 20" fill="currentColor" className="size-5 shrink-0 text-violet-400 mt-0.5">
        <path fillRule="evenodd" d="M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Zm-7-4a1 1 0 1 1-2 0 1 1 0 0 1 2 0ZM9 9a.75.75 0 0 0 0 1.5h.253a.25.25 0 0 1 .244.304l-.459 2.066A1.75 1.75 0 0 0 10.747 15H11a.75.75 0 0 0 0-1.5h-.253a.25.25 0 0 1-.244-.304l.459-2.066A1.75 1.75 0 0 0 9.253 9H9Z" clipRule="evenodd" />
      </svg>
      <p className="text-sm text-[oklch(0.72_0.04_265)] leading-relaxed">{children}</p>
    </div>
  )
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4 mb-6">
      <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-violet-500/15 border border-violet-500/25 text-xs font-bold text-violet-400 mt-0.5">
        {n}
      </div>
      <div>
        <p className="text-sm font-semibold text-white mb-1">{title}</p>
        <div className="text-sm text-[oklch(0.56_0.04_265)] leading-relaxed">{children}</div>
      </div>
    </div>
  )
}

function KbdKey({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center rounded border border-white/15 bg-white/5 px-1.5 py-0.5 text-xs font-mono text-[oklch(0.75_0.04_265)]">
      {children}
    </kbd>
  )
}

function Divider() {
  return <hr className="my-12 border-white/8" />
}

export default function TutorialPage() {
  return (
    <div className="relative mx-auto max-w-6xl px-4 py-12">
      {/* Background glow */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden -z-10">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 h-[500px] w-[500px] rounded-full bg-violet-600/8 blur-[120px]" />
      </div>

      <div className="flex gap-12">
        {/* ── Sticky sidebar nav ─────────────────────────────────────────── */}
        <aside className="hidden lg:block w-52 shrink-0">
          <div className="sticky top-20">
            <p className="text-xs font-semibold uppercase tracking-wider text-[oklch(0.45_0.03_265)] mb-3">On this page</p>
            <nav className="flex flex-col gap-0.5">
              {SECTIONS.map(({ id, label }) => (
                <a
                  key={id}
                  href={`#${id}`}
                  className="rounded-lg px-3 py-1.5 text-sm text-[oklch(0.56_0.04_265)] transition-colors hover:text-white hover:bg-white/5"
                >
                  {label}
                </a>
              ))}
            </nav>
          </div>
        </aside>

        {/* ── Main content ───────────────────────────────────────────────── */}
        <article className="min-w-0 flex-1">
          {/* Page header */}
          <div className="mb-12">
            <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1 text-xs font-medium text-violet-300 mb-4">
              Tutorial
            </div>
            <h1 className="text-4xl font-bold text-white mb-4">How to use Flow State</h1>
            <p className="text-[oklch(0.56_0.04_265)] leading-relaxed max-w-2xl">
              This guide walks you through every feature — from your first focus session to reading your analytics. You don&apos;t need to read it all at once; jump to the section you need.
            </p>
          </div>

          {/* ── Getting started ──────────────────────────────────────────── */}
          <SectionHeading id="getting-started">Getting started</SectionHeading>
          <p className="text-sm text-[oklch(0.56_0.04_265)] leading-relaxed mb-6">
            Flow State uses Google sign-in — no password to remember. After signing in for the first time, your account is created automatically and you land on the Today view.
          </p>

          <Step n={1} title="Sign in with Google">
            Click <strong className="text-white">Continue with Google</strong> on the home page. You&apos;ll be redirected to Google&apos;s OAuth screen. After approving, you&apos;re taken straight to the app.
          </Step>
          <Step n={2} title="Explore the sidebar">
            The left sidebar is always visible. It has links to <strong className="text-white">Today</strong>, <strong className="text-white">Focus</strong>, <strong className="text-white">Analytics</strong>, and <strong className="text-white">Settings</strong>. The Boards section is expandable — click the chevron to see your boards.
          </Step>
          <Step n={3} title="Create your first board">
            Go to <strong className="text-white">Boards</strong> and click <strong className="text-white">New Board</strong>. Give it a name and pick a color. You&apos;ll start with default columns (To Do, In Progress, Done) that you can rename or delete.
          </Step>

          <Tip>
            The fastest way to get productive: create a board, add a few task cards, then head to the Focus page and link one of those tasks to your first timer session.
          </Tip>

          <Divider />

          {/* ── Timer ────────────────────────────────────────────────────── */}
          <SectionHeading id="timer">Timer</SectionHeading>
          <p className="text-sm text-[oklch(0.56_0.04_265)] leading-relaxed mb-6">
            The Focus page is the heart of the app. The timer runs in the background across all pages — you can navigate to your boards or analytics while a session is active.
          </p>

          <SubHeading>Pomodoro mode</SubHeading>
          <p className="text-sm text-[oklch(0.56_0.04_265)] leading-relaxed mb-4">
            Pomodoro mode cycles through focus phases and breaks automatically. The default is 25 minutes of focus, 5 minutes short break, and a 15-minute long break every 4 cycles.
          </p>
          <ul className="space-y-2 text-sm text-[oklch(0.56_0.04_265)] mb-6">
            {[
              'Focus phase (amber ring) — work on your task',
              'Short break (violet ring) — rest briefly',
              'Long break (indigo ring) — longer rest after every 4 focus phases',
              'A tone plays and a browser notification fires at each transition',
              'When a focus phase ends, the Session Complete modal appears',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="mt-1.5 size-1.5 rounded-full bg-amber-400 shrink-0" />
                {item}
              </li>
            ))}
          </ul>

          <SubHeading>Stopwatch mode</SubHeading>
          <p className="text-sm text-[oklch(0.56_0.04_265)] leading-relaxed mb-4">
            Stopwatch mode counts up from zero. Set an optional maximum duration — when reached, the timer stops and the Session Complete modal opens. Good for open-ended work sessions.
          </p>

          <SubHeading>Linking a task to your session</SubHeading>
          <p className="text-sm text-[oklch(0.56_0.04_265)] leading-relaxed mb-4">
            Before starting the timer, use the <strong className="text-white">Task Picker</strong> to select a card from any of your boards. When the session is saved, the time is automatically added to that card&apos;s actual minutes — so your task cards always reflect real work logged.
          </p>

          <SubHeading>The floating widget</SubHeading>
          <p className="text-sm text-[oklch(0.56_0.04_265)] leading-relaxed mb-4">
            Once the timer is running, a small widget appears in the bottom-right corner of every page. It shows the remaining time, the current phase, and the linked task name. You never lose track of your session.
          </p>

          <SubHeading>Session Complete modal</SubHeading>
          <p className="text-sm text-[oklch(0.56_0.04_265)] leading-relaxed mb-4">
            When a focus phase ends, a modal appears. You can:
          </p>
          <ul className="space-y-2 text-sm text-[oklch(0.56_0.04_265)] mb-6">
            {[
              'Rate your focus score (1–10) — used in analytics averages',
              'Add a note about what you worked on',
              'Select or change the tag for this session',
              'Skip saving if you don\'t want to record the session',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="mt-1.5 size-1.5 rounded-full bg-violet-400 shrink-0" />
                {item}
              </li>
            ))}
          </ul>

          <SubHeading>Adjusting timer settings inline</SubHeading>
          <p className="text-sm text-[oklch(0.56_0.04_265)] leading-relaxed mb-4">
            Expand the <strong className="text-white">Timer Settings</strong> panel on the Focus page to change durations without going to Settings. Changes take effect on the next phase. You can also save them permanently from the Settings page.
          </p>

          <Tip>
            The timer state is saved to localStorage. If you close the browser tab while the timer is running, it picks up exactly where it left off when you reopen the app.
          </Tip>

          <Divider />

          {/* ── Boards ───────────────────────────────────────────────────── */}
          <SectionHeading id="boards">Boards &amp; cards</SectionHeading>
          <p className="text-sm text-[oklch(0.56_0.04_265)] leading-relaxed mb-6">
            Boards are Kanban-style workspaces. Each board has columns, and each column holds cards (tasks). You can have as many boards as you need — one per project, one per area of life, whatever works for you.
          </p>

          <SubHeading>Creating and managing boards</SubHeading>
          <ul className="space-y-2 text-sm text-[oklch(0.56_0.04_265)] mb-6">
            {[
              'Go to Boards → New Board. Give it a name and a color.',
              'Star a board to pin it to the top of the list.',
              'Archive a board to hide it without deleting it.',
              'The sidebar shows your boards — click the chevron to expand the list.',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="mt-1.5 size-1.5 rounded-full bg-violet-400 shrink-0" />
                {item}
              </li>
            ))}
          </ul>

          <SubHeading>Columns</SubHeading>
          <ul className="space-y-2 text-sm text-[oklch(0.56_0.04_265)] mb-6">
            {[
              'Add a column with the + button at the right end of the board.',
              'Rename a column by clicking its header.',
              'Set a WIP (work-in-progress) limit — the column header turns amber when the limit is reached, and new cards are blocked.',
              'Collapse a column to save space while keeping the header visible.',
              'Delete a column — if it has cards, you\'ll be asked where to move them first.',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="mt-1.5 size-1.5 rounded-full bg-violet-400 shrink-0" />
                {item}
              </li>
            ))}
          </ul>

          <SubHeading>Cards</SubHeading>
          <p className="text-sm text-[oklch(0.56_0.04_265)] leading-relaxed mb-4">
            Click any card to open the Card Detail modal. From there you can:
          </p>
          <ul className="space-y-2 text-sm text-[oklch(0.56_0.04_265)] mb-6">
            {[
              'Edit the title, description (Markdown), and due date',
              'Add labels (color-coded, board-scoped)',
              'Add subtasks and check them off as you go — a progress bar shows completion',
              'Leave comments and see an activity log of all changes',
              'Set an estimated time — actual minutes are tracked automatically from linked sessions',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="mt-1.5 size-1.5 rounded-full bg-violet-400 shrink-0" />
                {item}
              </li>
            ))}
          </ul>

          <SubHeading>Drag and drop</SubHeading>
          <p className="text-sm text-[oklch(0.56_0.04_265)] leading-relaxed mb-4">
            Drag cards within a column to reorder them, or drag them to a different column to move them. The board uses fractional indexing so positions are always stable. WIP limits are enforced on drop — if a column is full, the card snaps back.
          </p>

          <SubHeading>Kanban vs List view</SubHeading>
          <p className="text-sm text-[oklch(0.56_0.04_265)] leading-relaxed mb-4">
            Toggle between Kanban (column layout) and List (flat table) views using the buttons in the board toolbar. The preference is saved per board. List view is useful for sorting and scanning all cards at once.
          </p>

          <Tip>
            Overdue cards are highlighted in red. Keep an eye on the Today view — it surfaces overdue and in-progress cards automatically.
          </Tip>

          <Divider />

          {/* ── Today ────────────────────────────────────────────────────── */}
          <SectionHeading id="today">Today view</SectionHeading>
          <p className="text-sm text-[oklch(0.56_0.04_265)] leading-relaxed mb-6">
            The Today view is your daily planning surface. It shows a task list on the left and the timer on the right — everything you need to plan and execute your day in one place.
          </p>

          <SubHeading>What appears in the task list</SubHeading>
          <ul className="space-y-2 text-sm text-[oklch(0.56_0.04_265)] mb-6">
            {[
              'Cards with a due date of today',
              'Overdue cards (past due date, not yet done or cancelled)',
              'Cards currently marked as In Progress',
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <span className="mt-1.5 size-1.5 rounded-full bg-emerald-400 shrink-0" />
                {item}
              </li>
            ))}
          </ul>

          <SubHeading>Starting a session from Today</SubHeading>
          <Step n={1} title="Select a task">
            Click a card in the task list to select it (radio-style highlight).
          </Step>
          <Step n={2} title="Start the timer">
            A <strong className="text-white">Start timer with selected task</strong> button appears at the bottom of the list. Click it to link the task and start the timer simultaneously.
          </Step>
          <Step n={3} title="Work and complete">
            The timer runs on the right. When the focus phase ends, the Session Complete modal appears and the time is logged to the card.
          </Step>

          <Divider />

          {/* ── Analytics ────────────────────────────────────────────────── */}
          <SectionHeading id="analytics">Analytics</SectionHeading>
          <p className="text-sm text-[oklch(0.56_0.04_265)] leading-relaxed mb-6">
            The Analytics page has six tabs. All data is computed client-side from your raw session history — no estimates, no guesses.
          </p>

          <div className="grid sm:grid-cols-2 gap-4 mb-8">
            {[
              {
                tab: 'Overview',
                color: 'text-violet-400',
                bg: 'bg-violet-400/10',
                border: 'border-violet-400/15',
                desc: "Today's stats, current and best streaks, a 12-month calendar heatmap, and your top 5 tasks by focus time.",
              },
              {
                tab: 'Day',
                color: 'text-amber-400',
                bg: 'bg-amber-400/10',
                border: 'border-amber-400/15',
                desc: 'Drill into any single day. See a tag donut chart, a session timeline, and a per-task breakdown.',
              },
              {
                tab: 'Week',
                color: 'text-cyan-400',
                bg: 'bg-cyan-400/10',
                border: 'border-cyan-400/15',
                desc: 'Weekly totals with a daily bar chart and tag distribution. Navigate week by week.',
              },
              {
                tab: 'Month',
                color: 'text-emerald-400',
                bg: 'bg-emerald-400/10',
                border: 'border-emerald-400/15',
                desc: 'Monthly heatmap, tag donut, and an auto-generated insight about your most productive day and consistency.',
              },
              {
                tab: 'Year',
                color: 'text-rose-400',
                bg: 'bg-rose-400/10',
                border: 'border-rose-400/15',
                desc: 'Quarterly breakdown, monthly trend line, yearly highlights, and a consistency score.',
              },
              {
                tab: 'Calendar',
                color: 'text-indigo-400',
                bg: 'bg-indigo-400/10',
                border: 'border-indigo-400/15',
                desc: 'Monthly calendar grid with focus minutes per day and due cards. Click a day to see its sessions and tasks.',
              },
            ].map(({ tab, color, bg, border, desc }) => (
              <div key={tab} className={cn('rounded-xl border p-4', border, bg.replace('/10', '/5'))}>
                <span className={cn('text-xs font-semibold', color)}>{tab}</span>
                <p className="text-xs text-[oklch(0.52_0.04_265)] mt-1 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>

          <Tip>
            The heatmap on the Overview tab shows the trailing 12 months. Darker cells = more focus time. Hover any cell to see the exact date and minutes.
          </Tip>

          <Divider />

          {/* ── Tags ─────────────────────────────────────────────────────── */}
          <SectionHeading id="tags">Tags</SectionHeading>
          <p className="text-sm text-[oklch(0.56_0.04_265)] leading-relaxed mb-6">
            Tags are color-coded labels you attach to focus sessions. They&apos;re the primary way to categorize your time in analytics — think &quot;Deep Work&quot;, &quot;Admin&quot;, &quot;Learning&quot;, etc.
          </p>

          <SubHeading>Creating tags</SubHeading>
          <p className="text-sm text-[oklch(0.56_0.04_265)] leading-relaxed mb-4">
            Open the <strong className="text-white">Tag Manager</strong> from the Focus page (the tag selector has a manage button). Give the tag a name and pick a hex color. Tags are global — they apply across all boards and sessions.
          </p>

          <SubHeading>Using tags</SubHeading>
          <p className="text-sm text-[oklch(0.56_0.04_265)] leading-relaxed mb-4">
            Select a tag from the Tag Selector on the Focus page before starting the timer. The tag is attached to the session when it&apos;s saved. You can also change the tag in the Session Complete modal.
          </p>

          <Tip>
            Tags are different from card labels. Labels are board-scoped and appear on cards. Tags are session-scoped and appear in analytics. A session can have one tag; a card can have many labels.
          </Tip>

          <Divider />

          {/* ── Settings ─────────────────────────────────────────────────── */}
          <SectionHeading id="settings">Settings</SectionHeading>
          <p className="text-sm text-[oklch(0.56_0.04_265)] leading-relaxed mb-6">
            The Settings page lets you configure timer durations and notification preferences. Changes are saved to your account and sync across devices.
          </p>

          <div className="rounded-xl border border-white/8 bg-[oklch(0.14_0.025_265)] overflow-hidden mb-6">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/8">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[oklch(0.45_0.03_265)] uppercase tracking-wider">Setting</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[oklch(0.45_0.03_265)] uppercase tracking-wider">Default</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[oklch(0.45_0.03_265)] uppercase tracking-wider">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {[
                  ['Focus duration', '25 min', 'Length of each focus phase'],
                  ['Short break', '5 min', 'Break after each focus phase'],
                  ['Long break', '15 min', 'Break after every N focus phases'],
                  ['Long break interval', '4 cycles', 'How many focus phases before a long break'],
                  ['Sound', 'On', 'Plays a tone at each phase transition'],
                  ['Browser notifications', 'Off', 'Requires browser permission when enabled'],
                ].map(([setting, def, note]) => (
                  <tr key={setting}>
                    <td className="px-4 py-3 text-[oklch(0.88_0.01_265)]">{setting}</td>
                    <td className="px-4 py-3 text-[oklch(0.56_0.04_265)]">{def}</td>
                    <td className="px-4 py-3 text-[oklch(0.45_0.03_265)] text-xs">{note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Tip>
            You can also adjust timer durations inline on the Focus page without going to Settings. Those changes are temporary unless you save them from the Settings page.
          </Tip>

          <Divider />

          {/* ── Shortcuts ────────────────────────────────────────────────── */}
          <SectionHeading id="shortcuts">Keyboard shortcuts</SectionHeading>
          <p className="text-sm text-[oklch(0.56_0.04_265)] leading-relaxed mb-6">
            Flow State is designed to be keyboard-friendly. Here are all the shortcuts:
          </p>

          <div className="rounded-xl border border-white/8 bg-[oklch(0.14_0.025_265)] overflow-hidden mb-8">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/8">
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[oklch(0.45_0.03_265)] uppercase tracking-wider">Shortcut</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-[oklch(0.45_0.03_265)] uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {[
                  [<><KbdKey>Ctrl</KbdKey> + <KbdKey>K</KbdKey> / <KbdKey>⌘</KbdKey> + <KbdKey>K</KbdKey></>, 'Open command palette'],
                  [<KbdKey>N</KbdKey>, 'New card (on the Boards page — opens the form on the first column)'],
                  [<KbdKey>B</KbdKey>, 'Focus the Boards section in the sidebar'],
                  [<KbdKey>F</KbdKey>, 'Navigate to the Focus page'],
                  [<><KbdKey>↑</KbdKey> <KbdKey>↓</KbdKey></>, 'Navigate command palette results'],
                  [<KbdKey>Enter</KbdKey>, 'Select highlighted command palette result'],
                  [<KbdKey>Esc</KbdKey>, 'Close command palette or modal'],
                ].map(([shortcut, action], i) => (
                  <tr key={i}>
                    <td className="px-4 py-3 font-mono">{shortcut}</td>
                    <td className="px-4 py-3 text-[oklch(0.56_0.04_265)]">{action}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <SubHeading>Command palette</SubHeading>
          <p className="text-sm text-[oklch(0.56_0.04_265)] leading-relaxed mb-4">
            Press <KbdKey>Ctrl+K</KbdKey> (or <KbdKey>⌘K</KbdKey> on Mac) from anywhere in the app. The palette searches boards by name, cards by title, and navigation links. When the query is empty, it shows a keyboard shortcuts reference.
          </p>

          <Divider />

          {/* ── CTA ──────────────────────────────────────────────────────── */}
          <div className="rounded-2xl border border-violet-400/20 bg-gradient-to-br from-violet-400/5 to-transparent p-8 text-center">
            <h2 className="text-xl font-bold text-white mb-2">Ready to try it?</h2>
            <p className="text-sm text-[oklch(0.56_0.04_265)] mb-6">
              Sign in with Google and start your first session in under a minute.
            </p>
            <Link
              href="/"
              className={cn(
                'inline-flex items-center gap-2 rounded-xl',
                'bg-violet-600 px-6 py-3',
                'text-sm font-semibold text-white',
                'transition-all hover:bg-violet-500 active:scale-[0.98]',
              )}
            >
              Get started
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth={1.5} className="size-4">
                <path d="M3 8h10M9 4l4 4-4 4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </div>
        </article>
      </div>
    </div>
  )
}
