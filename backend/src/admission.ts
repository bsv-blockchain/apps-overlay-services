export type AppAdmissionCode =
  | 'ERR_TRANSACTION_INVALID'
  | 'ERR_OUTPUT_NOT_PUSH_DROP'
  | 'ERR_METADATA_INVALID'
  | 'ERR_METADATA_TOO_LARGE'
  | 'ERR_METADATA_UNSUPPORTED_SCHEMA'
  | 'ERR_METADATA_INVALID_URL'
  | 'ERR_METADATA_INVALID_DOMAIN'
  | 'ERR_METADATA_FIELD_TOO_LONG'
  | 'ERR_METADATA_TOO_MANY_ITEMS'
  | 'ERR_PUBLISHER_MISSING'
  | 'ERR_SIGNATURE_INVALID'
  | 'ERR_SIGNATURE_KEY_ID_MISMATCH'
  | 'ERR_LOCKING_KEY_MISMATCH'
  | 'ERR_INTERNAL'

export class AppAdmissionError extends Error {
  constructor (readonly code: AppAdmissionCode, message: string) {
    super(message)
    this.name = 'AppAdmissionError'
  }
}

export interface AppAdmissionLog {
  event: 'apps.admission_rejected' | 'apps.admission_completed'
  txid?: string
  outputIndex?: number
  code?: AppAdmissionCode
  admittedOutputs?: number[]
  rejectedOutputCount?: number
  previousCoinCount?: number
}

export function logAdmission (log: AppAdmissionLog): void {
  const serialized = JSON.stringify(log)
  if (log.event === 'apps.admission_rejected') console.warn(serialized)
  else console.info(serialized)
}
