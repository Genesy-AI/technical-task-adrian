/**
 * The variables a message template can use, as `{key}`, in display order.
 *
 * DUPLICATED ON PURPOSE: frontend/src/leadTemplateFields.ts holds the same list, and
 * `scripts/ci.sh contracts lead-template-fields` fails if the two differ. Change both in
 * the same PR. See docs/adr/0002-lead-template-fields-duplicated-and-checked-in-ci.md.
 *
 * Keep this file pure data and types (no imports, enums or logic): CI loads it with
 * Node's type stripping, outside this package's toolchain.
 */
export const LEAD_TEMPLATE_FIELDS = [
  { key: 'firstName', label: 'First name' },
  { key: 'lastName', label: 'Last name' },
  { key: 'email', label: 'Email' },
  { key: 'jobTitle', label: 'Job title' },
  { key: 'companyName', label: 'Company' },
  { key: 'countryCode', label: 'Country code' },
  { key: 'phoneNumber', label: 'Phone number' },
  { key: 'yearsAtCompany', label: 'Years at company' },
  { key: 'linkedinUrl', label: 'LinkedIn URL' },
] as const satisfies readonly { key: string; label: string }[]

export type LeadTemplateField = (typeof LEAD_TEMPLATE_FIELDS)[number]
export type LeadTemplateFieldKey = LeadTemplateField['key']
