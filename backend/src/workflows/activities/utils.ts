import { Context } from '@temporalio/activity'

export async function verifyEmail(email: string): Promise<boolean> {
  if (email.includes('john.doe')) {
    return false
  }

  if (email.includes('jane.smith')) {
    await simulateLatency(20000)
  }

  if (/\+/.test(email)) {
    return false
  }

  return true
}

const HEARTBEAT_INTERVAL_MS = 200

/**
 * Simulates a slow provider call. A plain setTimeout kept every timed-out
 * attempt running on the worker until it finished on its own. Temporal only
 * tells an activity it was cancelled (timeout, workflow closed, worker
 * shutdown) through its heartbeats, and the activity's `sleep` rejects when
 * that happens, so the attempt stops promptly.
 */
async function simulateLatency(ms: number): Promise<void> {
  const ctx = Context.current()
  const deadline = Date.now() + ms
  while (Date.now() < deadline) {
    ctx.heartbeat()
    await ctx.sleep(Math.min(HEARTBEAT_INTERVAL_MS, deadline - Date.now()))
  }
}
