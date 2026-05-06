export { getOciTokens as getCaviarTokens, getOciQuote as getCaviarQuote, getOciManifest as getCaviarManifest } from './ociswap'

export function getCaviarUrl(inputAddress, outputAddress, network = 'mainnet') {
  const base = network === 'mainnet' ? 'https://app.caviarnine.com' : 'https://stokenet.caviarnine.com'
  return `${base}/trade?from=${inputAddress}&to=${outputAddress}`
}

export async function getCaviarTokenPrice(address, network = 'mainnet') {
  try {
    const res = await fetch(`https://api.ociswap.com/tokens/${address}`)
    if (!res.ok) return null
    const data = await res.json()
    return data?.price?.usd?.now ? parseFloat(data.price.usd.now) : null
  } catch { return null }
}
