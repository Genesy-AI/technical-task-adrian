import { afterEach, describe, expect, it, vi } from 'vitest'
import { ActivityFailure, TimeoutFailure, WorkflowFailedError } from '@temporalio/client'
import { verificationErrorMessage } from './verificationError'

describe('verificationErrorMessage', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('reports the innermost cause of a failed workflow', () => {
    const timeout = new TimeoutFailure('activity StartToClose timeout', undefined, 'START_TO_CLOSE')
    const activityFailure = new ActivityFailure(
      'Activity task timed out',
      'verifyEmail',
      '1',
      'MAXIMUM_ATTEMPTS_REACHED',
      undefined,
      timeout
    )
    const error = new WorkflowFailedError(
      'Workflow execution failed',
      activityFailure,
      'NON_RETRYABLE_FAILURE'
    )

    expect(verificationErrorMessage(1, error)).toBe('activity StartToClose timeout')
  })

  it('reports a failed workflow without a cause by its own message', () => {
    const error = new WorkflowFailedError('Workflow execution failed', undefined, 'NON_RETRYABLE_FAILURE')

    expect(verificationErrorMessage(1, error)).toBe('Workflow execution failed')
  })

  it('hides internal errors from the client and logs them', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const error = new Error('Invalid `prisma.lead.update()` invocation in /srv/app/src/index.ts:313:27')

    const message = verificationErrorMessage(42, error)

    expect(message).toBe('Internal error, please try again')
    expect(message).not.toContain('prisma')
    expect(consoleError).toHaveBeenCalledWith('Error verifying email for lead 42:', error)
  })

  it('treats non-Error throws as internal errors', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(verificationErrorMessage(1, 'boom')).toBe('Internal error, please try again')
  })
})
