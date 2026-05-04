import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// ---------------------------------------------------------------------------
// GET /api/cards/calendar
// Returns all non-archived cards that have a dueDate set, for the
// authenticated user. Used by the Analytics Calendar tab to show due cards
// on their respective days.
// Requirements: 7.2, 7.3
// ---------------------------------------------------------------------------
export async function GET() {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const cards = await prisma.card.findMany({
      where: {
        board: { userId: session.user.id, isArchived: false },
        isArchived: false,
        dueDate: { not: null },
      },
      select: {
        id: true,
        title: true,
        status: true,
        dueDate: true,
        isArchived: true,
        boardId: true,
      },
      orderBy: { dueDate: 'asc' },
    })

    return Response.json(cards)
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
