import { describe, it, expect } from 'vitest'
import {
  extractTemplateVariables,
  filterTemplateFields,
  findUnknownVariables,
  getActiveVariableQuery,
  moveActiveIndex,
  replaceRange,
  toTemplateVariable,
} from './templateVariables'
import { LEAD_TEMPLATE_FIELDS } from '../leadTemplateFields'

const keys = (fields: readonly { key: string }[]) => fields.map((field) => field.key)

describe('extractTemplateVariables', () => {
  it('returns each variable once, in order of first appearance', () => {
    expect(extractTemplateVariables('Hi {firstName}, {companyName} loves {firstName}')).toEqual([
      'firstName',
      'companyName',
    ])
  })

  it('only treats {\\w+} as a variable, like the backend', () => {
    expect(extractTemplateVariables('{} { firstName } {first-name} {{x} {a_1}')).toEqual(['x', 'a_1'])
  })

  it('returns an empty list when there are no variables', () => {
    expect(extractTemplateVariables('Plain text')).toEqual([])
  })
})

describe('findUnknownVariables', () => {
  it('returns variables that are not field keys', () => {
    expect(findUnknownVariables('Hi {firstName} from {company} at {foo} {company}')).toEqual([
      'company',
      'foo',
    ])
  })

  it('is case-sensitive, like the backend', () => {
    expect(findUnknownVariables('{FirstName}')).toEqual(['FirstName'])
  })

  it('accepts every known field', () => {
    const template = LEAD_TEMPLATE_FIELDS.map((field) => toTemplateVariable(field.key)).join(' ')
    expect(findUnknownVariables(template)).toEqual([])
  })

  it('checks against the given field list', () => {
    expect(findUnknownVariables('{a} {b}', [{ key: 'a' }])).toEqual(['b'])
  })
})

describe('getActiveVariableQuery', () => {
  it('detects a bare { right before the caret', () => {
    expect(getActiveVariableQuery('Hi {', 4)).toEqual({ query: '', start: 3, end: 4 })
  })

  it('detects a partial name before the caret', () => {
    expect(getActiveVariableQuery('Hi {fir', 7)).toEqual({ query: 'fir', start: 3, end: 7 })
  })

  it('extends the replaced range over word characters after the caret', () => {
    expect(getActiveVariableQuery('Hi {firXY there', 7)).toEqual({ query: 'fir', start: 3, end: 9 })
  })

  it('ignores a variable that is already closed', () => {
    expect(getActiveVariableQuery('Hi {firstName}', 7)).toBeNull()
    expect(getActiveVariableQuery('Hi {firstName}', 14)).toBeNull()
  })

  it('ignores a { followed by a non-word character', () => {
    expect(getActiveVariableQuery('Hi {fir st', 10)).toBeNull()
    expect(getActiveVariableQuery('Hi { ', 5)).toBeNull()
  })

  it('returns null without a { before the caret', () => {
    expect(getActiveVariableQuery('Hello', 5)).toBeNull()
    expect(getActiveVariableQuery('', 0)).toBeNull()
  })

  it('uses the { closest to the caret', () => {
    expect(getActiveVariableQuery('{a} {b', 6)).toEqual({ query: 'b', start: 4, end: 6 })
  })

  it('returns null for an out-of-range caret', () => {
    expect(getActiveVariableQuery('{a', 5)).toBeNull()
    expect(getActiveVariableQuery('{a', -1)).toBeNull()
  })
})

describe('filterTemplateFields', () => {
  it('returns every field for an empty query', () => {
    expect(keys(filterTemplateFields(''))).toEqual(keys(LEAD_TEMPLATE_FIELDS))
  })

  it('matches keys case-insensitively', () => {
    expect(keys(filterTemplateFields('LINKEDIN'))).toEqual(['linkedinUrl'])
  })

  it('matches labels, ignoring spaces', () => {
    expect(keys(filterTemplateFields('years at'))).toEqual(['yearsAtCompany'])
    expect(keys(filterTemplateFields('jobtit'))).toEqual(['jobTitle'])
  })

  it('ranks prefix matches before substring matches', () => {
    // "Company" (companyName) starts with "comp"; "Years at company" only contains it.
    expect(keys(filterTemplateFields('comp'))).toEqual(['companyName', 'yearsAtCompany'])
    // "name" is a substring of firstName/lastName/companyName; none starts with it.
    expect(keys(filterTemplateFields('name'))).toEqual(['firstName', 'lastName', 'companyName'])
  })

  it('returns nothing when no field matches', () => {
    expect(filterTemplateFields('zzz')).toEqual([])
  })
})

describe('replaceRange', () => {
  it('replaces the range and puts the caret after the insertion', () => {
    expect(replaceRange('Hi {fir!', 3, 7, '{firstName}')).toEqual({ text: 'Hi {firstName}!', caret: 14 })
  })

  it('inserts at a collapsed range', () => {
    expect(replaceRange('Hi ', 3, 3, '{email}')).toEqual({ text: 'Hi {email}', caret: 10 })
  })
})

describe('moveActiveIndex', () => {
  it('moves and wraps around in both directions', () => {
    expect(moveActiveIndex(0, 1, 3)).toBe(1)
    expect(moveActiveIndex(2, 1, 3)).toBe(0)
    expect(moveActiveIndex(0, -1, 3)).toBe(2)
  })

  it('returns 0 for an empty list', () => {
    expect(moveActiveIndex(0, 1, 0)).toBe(0)
  })
})
