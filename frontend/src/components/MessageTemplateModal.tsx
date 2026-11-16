import { FC, useState, useEffect, useLayoutEffect, useCallback, useId, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import { api } from '../api'
import type { LeadTemplateField } from '../leadTemplateFields'
import {
  filterTemplateFields,
  findUnknownVariables,
  getActiveVariableQuery,
  listboxOptionId,
  moveActiveIndex,
  replaceRange,
  toTemplateVariable,
} from '../utils/templateVariables'
import { TemplateVariableListbox } from './TemplateVariableListbox'
import { TemplateVariablePicker } from './TemplateVariablePicker'

interface MessageTemplateModalProps {
  isOpen: boolean
  onClose: () => void
  selectedLeadIds: number[]
  selectedLeadsCount: number
}

export const MessageTemplateModal: FC<MessageTemplateModalProps> = ({
  isOpen,
  onClose,
  selectedLeadIds,
  selectedLeadsCount,
}) => {
  const [template, setTemplate] = useState('')
  const [generationResult, setGenerationResult] = useState<{
    success: boolean
    generatedCount: number
    errors: Array<{ leadId: number; leadName: string; error: string }>
  } | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  // Caret position to restore after a programmatic edit, applied once React has rendered the new value.
  const pendingCaretRef = useRef<number | null>(null)
  // Collapsed caret in the textarea, or null when it is not focused or text is selected.
  const [caret, setCaret] = useState<number | null>(null)
  // `{` position whose suggestions the user dismissed with Escape.
  const [dismissedSuggestionsAt, setDismissedSuggestionsAt] = useState<number | null>(null)
  const [suggestionHighlight, setSuggestionHighlight] = useState({ queryKey: '', index: 0 })
  const suggestionsId = useId()
  const unknownVariablesId = useId()
  const queryClient = useQueryClient()

  const unknownVariables = findUnknownVariables(template)
  const activeQuery = caret === null ? null : getActiveVariableQuery(template, caret)
  const suggestions = activeQuery ? filterTemplateFields(activeQuery.query) : []
  const showSuggestions =
    activeQuery !== null && suggestions.length > 0 && dismissedSuggestionsAt !== activeQuery.start
  const suggestionQueryKey = activeQuery ? `${activeQuery.start}:${activeQuery.query}` : ''
  // The highlight resets to the first suggestion whenever the typed partial changes.
  const activeSuggestionIndex =
    suggestionHighlight.queryKey === suggestionQueryKey
      ? Math.min(suggestionHighlight.index, suggestions.length - 1)
      : 0

  const generateMessagesMutation = useMutation({
    mutationFn: async (data: { leadIds: number[]; template: string }) => api.leads.generateMessages(data),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['leads', 'getMany'] })
      setGenerationResult(result)

      if (result.errors.length === 0) {
        const message =
          result.generatedCount === 1
            ? `Successfully generated message for ${result.generatedCount} lead`
            : `Successfully generated messages for ${result.generatedCount} leads`
        toast.success(message)
        onClose()
        setTemplate('')
        setGenerationResult(null)
      } else {
        const successMessage =
          result.generatedCount === 1
            ? `Generated message for ${result.generatedCount} lead`
            : `Generated messages for ${result.generatedCount} leads`
        const errorMessage =
          result.errors.length === 1
            ? `${result.errors.length} lead had errors`
            : `${result.errors.length} leads had errors`
        toast.success(`${successMessage}, but ${errorMessage}. Check details below.`)
      }
    },
    onError: () => {
      toast.error('Failed to generate messages. Please try again.')
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (template.trim() && selectedLeadIds.length > 0 && unknownVariables.length === 0) {
      setGenerationResult(null)

      generateMessagesMutation.mutate({
        leadIds: selectedLeadIds,
        template: template.trim(),
      })
    }
  }

  const handleClose = useCallback(() => {
    if (!generateMessagesMutation.isPending) {
      onClose()
      setTemplate('')
      setGenerationResult(null)
      setDismissedSuggestionsAt(null)
    }
  }, [generateMessagesMutation.isPending, onClose])

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      handleClose()
    }
  }

  useEffect(() => {
    const handleEscapeKey = (e: KeyboardEvent) => {
      // Inner widgets (variable picker, `{` suggestions) handle their own Escape and mark it with
      // preventDefault(); their React handlers run before this document listener, so only the
      // innermost open thing closes.
      if (e.key === 'Escape' && isOpen && !e.defaultPrevented) {
        handleClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscapeKey)
      document.body.style.overflow = 'hidden'

      if (textareaRef.current) {
        textareaRef.current.focus()
      }
    }

    return () => {
      document.removeEventListener('keydown', handleEscapeKey)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, handleClose])

  useLayoutEffect(() => {
    const textarea = textareaRef.current
    const position = pendingCaretRef.current
    if (textarea && position !== null) {
      pendingCaretRef.current = null
      textarea.focus()
      textarea.setSelectionRange(position, position)
      setCaret(position)
    }
  }, [template])

  const replaceTemplateRange = (start: number, end: number, insertion: string) => {
    const result = replaceRange(template, start, end, insertion)
    pendingCaretRef.current = result.caret
    setTemplate(result.text)
  }

  /** Picker: insert `{key}` at the caret, replacing any selected text. */
  const insertVariable = (field: LeadTemplateField) => {
    const textarea = textareaRef.current
    const start = textarea?.selectionStart ?? template.length
    const end = textarea?.selectionEnd ?? template.length
    replaceTemplateRange(start, end, toTemplateVariable(field.key))
  }

  /** Autocomplete: replace the `{partial` being typed with `{key}`. */
  const acceptSuggestion = (field: LeadTemplateField) => {
    if (activeQuery) replaceTemplateRange(activeQuery.start, activeQuery.end, toTemplateVariable(field.key))
  }

  const syncCaret = (textarea: HTMLTextAreaElement) => {
    setCaret(textarea.selectionStart === textarea.selectionEnd ? textarea.selectionStart : null)
  }

  const handleTemplateChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const textarea = e.target
    setTemplate(textarea.value)
    syncCaret(textarea)
    // A dismissal only applies to the `{` it was made on; leaving that variable re-arms suggestions.
    const next = getActiveVariableQuery(textarea.value, textarea.selectionStart)
    if (next?.start !== dismissedSuggestionsAt) setDismissedSuggestionsAt(null)
  }

  const handleTemplateKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (!showSuggestions || !activeQuery) return
    switch (e.key) {
      case 'ArrowDown':
      case 'ArrowUp':
        e.preventDefault()
        setSuggestionHighlight({
          queryKey: suggestionQueryKey,
          index: moveActiveIndex(activeSuggestionIndex, e.key === 'ArrowDown' ? 1 : -1, suggestions.length),
        })
        break
      case 'Enter':
      case 'Tab':
        e.preventDefault()
        acceptSuggestion(suggestions[activeSuggestionIndex])
        break
      case 'Escape':
        e.preventDefault()
        setDismissedSuggestionsAt(activeQuery.start)
        break
    }
  }

  if (!isOpen) return null

  const modalContent = (
    <div
      className="fixed inset-0 bg-black/40 backdrop-blur-xs flex items-center justify-center z-50"
      onClick={handleBackdropClick}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-gray-900">
              Generate Messages for {selectedLeadsCount} Lead{selectedLeadsCount !== 1 ? 's' : ''}
            </h2>
            <button
              onClick={handleClose}
              disabled={generateMessagesMutation.isPending}
              className="text-gray-400 hover:text-gray-600 transition-colors disabled:opacity-50"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label htmlFor="message-template" className="block text-sm font-medium text-gray-700">
                  Message Template
                </label>
                <TemplateVariablePicker
                  onSelect={insertVariable}
                  disabled={generateMessagesMutation.isPending}
                />
              </div>
              <div className="relative">
                <textarea
                  ref={textareaRef}
                  id="message-template"
                  value={template}
                  onChange={handleTemplateChange}
                  onSelect={(e) => syncCaret(e.currentTarget)}
                  onBlur={() => setCaret(null)}
                  onKeyDown={handleTemplateKeyDown}
                  aria-autocomplete="list"
                  aria-controls={showSuggestions ? suggestionsId : undefined}
                  aria-activedescendant={
                    showSuggestions ? listboxOptionId(suggestionsId, activeSuggestionIndex) : undefined
                  }
                  aria-invalid={unknownVariables.length > 0}
                  aria-describedby={unknownVariables.length > 0 ? unknownVariablesId : undefined}
                  placeholder="Enter your message template here. Type { to insert a variable.&#10;&#10;Example: Hi {firstName}, I noticed you work at {companyName} as a {jobTitle}. Would you be interested in..."
                  className={`w-full h-32 px-3 py-2 border rounded-md focus:outline-none focus:ring-2 resize-none ${
                    unknownVariables.length > 0
                      ? 'border-red-400 focus:ring-red-500 focus:border-red-500'
                      : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500'
                  }`}
                  required
                />
                {showSuggestions && (
                  <TemplateVariableListbox
                    id={suggestionsId}
                    label="Variable suggestions"
                    options={suggestions}
                    activeIndex={activeSuggestionIndex}
                    onActiveIndexChange={(index) =>
                      setSuggestionHighlight({ queryKey: suggestionQueryKey, index })
                    }
                    onSelect={acceptSuggestion}
                    className="absolute left-0 top-full mt-1 z-10 w-72 bg-white border border-gray-200 rounded-md shadow-lg"
                  />
                )}
              </div>
              {unknownVariables.length > 0 && (
                <p id={unknownVariablesId} role="alert" className="mt-2 text-sm text-red-600">
                  {unknownVariables.length === 1 ? 'Unknown variable' : 'Unknown variables'}:{' '}
                  {unknownVariables.map(toTemplateVariable).join(', ')}. Use “Insert variable” to see the
                  available ones.
                </p>
              )}
              <p className="mt-2 text-sm text-gray-500">
                Type{' '}
                <kbd className="px-1 font-mono text-xs bg-gray-100 border border-gray-300 rounded">{'{'}</kbd>{' '}
                or use “Insert variable” to add a lead field such as {`{firstName}`}. If a field is empty for
                a lead, no message is generated for that lead and the error is listed below.
              </p>
            </div>

            {generationResult && (
              <div className="space-y-4">
                {generationResult.generatedCount > 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center">
                      <svg
                        className="w-5 h-5 text-green-600 mr-3"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <span className="text-sm font-medium text-green-800">
                        Successfully generated messages for {generationResult.generatedCount} lead
                        {generationResult.generatedCount !== 1 ? 's' : ''}
                      </span>
                    </div>
                  </div>
                )}

                {generationResult.errors.length > 0 && (
                  <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                    <div className="flex items-start">
                      <svg
                        className="w-5 h-5 text-red-600 mr-3 mt-0.5 flex-shrink-0"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <div className="flex-1">
                        <h4 className="text-sm font-medium text-red-800 mb-2">
                          Failed to generate messages for {generationResult.errors.length} lead
                          {generationResult.errors.length !== 1 ? 's' : ''}:
                        </h4>
                        <div className="space-y-1">
                          {generationResult.errors.map((error, index) => (
                            <div key={index} className="text-sm text-red-700">
                              <span className="font-medium">{error.leadName}</span>: {error.error}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={handleClose}
                disabled={generateMessagesMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {generationResult ? 'Close' : 'Cancel'}
              </button>
              {(!generationResult || generationResult.errors.length > 0) && (
                <button
                  type="submit"
                  disabled={
                    !template.trim() || unknownVariables.length > 0 || generateMessagesMutation.isPending
                  }
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {generateMessagesMutation.isPending ? (
                    <>
                      <svg
                        className="animate-spin -ml-1 mr-2 h-4 w-4 text-white inline"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                      Generating...
                    </>
                  ) : generationResult ? (
                    'Try Again'
                  ) : (
                    'Generate Messages'
                  )}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  )

  return createPortal(modalContent, document.body)
}
