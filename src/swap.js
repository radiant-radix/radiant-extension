import { getGatewayUrl } from './gateway'

// Known Radix ecosystem tokens
export const RADIX_TOKENS = {
  mainnet: [
    {
      symbol: 'XRD',
      name: 'Radix',
      address: 'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd',
      logo: 'https://assets.radixdlt.com/icons/icon-xrd-32x32.png',
      decimals: 18,
    },
    {
      symbol: 'OCI',
      name: 'Ociswap',
      address: 'resource_rdx1t4dy69k6s0gv040xa64cyadyefczlu3zruy4pqfzjsqn7fv3wj4g2',
      logo: 'https://ociswap.com/icons/oci.png',
      decimals: 18,
    },
    {
      symbol: 'EARLY',
      name: 'Early',
      address: 'resource_rdx1t5kmyj54jt85malva7fxdrvnq5tdazpzpnrfsgzf5jwnk5ll2m5c73',
      logo: null,
      decimals: 18,
    },
    {
      symbol: 'HUG',
      name: 'HUG',
      address: 'resource_rdx1t5e3n7rqal4m9kzn8a2jnegnyqfkh3ghxhkavj76ggyzfkn9c9qqxf',
      logo: null,
      decimals: 18,
    },
    {
      symbol: 'DFP2',
      name: 'DefiPlaza',
      address: 'resource_rdx1thrvr3xfs2tarm2dl9emvs26vjqxu6mo8j9hzq2ypjqm8zj5g06gy9',
      logo: null,
      decimals: 18,
    },
    {
      symbol: 'CAVIAR',
      name: 'CaviarNine',
      address: 'resource_rdx1t5n648r4c0nh3u09ggs6ru7tpzwvuqnhkqjdpsnvfpgcx6c7qhfmq5',
      logo: null,
      decimals: 18,
    },
  ],
  stokenet: [
    {
      symbol: 'XRD',
      name: 'Radix',
      address: 'resource_tdx_2_1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxtfd2jc',
      logo: 'https://assets.radixdlt.com/icons/icon-xrd-32x32.png',
      decimals: 18,
    },
  ],
}

export function getTokenList(network = 'mainnet') {
  return RADIX_TOKENS[network] || RADIX_TOKENS.mainnet
}

export function getTokenBySymbol(symbol, network = 'mainnet') {
  return getTokenList(network).find(t => t.symbol === symbol)
}

export function getTokenByAddress(address, network = 'mainnet') {
  return getTokenList(network).find(t => t.address === address)
}

// Ociswap swap URL
export function getOciswapUrl(fromToken, toToken, amount, network = 'mainnet') {
  const base = network === 'mainnet' ? 'https://ociswap.com' : 'https://stokenet.ociswap.com'
  return `${base}/tokens/${toToken}?inputToken=${fromToken}&amount=${amount}`
}

// CaviarNine swap URL
export function getCaviarSwapUrl(fromToken, toToken, network = 'mainnet') {
  const base = network === 'mainnet' ? 'https://app.caviarnine.com' : 'https://stokenet.caviarnine.com'
  return `${base}/trade?from=${fromToken}&to=${toToken}`
}

export async function getTokenPrice(address, network = 'mainnet') {
  // Try Ociswap price API
  try {
    const res = await fetch(`https://api.ociswap.com/tokens/${address}`)
    if (!res.ok) return null
    const data = await res.json()
    return data?.price_usd || null
  } catch { return null }
}
