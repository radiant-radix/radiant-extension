import { getGatewayUrl } from './gateway'

export async function simulateManifest(manifestStr, signerAddress, network) {
  const url = getGatewayUrl(network)
  try {
    // Get current epoch
    const epochRes = await fetch(`${url}/status/gateway-status`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
    })
    const epochData = await epochRes.json()
    const epoch = epochData?.ledger_state?.epoch || 0

    const res = await fetch(`${url}/transaction/preview`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        manifest: manifestStr,
        blobs_hex: [],
        start_epoch_inclusive: epoch,
        end_epoch_exclusive: epoch + 2,
        notary_public_key: {
          key_type: 'EddsaEd25519',
          key_hex: '0'.repeat(64),
        },
        notary_is_signatory: true,
        tip_percentage: 0,
        nonce: Math.floor(Math.random() * 0xFFFFFF),
        signer_public_keys: [],
        flags: {
          use_free_credit: true,
          assume_all_signature_proofs: true,
          skip_epoch_check: true,
        },
      }),
    })
    return res.json()
  } catch (e) {
    return { error: e.message }
  }
}

export function parseSimulationResult(result) {
  if (result?.error) return { success: false, error: result.error }
  const receipt = result?.receipt
  if (!receipt) return { success: false, error: 'No receipt' }
  const status = receipt.status
  const fee = receipt.fee_summary?.total_execution_cost_in_xrd ||
    receipt.fee_summary?.execution_cost_in_xrd || '0'
  const changes = receipt.state_updates?.balance_changes ||
    result?.resource_changes || []
  const error = receipt.error_message || receipt.output?.error
  return {
    success: status === 'Succeeded',
    status,
    fee: parseFloat(fee).toFixed(4),
    changes,
    error,
    raw: receipt,
  }
}
