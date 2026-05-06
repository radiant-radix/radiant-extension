let cachedPrice = null
let cacheTime = 0
const CACHE_DURATION = 60000 // 1 minute

export async function getXRDPrice() {
  if (cachedPrice && Date.now() - cacheTime < CACHE_DURATION) {
    return cachedPrice
  }
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price?ids=radix&vs_currencies=usd',
      { headers: { 'Accept': 'application/json' } }
    )
    const data = await res.json()
    cachedPrice = data?.radix?.usd || 0
    cacheTime = Date.now()
    return cachedPrice
  } catch {
    return cachedPrice || 0
  }
}
