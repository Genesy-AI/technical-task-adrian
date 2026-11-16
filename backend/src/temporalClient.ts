import { Client, Connection } from '@temporalio/client'
import { config } from './config'

let clientPromise: Promise<Client> | undefined

/**
 * Process-wide Temporal client. A connection is a gRPC channel that is meant
 * to be long-lived and shared, so it is opened on first use and reused. If
 * connecting fails, the next call tries again instead of reusing the error.
 */
export function getTemporalClient(): Promise<Client> {
  if (!clientPromise) {
    const pending = Connection.connect({ address: config.temporal.address }).then(
      (connection) => new Client({ connection, namespace: config.temporal.namespace })
    )
    clientPromise = pending
    pending.catch(() => {
      if (clientPromise === pending) {
        clientPromise = undefined
      }
    })
  }
  return clientPromise
}
