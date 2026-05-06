import {
  RadixEngineToolkit,
  PrivateKey,
  NetworkId,
} from '@radixdlt/radix-engine-toolkit'
import { getGatewayUrl } from './gateway'

export async function getCurrentEpoch(network = 'mainnet') {
  const url = getGatewayUrl(network)
  try {
    const res = await fetch(`${url}/status/gateway-status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    const data = await res.json()
    return data?.ledger_state?.epoch || 0
  } catch { return 0 }
}

export async function estimateFee({
  fromAddress,
  toAddress,
  resourceAddress,
  amount,
  network = 'mainnet',
}) {
  const url = getGatewayUrl(network)
  const XRD = network === 'mainnet'
    ? 'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd'
    : 'resource_tdx_2_1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxtfd2jc'
  const resource = resourceAddress || XRD
  const amountStr = parseFloat(amount).toFixed(8)

  const manifestStr = buildManifest(fromAddress, toAddress, resource, amountStr, XRD, '2')

  try {
    const res = await fetch(`${url}/transaction/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        manifest: manifestStr,
        blobs_hex: [],
        start_epoch_inclusive: 0,
        end_epoch_exclusive: 1,
        notary_public_key: { key_type: 'EddsaEd25519', key_hex: '0000000000000000000000000000000000000000000000000000000000000000' },
        notary_is_signatory: true,
        tip_percentage: 0,
        nonce: 1,
        signer_public_keys: [],
        flags: { use_free_credit: true, assume_all_signature_proofs: true, skip_epoch_check: true },
      }),
    })
    const data = await res.json()
    const fee = data?.receipt?.fee_summary?.total_execution_cost_in_xrd
      || data?.receipt?.fee_summary?.execution_cost_in_xrd
      || null
    return fee ? parseFloat(fee).toFixed(4) : null
  } catch {
    return null
  }
}

function buildManifest(fromAddress, toAddress, resource, amountStr, XRD, lockFee = '2') {
  return `CALL_METHOD
    Address("${fromAddress}")
    "lock_fee"
    Decimal("${lockFee}");
CALL_METHOD
    Address("${fromAddress}")
    "withdraw"
    Address("${resource}")
    Decimal("${amountStr}");
TAKE_FROM_WORKTOP
    Address("${resource}")
    Decimal("${amountStr}")
    Bucket("xfer");
CALL_METHOD
    Address("${toAddress}")
    "try_deposit_or_abort"
    Bucket("xfer")
    Enum<0u8>();`
}

export async function buildAndSignTransferTx({
  privateKeyHex,
  fromAddress,
  toAddress,
  resourceAddress,
  amount,
  network = 'mainnet',
}) {
  const networkId = network === 'mainnet' ? NetworkId.Mainnet : NetworkId.Stokenet
  const privateKeyBytes = Uint8Array.from(Buffer.from(privateKeyHex, 'hex'))
  const privateKey = new PrivateKey.Ed25519(privateKeyBytes)
  const currentEpoch = await getCurrentEpoch(network)

  const XRD = network === 'mainnet'
    ? 'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd'
    : 'resource_tdx_2_1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxtfd2jc'

  const resource = resourceAddress || XRD
  const amountStr = parseFloat(amount).toFixed(8)
  const manifestStr = buildManifest(fromAddress, toAddress, resource, amountStr, XRD, '2')
  const nonce = Math.floor(Math.random() * 0xFFFFFFFF)

  const intent = {
    header: {
      networkId,
      startEpochInclusive: currentEpoch,
      endEpochExclusive: currentEpoch + 10,
      nonce,
      notaryPublicKey: privateKey.publicKey(),
      notaryIsSignatory: true,
      tipPercentage: 0,
    },
    manifest: {
      instructions: { kind: 'String', value: manifestStr },
      blobs: [],
    },
    message: { kind: 'None' },
  }

  const intentHash = await RadixEngineToolkit.Intent.intentHash(intent)
  const intentSignature = privateKey.signToSignatureWithPublicKey(intentHash.hash)
  const signedIntent = { intent, intentSignatures: [intentSignature] }
  const signedIntentHash = await RadixEngineToolkit.SignedIntent.signedIntentHash(signedIntent)
  const notarySignature = privateKey.signToSignature(signedIntentHash.hash)
  const notarizedTransaction = { signedIntent, notarySignature }
  const compiled = await RadixEngineToolkit.NotarizedTransaction.compile(notarizedTransaction)

  // Get intent hash for tracking
  const txIntentHash = await RadixEngineToolkit.Intent.intentHash(intent)

  return {
    compiledHex: Buffer.from(compiled).toString('hex'),
    manifest: manifestStr,
    intentHash: txIntentHash.id,
  }
}

export async function submitTx(compiledHex, network = 'mainnet') {
  const url = getGatewayUrl(network)
  const res = await fetch(`${url}/transaction/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notarized_transaction_hex: compiledHex }),
  })
  return res.json()
}

export async function getTxStatus(intentHash, network = 'mainnet') {
  const url = getGatewayUrl(network)
  const res = await fetch(`${url}/transaction/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ intent_hash: intentHash }),
  })
  return res.json()
}
