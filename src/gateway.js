const GATEWAY_URL = 'https://mainnet.radixdlt.com'
const STOKENET_URL = 'https://stokenet.radixdlt.com'

export function getGatewayUrl(network = 'mainnet') {
  return network === 'mainnet' ? GATEWAY_URL : STOKENET_URL
}

export async function getEntityDetails(address, network = 'mainnet') {
  const url = getGatewayUrl(network)
  try {
    const res = await fetch(`${url}/state/entity/details`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        addresses: [address],
        aggregation_level: 'Vault',
        opt_ins: {
          explicit_metadata: ['name', 'symbol', 'icon_url', 'description'],
          ancestor_identities: false,
          component_royalty_config: false,
          component_royalty_vault_balance: false,
          package_royalty_vault_balance: false,
          non_fungible_include_nfids: true,
        },
      }),
    })
    if (!res.ok) {
      console.error('getEntityDetails status:', res.status)
      return null
    }
    const data = await res.json()
    return data?.items?.[0] || null
  } catch (e) {
    console.error('getEntityDetails:', e)
    return null
  }
}

export async function getXRDBalance(address, network = 'mainnet') {
  try {
    const entity = await getEntityDetails(address, network)
    const XRD = network === 'mainnet'
      ? 'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd'
      : 'resource_tdx_2_1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxtfd2jc'
    const fungibles = entity?.fungible_resources?.items || []
    const xrd = fungibles.find(i => i.resource_address === XRD)
    if (!xrd) return 0
    // Handle both vault aggregation formats
    const amount = xrd.vaults?.items?.[0]?.amount
      || xrd.amount
      || xrd.aggregated_amount
      || '0'
    return parseFloat(amount)
  } catch (e) {
    console.error('getXRDBalance:', e)
    return 0
  }
}

export async function getTransactionHistory(address, network = 'mainnet') {
  const url = getGatewayUrl(network)
  try {
    const res = await fetch(`${url}/stream/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        affected_global_entities_filter: [address],
        limit_per_page: 20,
        opt_ins: {
          balance_changes: true,
          receipt_fee_summary: true,
        },
      }),
    })
    if (!res.ok) return []
    const data = await res.json()
    return data?.items || []
  } catch (e) {
    console.error('getTransactionHistory:', e)
    return []
  }
}

export async function submitTransaction(notarizedHex, network = 'mainnet') {
  const url = getGatewayUrl(network)
  const res = await fetch(`${url}/transaction/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notarized_transaction_hex: notarizedHex }),
  })
  return res.json()
}

export async function getTransactionStatus(txId, network = 'mainnet') {
  const url = getGatewayUrl(network)
  const res = await fetch(`${url}/transaction/status`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ intent_hash: txId }),
  })
  return res.json()
}
