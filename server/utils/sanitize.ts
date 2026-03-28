/**
 * Sanitize a name: trim whitespace, normalize Unicode (NFC),
 * reject control characters, enforce max length.
 */
export function sanitizeName(raw: string): string {
  // Normalize Unicode to NFC form
  let name = raw.normalize('NFC')

  // Remove control characters (except normal whitespace)
  name = name.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')

  // Collapse multiple spaces into one, trim
  name = name.replace(/\s+/g, ' ').trim()

  // Max length 100 characters
  if (name.length > 100) {
    name = name.slice(0, 100).trim()
  }

  return name
}

/**
 * Validate that a name is non-empty after sanitization.
 */
export function validateName(raw: string): { valid: boolean; sanitized: string; error?: string } {
  const sanitized = sanitizeName(raw)
  if (sanitized.length === 0) {
    return { valid: false, sanitized, error: 'Name cannot be empty' }
  }
  if (sanitized.length < 2) {
    return { valid: false, sanitized, error: 'Name must be at least 2 characters' }
  }
  return { valid: true, sanitized }
}
