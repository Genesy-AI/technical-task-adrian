import { TimeoutFailure, WorkflowFailedError } from '@temporalio/client'

/** User-facing reasons for a lead that could not be verified, shown in the UI. */
export const VERIFICATION_ERROR_MESSAGES = {
  timedOut: 'Verification timed out',
  failed: 'Verification failed',
  internal: 'Something went wrong',
} as const

/**
 * Message reported to the client for a lead that could not be verified.
 *
 * The client only gets a short, user-facing reason. The technical cause is
 * logged here instead, because Temporal's messages ("activity StartToClose
 * timeout") mean nothing to users and other errors, such as Prisma's, include
 * server paths and code excerpts.
 *
 * A failed workflow is a verification outcome (e.g. the provider timed out).
 * Anything else (database write, Temporal unreachable) is an internal fault.
 */
export function verificationErrorMessage(leadId: number, error: unknown): string {
  if (error instanceof WorkflowFailedError) {
    console.warn(`Email verification failed for lead ${leadId}:`, error)
    return causeChain(error).some((cause) => cause instanceof TimeoutFailure)
      ? VERIFICATION_ERROR_MESSAGES.timedOut
      : VERIFICATION_ERROR_MESSAGES.failed
  }

  console.error(`Error verifying email for lead ${leadId}:`, error)
  return VERIFICATION_ERROR_MESSAGES.internal
}

/** The error followed by its causes. Temporal nests them, e.g. WorkflowFailedError -> ActivityFailure -> TimeoutFailure. */
function causeChain(error: Error): Error[] {
  const chain: Error[] = []
  let current: unknown = error
  while (current instanceof Error) {
    chain.push(current)
    current = (current as { cause?: unknown }).cause
  }
  return chain
}
