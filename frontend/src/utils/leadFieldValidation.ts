// Validation and normalization for the optional lead fields phoneNumber, yearsAtCompany
// and linkedinUrl. Mirrored in backend/src/utils/leadFieldValidation.ts — keep both in sync.

/**
 * Upper bound on the trimmed phone input. A 15-digit number with separators and a
 * 6-digit extension fits well within it, and it keeps the regex below from doing
 * quadratic backtracking on long hostile input.
 */
const PHONE_MAX_LENGTH = 50
const PHONE_PATTERN = /^\+?[0-9()\-.\s]+(?:\s*(?:x|ext\.?)\s*\d{1,6})?$/i
const PHONE_EXTENSION = /\s*(?:x|ext\.?)\s*\d{1,6}$/i
const PHONE_MIN_DIGITS = 7
const PHONE_MAX_DIGITS = 15

export const YEARS_AT_COMPANY_MAX = 80

/** Trims a phone number, keeping it as typed. Returns undefined for blank input. */
export const normalizePhoneNumber = (value: string | null | undefined): string | undefined => {
  const normalized = value?.trim()
  return normalized || undefined
}

/**
 * True if `phone` (surrounding whitespace ignored) is made of digits, spaces and
 * `+ ( ) - .`, optionally followed by an extension (`x123`, `ext. 123`), and the part
 * before the extension has 7–15 digits.
 */
export const isValidPhoneNumber = (phone: string): boolean => {
  const normalized = normalizePhoneNumber(phone)
  if (normalized === undefined || normalized.length > PHONE_MAX_LENGTH || !PHONE_PATTERN.test(normalized)) {
    return false
  }
  const digitCount = normalized.replace(PHONE_EXTENSION, '').replace(/\D/g, '').length
  return digitCount >= PHONE_MIN_DIGITS && digitCount <= PHONE_MAX_DIGITS
}

/** True if `value` is an integer number of years between 0 and 80 inclusive. */
export const isValidYearsAtCompany = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= YEARS_AT_COMPANY_MAX

/**
 * Parses years at company from text such as a CSV cell: the trimmed value must be
 * whole-number digits only (no sign, decimals or exponent) within 0–80. Returns
 * undefined for blank or invalid input; callers tell the two apart by checking for
 * blank input first.
 */
export const parseYearsAtCompany = (value: string | null | undefined): number | undefined => {
  const trimmed = value?.trim()
  if (!trimmed || !/^\d+$/.test(trimmed)) return undefined
  const years = Number(trimmed)
  return isValidYearsAtCompany(years) ? years : undefined
}

const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:\/\//i

/**
 * Normalizes a LinkedIn profile/company URL to `https://<host><path>` with no trailing
 * slash, query or fragment. A missing scheme is treated as `https://`. Returns undefined
 * if the input is blank, not an http(s) URL on linkedin.com (or a subdomain), or has no
 * path. Idempotent: normalizing a normalized URL returns it unchanged.
 */
export const normalizeLinkedinUrl = (value: string | null | undefined): string | undefined => {
  const trimmed = value?.trim()
  if (!trimmed) return undefined

  let url: URL
  try {
    url = new URL(HAS_SCHEME.test(trimmed) ? trimmed : `https://${trimmed}`)
  } catch {
    return undefined
  }

  if (url.protocol !== 'https:' && url.protocol !== 'http:') return undefined
  if (url.hostname !== 'linkedin.com' && !url.hostname.endsWith('.linkedin.com')) return undefined

  const pathname = url.pathname.replace(/\/+$/, '')
  if (!pathname) return undefined

  return `https://${url.hostname}${pathname}`
}
