import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { CardStatus } from '@/generated/prisma/enums'

// Terminal statuses — cards in these states are excluded from the task picker
const TERMINAL_STATUSES: CardStatus[] = [CardStatus.DONE, CardStatus.CANCELLED]

// ---------------------------------------------------------------------------
// GET /api/cards/tasks
// Returns all non-archived, non-terminal cards for the authenticated user,
// with board name and column name included for context.
// Used by the Focus page task picker (Requirement 16.1).
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
        status: { notIn: TERMINAL_STATUSES },
      },
      select: {
        id: true,
        title: true,
        status: true,
        dueDate: true,
        board: { select: { id: true, name: true, color: true } },
        column: { select: { id: true, name: true } },
      },
      orderBy: [{ board: { name: 'asc' } }, { column: { position: 'asc' } }, { position: 'asc' }],
    })

    return Response.json(cards)
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
