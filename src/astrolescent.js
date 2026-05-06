// Astrolescent API integration
// Get API key from: https://astrl.trade (contact them)
const ASTRL_API_KEY = import.meta.env.VITE_ASTRL_API_KEY || ''
const ASTRL_BASE = 'https://api.astrolescent.com'

let tokenCache = null
let priceCache = null
let cacheTime = 0
const CACHE_TTL = 10 * 60 * 1000 // 10 min

export async function getAstrlTokens() {
  if (tokenCache && Date.now() - cacheTime < CACHE_TTL) return tokenCache
  try {
    if (!ASTRL_API_KEY) return []
    const res = await fetch(`${ASTRL_BASE}/partner/${ASTRL_API_KEY}/tokens`)
    if (!res.ok) return []
    tokenCache = await res.json()
    cacheTime = Date.now()
    return tokenCache
  } catch { return [] }
}

export async function getAstrlPrices() {
  if (priceCache && Date.now() - cacheTime < CACHE_TTL) return priceCache
  try {
    if (!ASTRL_API_KEY) return {}
    const res = await fetch(`${ASTRL_BASE}/partner/${ASTRL_API_KEY}/prices`)
    if (!res.ok) return {}
    priceCache = await res.json()
    cacheTime = Date.now()
    return priceCache
  } catch { return {} }
}

export async function getSwapManifest({ inputToken, outputToken, inputAmount, fromAddress }) {
  try {
    if (!ASTRL_API_KEY) throw new Error('No Astrolescent API key. Set VITE_ASTRL_API_KEY in .env')
    const res = await fetch(`${ASTRL_BASE}/partner/${ASTRL_API_KEY}/swap`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inputToken, outputToken, inputAmount, fromAddress }),
    })
    if (!res.ok) throw new Error('Swap API failed: ' + res.status)
    return res.json()
  } catch (e) {
    throw e
  }
}

export function hasApiKey() {
  return !!ASTRL_API_KEY
}
