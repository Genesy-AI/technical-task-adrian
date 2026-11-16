import type { lead as PrismaLead } from '@prisma/client'
import { LEAD_TEMPLATE_FIELDS, LeadTemplateFieldKey } from '../leadTemplateFields'

export interface Lead {
  firstName: string
  lastName?: string | null
  email?: string | null
  jobTitle?: string | null
  companyName?: string | null
  countryCode?: string | null
  phoneNumber?: string | null
  yearsAtCompany?: number | null
  linkedinUrl?: string | null
}

// Compile-time guard: every template variable must be a column of the Prisma `lead`
// model and a property of `Lead`. Adding a key to LEAD_TEMPLATE_FIELDS without the
// matching column/property fails the build here.
type AssertKeysOf<T, K extends keyof T> = K
type TemplateFieldsAreLeadColumns = AssertKeysOf<PrismaLead, LeadTemplateFieldKey>
type TemplateFieldsAreLeadProperties = AssertKeysOf<Lead, LeadTemplateFieldKey>

const TEMPLATE_FIELD_KEYS: ReadonlySet<string> = new Set(LEAD_TEMPLATE_FIELDS.map((field) => field.key))

const isTemplateFieldKey = (name: string): name is LeadTemplateFieldKey => TEMPLATE_FIELD_KEYS.has(name)

export function generateMessageFromTemplate(template: string, lead: Lead): string {
  // One pass over the template, so text inserted from a value (e.g. a job title
  // containing "{email}") is never itself treated as a variable. The function replacer
  // also inserts values literally (no `$&`, `$1`, `$$` expansion).
  return template.replace(/\{(\w+)\}/g, (_match, fieldName: string) => {
    if (!isTemplateFieldKey(fieldName)) {
      throw new Error(`Unknown field in template: ${fieldName}`)
    }

    const fieldValue = lead[fieldName]

    if (fieldValue === null || fieldValue === undefined || fieldValue === '') {
      throw new Error(`Missing required field: ${fieldName}`)
    }

    return String(fieldValue)
  })
}
