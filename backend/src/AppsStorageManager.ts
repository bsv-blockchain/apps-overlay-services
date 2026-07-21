import { Collection, Db } from 'mongodb'
import { LookupFormula } from '@bsv/overlay'
import type { NormalizedPublishedAppMetadata, PublishedAppMetadata } from 'metanet-apps'
import { AppCatalogRecord } from './types.js'

/**
 * Storage manager for the on-chain Apps catalogue overlay.
 */
export class AppsStorageManager {
  private readonly records: Collection<AppCatalogRecord>

  /**
   * @param db  A connected MongoDB database handle.
   */
  constructor (private readonly db: Db) {
    this.records = db.collection<AppCatalogRecord>('appsCatalogRecords')

    // Simple full-text index so callers can perform ad-hoc searches.
    this.records
      .createIndex({
        'metadata.name': 'text',
        'metadata.description': 'text',
        'metadata.tags': 'text',
        'metadata.domain': 'text'
      })
      .catch(console.error)
    this.records.createIndex({ txid: 1, outputIndex: 1 }, { unique: true }).catch(console.error)
    this.records.createIndex({ 'normalizedMetadata.domain': 1 }).catch(console.error)
    this.records.createIndex({ releasedAt: -1 }).catch(console.error)
  }

  /**
   * Insert a new app-token record.
   */
  async storeRecord (
    txid: string,
    outputIndex: number,
    metadata: PublishedAppMetadata,
    normalizedMetadata: NormalizedPublishedAppMetadata
  ): Promise<void> {
    await this.records.updateOne(
      { txid, outputIndex },
      {
        $set: {
          metadata,
          normalizedMetadata,
          releasedAt: new Date(normalizedMetadata.released_at)
        },
        $setOnInsert: { txid, outputIndex, createdAt: new Date() }
      },
      { upsert: true }
    )
  }

  /**
   * Remove an app-token record identified by its UTXO.
   */
  async deleteRecord (txid: string, outputIndex: number): Promise<void> {
    await this.records.deleteOne({ txid, outputIndex })
  }

  /**
   * Fetch records published for a specific domain with pagination and sorting.
   * @param {string} domain - Domain to filter by
   * @param {number} limit - Maximum number of records to return
   * @param {number} skip - Number of records to skip (for pagination)
   * @param {string} sortOrder - Sort direction ('asc' or 'desc')
   * @returns {Promise<LookupFormula>} Matching UTXO references
   */
  async findByDomain (
    domain: string,
    limit: number = 50,
    skip: number = 0,
    sortOrder: 'asc' | 'desc' = 'desc'
  ): Promise<LookupFormula> {
    return await this.findRecordWithQuery({
      $or: [{ 'normalizedMetadata.domain': domain.toLowerCase() }, { 'metadata.domain': domain }]
    }, limit, skip, sortOrder)
  }

  /**
   * Fetch records by publisher (identity key) with pagination and sorting.
   * @param {string} publisher - Publisher identity key
   * @param {number} limit - Maximum number of records to return
   * @param {number} skip - Number of records to skip (for pagination)
   * @param {string} sortOrder - Sort direction ('asc' or 'desc')
   * @returns {Promise<LookupFormula>} Matching UTXO references
   */
  async findByPublisher (
    publisher: string,
    limit: number = 50,
    skip: number = 0,
    sortOrder: 'asc' | 'desc' = 'desc'
  ): Promise<LookupFormula> {
    return await this.findRecordWithQuery({ 'metadata.publisher': publisher }, limit, skip, sortOrder)
  }

  /**
   * Look up the single record behind an outpoint ("txid.outputIndex").
   * Throws if the outpoint string is malformed.
   * @param {string} outpoint - Outpoint in format "txid.outputIndex"
   * @returns {Promise<LookupFormula>} Matching UTXO reference
   */
  async findByOutpoint (outpoint: string): Promise<LookupFormula> {
    if (!/^[0-9a-f]{64}\.\d+$/i.test(outpoint)) throw new Error('Invalid outpoint format – expected "txid.outputIndex"')
    const [txid, indexStr] = outpoint.split('.')
    const outputIndex = Number(indexStr)

    if (txid === '' || Number.isNaN(outputIndex)) {
      throw new Error('Invalid outpoint format – expected "txid.outputIndex"')
    }

    // For outpoint lookup, we don't need pagination or sorting as it's a unique identifier
    return await this.findRecordWithQuery({ txid, outputIndex }, 1, 0, 'desc')
  }

  /**
  * Fuzzy-match apps by (partial) name.
  * By default uses a case-insensitive RegExp; adjust parameters as needed.
  *
  * @param {string} partialName - Partial name to search for
  * @param {number} limit - Maximum number of records to return
  * @param {number} skip - Number of records to skip (for pagination)
  * @param {string} sortOrder - Sort direction ('asc' or 'desc')
  * @returns {Promise<LookupFormula>} Matching UTXO references
  */
  async findByNameFuzzy (
    partialName: string,
    limit: number = 50,
    skip: number = 0,
    sortOrder: 'asc' | 'desc' = 'desc'
  ): Promise<LookupFormula> {
    // Escape regex metacharacters so user input is safe
    const escaped = partialName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(escaped, 'i')

    // Use findRecordWithQuery with the regex query
    return await this.findRecordWithQuery(
      { 'metadata.name': { $regex: regex } },
      limit,
      skip,
      sortOrder
    )

    /* ---------- Note: Consider supporting Atlas Search version ----------
    return this.records
      .aggregate<AppCatalogRecord>([
        {
          $search: {
            index: 'default',                 // Atlas Search index
            text: {
              query: partialName,
              path: 'metadata.name',
              fuzzy: { maxEdits: 2 }
            }
          }
        },
        { $limit: limit }
      ])
      .toArray()
    ------------------------------------------- */
  }

  /**
   * Fetch records that match the specified tags with pagination and sorting.
   * @param {string[]} tags - Array of tags to match (any tag matches)
   * @param {number} limit - Maximum number of records to return
   * @param {number} skip - Number of records to skip (for pagination)
   * @param {string} sortOrder - Sort direction ('asc' or 'desc')
   * @returns {Promise<LookupFormula>} Matching UTXO references
   */
  async findByTags (
    tags: string[],
    limit: number = 50,
    skip: number = 0,
    sortOrder: 'asc' | 'desc' = 'desc'
  ): Promise<LookupFormula> {
    return await this.findRecordWithQuery(
      { 'metadata.tags': { $in: tags } },
      limit,
      skip,
      sortOrder
    )
  }

  /**
   * Fetch records that match the specified category with pagination and sorting.
   * @param {string} category - Category to filter by
   * @param {number} limit - Maximum number of records to return
   * @param {number} skip - Number of records to skip (for pagination)
   * @param {string} sortOrder - Sort direction ('asc' or 'desc')
   * @returns {Promise<LookupFormula>} Matching UTXO references
   */
  async findByCategory (
    category: string,
    limit: number = 50,
    skip: number = 0,
    sortOrder: 'asc' | 'desc' = 'desc'
  ): Promise<LookupFormula> {
    return await this.findRecordWithQuery(
      { 'metadata.category': category },
      limit,
      skip,
      sortOrder
    )
  }

  /**
   * Fetch all app records without filtering, with pagination and sorting.
   * @param {number} limit - Maximum number of records to return
   * @param {number} skip - Number of records to skip (for pagination)
   * @param {string} sortOrder - Sort direction ('asc' or 'desc')
   * @returns {Promise<LookupFormula>} All app UTXO references
   */
  async findAllApps (
    limit: number = 50,
    skip: number = 0,
    sortOrder: 'asc' | 'desc' = 'desc'
  ): Promise<LookupFormula> {
    return await this.findRecordWithQuery({}, limit, skip, sortOrder)
  }

  /**
   * Helper function for querying from the database
   * @param {object} query - MongoDB query object
   * @param {number} limit - Maximum number of records to return
   * @param {number} skip - Number of records to skip (for pagination)
   * @param {string} sortOrder - Sort direction ('asc' or 'desc')
   * @returns {Promise<LookupFormula>} returns matching UTXO references
   */
  private async findRecordWithQuery (
    query: object,
    limit: number = 50,
    skip: number = 0,
    sortOrder: 'asc' | 'desc' = 'desc'
  ): Promise<LookupFormula> {
    // Apply sort on release_date (or other time-based field) for chronological ordering
    const sortDirection = sortOrder === 'desc' ? -1 : 1
    const safeLimit = Math.min(Math.max(Number.isFinite(limit) ? Math.trunc(limit) : 50, 1), 100)
    const safeSkip = Math.min(Math.max(Number.isFinite(skip) ? Math.trunc(skip) : 0, 0), 10_000)

    // Find matching results from the DB with pagination and sorting
    const results = await this.records
      .find(query)
      .sort({ releasedAt: sortDirection, 'metadata.release_date': sortDirection })
      .skip(safeSkip)
      .limit(safeLimit)
      .project({ txid: 1, outputIndex: 1 })
      .toArray()

    return results.map((record: any) => {
      return {
        txid: record.txid,
        outputIndex: record.outputIndex
      }
    })
  }
}
