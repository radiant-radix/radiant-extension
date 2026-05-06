import { getGatewayUrl } from './gateway'

export async function getValidators(network = 'mainnet') {
  const url = getGatewayUrl(network)
  try {
    const res = await fetch(`${url}/state/validators/list`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ at_ledger_state: null }),
    })
    if (!res.ok) return []
    const data = await res.json()
    // API returns different shapes, handle both
    return data?.validators || data?.items || data?.state?.validators || []
  } catch (e) {
    console.error('getValidators error:', e)
    return []
  }
}

export async function getStakePositions(address, network = 'mainnet') {
  const url = getGatewayUrl(network)
  try {
    const res = await fetch(`${url}/state/account/page/stakes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account_address: address }),
    })
    if (!res.ok) return []
    const data = await res.json()
    return data?.items || []
  } catch (e) {
    console.error('getStakePositions error:', e)
    return []
  }
}
