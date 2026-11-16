import { describe, it, expect } from 'vitest'
import { isValidCountryCode, normalizeCountryCode } from './countryCodes'

describe('normalizeCountryCode', () => {
  it('trims and upper-cases', () => {
    expect(normalizeCountryCode(' us ')).toBe('US')
  })

  it('returns undefined for blank input', () => {
    expect(normalizeCountryCode('')).toBeUndefined()
    expect(normalizeCountryCode('   ')).toBeUndefined()
    expect(normalizeCountryCode(null)).toBeUndefined()
    expect(normalizeCountryCode(undefined)).toBeUndefined()
  })
})

describe('isValidCountryCode', () => {
  it('accepts ISO 3166-1 alpha-2 codes, case-insensitively', () => {
    for (const code of ['US', 'ES', 'GB', 'TV', 'ZW', 'ad', ' fr ']) {
      expect(isValidCountryCode(code)).toBe(true)
    }
  })

  it('rejects values that are not assigned alpha-2 codes', () => {
    for (const code of ['', 'XXX', '12', 'U', 'USA', 'ZZ', 'UK', 'EU', 'U$', 'ÉS']) {
      expect(isValidCountryCode(code)).toBe(false)
    }
  })
})
