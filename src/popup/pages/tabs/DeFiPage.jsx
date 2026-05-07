import { useState, useEffect } from 'react'
import { getGatewayUrl } from '../../../lib/gateway'
import { loadWallet, decryptWallet } from '../../../lib/wallet'
import { signAndSubmitManifest } from '../../../lib/batch'
import Icon from '../../../components/ui/Icon'

function getMetaValue(items, key) {
  const item = (items || []).find(i => i.key === key)
  return item?.value?.typed?.value ||
    item?.value?.programmatic_json?.fields?.[0]?.value || ''
}

async function getValidators(network) {
  try {
    const url = getGatewayUrl(network)
    // Use cursor pagination to get top 100
    let allValidators = []
    let cursor = null
    let pages = 0
    do {
      const body = { at_ledger_state: null, cursor, limit_per_page: 100 }
      const res = await fetch(`${url}/state/validators/list`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) break
      const data = await res.json()
      const items = data?.validators?.items || []
      allValidators = [...allValidators, ...items]
      cursor = data?.validators?.next_cursor || null
      pages++
    } while (cursor && pages < 2 && allValidators.length < 100)
    return allValidators
      .sort((a, b) => parseFloat(b?.stake_vault?.balance || 0) - parseFloat(a?.stake_vault?.balance || 0))
      .slice(0, 100)
  } catch (e) {
    console.error('getValidators:', e)
    return []
  }
}

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

function ValidatorLogo({ iconUrl, name, size = 40 }) {
  const [err, setErr] = useState(false)
  const initials = (name || '??').replace(/[^\w\s]/g, '').trim().slice(0, 2).toUpperCase() || '??'
  if (iconUrl && !err) {
    return (
      <div style={{ width: size, height: size }}
        className="rounded-xl overflow-hidden glass-teal flex items-center justify-center shrink-0 bg-white/5">
        <img src={iconUrl} alt={name} className="w-full h-full object-cover"
          onError={() => setErr(true)} />
      </div>
    )
  }
  return (
    <div style={{ width: size, height: size }}
      className="rounded-xl glass-teal flex items-center justify-center shrink-0">
      <span className="text-xs font-bold text-[#00D2B4]">{initials}</span>
    </div>
  )
}

function StakeModal({ validator, wallet, network, onClose, onSuccess }) {
  const [amount, setAmount] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')

  const XRD = network === 'mainnet'
    ? 'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd'
    : 'resource_tdx_2_1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxtfd2jc'

  async function handleStake() {
    if (!amount || parseFloat(amount) <= 0) { setError('Enter amount'); return }
    if (!password) { setError('Enter password'); return }
    setLoading(true); setError(''); setStatusMsg('Decrypting...')
    try {
      const decrypted = await decryptWallet(loadWallet(), password)
      if (!decrypted) { setError('Wrong password'); setLoading(false); return }
      setStatusMsg('Building stake TX...')
      const manifest = `CALL_METHOD
    Address("${wallet.address}")
    "lock_fee"
    Decimal("2");
CALL_METHOD
    Address("${wallet.address}")
    "withdraw"
    Address("${XRD}")
    Decimal("${parseFloat(amount).toFixed(8)}");
TAKE_FROM_WORKTOP
    Address("${XRD}")
    Decimal("${parseFloat(amount).toFixed(8)}")
    Bucket("stake_bucket");
CALL_METHOD
    Address("${validator.address}")
    "stake"
    Bucket("stake_bucket");
CALL_METHOD
    Address("${wallet.address}")
    "deposit_batch"
    Expression("ENTIRE_WORKTOP");`
      setStatusMsg('Signing & submitting...')
      const result = await signAndSubmitManifest(manifest, decrypted.privateKey, network)
      if (result?.error_message) { setError(result.error_message); setLoading(false); return }
      setSuccess(true); onSuccess?.()
    } catch (e) { setError(e?.message || 'Stake failed') }
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative z-10 w-full max-w-sm bg-[#071414] rounded-t-3xl p-6 border-t border-[rgba(0,210,180,0.15)]"
        onClick={e => e.stopPropagation()}>
        <div className="w-10 h-1 bg-[#1A4040] rounded-full mx-auto mb-6" />
        {!success ? (
          <>
            <div className="flex items-center gap-3 mb-6">
              <ValidatorLogo iconUrl={validator.iconUrl} name={validator.name} size={44} />
              <div className="min-w-0">
                <h3 className="text-lg font-bold text-[#E8F8F6] truncate">{validator.name}</h3>
                <p className="text-[#3A7A72] text-xs font-mono">Stake XRD</p>
              </div>
            </div>
            <div className="glass-teal rounded-2xl p-4 grid grid-cols-3 gap-3 mb-4">
              {[
                { label: 'UPTIME', value: validator.uptime },
                { label: 'STAKE', value: validator.totalStake },
                { label: 'FEE', value: validator.fee },
              ].map(item => (
                <div key={item.label} className="text-center">
                  <p className="text-[#3A7A72] text-xs font-mono">{item.label}</p>
                  <p className="text-[#E8F8F6] text-sm font-bold">{item.value}</p>
                </div>
              ))}
            </div>
            <div className="flex flex-col gap-3 mb-4">
              <div className="glass rounded-xl px-4 py-3">
                <p className="text-[#3A7A72] text-xs font-mono mb-1">AMOUNT (XRD)</p>
                <input type="number" placeholder="0.00" value={amount}
                  onChange={e => setAmount(e.target.value)}
                  className="w-full bg-transparent text-[#E8F8F6] text-2xl font-bold outline-none placeholder-[#2A5550]" />
              </div>
              <div className="glass rounded-xl px-4 py-3">
                <p className="text-[#3A7A72] text-xs font-mono mb-1">PASSWORD</p>
                <input type="password" placeholder="Confirm with password"
                  value={password} onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleStake()}
                  className="w-full bg-transparent text-[#E8F8F6] text-sm outline-none placeholder-[#2A5550]" />
              </div>
            </div>
            {loading && (
              <div className="glass-teal rounded-xl px-4 py-3 mb-3 flex items-center gap-3">
                <div className="w-4 h-4 rounded-full border-2 border-[#00D2B4] border-t-transparent animate-spin shrink-0" />
                <p className="text-[#00D2B4] text-sm font-mono">{statusMsg}</p>
              </div>
            )}
            {error && <p className="text-red-400 text-sm font-mono mb-3">{error}</p>}
            <div className="flex gap-3">
              <button onClick={onClose} className="btn-ghost flex-1 py-4 rounded-2xl text-sm flex items-center justify-center gap-1">
                <Icon name="back" size={14} /> Back
              </button>
              <button onClick={handleStake} disabled={loading}
                className="btn-teal flex-1 py-4 rounded-2xl text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-1">
                <Icon name="zap" size={14} />
                {loading ? 'Staking...' : 'Stake XRD'}
              </button>
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center text-center gap-4 py-4">
            <div className="w-16 h-16 rounded-full glass-teal flex items-center justify-center animate-glow-pulse">
              <Icon name="check" size={28} className="text-[#00D2B4]" />
            </div>
            <h3 className="text-xl font-bold text-[#E8F8F6]">Stake Submitted!</h3>
            <p className="text-[#3A7A72] text-sm">Your XRD is being staked to {validator.name}.</p>
            <button onClick={onClose} className="btn-teal w-full py-4 rounded-2xl text-base font-semibold">Done</button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function DeFiPage({ wallet, network }) {
  const [activeTab, setActiveTab] = useState('staking')
  const [validators, setValidators] = useState([])
  const [stakes, setStakes] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selectedValidator, setSelectedValidator] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function fetchData() {
      setLoading(true)
      const [v, s] = await Promise.all([
        getValidators(network),
        getStakePositions(wallet.address, network),
      ])
      if (cancelled) return
      setValidators(v)
      setStakes(s)
      setLoading(false)
    }
    fetchData()
    return () => { cancelled = true }
  }, [wallet.address, network])

  function getValidatorInfo(v) {
    const items = v?.metadata?.items || []
    return {
      name: getMetaValue(items, 'name') || v.address?.slice(0, 16) + '...',
      iconUrl: getMetaValue(items, 'icon_url') || '',
      description: getMetaValue(items, 'description') || '',
    }
  }

  function getValidatorStake(v) {
    const raw = parseFloat(v?.stake_vault?.balance || 0)
    if (raw >= 1_000_000) return (raw / 1_000_000).toFixed(2) + 'M'
    if (raw >= 1_000) return (raw / 1_000).toFixed(1) + 'K'
    return raw.toFixed(0)
  }

  function getUptime(v) {
    // active_in_epoch contains uptime for current epoch
    const u = v?.active_in_epoch?.uptime
    if (u !== undefined && u !== null && u !== '') {
      return (parseFloat(u) * 100).toFixed(1) + '%'
    }
    // Try state
    const stateUptime = v?.state?.reliability_percentage
    if (stateUptime !== undefined) {
      return parseFloat(stateUptime).toFixed(1) + '%'
    }
    return '—'
  }

  function getFee(v) {
    // effective_fee_factor.current can be a number or object
    const current = v?.effective_fee_factor?.current
    if (current !== undefined && current !== null) {
      const val = typeof current === 'object'
        ? current?.percentage ?? current?.value ?? null
        : current
      if (val !== null) return (parseFloat(val) * 100).toFixed(1) + '%'
    }
    const state = v?.state?.validator_fee_factor
    if (state !== undefined && state !== null) {
      return (parseFloat(state) * 100).toFixed(1) + '%'
    }
    return '—'
  }

  const filtered = validators.filter(v => {
    const { name } = getValidatorInfo(v)
    const s = search.toLowerCase()
    return name.toLowerCase().includes(s) || v.address?.toLowerCase().includes(s)
  })

  const totalStaked = stakes.reduce((acc, s) => acc + parseFloat(s.amount || 0), 0)

  return (
    <div className="px-6 flex flex-col gap-4">
      {selectedValidator && (
        <StakeModal validator={selectedValidator} wallet={wallet} network={network}
          onClose={() => setSelectedValidator(null)}
          onSuccess={() => setSelectedValidator(null)} />
      )}

      <div className="pt-2">
        <h2 className="text-2xl font-bold text-[#E8F8F6] mb-1">DeFi</h2>
        <p className="text-[#3A7A72] text-xs font-mono">Staking & protocols</p>
      </div>

      <div className="flex gap-2">
        {['staking', 'protocols'].map(t => (
          <button key={t} onClick={() => setActiveTab(t)}
            className={`px-4 py-2 rounded-xl text-sm font-semibold capitalize transition-all ${activeTab === t ? 'btn-teal' : 'btn-ghost'}`}>
            {t}
          </button>
        ))}
      </div>

      {activeTab === 'staking' && (
        <div className="flex flex-col gap-4">
          {stakes.length > 0 && (
            <div className="glass-teal rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[#3A7A72] text-xs font-mono tracking-widest">MY STAKES</p>
                <span className="text-[#00D2B4] text-sm font-bold">{totalStaked.toFixed(2)} XRD</span>
              </div>
              {stakes.map((s, i) => (
                <div key={i} className="flex items-center gap-3 py-2 border-t border-[rgba(0,210,180,0.08)] first:border-0">
                  <Icon name="lock" size={14} className="text-[#00D2B4] shrink-0" />
                  <p className="text-[#E8F8F6] text-xs font-mono truncate flex-1">{s.validator_address?.slice(0,26)}...</p>
                  <p className="text-[#00D2B4] text-sm font-bold shrink-0">{parseFloat(s.amount || 0).toFixed(2)} XRD</p>
                </div>
              ))}
            </div>
          )}

          <div className="glass rounded-xl px-4 py-2.5 flex items-center gap-2">
            <Icon name="search" size={14} className="text-[#2A5550] shrink-0" />
            <input type="text" placeholder="Search validators..."
              value={search} onChange={e => setSearch(e.target.value)}
              className="flex-1 bg-transparent text-[#E8F8F6] text-sm outline-none placeholder-[#2A5550]" />
          </div>

          <div className="flex items-center justify-between">
            <p className="text-[#2A5550] text-xs font-mono tracking-widest uppercase">
              Top {filtered.length} Validators
            </p>
            {loading && <div className="w-4 h-4 rounded-full border-2 border-[#00D2B4] border-t-transparent animate-spin" />}
          </div>

          {loading ? (
            <div className="flex flex-col gap-2">
              {[1,2,3,4,5].map(i => <div key={i} className="h-16 bg-[#071414] rounded-2xl animate-pulse" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="glass rounded-2xl p-6 text-center">
              <p className="text-[#3A7A72] text-sm">No validators found</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {filtered.map((v, i) => {
                const { name, iconUrl } = getValidatorInfo(v)
                return (
                  <div key={v.address} className="glass rounded-2xl px-4 py-3 flex items-center gap-3">
                    <ValidatorLogo iconUrl={iconUrl} name={name} size={40} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[#E8F8F6] text-sm font-semibold truncate">{name}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-[#3A7A72] text-xs font-mono">uptime {getUptime(v)}</span>
                        <span className="text-[#3A7A72] text-xs font-mono">fee {getFee(v)}</span>
                        <span className="text-[#3A7A72] text-xs font-mono">{getValidatorStake(v)} XRD</span>
                      </div>
                    </div>
                    <button onClick={() => setSelectedValidator({
                      address: v.address,
                      name,
                      iconUrl,
                      uptime: getUptime(v),
                      totalStake: getValidatorStake(v) + ' XRD',
                      fee: getFee(v),
                    })} className="btn-teal px-3 py-2 rounded-xl text-xs font-semibold shrink-0 flex items-center gap-1">
                      <Icon name="zap" size={12} /> Stake
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'protocols' && (
        <div className="flex flex-col gap-3">
          {[
            { name: 'Astrolescent', desc: 'DEX aggregator — best rates', icon: 'trending', url: 'https://astrl.trade' },
            { name: 'Ociswap', desc: 'DEX & liquidity pools', icon: 'layers', url: 'https://ociswap.com' },
            { name: 'CaviarNine', desc: 'Concentrated liquidity AMM', icon: 'database', url: 'https://app.caviarnine.com' },
            { name: 'DefiPlaza', desc: 'Multi-token DEX', icon: 'activity', url: 'https://defiplaza.net' },
            { name: 'Surge', desc: 'Lending & borrowing', icon: 'zap', url: null },
          ].map(p => (
            <div key={p.name} className="glass rounded-2xl px-4 py-4 flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl glass-teal flex items-center justify-center shrink-0">
                <Icon name={p.icon} size={20} className="text-[#00D2B4]" />
              </div>
              <div className="flex-1">
                <p className="text-base font-bold text-[#E8F8F6]">{p.name}</p>
                <p className="text-[#3A7A72] text-xs">{p.desc}</p>
              </div>
              {p.url ? (
                <a href={p.url} target="_blank" rel="noopener noreferrer"
                  className="btn-teal px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1">
                  <Icon name="external" size={12} /> Open
                </a>
              ) : (
                <span className="text-xs font-mono px-2 py-1 rounded-full border text-[#2A5550] border-[#1A4040]">soon</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
