import type { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { SessionType } from '@/generated/prisma/enums'

// ---------------------------------------------------------------------------
// GET /api/focus-sessions
// ---------------------------------------------------------------------------
// Query params:
//   page        — positive integer, default 1
//   pageSize    — positive integer, default 20, max 100
//   startDate   — ISO date string (inclusive)
//   endDate     — ISO date string (inclusive, end of day)
//   tagId       — string
//   sessionType — 'POMODORO' | 'STOPWATCH'

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const sp = req.nextUrl.searchParams

  // --- Pagination ---
  const rawPage = parseInt(sp.get('page') ?? '1', 10)
  const rawPageSize = parseInt(sp.get('pageSize') ?? '20', 10)
  const page = Number.isNaN(rawPage) || rawPage < 1 ? 1 : rawPage
  const pageSize =
    Number.isNaN(rawPageSize) || rawPageSize < 1
      ? 20
      : Math.min(rawPageSize, 100)
  const skip = (page - 1) * pageSize

  // --- Filters ---
  const startDateParam = sp.get('startDate')
  const endDateParam = sp.get('endDate')
  const tagIdParam = sp.get('tagId')
  const sessionTypeParam = sp.get('sessionType')

  // Build the where clause
  const where: {
    userId: string
    completedAt?: { gte?: Date; lte?: Date }
    tagId?: string
    sessionType?: SessionType
  } = { userId: session.user.id }

  if (startDateParam || endDateParam) {
    where.completedAt = {}
    if (startDateParam) {
      const d = new Date(startDateParam)
      if (!isNaN(d.getTime())) {
        where.completedAt.gte = d
      }
    }
    if (endDateParam) {
      const d = new Date(endDateParam)
      if (!isNaN(d.getTime())) {
        // Include the full end day
        d.setHours(23, 59, 59, 999)
        where.completedAt.lte = d
      }
    }
  }

  if (tagIdParam) {
    where.tagId = tagIdParam
  }

  if (sessionTypeParam === 'POMODORO' || sessionTypeParam === 'STOPWATCH') {
    where.sessionType = sessionTypeParam as SessionType
  }

  const [total, logs] = await Promise.all([
    prisma.pomodoroLog.count({ where }),
    prisma.pomodoroLog.findMany({
      where,
      orderBy: { completedAt: 'desc' },
      skip,
      take: pageSize,
    }),
  ])

  return Response.json({
    data: logs,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    },
  })
}

// ---------------------------------------------------------------------------
// POST /api/focus-sessions
// ---------------------------------------------------------------------------
// Required body fields:
//   sessionType  — 'POMODORO' | 'STOPWATCH'
//   duration     — positive integer (minutes)
//   startedAt    — ISO date string
//   completedAt  — ISO date string
// Optional body fields:
//   focusScore   — integer 1–10
//   notes        — string
//   tagId        — string
//   taskId       — string

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) {
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

  // --- Validate sessionType ---
  if (!input.sessionType) {
    fields.sessionType = 'sessionType is required'
  } else if (input.sessionType !== 'POMODORO' && input.sessionType !== 'STOPWATCH') {
    fields.sessionType = 'sessionType must be POMODORO or STOPWATCH'
  }

  // --- Validate duration ---
  if (input.duration === undefined || input.duration === null) {
    fields.duration = 'duration is required'
  } else if (
    typeof input.duration !== 'number' ||
    !Number.isInteger(input.duration) ||
    input.duration < 1
  ) {
    fields.duration = 'duration must be a positive integer (minutes)'
  }

  // --- Validate startedAt ---
  let startedAtDate: Date | null = null
  if (!input.startedAt) {
    fields.startedAt = 'startedAt is required'
  } else {
    startedAtDate = new Date(input.startedAt as string)
    if (isNaN(startedAtDate.getTime())) {
      fields.startedAt = 'startedAt must be a valid ISO date string'
    }
  }

  // --- Validate completedAt ---
  let completedAtDate: Date | null = null
  if (!input.completedAt) {
    fields.completedAt = 'completedAt is required'
  } else {
    completedAtDate = new Date(input.completedAt as string)
    if (isNaN(completedAtDate.getTime())) {
      fields.completedAt = 'completedAt must be a valid ISO date string'
    }
  }

  // --- Validate focusScore (optional) ---
  if (input.focusScore !== undefined && input.focusScore !== null) {
    if (
      typeof input.focusScore !== 'number' ||
      !Number.isInteger(input.focusScore) ||
      input.focusScore < 1 ||
      input.focusScore > 10
    ) {
      fields.focusScore = 'focusScore must be an integer between 1 and 10'
    }
  }

  // --- Validate notes (optional) ---
  if (input.notes !== undefined && input.notes !== null) {
    if (typeof input.notes !== 'string') {
      fields.notes = 'notes must be a string'
    }
  }

  // --- Validate tagId (optional) ---
  if (input.tagId !== undefined && input.tagId !== null) {
    if (typeof input.tagId !== 'string' || input.tagId.trim() === '') {
      fields.tagId = 'tagId must be a non-empty string'
    }
  }

  // --- Validate taskId (optional) ---
  if (input.taskId !== undefined && input.taskId !== null) {
    if (typeof input.taskId !== 'string' || input.taskId.trim() === '') {
      fields.taskId = 'taskId must be a non-empty string'
    }
  }

  if (Object.keys(fields).length > 0) {
    return Response.json({ error: 'Validation failed', fields }, { status: 422 })
  }

  // All validated — safe to cast
  const sessionType = input.sessionType as SessionType
  const duration = input.duration as number
  const focusScore =
    input.focusScore !== undefined && input.focusScore !== null
      ? (input.focusScore as number)
      : null
  const notes =
    input.notes !== undefined && input.notes !== null
      ? (input.notes as string)
      : null
  const tagId =
    input.tagId !== undefined && input.tagId !== null
      ? (input.tagId as string)
      : null
  const taskId =
    input.taskId !== undefined && input.taskId !== null
      ? (input.taskId as string)
      : null

  // Use a transaction so the PomodoroLog creation and card counter increments
  // are atomic (Requirements 16.2, 16.3).
  const log = await prisma.$transaction(async (tx) => {
    const created = await tx.pomodoroLog.create({
      data: {
        userId: session.user.id,
        sessionType,
        duration,
        startedAt: startedAtDate!,
        completedAt: completedAtDate!,
        focusScore,
        notes,
        tagId,
        taskId,
      },
    })

    // If linked to a card, increment actualMinutes (and completedPomodoros for
    // POMODORO sessions).
    if (taskId) {
      await tx.card.update({
        where: { id: taskId },
        data: {
          actualMinutes: { increment: duration },
          ...(sessionType === 'POMODORO'
            ? { completedPomodoros: { increment: 1 } }
            : {}),
        },
      })
    }

    return created
  })

  return Response.json(log, { status: 201 })
}
