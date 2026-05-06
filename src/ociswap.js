const OCI_API = 'https://api.ociswap.com'
const XRD_MAINNET = 'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd'
const XRD_STOKENET = 'resource_tdx_2_1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxtfd2jc'
const BLACKLIST = ['xlink', 'XLink', 'XLINK']

let tokenCache = null
let tokenCacheTime = 0
let allPoolsCache = null
let allPoolsCacheTime = 0
const TTL = 10 * 60 * 1000

export async function getOciTokens(network = 'mainnet') {
  if (tokenCache && Date.now() - tokenCacheTime < TTL) return tokenCache
  try {
    const [p1, p2] = await Promise.all([
      fetch(`${OCI_API}/tokens?offset=0&limit=100`).then(r => r.json()),
      fetch(`${OCI_API}/tokens?offset=100&limit=100`).then(r => r.json()),
    ])
    const XRD = network === 'mainnet' ? XRD_MAINNET : XRD_STOKENET
    const list = [...(p1?.data || []), ...(p2?.data || [])]
    tokenCache = list
      .filter(t => t.address && t.symbol && t.address !== XRD &&
        !BLACKLIST.some(b => t.symbol?.toLowerCase() === b.toLowerCase()))
      .map(t => ({
        address: t.address,
        symbol: t.symbol,
        name: t.name || t.symbol,
        icon_url: t.icon_url || null,
        slug: t.slug || null,
        price_usd: t.price?.usd?.now ? parseFloat(t.price.usd.now) : null,
      }))
    tokenCacheTime = Date.now()
    return tokenCache
  } catch { return [] }
}

// Fetch ALL pools and cache them
async function getAllPools() {
  if (allPoolsCache && Date.now() - allPoolsCacheTime < TTL) return allPoolsCache
  try {
    // Fetch top 500 pools by liquidity
    const [p1, p2, p3, p4, p5] = await Promise.all([
      fetch(`${OCI_API}/pools?offset=0&limit=100`).then(r => r.json()).catch(() => null),
      fetch(`${OCI_API}/pools?offset=100&limit=100`).then(r => r.json()).catch(() => null),
      fetch(`${OCI_API}/pools?offset=200&limit=100`).then(r => r.json()).catch(() => null),
      fetch(`${OCI_API}/pools?offset=300&limit=100`).then(r => r.json()).catch(() => null),
      fetch(`${OCI_API}/pools?offset=400&limit=100`).then(r => r.json()).catch(() => null),
    ])
    allPoolsCache = [
      ...(p1?.data || []),
      ...(p2?.data || []),
      ...(p3?.data || []),
      ...(p4?.data || []),
      ...(p5?.data || []),
    ]
    allPoolsCacheTime = Date.now()
    return allPoolsCache
  } catch { return [] }
}

// Find best pool for token pair by searching all pools
export async function findPool(tokenA, tokenB) {
  const pools = await getAllPools()
  const matches = pools.filter(p => {
    const xAddr = p.x?.token?.address
    const yAddr = p.y?.token?.address
    return (xAddr === tokenA && yAddr === tokenB) ||
           (xAddr === tokenB && yAddr === tokenA)
  })
  if (!matches.length) return null
  // Return highest liquidity pool
  return matches.sort((a, b) =>
    parseFloat(b.liquidity?.usd?.now || 0) - parseFloat(a.liquidity?.usd?.now || 0)
  )[0]
}

// Calculate output from pool price data
export function calcOutputFromPool(pool, inputAddress, inputAmount) {
  if (!pool) return null
  const xAddr = pool.x?.token?.address
  const amt = parseFloat(inputAmount)
  if (!amt) return null

  let priceNow
  if (inputAddress === xAddr) {
    // Selling x → getting y. Price of x in terms of y
    priceNow = parseFloat(pool.x?.price?.token?.now || 0)
  } else {
    // Selling y → getting x. Price of y in terms of x
    priceNow = parseFloat(pool.y?.price?.token?.now || 0)
  }
  if (!priceNow) return null

  const fee = parseFloat(pool.fee_rate || 0.01)
  const output = amt * priceNow * (1 - fee)
  return {
    output_amount: output.toFixed(8),
    price_impact: (fee * 100).toFixed(2),
    pool,
  }
}

// Build swap manifest — works for both BasicPool and PrecisionPool
export function buildSwapManifest(pool, inputAddress, outputAddress, inputAmount, fromAddress, slippage = 0.01) {
  if (!pool) return null
  const amtDecimal = parseFloat(inputAmount).toFixed(8)
  const poolAddr = pool.address

  return `CALL_METHOD
    Address("${fromAddress}")
    "withdraw"
    Address("${inputAddress}")
    Decimal("${amtDecimal}");
TAKE_FROM_WORKTOP
    Address("${inputAddress}")
    Decimal("${amtDecimal}")
    Bucket("input_bucket");
CALL_METHOD
    Address("${poolAddr}")
    "swap"
    Bucket("input_bucket");
CALL_METHOD
    Address("${fromAddress}")
    "deposit_batch"
    Expression("ENTIRE_WORKTOP");`
}

export function getOciswapUrl(fromSlug, toSlug, amount) {
  if (toSlug) return `https://ociswap.com/${toSlug}?inputToken=${fromSlug || 'xrd'}&inputAmount=${amount || ''}`
  return 'https://ociswap.com'
}

// Legacy compat
export async function getOciQuote(inputAddress, outputAddress, inputAmount) {
  const pool = await findPool(inputAddress, outputAddress)
  return calcOutputFromPool(pool, inputAddress, inputAmount)
}

export async function getOciManifest(inputAddress, outputAddress, inputAmount, fromAddress, slippage = 0.01) {
  const pool = await findPool(inputAddress, outputAddress)
  return buildSwapManifest(pool, inputAddress, outputAddress, inputAmount, fromAddress, slippage)
}
