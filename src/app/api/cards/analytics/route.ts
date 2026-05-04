import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// ---------------------------------------------------------------------------
// GET /api/cards/analytics
// Returns all non-archived cards for the authenticated user that have
// actualMinutes > 0, with fields needed for analytics computations.
// Used by the Analytics page (Requirements: 7.1, 8.1, 9.1, 10.1, 11.1).
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
        actualMinutes: { gt: 0 },
      },
      select: {
        id: true,
        title: true,
        estimatedMinutes: true,
        actualMinutes: true,
        completedPomodoros: true,
      },
      orderBy: { actualMinutes: 'desc' },
    })

    return Response.json(cards)
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
