import type { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// ---------------------------------------------------------------------------
// GET /api/cards/today — non-archived cards that are:
//   1. due today (dueDate falls within today's date range), OR
//   2. overdue (dueDate in the past) with non-terminal status, OR
//   3. status === 'IN_PROGRESS'
// ---------------------------------------------------------------------------
export async function GET(_req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const now = new Date()
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000)

  const TERMINAL_STATUSES = ['DONE', 'CANCELLED'] as const

  try {
    const cards = await prisma.card.findMany({
      where: {
        board: { userId: session.user.id },
        isArchived: false,
        OR: [
          // Due today
          { dueDate: { gte: todayStart, lt: todayEnd } },
          // Overdue with non-terminal status
          {
            dueDate: { lt: todayStart },
            status: { notIn: TERMINAL_STATUSES },
          },
          // In progress
          { status: 'IN_PROGRESS' },
        ],
      },
      include: {
        column: { select: { id: true, name: true } },
        board: { select: { id: true, name: true } },
        subtasks: { orderBy: { position: 'asc' } },
        labels: { include: { label: true } },
      },
      orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }],
    })

    return Response.json(cards)
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
