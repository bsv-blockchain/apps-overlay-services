import { AdmittanceInstructions, TopicManager } from '@bsv/overlay'
import { PushDrop, Transaction, Utils } from '@bsv/sdk'
import docs from './docs/TimeCrateTopicManagerDocs.md.js'

/**
 * Implements a topic manager for Apps tokens
 * @public
 */
export default class AppsTopicManager implements TopicManager {
  /**
   * Returns the outputs from the Apps transaction that are admissible.
   * @param beef - The transaction data in BEEF format
   * @param previousCoins - The previous coins to consider
   * @returns A promise that resolves with the admittance instructions
   */
  async identifyAdmissibleOutputs(beef: number[], previousCoins: number[]): Promise<AdmittanceInstructions> {
    const outputsToAdmit: number[] = []
    try {
      console.log('Apps topic manager was invoked')
      const parsedTransaction = Transaction.fromBEEF(beef)

      // Validate params
      if (!Array.isArray(parsedTransaction.inputs) || parsedTransaction.inputs.length < 1) throw new Error('Missing parameter: inputs')
      if (!Array.isArray(parsedTransaction.outputs) || parsedTransaction.outputs.length < 1) throw new Error('Missing parameter: outputs')
      console.log('TimeCrate topic manager has parsed a the transaction: ', parsedTransaction.id('hex'))

      // Try to decode and validate transaction outputs
      for (const [i, output] of parsedTransaction.outputs.entries()) {
        // Decode the fields
        try {
          const result = PushDrop.decode(output.lockingScript)

          // Check that there is exactly one field + signature
          if (result.fields.length !== 2) {
            throw new Error('TimeCrate token must have exactly one field + signature')
          }

          const serialNumber = Utils.toUTF8(result.fields[0])

          if (serialNumber === undefined || serialNumber === null) {
            throw new Error('TimeCrate token must contain a valid serialNumber')
          }

          // Check that the field is exactly 32 bytes in length
          if (result.fields[0].length !== 32) {
            throw new Error('TimeCrate token serial number must be exactly 32 bytes in length')
          }

          outputsToAdmit.push(i)
        } catch (error) {
          console.error(`Error parsing output ${i}`, error)
          // It's common for other outputs to be invalid; no need to log an error here
          continue
        }
      }
      if (outputsToAdmit.length === 0) {
        throw new Error('Apps topic manager: no outputs admitted!')
      }

      // Returns an array of outputs admitted
      // And previousOutputsRetained (none by default)
      return {
        outputsToAdmit,
        coinsToRetain: []
      }
    } catch (error) {
      // Only log an error if no outputs were admitted and no previous coins consumed
      if (outputsToAdmit.length === 0 && (previousCoins === undefined || previousCoins.length === 0)) {
        console.error('Error identifying admissible outputs:', error)
      }
    }

    if (outputsToAdmit.length > 0) {
      console.log(`Admitted ${outputsToAdmit.length} TimeCrate ${outputsToAdmit.length === 1 ? 'output' : 'outputs'}!`)
    }

    if (previousCoins !== undefined && previousCoins.length > 0) {
      console.log(`Consumed ${previousCoins.length} previous TimeCrate ${previousCoins.length === 1 ? 'coin' : 'coins'}!`)
    }

    if (outputsToAdmit.length === 0 && (previousCoins === undefined || previousCoins.length === 0)) {
      console.warn('No TimeCrate outputs admitted, and no previous TimeCrate coins were consumed.')
    }

    return {
      outputsToAdmit,
      coinsToRetain: []
    }
  }

  // TODO: Consider supporting identifyNeededInputs
  // identifyNeededInputs?: ((beef: number[]) => Promise<Array<{ txid: string; outputIndex: number }>>) | undefined

  /**
   * Get the documentation associated with this TimeCrate topic manager
   * @returns A promise that resolves to a string containing the documentation
   */
  async getDocumentation(): Promise<string> {
    return docs
  }

  /**
   * Get metadata about the topic manager
   * @returns A promise that resolves to an object containing metadata
   * @throws An error indicating the method is not implemented
   */
  async getMetaData(): Promise<{
    name: string
    shortDescription: string
    iconURL?: string
    version?: string
    informationURL?: string
  }> {
    return {
      name: 'TimeCrate Topic Manager',
      shortDescription: 'TimeCrate Resolution Protocol'
    }
  }
}
