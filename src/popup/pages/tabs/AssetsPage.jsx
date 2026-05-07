import { useState, useEffect } from 'react'
import { getNFTs } from '../../../lib/nft'
import { getResourceMetadata } from '../../../lib/metadata'
import { copyToClipboard } from '../../../lib/clipboard'
import { getGatewayUrl } from '../../../lib/gateway'
import { getCaviarTokenPrice } from '../../../lib/caviar'
import { getAstrlTokens } from '../../../lib/astrolescent'
import { getXRDPrice } from '../../../lib/price'
import Icon from '../../../components/ui/Icon'

const XRD_MAINNET = 'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd'
const XRD_STOKENET = 'resource_tdx_2_1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxtfd2jc'

async function getStakePositions(address, network) {
  try {
    const url = getGatewayUrl(network)
    const res = await fetch(`${url}/state/account/page/stakes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ account_address: address }),
    })
    if (!res.ok) return []
    return (await res.json())?.items || []
  } catch { return [] }
}

// Fetch resource details to check if it's an LSU (NonFungible or FungibleVault from validator)
async function classifyTokens(tokens, network) {
  if (!tokens.length) return {}
  try {
    const url = getGatewayUrl(network)
    const res = await fetch(`${url}/state/entity/details`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        addresses: tokens.map(t => t.resource_address),
        opt_ins: { explicit_metadata: ['name', 'symbol', 'description', 'icon_url', 'tags', 'validator'] },
      }),
    })
    if (!res.ok) return {}
    const data = await res.json()
    const result = {}
    for (const item of (data?.items || [])) {
      const addr = item.address
      const tags = item.metadata?.items?.find(m => m.key === 'tags')?.value?.typed?.values || []
      const hasValidator = item.metadata?.items?.some(m => m.key === 'validator')
      const nameVal = item.metadata?.items?.find(m => m.key === 'name')?.value?.typed?.value?.toLowerCase() || ''
      // Strict LSU: only flag if gateway explicitly has validator key OR name contains 'liquid stake'
      const isLSU = (
        hasValidator ||
        nameVal.includes('liquid stake unit') ||
        nameVal === 'lsu'
      )
      const isPool = (
        addr?.includes('pool') ||
        item.metadata?.items?.find(m => m.key === 'name')?.value?.typed?.value?.toLowerCase().includes('pool') ||
        item.metadata?.items?.find(m => m.key === 'symbol')?.value?.typed?.value?.toLowerCase().includes('lp')
      )
      result[addr] = { isLSU, isPool }
    }
    return result
  } catch { return {} }
}

function fmt(n, dec = 4) {
  return parseFloat(n || 0).toLocaleString('en-US', { maximumFractionDigits: dec })
}
function fmtUSD(n) {
  if (!n || n < 0.01) return null
  return '$' + parseFloat(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function TokenLogo({ address, symbol, logoUrl, size = 44 }) {
  const [err, setErr] = useState(false)
  const displaySymbol = (symbol || address?.slice(9, 13) || '??').slice(0, 4).toUpperCase()
  if (logoUrl && !err) {
    return (
      <div style={{ width: size, height: size }}
        className="rounded-xl overflow-hidden glass-teal flex items-center justify-center shrink-0 bg-white/5">
        <img src={logoUrl} alt={displaySymbol} className="w-3/4 h-3/4 object-contain" onError={() => setErr(true)} />
      </div>
    )
  }
  const colors = ['text-[#00D2B4]', 'text-yellow-400', 'text-purple-400', 'text-blue-400', 'text-pink-400']
  const color = colors[(address?.charCodeAt(address.length - 1) || 0) % colors.length]
  return (
    <div style={{ width: size, height: size }} className="rounded-xl glass-teal flex items-center justify-center shrink-0">
      <span className={`font-bold ${color}`} style={{ fontSize: size * 0.28 }}>{displaySymbol}</span>
    </div>
  )
}

function TokenDetail({ token, tokenMeta, network, onClose, onSend, usdValue }) {
  const [copied, setCopied] = useState(false)
  const name = tokenMeta?.name || 'Unknown Token'
  const symbol = tokenMeta?.symbol || token.resource_address.slice(9, 13).toUpperCase()
  const logo = tokenMeta?.icon_url || tokenMeta?.logo_url || null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative z-10 w-full max-w-sm bg-[#071414] rounded-t-3xl p-6 pb-10 border-t border-[rgba(0,210,180,0.15)]"
        onClick={e => e.stopPropagation()}>
        <div className="w-10 h-1 bg-[#1A4040] rounded-full mx-auto mb-6" />
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-4">
            <TokenLogo address={token.resource_address} symbol={symbol} logoUrl={logo} size={52} />
            <div>
              <h3 className="text-xl font-bold text-[#E8F8F6]">{name}</h3>
              <p className="text-[#3A7A72] text-xs font-mono">{symbol}</p>
            </div>
          </div>
          <div className="glass-teal rounded-2xl p-4 text-center">
            <p className="text-[#3A7A72] text-xs font-mono mb-1">BALANCE</p>
            <p className="text-3xl font-black text-[#E8F8F6]">{fmt(token.amount || 0, 6)}</p>
            <p className="text-[#00D2B4] text-sm font-mono mt-1">{symbol}</p>
            {usdValue && <p className="text-[#3A7A72] text-xs font-mono mt-1">{usdValue}</p>}
          </div>
          {tokenMeta?.description && (
            <div className="glass rounded-xl p-3">
              <p className="text-[#3A7A72] text-xs leading-relaxed">{tokenMeta.description}</p>
            </div>
          )}
          <div className="glass rounded-xl px-4 py-3">
            <p className="text-[#2A5550] text-xs font-mono mb-1">RESOURCE ADDRESS</p>
            <p className="text-[#E8F8F6] text-xs font-mono break-all">{token.resource_address}</p>
          </div>
          <div className="flex gap-3">
            <button onClick={() => { onClose(); onSend(token) }}
              className="btn-teal flex-1 py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-1">
              <Icon name="send" size={14} /> Send
            </button>
            <button onClick={async () => {
              await copyToClipboard(token.resource_address)
              setCopied(true); setTimeout(() => setCopied(false), 2000)
            }} className="btn-ghost flex-1 py-3 rounded-xl text-sm flex items-center justify-center gap-1">
              <Icon name={copied ? 'check' : 'copy'} size={14} />
              {copied ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function AssetsPage({ wallet, network, tokens, loading, onSend }) {
  const [activeTab, setActiveTab] = useState('tokens')
  const [nfts, setNfts] = useState([])
  const [stakes, setStakes] = useState([])
  const [loadingExtra, setLoadingExtra] = useState(true)
  const [selectedToken, setSelectedToken] = useState(null)
  const [selectedTokenMeta, setSelectedTokenMeta] = useState(null)
  const [ociTokenMap, setOciTokenMap] = useState({})
  const [gatewayMeta, setGatewayMeta] = useState({})
  const [tokenClasses, setTokenClasses] = useState({}) // address -> {isLSU, isPool}
  const [search, setSearch] = useState('')
  const [xrdPrice, setXrdPrice] = useState(0)
  const [tokenPrices, setTokenPrices] = useState({})

  const XRD = network === 'mainnet' ? XRD_MAINNET : XRD_STOKENET

  // Classify tokens
  const xrdToken = tokens.find(t => t.resource_address === XRD)
  const nonXRD = tokens.filter(t => t.resource_address !== XRD)

  // LSU: from classifyTokens OR address keywords
  const lsuTokens = nonXRD.filter(t => tokenClasses[t.resource_address]?.isLSU === true)
  const lsuAddrs = new Set(lsuTokens.map(t => t.resource_address))

  const poolTokens = nonXRD.filter(t =>
    !lsuAddrs.has(t.resource_address) && (
      tokenClasses[t.resource_address]?.isPool ||
      ociTokenMap[t.resource_address]?.name?.toLowerCase().includes('pool') ||
      ociTokenMap[t.resource_address]?.symbol?.toLowerCase().includes('lp') ||
      t.resource_address?.includes('pool')
    )
  )
  const poolAddrs = new Set(poolTokens.map(t => t.resource_address))

  const regularTokens = nonXRD.filter(t => !lsuAddrs.has(t.resource_address) && !poolAddrs.has(t.resource_address))

  useEffect(() => {
    getAstrlTokens().then(list => {
      const map = {}
      list.forEach(t => { if (t.address) map[t.address] = t })
      setOciTokenMap(map)
    })
    getXRDPrice().then(p => setXrdPrice(p || 0))
  }, [network])

  useEffect(() => {
    async function fetchExtra() {
      setLoadingExtra(true)
      const [nftData, stakeData] = await Promise.all([
        getNFTs(wallet.address, network),
        getStakePositions(wallet.address, network),
      ])
      setNfts(nftData)
      setStakes(stakeData)
      setLoadingExtra(false)
    }
    fetchExtra()
  }, [wallet.address, network])

  // Classify all nonXRD tokens via Gateway
  useEffect(() => {
    if (!nonXRD.length) return
    classifyTokens(nonXRD, network).then(classes => setTokenClasses(classes))
  }, [tokens, network])

  // Fetch gateway metadata for tokens not in Ociswap
  useEffect(() => {
    const missing = tokens.filter(t => !ociTokenMap[t.resource_address] && t.resource_address !== XRD)
    if (!missing.length) return
    Promise.all(missing.slice(0, 10).map(async t => {
      const meta = await getResourceMetadata(t.resource_address, network)
      return [t.resource_address, meta]
    })).then(results => {
      const map = {}
      results.forEach(([addr, meta]) => { if (meta) map[addr] = meta })
      setGatewayMeta(prev => ({ ...prev, ...map }))
    })
  }, [tokens, ociTokenMap])

  // Fetch USD prices
  useEffect(() => {
    if (!tokens.length || !xrdPrice) return
    const toFetch = tokens.filter(t => t.resource_address !== XRD && !ociTokenMap[t.resource_address]?.price_usd).slice(0, 10)
    toFetch.forEach(async t => {
      const price = await getCaviarTokenPrice(t.resource_address, network)
      if (price) setTokenPrices(prev => ({ ...prev, [t.resource_address]: parseFloat(price) }))
    })
  }, [tokens, ociTokenMap, xrdPrice])

  function getTokenMeta(address) {
    const oci = ociTokenMap[address]
    const gw = gatewayMeta[address]
    if (oci) return { name: oci.name, symbol: oci.symbol, icon_url: oci.icon_url, description: oci.description }
    if (gw) return gw
    return null
  }
  function getTokenSymbol(address) {
    return getTokenMeta(address)?.symbol || address?.slice(9, 13)?.toUpperCase() || '??'
  }
  function getTokenName(address) {
    return getTokenMeta(address)?.name || address?.slice(0, 20) + '...'
  }
  function getTokenLogo(address) {
    const m = getTokenMeta(address)
    return m?.icon_url || m?.logo_url || null
  }
  function getUSDPrice(address) {
    if (address === XRD) return xrdPrice
    const fromOci = ociTokenMap[address]?.price_usd
    if (fromOci) return parseFloat(fromOci)
    return tokenPrices[address] || null
  }
  function getUSDValue(address, amount) {
    const price = getUSDPrice(address)
    if (!price) return null
    return fmtUSD(parseFloat(amount || 0) * price)
  }

  const totalUSD = tokens.reduce((sum, t) => {
    const p = getUSDPrice(t.resource_address)
    return p ? sum + parseFloat(t.amount || 0) * p : sum
  }, 0)

  async function handleTokenTap(token) {
    setSelectedToken(token)
    const meta = getTokenMeta(token.resource_address)
    if (meta) {
      setSelectedTokenMeta(meta)
    } else {
      const gw = await getResourceMetadata(token.resource_address, network)
      setSelectedTokenMeta(gw || {})
    }
  }

  const filteredTokens = regularTokens.filter(t => {
    const s = search.toLowerCase()
    return getTokenName(t.resource_address).toLowerCase().includes(s) ||
      getTokenSymbol(t.resource_address).toLowerCase().includes(s)
  })

  const tabs = [
    { id: 'tokens', label: 'Tokens', count: regularTokens.length + (xrdToken ? 1 : 0) },
    { id: 'nfts', label: 'NFTs', count: nfts.length },
    { id: 'staking', label: 'Staking', count: stakes.length + lsuTokens.length },
    { id: 'pools', label: 'Pools', count: poolTokens.length },
  ]

  return (
    <div className="px-6 flex flex-col gap-4">
      {selectedToken && (
        <TokenDetail token={selectedToken} tokenMeta={selectedTokenMeta}
          network={network}
          usdValue={getUSDValue(selectedToken.resource_address, selectedToken.amount)}
          onClose={() => { setSelectedToken(null); setSelectedTokenMeta(null) }}
          onSend={t => { setSelectedToken(null); onSend(t) }} />
      )}

      <div className="pt-2">
        <h2 className="text-2xl font-bold text-[#E8F8F6] mb-1">Assets</h2>
        {totalUSD > 0
          ? <p className="text-[#00D2B4] text-sm font-mono font-bold">{fmtUSD(totalUSD)} total</p>
          : <p className="text-[#3A7A72] text-xs font-mono">Your portfolio</p>
        }
      </div>

      {!loading && (
        <div className="grid grid-cols-4 gap-2">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`rounded-2xl p-2.5 text-center transition-all ${activeTab === t.id ? 'glass-teal' : 'glass'}`}>
              <p className={`text-xl font-bold ${activeTab === t.id ? 'text-[#00D2B4]' : 'text-[#E8F8F6]'}`}>{t.count}</p>
              <p className={`text-xs font-mono ${activeTab === t.id ? 'text-[#00D2B4]' : 'text-[#3A7A72]'}`}>{t.label}</p>
            </button>
          ))}
        </div>
      )}

      {/* TOKENS */}
      {activeTab === 'tokens' && (
        <div className="flex flex-col gap-3">
          {loading ? (
            <div className="flex flex-col gap-2">
              {[1,2,3].map(i => <div key={i} className="h-16 bg-[#071414] rounded-2xl animate-pulse" />)}
            </div>
          ) : (
            <>
              {xrdToken && (
                <>
                  <p className="text-[#2A5550] text-xs font-mono tracking-widest">NATIVE</p>
                  <button onClick={() => handleTokenTap(xrdToken)}
                    className="glass-teal rounded-2xl px-4 py-3 flex items-center gap-3 w-full text-left active:scale-[0.98] transition-all">
                    <TokenLogo address={xrdToken.resource_address} symbol="XRD"
                      logoUrl="https://assets.radixdlt.com/icons/icon-xrd-32x32.png" size={44} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[#E8F8F6] text-sm font-semibold">Radix</p>
                      <p className="text-[#3A7A72] text-xs font-mono">Native token</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[#E8F8F6] text-sm font-bold">{fmt(xrdToken.amount || 0)}</p>
                      {xrdPrice > 0 && <p className="text-[#3A7A72] text-xs font-mono">{fmtUSD(parseFloat(xrdToken.amount || 0) * xrdPrice)}</p>}
                    </div>
                  </button>
                </>
              )}
              {regularTokens.length > 0 && (
                <>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-[#2A5550] text-xs font-mono tracking-widest">TOKENS ({regularTokens.length})</p>
                  </div>
                  <div className="glass rounded-xl px-4 py-2.5 flex items-center gap-2">
                    <Icon name="search" size={14} className="text-[#2A5550]" />
                    <input type="text" placeholder="Search tokens..."
                      value={search} onChange={e => setSearch(e.target.value)}
                      className="flex-1 bg-transparent text-[#E8F8F6] text-sm outline-none placeholder-[#2A5550]" />
                  </div>
                  {filteredTokens.map((token, i) => (
                    <button key={i} onClick={() => handleTokenTap(token)}
                      className="glass rounded-2xl px-4 py-3 flex items-center gap-3 w-full text-left active:scale-[0.98] transition-all teal-border">
                      <TokenLogo address={token.resource_address}
                        symbol={getTokenSymbol(token.resource_address)}
                        logoUrl={getTokenLogo(token.resource_address)} size={44} />
                      <div className="flex-1 min-w-0">
                        <p className="text-[#E8F8F6] text-sm font-semibold truncate">{getTokenName(token.resource_address)}</p>
                        <p className="text-[#3A7A72] text-xs font-mono">{getTokenSymbol(token.resource_address)}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[#E8F8F6] text-sm font-bold">{fmt(token.amount || 0)}</p>
                        {getUSDValue(token.resource_address, token.amount) && (
                          <p className="text-[#3A7A72] text-xs font-mono">{getUSDValue(token.resource_address, token.amount)}</p>
                        )}
                      </div>
                    </button>
                  ))}
                </>
              )}
              {regularTokens.length === 0 && !xrdToken && (
                <div className="glass rounded-2xl p-8 flex flex-col items-center text-center">
                  <Icon name="coins" size={32} className="text-[#1A4040] mb-3" />
                  <p className="text-[#3A7A72] text-sm">No tokens found</p>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* NFTS */}
      {activeTab === 'nfts' && (
        loadingExtra ? (
          <div className="grid grid-cols-2 gap-3">
            {[1,2,3,4].map(i => <div key={i} className="aspect-square bg-[#071414] rounded-2xl animate-pulse" />)}
          </div>
        ) : nfts.length === 0 ? (
          <div className="glass rounded-2xl p-8 flex flex-col items-center text-center">
            <Icon name="image" size={32} className="text-[#1A4040] mb-3" />
            <p className="text-[#3A7A72] text-sm">No NFTs found</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {nfts.map((nft, i) => (
              <div key={i} className="glass rounded-2xl overflow-hidden">
                <div className="aspect-square bg-[#0A1A1A] flex items-center justify-center relative">
                  <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(0,210,180,0.05)_0%,transparent_70%)]" />
                  <Icon name="image" size={32} className="text-[#1A4040]" />
                  <div className="absolute bottom-2 right-2 glass-teal rounded-lg px-2 py-0.5">
                    <span className="text-[#00D2B4] text-xs font-mono">{nft.total_count || 1}</span>
                  </div>
                </div>
                <div className="px-3 py-2">
                  <p className="text-[#E8F8F6] text-xs font-semibold truncate">{getTokenName(nft.resource_address)}</p>
                  <p className="text-[#3A7A72] text-xs font-mono">{nft.total_count || 0} items</p>
                </div>
              </div>
            ))}
          </div>
        )
      )}

      {/* STAKING */}
      {activeTab === 'staking' && (
        <div className="flex flex-col gap-3">
          {loadingExtra ? (
            <div className="flex flex-col gap-2">
              {[1,2].map(i => <div key={i} className="h-16 bg-[#071414] rounded-2xl animate-pulse" />)}
            </div>
          ) : (stakes.length === 0 && lsuTokens.length === 0) ? (
            <div className="glass rounded-2xl p-8 flex flex-col items-center text-center">
              <Icon name="lock" size={32} className="text-[#1A4040] mb-3" />
              <p className="text-[#3A7A72] text-sm">No stake positions</p>
              <p className="text-[#1A4040] text-xs mt-1">Go to DeFi to stake XRD</p>
            </div>
          ) : (
            <>
              {stakes.length > 0 && (
                <>
                  <p className="text-[#2A5550] text-xs font-mono tracking-widest">STAKED POSITIONS</p>
                  {stakes.map((s, i) => (
                    <div key={i} className="glass-teal rounded-2xl px-4 py-3 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl glass flex items-center justify-center shrink-0">
                        <Icon name="lock" size={16} className="text-[#00D2B4]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[#E8F8F6] text-sm font-semibold">Staked Position</p>
                        <p className="text-[#3A7A72] text-xs font-mono truncate">{s.validator_address?.slice(0, 24)}...</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[#00D2B4] text-sm font-bold">{parseFloat(s.amount || 0).toFixed(2)} XRD</p>
                        {xrdPrice > 0 && <p className="text-[#3A7A72] text-xs font-mono">{fmtUSD(parseFloat(s.amount || 0) * xrdPrice)}</p>}
                      </div>
                    </div>
                  ))}
                </>
              )}
              {lsuTokens.length > 0 && (
                <>
                  <p className="text-[#2A5550] text-xs font-mono tracking-widest mt-1">LIQUID STAKE UNITS</p>
                  {lsuTokens.map((token, i) => (
                    <button key={i} onClick={() => handleTokenTap(token)}
                      className="glass rounded-2xl px-4 py-3 flex items-center gap-3 w-full text-left active:scale-[0.98] transition-all teal-border">
                      <div className="w-11 h-11 rounded-xl glass-teal flex items-center justify-center shrink-0">
                        <Icon name="lock" size={16} className="text-[#00D2B4]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[#E8F8F6] text-sm font-semibold truncate">{getTokenName(token.resource_address)}</p>
                        <p className="text-[#00D2B4] text-xs font-mono">LSU</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-[#E8F8F6] text-sm font-bold">{fmt(token.amount || 0)}</p>
                        {getUSDValue(token.resource_address, token.amount) && (
                          <p className="text-[#3A7A72] text-xs font-mono">{getUSDValue(token.resource_address, token.amount)}</p>
                        )}
                      </div>
                    </button>
                  ))}
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* POOLS */}
      {activeTab === 'pools' && (
        <div className="flex flex-col gap-3">
          {poolTokens.length === 0 ? (
            <div className="glass rounded-2xl p-8 flex flex-col items-center text-center">
              <Icon name="layers" size={32} className="text-[#1A4040] mb-3" />
              <p className="text-[#3A7A72] text-sm">No pool positions</p>
            </div>
          ) : (
            poolTokens.map((token, i) => (
              <button key={i} onClick={() => handleTokenTap(token)}
                className="glass rounded-2xl px-4 py-3 flex items-center gap-3 w-full text-left active:scale-[0.98] transition-all">
                <TokenLogo address={token.resource_address}
                  symbol={getTokenSymbol(token.resource_address)}
                  logoUrl={getTokenLogo(token.resource_address)} size={44} />
                <div className="flex-1 min-w-0">
                  <p className="text-[#E8F8F6] text-sm font-semibold truncate">{getTokenName(token.resource_address)}</p>
                  <p className="text-yellow-500 text-xs font-mono">Pool Token</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[#E8F8F6] text-sm font-bold">{fmt(token.amount || 0, 6)}</p>
                  {getUSDValue(token.resource_address, token.amount) && (
                    <p className="text-[#3A7A72] text-xs font-mono">{getUSDValue(token.resource_address, token.amount)}</p>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}
