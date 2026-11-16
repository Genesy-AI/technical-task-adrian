import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { MessageTemplateModal } from './MessageTemplateModal'

const generateMessages = vi.hoisted(() => vi.fn())
vi.mock('../api', () => ({ api: { leads: { generateMessages } } }))
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }))

// @testing-library/react is not a dependency, so this file drives React with react-dom + act directly.
;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true

let root: Root
let container: HTMLDivElement
let onClose: ReturnType<typeof vi.fn>

beforeEach(() => {
  generateMessages.mockReset()
  onClose = vi.fn()
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } })
  act(() => {
    root.render(
      <QueryClientProvider client={queryClient}>
        <MessageTemplateModal isOpen onClose={onClose} selectedLeadIds={[1, 2]} selectedLeadsCount={2} />
      </QueryClientProvider>
    )
  })
})

afterEach(() => {
  act(() => root.unmount())
  container.remove()
})

const textarea = () => document.querySelector<HTMLTextAreaElement>('#message-template')!
const buttonByText = (text: string) =>
  [...document.querySelectorAll('button')].find((button) => button.textContent?.trim() === text)!
const listbox = (label: string) =>
  document.querySelector<HTMLElement>(`[role="listbox"][aria-label="${label}"]`)
const optionLabels = (box: HTMLElement) =>
  [...box.querySelectorAll('[role="option"]')].map((option) => option.textContent)
const pickerSearch = () => document.querySelector<HTMLInputElement>('input[role="combobox"]')

/** Sets a form control's value the way a user edit does, so React's onChange fires. */
function typeInto(element: HTMLTextAreaElement | HTMLInputElement, value: string, caret = value.length) {
  const prototype = Object.getPrototypeOf(element) as HTMLTextAreaElement | HTMLInputElement
  const setValue = Object.getOwnPropertyDescriptor(prototype, 'value')!.set!
  act(() => {
    element.focus()
    setValue.call(element, value)
    element.setSelectionRange(caret, caret)
    element.dispatchEvent(new Event('input', { bubbles: true }))
  })
}

function pressKey(element: Element, key: string) {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })
  act(() => {
    element.dispatchEvent(event)
  })
  return event
}

function click(element: Element) {
  act(() => {
    element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }))
    element.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
  })
}

describe('MessageTemplateModal variable picker', () => {
  it('inserts the chosen variable at the cursor, replacing the selection, and restores the caret', () => {
    typeInto(textarea(), 'Hi XX, welcome')
    act(() => textarea().setSelectionRange(3, 5))

    click(buttonByText('{ }Insert variable'))
    expect(pickerSearch()).toBe(document.activeElement)

    typeInto(pickerSearch()!, 'COMP')
    expect(optionLabels(listbox('Variables')!)).toEqual([
      'Company{companyName}',
      'Years at company{yearsAtCompany}',
    ])

    pressKey(pickerSearch()!, 'ArrowDown')
    pressKey(pickerSearch()!, 'Enter')

    expect(textarea().value).toBe('Hi {yearsAtCompany}, welcome')
    expect(document.activeElement).toBe(textarea())
    expect(textarea().selectionStart).toBe('Hi {yearsAtCompany}'.length)
    expect(pickerSearch()).toBeNull()
  })

  it('inserts on option click', () => {
    typeInto(textarea(), 'Hi ')
    click(buttonByText('{ }Insert variable'))
    const option = [...document.querySelectorAll('[role="option"]')].find((el) =>
      el.textContent?.includes('{email}')
    )!
    click(option)
    expect(textarea().value).toBe('Hi {email}')
  })

  it('closes on Escape without closing the modal, then Escape closes the modal', () => {
    click(buttonByText('{ }Insert variable'))
    const event = pressKey(pickerSearch()!, 'Escape')

    expect(event.defaultPrevented).toBe(true)
    expect(pickerSearch()).toBeNull()
    expect(onClose).not.toHaveBeenCalled()

    pressKey(document.activeElement ?? document.body, 'Escape')
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes on outside click', () => {
    click(buttonByText('{ }Insert variable'))
    click(textarea())
    expect(pickerSearch()).toBeNull()
  })
})

describe('MessageTemplateModal { autocomplete', () => {
  it('suggests matching variables after { and replaces the partial on Enter', () => {
    typeInto(textarea(), 'Hi {link and more', 'Hi {link'.length)

    const suggestions = listbox('Variable suggestions')!
    expect(optionLabels(suggestions)).toEqual(['LinkedIn URL{linkedinUrl}'])
    expect(textarea().getAttribute('aria-activedescendant')).toBe(
      suggestions.querySelector('[role="option"]')!.id
    )

    const event = pressKey(textarea(), 'Enter')
    expect(event.defaultPrevented).toBe(true)
    expect(textarea().value).toBe('Hi {linkedinUrl} and more')
    expect(textarea().selectionStart).toBe('Hi {linkedinUrl}'.length)
    expect(listbox('Variable suggestions')).toBeNull()
  })

  it('accepts the highlighted suggestion with Tab after moving with the arrows', () => {
    typeInto(textarea(), '{name')
    expect(optionLabels(listbox('Variable suggestions')!)).toEqual([
      'First name{firstName}',
      'Last name{lastName}',
      'Company{companyName}',
    ])
    pressKey(textarea(), 'ArrowDown')
    pressKey(textarea(), 'Tab')
    expect(textarea().value).toBe('{lastName}')
  })

  it('dismisses on Escape without closing the modal', () => {
    typeInto(textarea(), 'Hi {')
    expect(listbox('Variable suggestions')).not.toBeNull()

    pressKey(textarea(), 'Escape')
    expect(listbox('Variable suggestions')).toBeNull()
    expect(onClose).not.toHaveBeenCalled()

    // Typing in a new variable brings suggestions back.
    typeInto(textarea(), 'Hi {} {e')
    expect(listbox('Variable suggestions')).not.toBeNull()
  })

  it('shows nothing once the variable is closed or nothing matches', () => {
    typeInto(textarea(), 'Hi {firstName}')
    expect(listbox('Variable suggestions')).toBeNull()
    typeInto(textarea(), 'Hi {zzz')
    expect(listbox('Variable suggestions')).toBeNull()
  })
})

describe('MessageTemplateModal unknown variables', () => {
  it('lists unknown variables and disables submit until they are fixed', () => {
    typeInto(textarea(), 'Hi {firstName} at {company} {foo}')

    const submit = buttonByText('Generate Messages')
    expect(document.querySelector('[role="alert"]')?.textContent).toContain(
      'Unknown variables: {company}, {foo}'
    )
    expect(textarea().getAttribute('aria-invalid')).toBe('true')
    expect(submit).toBeDisabled()

    act(() => submit.closest('form')!.requestSubmit())
    expect(generateMessages).not.toHaveBeenCalled()

    typeInto(textarea(), 'Hi {firstName} at {companyName}')
    expect(document.querySelector('[role="alert"]')).toBeNull()
    expect(buttonByText('Generate Messages')).toBeEnabled()
  })

  it('submits a template with only known variables', async () => {
    generateMessages.mockResolvedValue({ success: true, generatedCount: 2, errors: [] })
    typeInto(textarea(), '  Hi {firstName}  ')

    await act(async () => buttonByText('Generate Messages').click())

    expect(generateMessages).toHaveBeenCalledWith({ leadIds: [1, 2], template: 'Hi {firstName}' })
    expect(onClose).toHaveBeenCalled()
  })
})
