import { FC, useEffect, useRef } from 'react'
import type { LeadTemplateField } from '../leadTemplateFields'
import { listboxOptionId, toTemplateVariable } from '../utils/templateVariables'

interface TemplateVariableListboxProps {
  /** DOM id of the listbox; each option gets `${id}-option-${index}`. */
  id: string
  label: string
  options: readonly LeadTemplateField[]
  activeIndex: number
  onActiveIndexChange: (index: number) => void
  onSelect: (field: LeadTemplateField) => void
  className?: string
}

/**
 * The list of template variables shared by the "Insert variable" picker and the `{`
 * autocomplete. Focus stays on the controlling input (it points at the active option via
 * `aria-activedescendant`), so options never take focus: mouse-down is prevented to keep
 * the caret in the input.
 */
export const TemplateVariableListbox: FC<TemplateVariableListboxProps> = ({
  id,
  label,
  options,
  activeIndex,
  onActiveIndexChange,
  onSelect,
  className = '',
}) => {
  const listRef = useRef<HTMLUListElement>(null)

  useEffect(() => {
    const active = listRef.current?.children[activeIndex]
    // jsdom does not implement scrollIntoView.
    active?.scrollIntoView?.({ block: 'nearest' })
  }, [activeIndex, options])

  return (
    <ul
      ref={listRef}
      id={id}
      role="listbox"
      aria-label={label}
      className={`max-h-60 overflow-y-auto py-1 ${className}`}
    >
      {options.map((field, index) => {
        const isActive = index === activeIndex
        return (
          <li
            key={field.key}
            id={listboxOptionId(id, index)}
            role="option"
            aria-selected={isActive}
            onMouseDown={(e) => e.preventDefault()}
            onMouseMove={() => {
              if (!isActive) onActiveIndexChange(index)
            }}
            onClick={() => onSelect(field)}
            className={`flex items-center justify-between gap-4 px-3 py-1.5 text-sm cursor-pointer ${
              isActive ? 'bg-blue-50 text-blue-900' : 'text-gray-700'
            }`}
          >
            <span>{field.label}</span>
            <code className="text-xs text-gray-500">{toTemplateVariable(field.key)}</code>
          </li>
        )
      })}
    </ul>
  )
}
