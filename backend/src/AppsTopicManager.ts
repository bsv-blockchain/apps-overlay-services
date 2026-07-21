import { AdmittanceInstructions, TopicManager } from '@bsv/overlay'
import { PushDrop, Transaction, Utils } from '@bsv/sdk'
import docs from './docs/AppsTopicManagerDocs.md.js'
import {
  AppMetadataValidationError,
  normalizeAppMetadata,
  PublishedAppMetadata
} from 'metanet-apps'
import { AppAdmissionError, AppAdmissionCode, logAdmission } from './admission.js'
import { verifyTokenSignatureLink } from './isTokenSignatureCorrectlyLinked.js'

/**
 * Implements a topic manager for App tokens
 * @public
 */
export default class AppsTopicManager implements TopicManager {
  /**
   * Returns the outputs from the App transaction that are admissible.
   * @param beef - The transaction data in BEEF format
   * @param previousCoins - The previous coins to consider
   * @returns A promise that resolves with the admittance instructions
   */
  async identifyAdmissibleOutputs (beef: number[], previousCoins: number[]): Promise<AdmittanceInstructions> {
    const outputsToAdmit: number[] = []
    let txid: string | undefined
    let rejectedOutputCount = 0
    try {
      const parsedTransaction = Transaction.fromBEEF(beef)
      txid = parsedTransaction.id('hex')

      // Validate params
      if (!Array.isArray(parsedTransaction.inputs) || parsedTransaction.inputs.length < 1) throw new AppAdmissionError('ERR_TRANSACTION_INVALID', 'Transaction must contain an input')
      if (!Array.isArray(parsedTransaction.outputs) || parsedTransaction.outputs.length < 1) throw new AppAdmissionError('ERR_TRANSACTION_INVALID', 'Transaction must contain an output')

      // Try to decode and validate transaction outputs
      for (const [i, output] of parsedTransaction.outputs.entries()) {
        // Decode the fields
        try {
          let result
          try {
            result = PushDrop.decode(output.lockingScript)
          } catch {
            throw new AppAdmissionError('ERR_OUTPUT_NOT_PUSH_DROP', 'Output is not a PushDrop token')
          }

          // Check that there is exactly one field + signature
          if (result.fields.length !== 2) {
            throw new AppAdmissionError('ERR_METADATA_INVALID', 'App token must have exactly one metadata field and one signature')
          }

          const metadataJSON = Utils.toUTF8(result.fields[0])
          let metadata: PublishedAppMetadata
          try {
            metadata = JSON.parse(metadataJSON)
          } catch {
            throw new AppAdmissionError('ERR_METADATA_INVALID', 'Metadata field is not valid JSON')
          }

          if (metadata == null) {
            throw new AppAdmissionError('ERR_METADATA_INVALID', 'App token must contain valid metadata')
          }

          const normalized = normalizeAppMetadata(metadata)
          if (normalized.publisher === undefined) throw new AppAdmissionError('ERR_PUBLISHER_MISSING', 'App metadata must include a publisher')

          // Check key linages
          const link = await verifyTokenSignatureLink(result.lockingPublicKey, normalized.publisher, result.fields)
          if (!link.valid) throw new AppAdmissionError(link.code, 'App signature is not linked to the claimed publisher with the canonical key')

          outputsToAdmit.push(i)
        } catch (error) {
          rejectedOutputCount++
          const code: AppAdmissionCode = error instanceof AppAdmissionError
            ? error.code
            : error instanceof AppMetadataValidationError
              ? error.code
              : 'ERR_INTERNAL'
          logAdmission({ event: 'apps.admission_rejected', txid, outputIndex: i, code })
        }
      }
    } catch (error) {
      const code: AppAdmissionCode = error instanceof AppAdmissionError ? error.code : 'ERR_TRANSACTION_INVALID'
      logAdmission({ event: 'apps.admission_rejected', txid, code })
    }

    logAdmission({
      event: 'apps.admission_completed',
      txid,
      admittedOutputs: outputsToAdmit,
      rejectedOutputCount,
      previousCoinCount: previousCoins?.length ?? 0
    })

    return {
      outputsToAdmit,
      coinsToRetain: []
    }
  }

  // TODO: Consider supporting identifyNeededInputs
  // identifyNeededInputs?: ((beef: number[]) => Promise<Array<{ txid: string; outputIndex: number }>>) | undefined

  /**
   * Get the documentation associated with this Apps topic manager
   * @returns A promise that resolves to a string containing the documentation
   */
  async getDocumentation (): Promise<string> {
    return docs
  }

  /**
   * Get metadata about the topic manager
   * @returns A promise that resolves to an object containing metadata
   * @throws An error indicating the method is not implemented
   */
  async getMetaData (): Promise<{
    name: string
    shortDescription: string
    iconURL?: string
    version?: string
    informationURL?: string
  }> {
    return {
      name: 'Apps Topic Manager',
      shortDescription: 'Admits PushDrop tokens representing published Metanet Apps into an overlay.',
      version: '1.1.0'
    }
  }
}
