import { LeadsVerifyEmailsOutput } from '../api/types/leads/verifyEmails'

/** Failed leads listed by name in the toast; the rest are summed up as "and N more". */
export const MAX_LISTED_FAILURES = 5

export type VerifyEmailsSummary = {
  /** True when some leads could not be verified. */
  hasFailures: boolean
  title: string
  failures: string[]
  /** Failed leads not listed in `failures`. */
  remainingFailures: number
}

const emails = (count: number) => (count === 1 ? `${count} email` : `${count} emails`)

export function summarizeVerifyEmails(data: LeadsVerifyEmailsOutput): VerifyEmailsSummary {
  const failedCount = data.errors.length
  if (failedCount === 0) {
    return {
      hasFailures: false,
      title: `Verified ${emails(data.verifiedCount)}`,
      failures: [],
      remainingFailures: 0,
    }
  }

  const total = data.verifiedCount + failedCount
  return {
    hasFailures: true,
    title:
      data.verifiedCount === 0
        ? `Couldn't verify ${emails(failedCount)}:`
        : `Verified ${data.verifiedCount} of ${emails(total)}. Couldn't verify:`,
    failures: data.errors.slice(0, MAX_LISTED_FAILURES).map(({ leadName, error }) => `${leadName}: ${error}`),
    remainingFailures: Math.max(0, failedCount - MAX_LISTED_FAILURES),
  }
}
