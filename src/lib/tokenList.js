let cachedTokens = null
let cacheTime = 0
const TTL = 10 * 60 * 1000

export async function getTokenList() {
  if (cachedTokens && Date.now() - cacheTime < TTL) return cachedTokens
  try {
    const res = await fetch('https://api.ociswap.com/tokens')
    if (!res.ok) return []
    const data = await res.json()
    cachedTokens = Array.isArray(data) ? data : (data?.tokens || data?.data || [])
    cacheTime = Date.now()
    return cachedTokens
  } catch { return [] }
}

export function findToken(address, list) {
  return list?.find(t => t.address === address) || null
}

export function getTokenLogo(address, list) {
  const token = findToken(address, list)
  return token?.icon_url || token?.logo_url || token?.iconUrl || null
}

export function getTokenSymbol(address, list) {
  const token = findToken(address, list)
  return token?.symbol || address?.slice(9, 13)?.toUpperCase() || '??'
}

export function getTokenName(address, list) {
  const token = findToken(address, list)
  return token?.name || address?.slice(0, 20) + '...'
}
