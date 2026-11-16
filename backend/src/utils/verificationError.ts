import { WorkflowFailedError } from '@temporalio/client'

/**
 * Message reported to the client for a lead that could not be verified.
 *
 * A failed workflow is a verification outcome (e.g. the provider timed out),
 * so its reason is returned. Temporal wraps it (WorkflowFailedError ->
 * ActivityFailure -> TimeoutFailure) and the outer message is just "Workflow
 * execution failed", so the innermost cause is used.
 *
 * Anything else (database write, Temporal unreachable) is an internal fault:
 * it is logged here, and the client gets a generic message, because raw
 * errors such as Prisma's include server paths and code excerpts.
 */
export function verificationErrorMessage(leadId: number, error: unknown): string {
  if (error instanceof WorkflowFailedError) {
    let current: Error = error
    for (;;) {
      const { cause } = current as { cause?: unknown }
      if (!(cause instanceof Error)) {
        return current.message
      }
      current = cause
    }
  }

  console.error(`Error verifying email for lead ${leadId}:`, error)
  return 'Internal error, please try again'
}
