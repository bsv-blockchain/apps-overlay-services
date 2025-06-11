import { Base64String } from "@bsv/sdk"

export interface TimeCrateRecord {
  txid: string
  outputIndex: number
  serialNumber: Base64String
  createdAt: Date
}

export interface TimeCrateQuery {
  serialNumber?: Base64String,
  outpoint?: string
}
