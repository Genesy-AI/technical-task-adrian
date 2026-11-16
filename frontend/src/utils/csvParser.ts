import Papa from 'papaparse'
import { isValidCountryCode, normalizeCountryCode } from './countryCodes'
import {
  isValidPhoneNumber,
  normalizeLinkedinUrl,
  normalizePhoneNumber,
  parseYearsAtCompany,
  YEARS_AT_COMPANY_MAX,
} from './leadFieldValidation'

export interface CsvLead {
  firstName: string
  lastName: string
  email: string
  jobTitle?: string
  countryCode?: string
  companyName?: string
  /** As typed (trimmed); kept even when invalid so the preview can show it. */
  phoneNumber?: string
  /** Undefined when blank or invalid; an invalid value is quoted in `errors`. */
  yearsAtCompany?: number
  /** Normalized when valid; the trimmed input when invalid, so the preview can show it. */
  linkedinUrl?: string
  isValid: boolean
  errors: string[]
  rowIndex: number
}

export const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

export const parseCsv = (content: string): CsvLead[] => {
  if (!content?.trim()) {
    throw new Error('CSV content cannot be empty')
  }

  const parseResult = Papa.parse<Record<string, string>>(content, {
    header: true,
    skipEmptyLines: true,
    transform: (value) => value.trim(),
    transformHeader: (header) => header.trim().toLowerCase(),
    quoteChar: '"',
  })

  if (parseResult.errors.length > 0) {
    const criticalErrors = parseResult.errors.filter(
      (error) => error.type === 'Delimiter' || error.type === 'Quotes' || error.type === 'FieldMismatch'
    )
    if (criticalErrors.length > 0) {
      throw new Error(`CSV parsing failed: ${criticalErrors[0].message}`)
    }
  }

  if (!parseResult.data || parseResult.data.length === 0) {
    throw new Error('CSV file appears to be empty or contains no valid data')
  }

  const data: CsvLead[] = []

  parseResult.data.forEach((row, index) => {
    if (Object.values(row).every((value) => !value)) return

    const lead: Partial<CsvLead> = { rowIndex: index + 2 }
    // Parsed after the loop, from the raw text, so error messages can quote the input.
    let yearsAtCompanyText = ''
    let linkedinUrlText = ''

    Object.entries(row).forEach(([header, value]) => {
      const normalizedHeader = header.toLowerCase().replace(/[^a-z]/g, '')
      const trimmedValue = value?.trim() || ''

      switch (normalizedHeader) {
        case 'firstname':
          lead.firstName = trimmedValue
          break
        case 'lastname':
          lead.lastName = trimmedValue
          break
        case 'email':
          lead.email = trimmedValue
          break
        case 'jobtitle':
          lead.jobTitle = trimmedValue || undefined
          break
        case 'countrycode':
          lead.countryCode = normalizeCountryCode(trimmedValue)
          break
        case 'companyname':
          lead.companyName = trimmedValue || undefined
          break
        case 'phonenumber':
        case 'phone':
          lead.phoneNumber = normalizePhoneNumber(trimmedValue)
          break
        case 'yearsatcompany':
        case 'yearsinrole':
          yearsAtCompanyText = trimmedValue
          break
        case 'linkedinurl':
        case 'linkedin':
          linkedinUrlText = trimmedValue
          break
      }
    })

    lead.yearsAtCompany = parseYearsAtCompany(yearsAtCompanyText)
    const normalizedLinkedinUrl = normalizeLinkedinUrl(linkedinUrlText)
    // An invalid URL is kept as typed so the preview shows what was rejected.
    lead.linkedinUrl = normalizedLinkedinUrl ?? (linkedinUrlText || undefined)

    const errors: string[] = []
    if (!lead.firstName?.trim()) {
      errors.push('First name is required')
    }
    if (!lead.lastName?.trim()) {
      errors.push('Last name is required')
    }
    if (!lead.email?.trim()) {
      errors.push('Email is required')
    } else if (!isValidEmail(lead.email)) {
      errors.push('Invalid email format')
    }
    if (lead.countryCode && !isValidCountryCode(lead.countryCode)) {
      errors.push(`Invalid country code "${lead.countryCode}" (expected ISO 3166-1 alpha-2, e.g. US)`)
    }
    if (lead.phoneNumber && !isValidPhoneNumber(lead.phoneNumber)) {
      errors.push(`Invalid phone number "${lead.phoneNumber}"`)
    }
    if (yearsAtCompanyText && lead.yearsAtCompany === undefined) {
      errors.push(
        `Invalid years at company "${yearsAtCompanyText}" (expected a whole number from 0 to ${YEARS_AT_COMPANY_MAX})`
      )
    }
    if (linkedinUrlText && normalizedLinkedinUrl === undefined) {
      errors.push(`Invalid LinkedIn URL "${linkedinUrlText}"`)
    }

    data.push({
      ...lead,
      firstName: lead.firstName || '',
      lastName: lead.lastName || '',
      email: lead.email || '',
      isValid: errors.length === 0,
      errors,
    } as CsvLead)
  })

  return data
}
