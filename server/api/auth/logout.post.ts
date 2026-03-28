export default defineEventHandler(async (event) => {
  deleteCookie(event, 'eventiny_token', { path: '/' })
  return { ok: true }
})
