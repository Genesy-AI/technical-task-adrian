const PHONE_EXTENSION = /\s*(?:x|ext\.?)\s*(\d{1,6})$/i

/**
 * Builds an RFC 3966 `tel:` href from a stored phone number: the leading `+` and the
 * digits are kept, separators dropped, and an extension (`x123`, `ext. 123`) becomes
 * `;ext=123`.
 */
export const toTelHref = (phoneNumber: string): string => {
  const trimmed = phoneNumber.trim()
  const extension = PHONE_EXTENSION.exec(trimmed)
  const main = extension ? trimmed.slice(0, extension.index) : trimmed
  const number = `${main.startsWith('+') ? '+' : ''}${main.replace(/\D/g, '')}`
  return `tel:${number}${extension ? `;ext=${extension[1]}` : ''}`
}

/**
 * Returns a safe href and a compact label (the path, e.g. `in/ada-lovelace`) for a
 * stored LinkedIn URL, or null if it is not an http(s) URL, so it is never rendered as
 * a link (no `javascript:` hrefs even if bad data reaches the database).
 */
export const toLinkedinLink = (linkedinUrl: string): { href: string; label: string } | null => {
  let url: URL
  try {
    url = new URL(linkedinUrl)
  } catch {
    return null
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
  const label = url.pathname.replace(/^\/+|\/+$/g, '') || url.hostname
  return { href: url.href, label }
}
