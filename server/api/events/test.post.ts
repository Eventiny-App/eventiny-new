import { z } from 'zod'

const testEventSchema = z.object({
  name: z.string().min(2).max(200).default('Test Event'),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  hipHopCount: z.number().int().min(1).max(200).default(30),
  breakingCount: z.number().int().min(1).max(200).default(30),
  choreoCount: z.number().int().min(1).max(200).default(30),
})

// Prefix + suffix combos → 20 × 16 = 320 unique names, enough for up to 200 per category
const NAME_PREFIXES = [
  'Ace', 'Blaze', 'Cipher', 'Devo', 'Echo', 'Flex', 'Ghost', 'Hustle',
  'Ice', 'Jinx', 'Kilo', 'Lyric', 'Monk', 'Nova', 'Orbit', 'Prism',
  'Quest', 'Razor', 'Shift', 'Titan',
]
const NAME_SUFFIXES = [
  'One', 'B', 'K', 'D', 'Style', 'Flow', 'Rock', 'Move',
  'Funk', 'Spin', 'Drop', 'G', 'X', 'Z', 'Jr', 'Solo',
]

// Build a full pool of 320 unique names and cache it
const NAME_POOL: string[] = []
for (const prefix of NAME_PREFIXES) {
  for (const suffix of NAME_SUFFIXES) {
    NAME_POOL.push(`${prefix} ${suffix}`)
  }
}

function shuffled<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    const tmp = a[i] as T
    a[i] = a[j] as T
    a[j] = tmp
  }
  return a
}

export default defineEventHandler(async (event) => {
  const auth = requireAuth(event, 'organizer', 'superadmin')

  const body = await readValidatedBody(event, testEventSchema.parse)

  const nameResult = validateName(body.name)
  if (!nameResult.valid) {
    throw createError({ statusCode: 400, statusMessage: nameResult.error })
  }

  if (new Date(body.endDate) <= new Date(body.startDate)) {
    throw createError({ statusCode: 400, statusMessage: 'End date must be after start date' })
  }

  const totalParticipants = body.hipHopCount + body.breakingCount + body.choreoCount
  if (totalParticipants > NAME_POOL.length) {
    throw createError({
      statusCode: 400,
      statusMessage: `Total participants (${totalParticipants}) exceeds the name pool size (${NAME_POOL.length}). Reduce the counts.`,
    })
  }

  const result = await prisma.$transaction(async (tx) => {
    // 1. Event
    const newEvent = await tx.event.create({
      data: {
        name: nameResult.sanitized,
        startDate: new Date(body.startDate),
        endDate: new Date(body.endDate),
        organizerId: auth.userId!,
      },
      select: { id: true, name: true },
    })

    // 2. Categories
    const hipHopCat = await tx.category.create({
      data: {
        eventId: newEvent.id,
        name: 'Hip Hop',
        type: 'battle',
        bracketSize: 16,
        battleVotingMode: 'app',
        sortOrder: 0,
      },
      select: { id: true },
    })

    const breakingCat = await tx.category.create({
      data: {
        eventId: newEvent.id,
        name: 'Breaking',
        type: 'battle',
        bracketSize: 16,
        battleVotingMode: 'app',
        sortOrder: 1,
      },
      select: { id: true },
    })

    const choreoCat = await tx.category.create({
      data: {
        eventId: newEvent.id,
        name: 'Hip Hop Choreo',
        type: 'choreo',
        sortOrder: 2,
      },
      select: { id: true },
    })

    // 3. CategoryState for each category
    await tx.categoryState.createMany({
      data: [
        { categoryId: hipHopCat.id },
        { categoryId: breakingCat.id },
        { categoryId: choreoCat.id },
      ],
    })

    // 4. Choreo themes
    await tx.choreoTheme.createMany({
      data: [
        { categoryId: choreoCat.id, name: 'Technique',       sortOrder: 0 },
        { categoryId: choreoCat.id, name: 'Musicality',      sortOrder: 1 },
        { categoryId: choreoCat.id, name: 'Choreo',          sortOrder: 2 },
        { categoryId: choreoCat.id, name: 'Stage Presence',  sortOrder: 3 },
        { categoryId: choreoCat.id, name: 'Originality',     sortOrder: 4 },
      ],
    })

    // 5. Participants — shuffle once and slice sequentially to avoid any duplicate names across categories
    const allNames = shuffled(NAME_POOL)
    let cursor = 0
    const hipHopNames   = allNames.slice(cursor, cursor += body.hipHopCount)
    const breakingNames = allNames.slice(cursor, cursor += body.breakingCount)
    const choreoNames   = allNames.slice(cursor, cursor += body.choreoCount)

    // Create participants and collect their IDs grouped by category
    const hipHopParticipants = await Promise.all(
      hipHopNames.map(name =>
        tx.participant.create({
          data: { eventId: newEvent.id, name },
          select: { id: true },
        })
      )
    )
    const breakingParticipants = await Promise.all(
      breakingNames.map(name =>
        tx.participant.create({
          data: { eventId: newEvent.id, name },
          select: { id: true },
        })
      )
    )
    const choreoParticipants = await Promise.all(
      choreoNames.map(name =>
        tx.participant.create({
          data: { eventId: newEvent.id, name },
          select: { id: true },
        })
      )
    )

    // 6. ParticipantCategory joins
    await tx.participantCategory.createMany({
      data: [
        ...hipHopParticipants.map(p => ({ participantId: p.id, categoryId: hipHopCat.id })),
        ...breakingParticipants.map(p => ({ participantId: p.id, categoryId: breakingCat.id })),
        ...choreoParticipants.map(p => ({ participantId: p.id, categoryId: choreoCat.id })),
      ],
    })

    // 7. Judges (fixed test PINs)
    const judgeData = [
      { name: 'Joseph Go',   accessPin: '1001' },
      { name: 'Kris',        accessPin: '1002' },
      { name: 'Mamson',      accessPin: '1003' },
      { name: 'Link',        accessPin: '1004' },
      { name: 'Jimmy Yudat', accessPin: '1005' },
    ]
    const judges = await Promise.all(
      judgeData.map(d =>
        tx.judge.create({
          data: { eventId: newEvent.id, name: d.name, accessPin: d.accessPin },
          select: { id: true, name: true },
        })
      )
    )
    const [josephGo, kris, mamson, link, jimmyYudat] = judges as [typeof judges[0], typeof judges[0], typeof judges[0], typeof judges[0], typeof judges[0]]

    // 8. JudgeCategory assignments:
    //    Joseph Go, Link, Jimmy Yudat → Hip Hop + Breaking
    //    Kris, Mamson → Choreo only
    await tx.judgeCategory.createMany({
      data: [
        { judgeId: josephGo.id,   categoryId: hipHopCat.id },
        { judgeId: josephGo.id,   categoryId: breakingCat.id },
        { judgeId: link.id,       categoryId: hipHopCat.id },
        { judgeId: link.id,       categoryId: breakingCat.id },
        { judgeId: jimmyYudat.id, categoryId: hipHopCat.id },
        { judgeId: jimmyYudat.id, categoryId: breakingCat.id },
        { judgeId: kris.id,       categoryId: choreoCat.id },
        { judgeId: mamson.id,     categoryId: choreoCat.id },
      ],
    })

    // 9. Host
    const dulk = await tx.host.create({
      data: { eventId: newEvent.id, name: 'Dulk', accessPin: '2001' },
      select: { id: true },
    })

    // 10. HostCategory assignments (all 3 categories)
    await tx.hostCategory.createMany({
      data: [
        { hostId: dulk.id, categoryId: hipHopCat.id },
        { hostId: dulk.id, categoryId: breakingCat.id },
        { hostId: dulk.id, categoryId: choreoCat.id },
      ],
    })

    return newEvent
  })

  return result
})
