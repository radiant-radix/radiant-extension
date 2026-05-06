const ASTRL_API = `https://api.astrolescent.com/partner/${import.meta.env.VITE_ASTRL_API_KEY}`
const XRD = 'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd'

// Fee config — update feeComponent once received from Timan
const FEE_COMPONENT = 'component_rdx1crselk8yucgt8ghkv5mh9gkzphcdmdqggrz8kslmwresx0knnu0y5a'
const FEE_PERCENT = 0.01   // 1%

let tokenCache = null
let tokenCacheTime = 0
let priceCache = null
let priceCacheTime = 0
const TTL = 10 * 60 * 1000

export async function getAstrlTokens() {
  if (tokenCache && Date.now() - tokenCacheTime < TTL) return tokenCache
  try {
    const [tokens, prices] = await Promise.all([
      fetch(`${ASTRL_API}/tokens`).then(r => r.json()),
      fetch(`${ASTRL_API}/prices`).then(r => r.json()),
    ])
    tokenCache = tokens
      .filter(t => t.address && t.symbol && t.address !== XRD)
      .map(t => {
        const price = prices[t.address]
        return {
          address: t.address,
          symbol: t.symbol,
          name: t.name || t.symbol,
          icon_url: t.iconUrl || null,
          price_usd: price?.tokenPriceUSD || null,
          price_xrd: price?.tokenPriceXRD || null,
        }
      })
    tokenCacheTime = Date.now()
    return tokenCache
  } catch { return [] }
}

export async function getAstrlQuote({ inputToken, outputToken, inputAmount, fromAddress }) {
  try {
    const body = {
      inputToken,
      outputToken,
      inputAmount,
      fromAddress,
      ...(FEE_COMPONENT ? { feeComponent: FEE_COMPONENT, fee: FEE_PERCENT } : {}),
    }
    const res = await fetch(`${ASTRL_API}/swap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return await res.json()
  } catch { return null }
}
