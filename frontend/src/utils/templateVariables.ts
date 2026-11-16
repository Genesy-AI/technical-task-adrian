import { LEAD_TEMPLATE_FIELDS, type LeadTemplateField } from '../leadTemplateFields'

/**
 * Pure helpers for `{key}` message-template variables.
 *
 * The variable syntax mirrors the backend generator (backend/src/utils/messageGenerator.ts):
 * a variable is `{` + one or more word characters (`\w+`) + `}`. Anything else (`{ name }`,
 * `{first-name}`) is literal text for the backend, so it is literal text here too.
 */

const TEMPLATE_VARIABLE_PATTERN = /\{(\w+)\}/g

/** Matches an unclosed `{partial` that ends exactly at the end of the input. */
const OPEN_VARIABLE_BEFORE_CARET = /\{(\w*)$/

/** Matches the rest of a word after the caret, and a closing `}` if there is one. */
const WORD_AFTER_CARET = /^(\w*)(\})?/

/** Variable names used in a template, de-duplicated, in order of first appearance. */
export function extractTemplateVariables(template: string): string[] {
  const names = new Set<string>()
  for (const match of template.matchAll(TEMPLATE_VARIABLE_PATTERN)) {
    names.add(match[1])
  }
  return [...names]
}

/** Variables in `template` that are not a known field key (the backend would reject them). */
export function findUnknownVariables(
  template: string,
  fields: readonly { key: string }[] = LEAD_TEMPLATE_FIELDS
): string[] {
  const known = new Set<string>(fields.map((field) => field.key))
  return extractTemplateVariables(template).filter((name) => !known.has(name))
}

/** An unclosed `{partial` the user is typing, and the text range accepting a suggestion replaces. */
export interface ActiveVariableQuery {
  /** The text typed after `{` and before the caret. */
  query: string
  /** Index of the `{`. */
  start: number
  /** End (exclusive) of the range to replace: the caret plus any word characters right after it. */
  end: number
}

/**
 * Returns the variable being typed at `caret`, i.e. when the caret sits after `{` followed by
 * `\w*`, and the variable is not closed yet. Returns null when the caret is anywhere else,
 * including inside an already closed `{variable}`.
 */
export function getActiveVariableQuery(text: string, caret: number): ActiveVariableQuery | null {
  if (caret < 0 || caret > text.length) return null

  const before = OPEN_VARIABLE_BEFORE_CARET.exec(text.slice(0, caret))
  if (!before) return null

  const after = WORD_AFTER_CARET.exec(text.slice(caret))
  const trailingWord = after?.[1] ?? ''
  if (after?.[2]) return null

  return {
    query: before[1],
    start: caret - before[0].length,
    end: caret + trailingWord.length,
  }
}

const normalize = (value: string) => value.toLowerCase().replace(/\s+/g, '')

/**
 * Fields whose key or label contains `query` (case-insensitive; spaces in labels are ignored,
 * so `jobtit` matches "Job title"). Fields where the key or label starts with the query come
 * first; otherwise the display order of `fields` is kept. An empty query returns every field.
 */
export function filterTemplateFields(
  query: string,
  fields: readonly LeadTemplateField[] = LEAD_TEMPLATE_FIELDS
): LeadTemplateField[] {
  const needle = normalize(query)
  if (!needle) return [...fields]

  const prefixMatches: LeadTemplateField[] = []
  const otherMatches: LeadTemplateField[] = []
  for (const field of fields) {
    const haystacks = [normalize(field.key), normalize(field.label)]
    if (haystacks.some((haystack) => haystack.startsWith(needle))) {
      prefixMatches.push(field)
    } else if (haystacks.some((haystack) => haystack.includes(needle))) {
      otherMatches.push(field)
    }
  }
  return [...prefixMatches, ...otherMatches]
}

/** Replaces `text[start, end)` with `insertion` and returns the new text and the caret after it. */
export function replaceRange(
  text: string,
  start: number,
  end: number,
  insertion: string
): { text: string; caret: number } {
  return {
    text: text.slice(0, start) + insertion + text.slice(end),
    caret: start + insertion.length,
  }
}

/** The `{key}` token for a field. */
export const toTemplateVariable = (key: string) => `{${key}}`

/** DOM id of the option at `index` in a variable listbox, for `aria-activedescendant`. */
export const listboxOptionId = (listboxId: string, index: number) => `${listboxId}-option-${index}`

/** Moves a listbox's active index by `delta`, wrapping around; 0 for an empty list. */
export function moveActiveIndex(current: number, delta: number, length: number): number {
  if (length === 0) return 0
  return (((current + delta) % length) + length) % length
}
