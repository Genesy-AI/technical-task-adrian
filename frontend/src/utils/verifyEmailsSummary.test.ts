import { describe, it, expect } from 'vitest'
import { LeadsVerifyEmailsOutput } from '../api/types/leads/verifyEmails'
import { MAX_LISTED_FAILURES, summarizeVerifyEmails } from './verifyEmailsSummary'

const failure = (leadId: number) => ({
  leadId,
  leadName: `Lead ${leadId}`,
  error: 'activity StartToClose timeout',
})

const output = (
  verifiedCount: number,
  errors: LeadsVerifyEmailsOutput['errors'] = []
): LeadsVerifyEmailsOutput => ({ success: true, verifiedCount, results: [], errors })

describe('summarizeVerifyEmails', () => {
  it('reports plain success when no lead failed', () => {
    expect(summarizeVerifyEmails(output(1))).toEqual({
      hasFailures: false,
      title: 'Verified 1 email',
      failures: [],
      remainingFailures: 0,
    })
    expect(summarizeVerifyEmails(output(3)).title).toBe('Verified 3 emails')
  })

  it('lists failed leads with their reason alongside the verified count', () => {
    const summary = summarizeVerifyEmails(output(2, [failure(7)]))

    expect(summary.hasFailures).toBe(true)
    expect(summary.title).toBe("Verified 2 of 3 emails. Couldn't verify:")
    expect(summary.failures).toEqual(['Lead 7: activity StartToClose timeout'])
    expect(summary.remainingFailures).toBe(0)
  })

  it('does not claim any success when every lead failed', () => {
    expect(summarizeVerifyEmails(output(0, [failure(1)])).title).toBe("Couldn't verify 1 email:")
    expect(summarizeVerifyEmails(output(0, [failure(1), failure(2)])).title).toBe("Couldn't verify 2 emails:")
  })

  it('caps the listed failures and counts the rest', () => {
    const errors = Array.from({ length: MAX_LISTED_FAILURES + 2 }, (_, i) => failure(i + 1))
    const summary = summarizeVerifyEmails(output(0, errors))

    expect(summary.failures).toHaveLength(MAX_LISTED_FAILURES)
    expect(summary.remainingFailures).toBe(2)
  })
})
