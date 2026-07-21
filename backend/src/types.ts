import { OutpointString, PubKeyHex } from '@bsv/sdk'
import type { NormalizedPublishedAppMetadata, PublishedAppMetadata } from 'metanet-apps'

export interface AppCatalogQuery {
  // Filter parameters
  domain?: string
  publisher?: PubKeyHex
  name?: string
  outpoint?: OutpointString
  tags?: string[]
  category?: string

  // Pagination parameters
  limit?: number // Maximum number of results to return (default: 50)
  skip?: number // Number of results to skip (default: 0)

  // Sorting parameters
  sortOrder?: 'asc' | 'desc' // Sort direction (default: 'desc' - newest first)
}

/**
 * On-chain App metadata held inside the PushDrop token’s JSON payload.
 * Only the required fields are mandatory; the rest remain optional
 * exactly as in the proposal.
 */
/**
 * A MongoDB document stored in the “appsCatalogRecords” collection.
 */
export interface AppCatalogRecord {
  txid: string
  outputIndex: number
  metadata: PublishedAppMetadata
  normalizedMetadata: NormalizedPublishedAppMetadata
  releasedAt: Date
  createdAt: Date
}

export type { PublishedAppMetadata }
