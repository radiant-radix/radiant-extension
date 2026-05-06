import { RadixEngineToolkit, PrivateKey, NetworkId } from '@radixdlt/radix-engine-toolkit'
import { getGatewayUrl } from './gateway'

export function buildBatchManifest(fromAddress, transfers, network) {
  const XRD = network === 'mainnet'
    ? 'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd'
    : 'resource_tdx_2_1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxtfd2jc'

  let manifest = `CALL_METHOD\n    Address("${fromAddress}")\n    "lock_fee"\n    Decimal("2");\n`

  // Withdraw all amounts first
  const byResource = {}
  transfers.forEach(t => {
    const resource = t.resource || XRD
    if (!byResource[resource]) byResource[resource] = 0
    byResource[resource] += parseFloat(t.amount)
  })

  Object.entries(byResource).forEach(([resource, total]) => {
    manifest += `\nCALL_METHOD\n    Address("${fromAddress}")\n    "withdraw"\n    Address("${resource}")\n    Decimal("${total.toFixed(8)}");\n`
  })

  // Distribute to each recipient
  transfers.forEach((t, i) => {
    const resource = t.resource || XRD
    manifest += `\nTAKE_FROM_WORKTOP\n    Address("${resource}")\n    Decimal("${parseFloat(t.amount).toFixed(8)}")\n    Bucket("bucket_${i}");\n`
    manifest += `\nCALL_METHOD\n    Address("${t.to}")\n    "try_deposit_or_abort"\n    Bucket("bucket_${i}")\n    Enum<0u8>();\n`
  })

  return manifest
}

export async function signAndSubmitManifest(manifestStr, privateKeyHex, network) {
  const { RadixEngineToolkit, PrivateKey, NetworkId } = await import('@radixdlt/radix-engine-toolkit')
  const networkId = network === 'mainnet' ? NetworkId.Mainnet : NetworkId.Stokenet
  const privateKeyBytes = Uint8Array.from(Buffer.from(privateKeyHex, 'hex'))
  const privateKey = new PrivateKey.Ed25519(privateKeyBytes)

  const epochRes = await fetch(getGatewayUrl(network) + '/status/gateway-status', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
  })
  const epochData = await epochRes.json()
  const currentEpoch = epochData?.ledger_state?.epoch || 0

  const intent = {
    header: {
      networkId, startEpochInclusive: currentEpoch, endEpochExclusive: currentEpoch + 10,
      nonce: Math.floor(Math.random() * 0xFFFFFFFF),
      notaryPublicKey: privateKey.publicKey(), notaryIsSignatory: true, tipPercentage: 0,
    },
    manifest: { instructions: { kind: 'String', value: manifestStr }, blobs: [] },
    message: { kind: 'None' },
  }

  const intentHash = await RadixEngineToolkit.Intent.intentHash(intent)
  const sig = privateKey.signToSignatureWithPublicKey(intentHash.hash)
  const signedIntent = { intent, intentSignatures: [sig] }
  const signedHash = await RadixEngineToolkit.SignedIntent.signedIntentHash(signedIntent)
  const notarySig = privateKey.signToSignature(signedHash.hash)
  const notarized = { signedIntent, notarySignature: notarySig }
  const compiled = await RadixEngineToolkit.NotarizedTransaction.compile(notarized)
  const compiledHex = Buffer.from(compiled).toString('hex')

  const res = await fetch(getGatewayUrl(network) + '/transaction/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notarized_transaction_hex: compiledHex }),
  })
  return res.json()
}
