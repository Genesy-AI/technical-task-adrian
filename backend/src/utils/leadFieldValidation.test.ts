import { describe, it, expect } from 'vitest'
import {
  isValidPhoneNumber,
  isValidYearsAtCompany,
  normalizeLinkedinUrl,
  normalizePhoneNumber,
} from './leadFieldValidation'

describe('normalizePhoneNumber', () => {
  it('trims and keeps the value as typed', () => {
    expect(normalizePhoneNumber('  (760)551-9973x6454 ')).toBe('(760)551-9973x6454')
  })

  it('returns undefined for blank, null or undefined', () => {
    expect(normalizePhoneNumber('')).toBeUndefined()
    expect(normalizePhoneNumber('   ')).toBeUndefined()
    expect(normalizePhoneNumber(null)).toBeUndefined()
    expect(normalizePhoneNumber(undefined)).toBeUndefined()
  })
})

describe('isValidPhoneNumber', () => {
  // Every phone number in docs/*.csv.
  it.each([
    '(731)123-9702',
    '(760)551-9973x6454',
    '(816)237-0737x0663',
    '+1-076-096-4074x6140',
    '+1-280-754-0462x2154',
    '+1-444-818-4212',
    '+1-627-991-1712x7922',
    '+1-648-901-1274x3620',
    '+1-889-907-8869x213',
    '001-464-312-8555',
    '001-477-229-9026x0890',
    '001-617-773-8594',
    '001-780-166-5134x703',
    '001-836-780-8339',
    '005-190-0118',
    '059-372-5255',
    '063.430.8860x4762',
    '133.622.7535',
    '1601140330',
    '235-396-3701x802',
    '272.441.0955x0661',
    '3467565048',
    '372-363-8280',
    '414-902-6626x468',
    '531-051-4908x367',
    '7549075690',
    '756-913-5693',
    '823-978-4724',
    '990-054-7491x78196',
  ])('accepts sample value %s', (phone) => {
    expect(isValidPhoneNumber(phone)).toBe(true)
  })

  it.each(['+34 600 123 456', '600 123 456 ext. 12', '600 123 456 EXT 12', '600-123-456 X 12', ' 1234567 '])(
    'accepts %j',
    (phone) => {
      expect(isValidPhoneNumber(phone)).toBe(true)
    }
  )

  it('requires 7 to 15 digits before the extension', () => {
    expect(isValidPhoneNumber('123-456')).toBe(false)
    expect(isValidPhoneNumber('123-4567')).toBe(true)
    expect(isValidPhoneNumber('123456789012345')).toBe(true)
    expect(isValidPhoneNumber('1234567890123456')).toBe(false)
    // Extension digits do not count towards the minimum.
    expect(isValidPhoneNumber('12345x678')).toBe(false)
  })

  it.each([
    '',
    '   ',
    'not a phone',
    '555-CALL-NOW',
    '++1 555 123 4567',
    '555 123 4567 +1',
    '555-123-4567x',
    '555-123-4567x1234567',
    '555-123-4567 ext',
    '555-123-4567;ext=12',
    `${' '.repeat(10_000)}1234567!`,
  ])('rejects %j', (phone) => {
    expect(isValidPhoneNumber(phone)).toBe(false)
  })
})

describe('isValidYearsAtCompany', () => {
  it.each([0, 1, 15, 80])('accepts %j', (value) => {
    expect(isValidYearsAtCompany(value)).toBe(true)
  })

  it.each([-1, 81, 1.5, NaN, Infinity, '5', '', null, undefined, true])('rejects %j', (value) => {
    expect(isValidYearsAtCompany(value)).toBe(false)
  })
})

describe('normalizeLinkedinUrl', () => {
  it.each([
    ['https://www.linkedin.com/in/jane-doe', 'https://www.linkedin.com/in/jane-doe'],
    ['http://linkedin.com/in/jane-doe/', 'https://linkedin.com/in/jane-doe'],
    ['linkedin.com/in/jane-doe', 'https://linkedin.com/in/jane-doe'],
    ['  www.linkedin.com/company/acme  ', 'https://www.linkedin.com/company/acme'],
    ['HTTPS://WWW.LinkedIn.COM/in/Jane', 'https://www.linkedin.com/in/Jane'],
    ['https://es.linkedin.com/in/jane?trk=abc#about', 'https://es.linkedin.com/in/jane'],
    ['https://linkedin.com:443/in/jane//', 'https://linkedin.com/in/jane'],
  ])('normalizes %j to %j', (input, expected) => {
    expect(normalizeLinkedinUrl(input)).toBe(expected)
  })

  it('is idempotent', () => {
    for (const input of [
      'linkedin.com/in/jane-doe/',
      'https://es.linkedin.com/in/José%20Ñ?x=1',
      'https://www.linkedin.com/in/jane doe',
    ]) {
      const once = normalizeLinkedinUrl(input)
      expect(once).not.toBeNull()
      expect(normalizeLinkedinUrl(once)).toBe(once)
    }
  })

  it.each([
    '',
    '   ',
    null,
    undefined,
    'https://linkedin.com',
    'https://linkedin.com/',
    'https://www.linkedin.com//',
    'https://linkedin.com.evil.com/in/jane',
    'https://evil-linkedin.com/in/jane',
    'https://evil.com/linkedin.com/in/jane',
    'ftp://linkedin.com/in/jane',
    'javascript:alert(1)',
    'https://',
    'not a url',
  ])('rejects %j', (input) => {
    expect(normalizeLinkedinUrl(input)).toBeNull()
  })
})
