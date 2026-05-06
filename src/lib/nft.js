import { getGatewayUrl } from './gateway'

export async function getNFTs(address, network = 'mainnet') {
  const url = getGatewayUrl(network)
  try {
    const res = await fetch(`${url}/state/entity/details`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        addresses: [address],
        opt_ins: {
          non_fungible_include_nfids: true,
          explicit_metadata: ['name', 'symbol', 'icon_url', 'description'],
        },
      }),
    })
    if (!res.ok) return []
    const data = await res.json()
    const item = data?.items?.[0]
    return item?.non_fungible_resources?.items || []
  } catch { return [] }
}

export async function getNFTData(resourceAddress, ids, network = 'mainnet') {
  const url = getGatewayUrl(network)
  try {
    const res = await fetch(`${url}/state/non-fungible/data`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        resource_address: resourceAddress,
        non_fungible_ids: ids.slice(0, 10),
      }),
    })
    if (!res.ok) return []
    const data = await res.json()
    return data?.non_fungible_ids || []
  } catch { return [] }
}
