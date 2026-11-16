import { describe, it, expect } from 'vitest'
import {
  isValidPhoneNumber,
  isValidYearsAtCompany,
  normalizeLinkedinUrl,
  normalizePhoneNumber,
  parseYearsAtCompany,
} from './leadFieldValidation'

describe('normalizePhoneNumber', () => {
  it('trims and keeps the number as typed', () => {
    expect(normalizePhoneNumber('  (760)551-9973x6454 ')).toBe('(760)551-9973x6454')
  })

  it.each(['', '   ', null, undefined])('returns undefined for blank input %j', (value) => {
    expect(normalizePhoneNumber(value)).toBeUndefined()
  })
})

describe('isValidPhoneNumber', () => {
  it.each([
    '+1-280-754-0462x2154',
    '001-464-312-8555',
    '(760)551-9973x6454',
    '990-054-7491x78196',
    '063.430.8860x4762',
    '7549075690',
    '+44 20 7946 0958',
    '555-1234',
    '+1 (555) 123-4567 ext. 89',
    '+1 555 123 4567 EXT 123456',
    ' 555-123-4567 ',
  ])('accepts %j', (phone) => {
    expect(isValidPhoneNumber(phone)).toBe(true)
  })

  it.each([
    '',
    'abc',
    '555-123',
    '123456',
    '1234567890123456',
    '555-123-4567x1234567',
    '555-123-4567 ext',
    '++1 555 123 4567',
    '555-123-4567 #12',
    `1${' '.repeat(45)}23456789012345`,
  ])('rejects %j', (phone) => {
    expect(isValidPhoneNumber(phone)).toBe(false)
  })

  it('rejects input longer than 50 characters before running the pattern', () => {
    // Surrounding whitespace is trimmed before the length check.
    expect(isValidPhoneNumber(`  +1 555 123 4567${' '.repeat(60)}`)).toBe(true)
    expect(isValidPhoneNumber(`+1${' '.repeat(36)}555 123 4567`)).toBe(true) // 50 chars
    expect(isValidPhoneNumber(`+1${' '.repeat(37)}555 123 4567`)).toBe(false) // 51 chars
  })

  it('counts the digits before the extension only', () => {
    expect(isValidPhoneNumber('12345x678')).toBe(false)
    expect(isValidPhoneNumber('123456 x1')).toBe(false)
    expect(isValidPhoneNumber('1234567 x123456')).toBe(true)
  })
})

describe('isValidYearsAtCompany', () => {
  it.each([0, 1, 15, 80])('accepts %d', (years) => {
    expect(isValidYearsAtCompany(years)).toBe(true)
  })

  it.each([-1, 81, 1.5, NaN, Infinity, '5', null, undefined])('rejects %j', (years) => {
    expect(isValidYearsAtCompany(years)).toBe(false)
  })
})

describe('parseYearsAtCompany', () => {
  it.each([
    ['0', 0],
    ['5', 5],
    [' 10 ', 10],
    ['007', 7],
    ['80', 80],
  ])('parses %j as %d', (text, years) => {
    expect(parseYearsAtCompany(text)).toBe(years)
  })

  it.each(['', '  ', null, undefined, 'abc', '-1', '+5', '1.5', '1e1', '5 years', '81', '0x10'])(
    'returns undefined for %j',
    (text) => {
      expect(parseYearsAtCompany(text)).toBeUndefined()
    }
  )
})

describe('normalizeLinkedinUrl', () => {
  it.each([
    ['https://www.linkedin.com/in/ada-lovelace', 'https://www.linkedin.com/in/ada-lovelace'],
    ['http://linkedin.com/in/ada-lovelace/', 'https://linkedin.com/in/ada-lovelace'],
    ['linkedin.com/in/ada-lovelace', 'https://linkedin.com/in/ada-lovelace'],
    ['  www.linkedin.com/company/acme/?trk=x#about ', 'https://www.linkedin.com/company/acme'],
    ['HTTPS://WWW.LinkedIn.com/in/ada', 'https://www.linkedin.com/in/ada'],
    ['https://es.linkedin.com/in/ada', 'https://es.linkedin.com/in/ada'],
    ['https://user:pass@www.linkedin.com:8443/in/ada', 'https://www.linkedin.com/in/ada'],
    ['https://www.linkedin.com/in/ada///', 'https://www.linkedin.com/in/ada'],
  ])('normalizes %j to %j', (input, expected) => {
    expect(normalizeLinkedinUrl(input)).toBe(expected)
  })

  it('is idempotent', () => {
    const once = normalizeLinkedinUrl('linkedin.com/in/ada-lovelace/?x=1')
    expect(once).toBeDefined()
    expect(normalizeLinkedinUrl(once)).toBe(once)
  })

  it.each([
    '',
    '   ',
    null,
    undefined,
    'https://linkedin.com',
    'https://linkedin.com/',
    'https://linkedin.com//',
    'mailto:ada@linkedin.com',
    'https://www.linkedin.com/?trk=x',
    'https://evil.com/in/ada',
    'https://linkedin.com.evil.com/in/ada',
    'https://notlinkedin.com/in/ada',
    'ftp://linkedin.com/in/ada',
    'javascript://linkedin.com/in/ada',
    'not a url',
  ])('rejects %j', (input) => {
    expect(normalizeLinkedinUrl(input)).toBeUndefined()
  })
})
