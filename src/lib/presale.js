import { signAndSubmitManifest } from './batch'
import { getGatewayUrl } from './gateway'

const _TK = 'rdnt_' + 'presale_' + '2026_' + 'v1'

export const PRESALE_CONFIG = {
  rdtAddress: 'resource_rdx1t4zds4xaephatvk5f4f58jt6x474t8n2eylaawyjgg3r6rhkxyr4d7',
  treasuryAddress: 'account_rdx128kkjhm3tp5gc56ymxffk24m2gspedrq3h95s3a87ggqtp8ellv83e',
  priceXrdPerRdt: 0.001,
  minBuyXrd: 500,
  maxBuyXrd: 100000,
  hardCapXrd: 600000,
  totalRdtForSale: 600000000,
  startDate: null,
  endDate: null,
}

const PRESALE_KEY = 'radiant_presale_treasury'
const PRESALE_STATS_KEY = 'radiant_presale_stats'

export function getPresaleStats() {
  try {
    return JSON.parse(localStorage.getItem(PRESALE_STATS_KEY) || '{}')
  } catch { return {} }
}

function updatePresaleStats(xrdAmount, rdtAmount, buyerAddress) {
  const stats = getPresaleStats()
  const purchases = stats.purchases || []
  purchases.push({
    buyer: buyerAddress,
    xrd: xrdAmount,
    rdt: rdtAmount,
    date: new Date().toISOString(),
  })
  const totalXrd = purchases.reduce((s, p) => s + parseFloat(p.xrd), 0)
  const totalRdt = purchases.reduce((s, p) => s + parseFloat(p.rdt), 0)
  localStorage.setItem(PRESALE_STATS_KEY, JSON.stringify({
    purchases,
    totalXrd,
    totalRdt,
    lastUpdate: new Date().toISOString(),
  }))
  return { totalXrd, totalRdt }
}

export function calcRdt(xrdAmount) {
  return parseFloat(xrdAmount) / PRESALE_CONFIG.priceXrdPerRdt
}

export async function getOnChainStats(network = 'mainnet') {
  try {
    const url = getGatewayUrl(network)
    const res = await fetch(`${url}/state/entity/details`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        addresses: [PRESALE_CONFIG.treasuryAddress],
        opt_ins: { explicit_metadata: [] },
      }),
    })
    const data = await res.json()
    const fungibles = data?.items?.[0]?.fungible_resources?.items || []

    // Track from RDT remaining in treasury — accurate regardless of XRD withdrawals
    const rdtItem = fungibles.find(f => f.resource_address === PRESALE_CONFIG.rdtAddress)
    const rdtRemaining = parseFloat(rdtItem?.amount || rdtItem?.vaults?.items?.[0]?.amount || PRESALE_CONFIG.totalRdtForSale)
    const rdtSold = PRESALE_CONFIG.totalRdtForSale - rdtRemaining
    const xrdRaised = rdtSold * PRESALE_CONFIG.priceXrdPerRdt
    const pct = (rdtSold / PRESALE_CONFIG.totalRdtForSale) * 100

    return {
      xrdRaised,
      rdtRemaining,
      rdtSold,
      pct: Math.min(pct, 100),
      hardCapXrd: PRESALE_CONFIG.hardCapXrd,
      isSoldOut: rdtRemaining <= 0,
    }
  } catch { return null }
}

function buildPresaleManifest(buyerAddress, treasuryAddress, xrdAmount, rdtAmount, network) {
  const XRD = network === 'mainnet'
    ? 'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd'
    : 'resource_tdx_2_1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxtfd2jc'

  const xrdDecimal = parseFloat(xrdAmount).toFixed(8)
  const rdtDecimal = parseFloat(rdtAmount).toFixed(8)

  return `CALL_METHOD
    Address("${buyerAddress}")
    "lock_fee"
    Decimal("2");
CALL_METHOD
    Address("${buyerAddress}")
    "withdraw"
    Address("${XRD}")
    Decimal("${xrdDecimal}");
TAKE_FROM_WORKTOP
    Address("${XRD}")
    Decimal("${xrdDecimal}")
    Bucket("xrd_bucket");
CALL_METHOD
    Address("${treasuryAddress}")
    "try_deposit_or_abort"
    Bucket("xrd_bucket")
    Enum<0u8>();
CALL_METHOD
    Address("${treasuryAddress}")
    "withdraw"
    Address("${PRESALE_CONFIG.rdtAddress}")
    Decimal("${rdtDecimal}");
TAKE_FROM_WORKTOP
    Address("${PRESALE_CONFIG.rdtAddress}")
    Decimal("${rdtDecimal}")
    Bucket("rdt_bucket");
CALL_METHOD
    Address("${buyerAddress}")
    "try_deposit_or_abort"
    Bucket("rdt_bucket")
    Enum<0u8>();`
}
