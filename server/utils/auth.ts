import jwt from 'jsonwebtoken'
import type { H3Event } from 'h3'

export interface JwtPayload {
  userId?: string
  judgeId?: string
  hostId?: string
  eventId?: string
  role: 'superadmin' | 'organizer' | 'judge' | 'host'
}

export function signToken(payload: JwtPayload): string {
  const config = useRuntimeConfig()
  return jwt.sign(payload, config.jwtSecret, { expiresIn: '7d' })
}

export function verifyToken(token: string): JwtPayload {
  const config = useRuntimeConfig()
  return jwt.verify(token, config.jwtSecret) as JwtPayload
}

export function getTokenFromEvent(event: H3Event): string | null {
  const authHeader = getHeader(event, 'authorization')
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7)
  }

  const cookie = getCookie(event, 'eventiny_token')
  return cookie || null
}

export function requireAuth(event: H3Event, ...allowedRoles: JwtPayload['role'][]): JwtPayload {
  const token = getTokenFromEvent(event)
  if (!token) {
    throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
  }

  let payload: JwtPayload
  try {
    payload = verifyToken(token)
  } catch {
    throw createError({ statusCode: 401, statusMessage: 'Invalid or expired token' })
  }

  if (allowedRoles.length > 0 && !allowedRoles.includes(payload.role)) {
    throw createError({ statusCode: 403, statusMessage: 'Insufficient permissions' })
  }

  return payload
}
