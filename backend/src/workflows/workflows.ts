import { proxyActivities } from '@temporalio/workflow'
import type * as activities from './activities'

const { verifyEmail } = proxyActivities<typeof activities>({
  startToCloseTimeout: '1 second',
  // Also sets how often heartbeats reach the server (80% of this value), which
  // is how a long-running attempt learns that it has timed out.
  heartbeatTimeout: '500 milliseconds',
  // Temporal's default retry policy retries forever. An attempt that keeps
  // timing out (a slow or unresponsive provider) would then keep the workflow
  // running indefinitely, so bound it: 3 attempts with exponential backoff
  // (1s, then 2s) fail the workflow after roughly 6 seconds at worst.
  retry: {
    initialInterval: '1 second',
    backoffCoefficient: 2,
    maximumInterval: '5 seconds',
    maximumAttempts: 3,
  },
})

export async function verifyEmailWorkflow(email: string): Promise<boolean> {
  return await verifyEmail(email)
}
