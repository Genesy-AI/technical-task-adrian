import { FC, useEffect, useId, useRef, useState } from 'react'
import type { LeadTemplateField } from '../leadTemplateFields'
import { filterTemplateFields, listboxOptionId, moveActiveIndex } from '../utils/templateVariables'
import { TemplateVariableListbox } from './TemplateVariableListbox'

interface TemplateVariablePickerProps {
  /** Called with the chosen field; the caller inserts it and moves focus back to its editor. */
  onSelect: (field: LeadTemplateField) => void
  disabled?: boolean
}

/**
 * "Insert variable" button that opens a searchable list of template variables.
 *
 * Keyboard: type to filter, ArrowUp/ArrowDown to move, Enter to insert, Escape to close.
 * Escape is marked handled with `preventDefault()` so the enclosing modal, which listens
 * for Escape on `document`, leaves itself open (see MessageTemplateModal).
 */
export const TemplateVariablePicker: FC<TemplateVariablePickerProps> = ({ onSelect, disabled = false }) => {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)
  const containerRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)
  const popoverId = useId()
  const listboxId = useId()

  const options = filterTemplateFields(search)
  const clampedIndex = Math.min(activeIndex, Math.max(options.length - 1, 0))

  const open = () => {
    setSearch('')
    setActiveIndex(0)
    setIsOpen(true)
  }

  const close = ({ restoreFocus }: { restoreFocus: boolean }) => {
    setIsOpen(false)
    if (restoreFocus) triggerRef.current?.focus()
  }

  const select = (field: LeadTemplateField) => {
    setIsOpen(false)
    onSelect(field)
  }

  useEffect(() => {
    if (!isOpen) return
    searchRef.current?.focus()

    const handlePointerDown = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setIsOpen(false)
    }
    document.addEventListener('mousedown', handlePointerDown)
    return () => document.removeEventListener('mousedown', handlePointerDown)
  }, [isOpen])

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowUp':
        e.preventDefault()
        setActiveIndex(moveActiveIndex(clampedIndex, e.key === 'ArrowDown' ? 1 : -1, options.length))
        break
      case 'Enter':
        // Never submit the surrounding form from the search box.
        e.preventDefault()
        if (options[clampedIndex]) select(options[clampedIndex])
        break
      case 'Escape':
        e.preventDefault()
        close({ restoreFocus: true })
        break
      case 'Tab':
        close({ restoreFocus: false })
        break
    }
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (isOpen ? close({ restoreFocus: false }) : open())}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-controls={isOpen ? popoverId : undefined}
        className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        <span aria-hidden="true">{'{ }'}</span>
        Insert variable
      </button>

      {isOpen && (
        <div
          id={popoverId}
          role="dialog"
          aria-label="Insert variable"
          className="absolute right-0 top-full mt-1 z-10 w-72 bg-white border border-gray-200 rounded-md shadow-lg"
        >
          <div className="p-2 border-b border-gray-100">
            <input
              ref={searchRef}
              type="text"
              role="combobox"
              aria-label="Search variables"
              aria-expanded="true"
              aria-controls={listboxId}
              aria-autocomplete="list"
              aria-activedescendant={
                options.length > 0 ? listboxOptionId(listboxId, clampedIndex) : undefined
              }
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setActiveIndex(0)
              }}
              onKeyDown={handleSearchKeyDown}
              placeholder="Search variables…"
              autoComplete="off"
              spellCheck={false}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <TemplateVariableListbox
            id={listboxId}
            label="Variables"
            options={options}
            activeIndex={clampedIndex}
            onActiveIndexChange={setActiveIndex}
            onSelect={select}
          />
          {options.length === 0 && <p className="px-3 py-2 text-sm text-gray-500">No matching variables</p>}
        </div>
      )}
    </div>
  )
}
