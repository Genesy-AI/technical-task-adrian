import { afterEach, describe, expect, it, vi } from 'vitest'
import { ActivityFailure, ApplicationFailure, TimeoutFailure, WorkflowFailedError } from '@temporalio/client'
import { VERIFICATION_ERROR_MESSAGES, verificationErrorMessage } from './verificationError'

const activityFailedWith = (cause: Error) =>
  new WorkflowFailedError(
    'Workflow execution failed',
    new ActivityFailure(
      'Activity task failed',
      'verifyEmail',
      '1',
      'MAXIMUM_ATTEMPTS_REACHED',
      undefined,
      cause
    ),
    'NON_RETRYABLE_FAILURE'
  )

describe('verificationErrorMessage', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('reports a timed-out verification in plain words and logs the technical cause', () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const error = activityFailedWith(
      new TimeoutFailure('activity StartToClose timeout', undefined, 'START_TO_CLOSE')
    )

    expect(verificationErrorMessage(2, error)).toBe(VERIFICATION_ERROR_MESSAGES.timedOut)
    expect(consoleWarn).toHaveBeenCalledWith('Email verification failed for lead 2:', error)
  })

  it('reports any other failed workflow as a failed verification', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})

    expect(
      verificationErrorMessage(
        1,
        activityFailedWith(ApplicationFailure.create({ message: 'provider error' }))
      )
    ).toBe(VERIFICATION_ERROR_MESSAGES.failed)
    expect(
      verificationErrorMessage(
        1,
        new WorkflowFailedError('Workflow execution failed', undefined, 'NON_RETRYABLE_FAILURE')
      )
    ).toBe(VERIFICATION_ERROR_MESSAGES.failed)
  })

  it('hides internal errors from the client and logs them', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const error = new Error('Invalid `prisma.lead.update()` invocation in /srv/app/src/index.ts:313:27')

    expect(verificationErrorMessage(42, error)).toBe(VERIFICATION_ERROR_MESSAGES.internal)
    expect(consoleError).toHaveBeenCalledWith('Error verifying email for lead 42:', error)
  })

  it('treats non-Error throws as internal errors', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(verificationErrorMessage(1, 'boom')).toBe(VERIFICATION_ERROR_MESSAGES.internal)
  })
})
