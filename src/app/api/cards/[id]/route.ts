import type { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { CardStatus } from '@/generated/prisma/enums'

type RouteContext = { params: Promise<{ id: string }> }

// ---------------------------------------------------------------------------
// GET /api/cards/[id] — card with subtasks, labels, comments, activity
// ---------------------------------------------------------------------------
export async function GET(_req: NextRequest, ctx: RouteContext) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await ctx.params

  try {
    const card = await prisma.card.findUnique({
      where: { id },
      include: {
        subtasks: {
          orderBy: { position: 'asc' },
        },
        labels: {
          include: {
            label: true,
          },
        },
        comments: {
          orderBy: { createdAt: 'asc' },
          include: {
            user: {
              select: { id: true, name: true, image: true },
            },
          },
        },
        activities: {
          orderBy: { createdAt: 'asc' },
          include: {
            user: {
              select: { id: true, name: true, image: true },
            },
          },
        },
        board: {
          select: { userId: true },
        },
      },
    })

    if (!card) {
      return Response.json({ error: 'Not found' }, { status: 404 })
    }

    if (card.board.userId !== session.user.id) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Strip the board ownership field from the response
    const { board: _board, ...cardData } = card
    return Response.json(cardData)
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// PUT /api/cards/[id] — update title, description, dueDate, status, estimatedMinutes
// Logs a CardActivity record for each changed field (in a transaction).
// ---------------------------------------------------------------------------
export async function PUT(req: NextRequest, ctx: RouteContext) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await ctx.params

  // Verify card exists and user owns the parent board
  const existing = await prisma.card.findUnique({
    where: { id },
    include: { board: { select: { userId: true } } },
  })
  if (!existing) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }
  if (existing.board.userId !== session.user.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  if (typeof body !== 'object' || body === null) {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const input = body as Record<string, unknown>
  const fields: Record<string, string> = {}
  const data: {
    title?: string
    description?: string | null
    dueDate?: Date | null
    status?: CardStatus
    estimatedMinutes?: number | null
  } = {}

  if (input.title !== undefined) {
    if (typeof input.title !== 'string' || input.title.trim() === '') {
      fields.title = 'title must be a non-empty string'
    } else {
      data.title = input.title.trim()
    }
  }

  if (input.description !== undefined) {
    if (input.description === null) {
      data.description = null
    } else if (typeof input.description !== 'string') {
      fields.description = 'description must be a string or null'
    } else {
      data.description = input.description
    }
  }

  if (input.dueDate !== undefined) {
    if (input.dueDate === null) {
      data.dueDate = null
    } else if (typeof input.dueDate !== 'string') {
      fields.dueDate = 'dueDate must be an ISO date string or null'
    } else {
      const parsed = new Date(input.dueDate)
      if (isNaN(parsed.getTime())) {
        fields.dueDate = 'dueDate must be a valid ISO date string'
      } else {
        data.dueDate = parsed
      }
    }
  }

  if (input.status !== undefined) {
    const validStatuses: string[] = Object.values(CardStatus)
    if (typeof input.status !== 'string' || !validStatuses.includes(input.status)) {
      fields.status = `status must be one of: ${validStatuses.join(', ')}`
    } else {
      data.status = input.status as CardStatus
    }
  }

  if (input.estimatedMinutes !== undefined) {
    if (input.estimatedMinutes === null) {
      data.estimatedMinutes = null
    } else if (
      typeof input.estimatedMinutes !== 'number' ||
      !Number.isInteger(input.estimatedMinutes) ||
      input.estimatedMinutes < 1
    ) {
      fields.estimatedMinutes = 'estimatedMinutes must be a positive integer or null'
    } else {
      data.estimatedMinutes = input.estimatedMinutes as number
    }
  }

  if (Object.keys(fields).length > 0) {
    return Response.json({ error: 'Validation failed', fields }, { status: 422 })
  }

  if (Object.keys(data).length === 0) {
    return Response.json(
      {
        error: 'Validation failed',
        fields: {
          _: 'At least one of title, description, dueDate, status, or estimatedMinutes must be provided',
        },
      },
      { status: 422 },
    )
  }

  // Build activity records for changed fields
  type ActivityInput = { field: string; oldValue: string | null; newValue: string | null }
  const activities: ActivityInput[] = []

  if (data.title !== undefined && data.title !== existing.title) {
    activities.push({ field: 'title', oldValue: existing.title, newValue: data.title })
  }
  if ('description' in data && data.description !== existing.description) {
    activities.push({
      field: 'description',
      oldValue: existing.description ?? null,
      newValue: data.description ?? null,
    })
  }
  if ('dueDate' in data) {
    const oldVal = existing.dueDate ? existing.dueDate.toISOString() : null
    const newVal = data.dueDate ? data.dueDate.toISOString() : null
    if (oldVal !== newVal) {
      activities.push({ field: 'dueDate', oldValue: oldVal, newValue: newVal })
    }
  }
  if (data.status !== undefined && data.status !== existing.status) {
    activities.push({ field: 'status', oldValue: existing.status, newValue: data.status })
  }
  if ('estimatedMinutes' in data) {
    const oldVal = existing.estimatedMinutes !== null ? String(existing.estimatedMinutes) : null
    const newVal = data.estimatedMinutes !== null && data.estimatedMinutes !== undefined
      ? String(data.estimatedMinutes)
      : null
    if (oldVal !== newVal) {
      activities.push({ field: 'estimatedMinutes', oldValue: oldVal, newValue: newVal })
    }
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      const card = await tx.card.update({ where: { id }, data })

      if (activities.length > 0) {
        await tx.cardActivity.createMany({
          data: activities.map((a) => ({
            cardId: id,
            userId: session.user.id,
            field: a.field,
            oldValue: a.oldValue,
            newValue: a.newValue,
          })),
        })
      }

      return card
    })

    return Response.json(updated)
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/cards/[id] — soft delete (set isArchived = true)
// ---------------------------------------------------------------------------
export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { id } = await ctx.params

  const existing = await prisma.card.findUnique({
    where: { id },
    include: { board: { select: { userId: true } } },
  })
  if (!existing) {
    return Response.json({ error: 'Not found' }, { status: 404 })
  }
  if (existing.board.userId !== session.user.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await prisma.card.update({ where: { id }, data: { isArchived: true } })
    return new Response(null, { status: 204 })
  } catch {
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
