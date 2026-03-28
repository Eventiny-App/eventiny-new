import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const email = process.env.SUPERADMIN_EMAIL || 'admin@eventiny.app'
  const password = process.env.SUPERADMIN_PASSWORD || 'changeme'

  const existing = await prisma.user.findUnique({ where: { email } })
  if (existing) {
    console.log(`SuperAdmin already exists: ${email}`)
    return
  }

  const passwordHash = await bcrypt.hash(password, 12)

  await prisma.user.create({
    data: {
      email,
      passwordHash,
      role: 'superadmin',
      name: 'Super Admin',
      enabled: true,
      expiresAt: null,
    },
  })

  console.log(`SuperAdmin created: ${email}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
