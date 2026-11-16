// Fails if the backend and frontend copies of LEAD_TEMPLATE_FIELDS differ (keys, labels
// or order). Both apps keep a static copy on purpose, see
// docs/adr/0002-lead-template-fields-duplicated-and-checked-in-ci.md.
//
// The two modules are pure data + types, so Node loads them directly with type
// stripping, without installing either package. Run it through scripts/ci.sh:
//
//   scripts/ci.sh contracts lead-template-fields
import { isDeepStrictEqual } from 'node:util'
import { fileURLToPath } from 'node:url'

const COPIES = ['backend/src/leadTemplateFields.ts', 'frontend/src/leadTemplateFields.ts']

const root = fileURLToPath(new URL('..', import.meta.url))

const load = async (path) => {
  const { LEAD_TEMPLATE_FIELDS: fields } = await import(new URL(path, `file://${root}`).href)
  if (!Array.isArray(fields) || fields.length === 0) {
    throw new Error(`${path} must export a non-empty LEAD_TEMPLATE_FIELDS array`)
  }
  return fields
}

const describe = (field) => (field ? `{${field.key}} "${field.label}"` : '(missing)')

const [backend, frontend] = await Promise.all(COPIES.map(load))

if (isDeepStrictEqual(backend, frontend)) {
  console.log(`LEAD_TEMPLATE_FIELDS match (${backend.length} fields).`)
  process.exit(0)
}

console.error(`LEAD_TEMPLATE_FIELDS differ between ${COPIES.join(' and ')}:`)
for (let i = 0; i < Math.max(backend.length, frontend.length); i++) {
  if (!isDeepStrictEqual(backend[i], frontend[i])) {
    console.error(`  #${i + 1}: backend ${describe(backend[i])} vs frontend ${describe(frontend[i])}`)
  }
}
console.error('Update both files in the same change (ADR 0002).')
process.exit(1)
