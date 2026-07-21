import {
  PrivateKey,
  type PublicKey,
  ProtoWallet,
  PushDrop,
  Utils,
  type WalletInterface
} from '@bsv/sdk'
import {
  METANET_APPS_KEY_ID,
  METANET_APPS_LEGACY_KEY_ID,
  METANET_APPS_PROTOCOL
} from 'metanet-apps'
import { verifyTokenSignatureLink } from './isTokenSignatureCorrectlyLinked.js'

const paperTradeMetadata = {
  version: '0.1.0',
  name: 'PaperTrade',
  description: 'Reader-first BRC-100-authenticated BSV publishing.',
  icon: 'https://papertrade.metanet.app/icon.svg',
  domain: 'papertrade.metanet.app',
  release_date: '2026-07-21T01:19:34.465Z',
  httpURL: 'https://papertrade.metanet.app/',
  publisher: ''
} as const

describe('Metanet Apps token signature contract', () => {
  const wallet = new ProtoWallet(new PrivateKey(42)) as unknown as WalletInterface

  async function createToken (keyID: string): Promise<{ lockingPublicKey: PublicKey, fields: number[][] }> {
    const { publicKey } = await wallet.getPublicKey({ identityKey: true })
    const metadata = { ...paperTradeMetadata, publisher: publicKey }
    const lockingScript = await new PushDrop(wallet).lock(
      [Utils.toArray(JSON.stringify(metadata), 'utf8')],
      METANET_APPS_PROTOCOL,
      keyID,
      'anyone',
      true
    )
    return PushDrop.decode(lockingScript)
  }

  it('classifies the PaperTrade legacy-key failure precisely', async () => {
    const decoded = await createToken(METANET_APPS_LEGACY_KEY_ID)
    const publisher = JSON.parse(Utils.toUTF8(decoded.fields[0])).publisher

    await expect(verifyTokenSignatureLink(
      decoded.lockingPublicKey,
      publisher,
      decoded.fields
    )).resolves.toEqual({ valid: false, code: 'ERR_SIGNATURE_KEY_ID_MISMATCH' })
  })

  it('admits an otherwise identical token created with the canonical key', async () => {
    const decoded = await createToken(METANET_APPS_KEY_ID)
    const publisher = JSON.parse(Utils.toUTF8(decoded.fields[0])).publisher

    await expect(verifyTokenSignatureLink(
      decoded.lockingPublicKey,
      publisher,
      decoded.fields
    )).resolves.toEqual({ valid: true })
  })
})
