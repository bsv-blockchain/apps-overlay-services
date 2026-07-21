import { PublicKey, ProtoWallet, PubKeyHex } from '@bsv/sdk'
import {
  METANET_APPS_KEY_ID,
  METANET_APPS_LEGACY_KEY_ID,
  METANET_APPS_PROTOCOL
} from 'metanet-apps'

export type SignatureLinkResult =
  | { valid: true }
  | { valid: false, code: 'ERR_SIGNATURE_INVALID' | 'ERR_SIGNATURE_KEY_ID_MISMATCH' | 'ERR_LOCKING_KEY_MISMATCH' }

async function verifyForKeyID (
  lockingPublicKey: PublicKey,
  publisher: PubKeyHex,
  fields: number[][],
  keyID: string
): Promise<SignatureLinkResult> {
  const dataFields = fields.slice(0, -1)
  const signature = fields.at(-1)
  if (signature === undefined) return { valid: false, code: 'ERR_SIGNATURE_INVALID' }

  const data = dataFields.reduce<number[]>((all, field) => all.concat(field), [])
  const anyoneWallet = new ProtoWallet('anyone')
  try {
    const { valid } = await anyoneWallet.verifySignature({
      data,
      signature,
      counterparty: publisher,
      protocolID: METANET_APPS_PROTOCOL,
      keyID
    })
    if (!valid) return { valid: false, code: 'ERR_SIGNATURE_INVALID' }

    const { publicKey: expectedLockingPublicKey } = await anyoneWallet.getPublicKey({
      counterparty: publisher,
      protocolID: METANET_APPS_PROTOCOL,
      keyID
    })
    if (expectedLockingPublicKey !== lockingPublicKey.toString()) {
      return { valid: false, code: 'ERR_LOCKING_KEY_MISMATCH' }
    }
    return { valid: true }
  } catch {
    return { valid: false, code: 'ERR_SIGNATURE_INVALID' }
  }
}

/**
 * Checks that the BRC-48 locking key and the signature are valid and linked to the claimed identity key.
 * @param lockingPublicKey - The public key used in the output's locking script.
 * @param fields - The fields of the PushDrop token for the UHRP advertisement.
 * @returns True if the token's signature is properly linked to the claimed identity key, false otherwise.
 */
export const isTokenSignatureCorrectlyLinked = async (
  lockingPublicKey: PublicKey,
  publisher: PubKeyHex,
  fields: number[][]
): Promise<boolean> => {
  return (await verifyTokenSignatureLink(lockingPublicKey, publisher, fields)).valid
}

/** Verify the canonical key and identify tokens signed by the historical UI key. */
export async function verifyTokenSignatureLink (
  lockingPublicKey: PublicKey,
  publisher: PubKeyHex,
  fields: number[][]
): Promise<SignatureLinkResult> {
  const canonical = await verifyForKeyID(lockingPublicKey, publisher, fields, METANET_APPS_KEY_ID)
  if (canonical.valid) return canonical

  const legacy = await verifyForKeyID(lockingPublicKey, publisher, fields, METANET_APPS_LEGACY_KEY_ID)
  if (legacy.valid) return { valid: false, code: 'ERR_SIGNATURE_KEY_ID_MISMATCH' }
  return canonical
}
