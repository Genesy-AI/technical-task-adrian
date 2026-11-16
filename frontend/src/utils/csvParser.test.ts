import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, it, expect } from 'vitest'
import { parseCsv, isValidEmail } from './csvParser'

describe('isValidEmail', () => {
  it('should return true for valid email addresses', () => {
    expect(isValidEmail('test@example.com')).toBe(true)
    expect(isValidEmail('user.name@domain.co.uk')).toBe(true)
    expect(isValidEmail('first.last+tag@example.org')).toBe(true)
    expect(isValidEmail('123@456.com')).toBe(true)
  })

  it('should return false for invalid email addresses', () => {
    expect(isValidEmail('')).toBe(false)
    expect(isValidEmail('invalid')).toBe(false)
    expect(isValidEmail('test@')).toBe(false)
    expect(isValidEmail('@example.com')).toBe(false)
    expect(isValidEmail('test.example.com')).toBe(false)
    expect(isValidEmail('test@.com')).toBe(false)
    expect(isValidEmail('test@example')).toBe(false)
  })
})

describe('parseCsv', () => {
  it('should throw error for empty content', () => {
    expect(() => parseCsv('')).toThrow('CSV content cannot be empty')
    expect(() => parseCsv('   ')).toThrow('CSV content cannot be empty')
  })

  it('should throw error for CSV with only headers', () => {
    const csv = 'firstName,lastName,email'
    expect(() => parseCsv(csv)).toThrow('CSV file appears to be empty or contains no valid data')
  })

  it('should throw error for malformed CSV content', () => {
    const malformedCsv = `firstName,lastName,email
"John,Doe,john@example.com,extra"field`
    expect(() => parseCsv(malformedCsv)).toThrow('CSV parsing failed')
  })

  it('should throw error for CSV with mismatched field count', () => {
    const mismatchedCsv = `firstName,lastName,email
John,Doe,john@example.com,ExtraField,AnotherExtra
Jane,Smith`
    expect(() => parseCsv(mismatchedCsv)).toThrow('CSV parsing failed')
  })

  it('should throw error for CSV with critical delimiter issues', () => {
    const noDelimiterCsv = `firstName lastName email
John Doe john@example.com`
    expect(() => parseCsv(noDelimiterCsv)).toThrow()
  })

  it('should parse valid CSV with all required fields', () => {
    const csv = `firstName,lastName,email,jobTitle,countryCode,companyName
John,Doe,john.doe@example.com,Developer,US,Tech Corp`

    const result = parseCsv(csv)

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      jobTitle: 'Developer',
      countryCode: 'US',
      companyName: 'Tech Corp',
      isValid: true,
      errors: [],
      rowIndex: 2,
    })
  })

  it('should handle missing required fields and mark as invalid', () => {
    const csv = `firstName,lastName,email
,Smith,john@example.com
John,,john@example.com
John,Smith,`

    const result = parseCsv(csv)

    expect(result).toHaveLength(3)

    expect(result[0].isValid).toBe(false)
    expect(result[0].errors).toContain('First name is required')

    expect(result[1].isValid).toBe(false)
    expect(result[1].errors).toContain('Last name is required')

    expect(result[2].isValid).toBe(false)
    expect(result[2].errors).toContain('Email is required')
  })

  it('should validate email format', () => {
    const csv = `firstName,lastName,email
John,Doe,invalid-email
Jane,Smith,jane@example.com`

    const result = parseCsv(csv)

    expect(result).toHaveLength(2)
    expect(result[0].isValid).toBe(false)
    expect(result[0].errors).toContain('Invalid email format')
    expect(result[1].isValid).toBe(true)
  })

  it('should handle CSV with quoted values', () => {
    const csv = `firstName,lastName,email,jobTitle
"John","Doe","john.doe@example.com","Software Engineer"`

    const result = parseCsv(csv)

    expect(result).toHaveLength(1)
    expect(result[0].firstName).toBe('John')
    expect(result[0].lastName).toBe('Doe')
    expect(result[0].email).toBe('john.doe@example.com')
    expect(result[0].jobTitle).toBe('Software Engineer')
  })

  it('should skip empty rows', () => {
    const csv = `firstName,lastName,email
John,Doe,john@example.com
,,
Jane,Smith,jane@example.com`

    const result = parseCsv(csv)

    expect(result).toHaveLength(2)
    expect(result[0].firstName).toBe('John')
    expect(result[1].firstName).toBe('Jane')
  })

  it('should handle case-insensitive headers', () => {
    const csv = `FIRSTNAME,LASTNAME,EMAIL,JOBTITLE,COUNTRYCODE,COMPANYNAME
John,Doe,john@example.com,Developer,US,Tech Corp`

    const result = parseCsv(csv)

    expect(result).toHaveLength(1)
    expect(result[0].firstName).toBe('John')
    expect(result[0].lastName).toBe('Doe')
    expect(result[0].email).toBe('john@example.com')
    expect(result[0].jobTitle).toBe('Developer')
  })

  it('should handle missing optional fields', () => {
    const csv = `firstName,lastName,email,jobTitle,countryCode
John,Doe,john@example.com,,`

    const result = parseCsv(csv)

    expect(result).toHaveLength(1)
    expect(result[0].jobTitle).toBeUndefined()
    expect(result[0].countryCode).toBeUndefined()
    expect(result[0].isValid).toBe(true)
  })

  it('should preserve row index correctly', () => {
    const csv = `firstName,lastName,email
John,Doe,john@example.com
Jane,Smith,jane@example.com
Bob,Johnson,bob@example.com`

    const result = parseCsv(csv)

    expect(result).toHaveLength(3)
    expect(result[0].rowIndex).toBe(2)
    expect(result[1].rowIndex).toBe(3)
    expect(result[2].rowIndex).toBe(4)
  })

  it('should handle multiple validation errors per lead', () => {
    const csv = `firstName,lastName,email
 , ,invalid-email`

    const result = parseCsv(csv)

    expect(result).toHaveLength(1)
    expect(result[0].isValid).toBe(false)
    expect(result[0].errors).toHaveLength(3)
    expect(result[0].errors).toContain('First name is required')
    expect(result[0].errors).toContain('Last name is required')
    expect(result[0].errors).toContain('Invalid email format')
  })

  it('should handle extra columns not in header mapping', () => {
    const csv = `firstName,lastName,email,unknownColumn
John,Doe,john@example.com,someValue`

    const result = parseCsv(csv)

    expect(result).toHaveLength(1)
    expect(result[0].firstName).toBe('John')
    expect(result[0].lastName).toBe('Doe')
    expect(result[0].email).toBe('john@example.com')
    expect(result[0].isValid).toBe(true)
  })

  it('should handle mixed valid and invalid leads', () => {
    const csv = `firstName,lastName,email
John,Doe,john@example.com
,Smith,invalid-email
Jane,Johnson,jane@example.com`

    const result = parseCsv(csv)

    expect(result).toHaveLength(3)
    expect(result[0].isValid).toBe(true)
    expect(result[1].isValid).toBe(false)
    expect(result[1].errors).toContain('First name is required')
    expect(result[1].errors).toContain('Invalid email format')
    expect(result[2].isValid).toBe(true)
  })

  it('should handle whitespace in fields', () => {
    const csv = `firstName,lastName,email
 John , Doe , john@example.com `

    const result = parseCsv(csv)

    expect(result).toHaveLength(1)
    expect(result[0].firstName).toBe('John')
    expect(result[0].lastName).toBe('Doe')
    expect(result[0].email).toBe('john@example.com')
    expect(result[0].isValid).toBe(true)
  })

  describe('country code validation', () => {
    const csvWithCountry = (countryCode: string) =>
      `firstName,lastName,email,countryCode\nJohn,Doe,john@example.com,${countryCode}`

    it('normalizes valid country codes to upper case', () => {
      const [lead] = parseCsv(csvWithCountry(' es '))
      expect(lead.countryCode).toBe('ES')
      expect(lead.isValid).toBe(true)
    })

    it('treats a blank country code as absent', () => {
      const [lead] = parseCsv(csvWithCountry(''))
      expect(lead.countryCode).toBeUndefined()
      expect(lead.isValid).toBe(true)
    })

    it.each(['XXX', '12', 'ZZ', 'U'])('marks the lead invalid for country code "%s"', (code) => {
      const [lead] = parseCsv(csvWithCountry(code))
      expect(lead.isValid).toBe(false)
      expect(lead.errors).toEqual([`Invalid country code "${code}" (expected ISO 3166-1 alpha-2, e.g. US)`])
    })

    it('never lets an invalid country code through as valid in the sample files', () => {
      const docs = resolve(__dirname, '../../../docs')
      for (const file of ['leads-with-errors.csv', 'leads-ok-1.csv', 'leads-ok-2.csv', 'leads-ok-3.csv']) {
        const leads = parseCsv(readFileSync(resolve(docs, file), 'utf-8'))
        for (const lead of leads.filter((l) => l.isValid && l.countryCode)) {
          expect(lead.countryCode, `${file} row ${lead.rowIndex}`).toMatch(/^[A-Z]{2}$/)
        }
      }
      const withErrors = parseCsv(readFileSync(resolve(docs, 'leads-with-errors.csv'), 'utf-8'))
      const badCountryRows = withErrors.filter((l) =>
        l.errors.some((e) => e.startsWith('Invalid country code'))
      )
      expect(badCountryRows.map((l) => l.countryCode).sort()).toEqual(['12', 'XXX', 'XXX', 'XXX', 'XXX'])
    })
  })

  describe('phone, years at company and LinkedIn URL', () => {
    const csvWith = (header: string, value: string) =>
      `firstName,lastName,email,${header}\nJohn,Doe,john@example.com,"${value}"`

    it('parses all three fields', () => {
      const csv = `firstName,lastName,email,phoneNumber,yearsAtCompany,linkedinUrl
Ada,Lovelace,ada@example.com, +1-280-754-0462x2154 ,0,linkedin.com/in/ada-lovelace/`

      const [lead] = parseCsv(csv)

      expect(lead).toEqual({
        firstName: 'Ada',
        lastName: 'Lovelace',
        email: 'ada@example.com',
        phoneNumber: '+1-280-754-0462x2154',
        yearsAtCompany: 0,
        linkedinUrl: 'https://linkedin.com/in/ada-lovelace',
        isValid: true,
        errors: [],
        rowIndex: 2,
      })
    })

    it.each([
      ['phone', 'phoneNumber', '555-123-4567', '555-123-4567'],
      ['Phone Number', 'phoneNumber', '555-123-4567', '555-123-4567'],
      ['yearsInRole', 'yearsAtCompany', '7', 7],
      ['years_at_company', 'yearsAtCompany', '7', 7],
      ['linkedin', 'linkedinUrl', 'www.linkedin.com/in/ada', 'https://www.linkedin.com/in/ada'],
      ['LinkedIn URL', 'linkedinUrl', 'www.linkedin.com/in/ada', 'https://www.linkedin.com/in/ada'],
    ] as const)('maps the "%s" header to %s', (header, field, value, expected) => {
      const [lead] = parseCsv(csvWith(header, value))
      expect(lead[field]).toBe(expected)
      expect(lead.isValid).toBe(true)
    })

    it('treats blank values as absent', () => {
      const csv = `firstName,lastName,email,phoneNumber,yearsAtCompany,linkedinUrl
John,Doe,john@example.com, , ,`

      const [lead] = parseCsv(csv)

      expect(lead.phoneNumber).toBeUndefined()
      expect(lead.yearsAtCompany).toBeUndefined()
      expect(lead.linkedinUrl).toBeUndefined()
      expect(lead.isValid).toBe(true)
    })

    it.each(['abc', '123', '555-123-4567 #12'])('marks the lead invalid for phone number "%s"', (phone) => {
      const [lead] = parseCsv(csvWith('phoneNumber', phone))
      expect(lead.isValid).toBe(false)
      expect(lead.phoneNumber).toBe(phone)
      expect(lead.errors).toEqual([`Invalid phone number "${phone}"`])
    })

    it.each(['abc', '-1', '81', '2.5', '1e1'])(
      'marks the lead invalid for years at company "%s"',
      (years) => {
        const [lead] = parseCsv(csvWith('yearsAtCompany', years))
        expect(lead.isValid).toBe(false)
        expect(lead.yearsAtCompany).toBeUndefined()
        expect(lead.errors).toEqual([
          `Invalid years at company "${years}" (expected a whole number from 0 to 80)`,
        ])
      }
    )

    it.each(['https://example.com/in/ada', 'linkedin.com', 'not a url'])(
      'marks the lead invalid for LinkedIn URL "%s", keeping the input for the preview',
      (url) => {
        const [lead] = parseCsv(csvWith('linkedinUrl', url))
        expect(lead.isValid).toBe(false)
        expect(lead.linkedinUrl).toBe(url)
        expect(lead.errors).toEqual([`Invalid LinkedIn URL "${url}"`])
      }
    )

    it('reports field errors after the required-field errors', () => {
      const csv = `firstName,lastName,email,phoneNumber,yearsAtCompany,linkedinUrl
,Doe,john@example.com,abc,abc,abc`

      const [lead] = parseCsv(csv)

      expect(lead.errors).toEqual([
        'First name is required',
        'Invalid phone number "abc"',
        'Invalid years at company "abc" (expected a whole number from 0 to 80)',
        'Invalid LinkedIn URL "abc"',
      ])
    })

    it('parses every phone number and yearsInRole value in the sample files', () => {
      const docs = resolve(__dirname, '../../../docs')
      for (const file of [
        'leads-ok-1.csv',
        'leads-ok-2.csv',
        'leads-ok-3.csv',
        'leads-ok-missing fields.csv',
        'leads-with-errors.csv',
      ]) {
        const leads = parseCsv(readFileSync(resolve(docs, file), 'utf-8'))
        for (const lead of leads) {
          const where = `${file} row ${lead.rowIndex}`
          expect(
            lead.errors.filter((e) => /phone|years|LinkedIn/.test(e)),
            where
          ).toEqual([])
        }
      }

      const [first] = parseCsv(readFileSync(resolve(docs, 'leads-ok-1.csv'), 'utf-8'))
      expect(first.phoneNumber).toBe('+1-280-754-0462x2154')
      expect(first.yearsAtCompany).toBe(2)
      expect(first.isValid).toBe(true)
    })
  })
})
