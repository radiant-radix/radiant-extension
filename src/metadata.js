import { getGatewayUrl } from './gateway'

const cache = {}

export async function getResourceMetadata(address, network = 'mainnet') {
  const key = `${network}:${address}`
  if (cache[key]) return cache[key]

  try {
    const url = getGatewayUrl(network)
    const res = await fetch(`${url}/state/entity/details`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        addresses: [address],
        opt_ins: {
          explicit_metadata: ['name', 'symbol', 'icon_url', 'description', 'tags'],
        },
      }),
    })
    if (!res.ok) return null
    const data = await res.json()
    const item = data?.items?.[0]
    if (!item) return null
    const meta = {}
    item.explicit_metadata?.items?.forEach(m => {
      meta[m.key] = m.value?.typed?.value || m.value?.programmatic_json?.fields?.[0]?.value || ''
    })
    cache[key] = meta
    return meta
  } catch { return null }
}

export async function batchGetMetadata(addresses, network = 'mainnet') {
  const uncached = addresses.filter(a => !cache[`${network}:${a}`])
  if (uncached.length === 0) {
    return Object.fromEntries(addresses.map(a => [a, cache[`${network}:${a}`]]))
  }
  try {
    const url = getGatewayUrl(network)
    const res = await fetch(`${url}/state/entity/details`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        addresses: uncached,
        opt_ins: { explicit_metadata: ['name', 'symbol', 'icon_url', 'description'] },
      }),
    })
    if (!res.ok) return {}
    const data = await res.json()
    data?.items?.forEach(item => {
      const meta = {}
      item.explicit_metadata?.items?.forEach(m => {
        meta[m.key] = m.value?.typed?.value || ''
      })
      cache[`${network}:${item.address}`] = meta
    })
  } catch {}
  return Object.fromEntries(addresses.map(a => [a, cache[`${network}:${a}`] || null]))
}
