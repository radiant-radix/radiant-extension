import { useState, useEffect } from 'react'
import { getAstrlTokens, getAstrlQuote } from '../../../lib/astrolescent'
import { loadWallet, decryptWallet } from '../../../lib/wallet'
import { signAndSubmitManifest } from '../../../lib/batch'
import { getTxStatus } from '../../../lib/transaction'
import Icon from '../../../components/ui/Icon'

const SMART_KEY = 'radiant_smart_features'
const XRD_MAINNET = 'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd'
const XRD_STOKENET = 'resource_tdx_2_1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxtfd2jc'

function loadSmartData() {
  try { return JSON.parse(localStorage.getItem(SMART_KEY) || '{}') }
  catch { return {} }
}
function saveSmartData(data) { localStorage.setItem(SMART_KEY, JSON.stringify(data)) }

function TokenLogo({ token, size = 28 }) {
  const [err, setErr] = useState(false)
  const logo = token?.icon_url
  const symbol = (token?.symbol || '??').slice(0, 3)
  if (logo && !err) return (
    <div style={{ width: size, height: size }} className="rounded-full overflow-hidden shrink-0 bg-white/10">
      <img src={logo} alt={symbol} className="w-full h-full object-cover" onError={() => setErr(true)} />
    </div>
  )
  return (
    <div style={{ width: size, height: size }} className="rounded-full glass-teal flex items-center justify-center shrink-0">
      <span className="font-bold text-[#00D2B4]" style={{ fontSize: size * 0.3 }}>{symbol}</span>
    </div>
  )
}

function DCASwapModal({ token, amount, wallet, network, XRD, onClose, onSuccess }) {
  const [password, setPassword] = useState('')
  const [step, setStep] = useState(0)
  const [error, setError] = useState('')
  const [statusMsg, setStatusMsg] = useState('')
  const [txResult, setTxResult] = useState(null)
  const [quote, setQuote] = useState(null)
  const [manifest, setManifest] = useState(null)
  const [pool, setPool] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function fetchQuote() {
      const result = await getAstrlQuote({
        inputToken: XRD,
        outputToken: token.address,
        inputAmount: parseFloat(amount),
        fromAddress: wallet.address,
      })
      if (result?.manifest) {
        setQuote({ output_amount: result.outputTokens })
        setManifest(result.manifest)
      }
      setLoading(false)
    }
    fetchQuote()
  }, [])

  async function execute() {
    if (!password) { setError('Enter password'); return }
    if (!manifest) { setError('No pool found for this pair'); return }
    setStep(1); setStatusMsg('Decrypting...'); setError('')
    try {
      const encrypted = await loadWallet()
      const decrypted = await decryptWallet(encrypted, password)
      if (!decrypted) { setError('Wrong password'); setStep(0); return }
      setStatusMsg('Signing...')
      const fullManifest = `CALL_METHOD\n    Address("${wallet.address}")\n    "lock_fee"\n    Decimal("2");\n` + manifest
      const result = await signAndSubmitManifest(fullManifest, decrypted.privateKey, network)
      if (result?.error_message) { setError(result.error_message); setStep(0); return }
      const txHash = result?.transaction_intent_hash
      if (txHash) {
        setStatusMsg('Confirming...')
        let attempts = 0
        const poll = setInterval(async () => {
          attempts++
          const status = await getTxStatus(txHash, network)
          const s = status?.status || status?.intent_status
          if (s === 'CommittedSuccess' || s === 'CommittedFailure' || attempts > 15) {
            clearInterval(poll)
            setTxResult({ hash: txHash, status: s || 'Submitted' })
            setStep(2)
            if (s === 'CommittedSuccess') onSuccess?.()
          }
        }, 2000)
      } else {
        setTxResult({ hash: null, status: 'Submitted' })
        setStep(2)
      }
    } catch (e) {
      setError(e?.message || 'Failed'); setStep(0)
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative z-10 w-full max-w-sm bg-[#071414] rounded-t-3xl p-6 border-t border-[rgba(0,210,180,0.15)]"
        onClick={e => e.stopPropagation()}>
        <div className="w-10 h-1 bg-[#1A4040] rounded-full mx-auto mb-6" />
        {step === 2 ? (
          <div className="flex flex-col items-center gap-4 py-4 text-center">
            <div className="w-16 h-16 rounded-full glass-teal flex items-center justify-center">
              <Icon name="check" size={28} className="text-[#00D2B4]" />
            </div>
            <h3 className="text-xl font-bold text-[#E8F8F6]">DCA Executed!</h3>
            <p className="text-[#3A7A72] text-sm">{amount} XRD → {token.symbol}</p>
            <button onClick={onClose} className="btn-teal w-full py-4 rounded-2xl text-base font-semibold">Done</button>
          </div>
        ) : (
          <>
            <h3 className="text-xl font-bold text-[#E8F8F6] text-center mb-6">Execute DCA</h3>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-8 h-8 rounded-full border-2 border-[#00D2B4] border-t-transparent animate-spin" />
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <div className="glass-teal rounded-2xl p-4 flex flex-col gap-3">
                  <div className="flex justify-between">
                    <span className="text-[#3A7A72] text-xs font-mono">SPENDING</span>
                    <span className="text-[#E8F8F6] font-bold">{amount} XRD</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[#3A7A72] text-xs font-mono">BUYING</span>
                    <div className="flex items-center gap-2">
                      <TokenLogo token={token} size={18} />
                      <span className="text-[#00D2B4] font-bold">
                        {quote ? parseFloat(quote.output_amount).toFixed(6) : '—'} {token.symbol}
                      </span>
                    </div>
                  </div>
                  {pool && (
                    <div className="flex justify-between">
                      <span className="text-[#3A7A72] text-xs font-mono">POOL</span>
                      <span className="text-[#7ABFB8] text-xs font-mono">{pool.name || pool.blueprint_name}</span>
                    </div>
                  )}
                </div>

                {!manifest ? (
                  <div className="glass rounded-xl px-4 py-3">
                    <p className="text-[#7ABFB8] text-xs text-center">No liquidity pool found for XRD → {token.symbol}</p>
                    <button onClick={onClose} className="btn-ghost w-full py-2.5 rounded-xl text-sm mt-2">Close</button>
                  </div>
                ) : (
                  <>
                    <div className="glass rounded-xl px-4 py-3">
                      <p className="text-[#3A7A72] text-xs font-mono mb-1">PASSWORD</p>
                      <input type="password" placeholder="Sign with password"
                        value={password} onChange={e => setPassword(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && execute()}
                        className="w-full bg-transparent text-[#E8F8F6] text-sm outline-none placeholder-[#2A5550]"
                        autoFocus />
                    </div>
                    {step === 1 && (
                      <div className="glass-teal rounded-xl px-4 py-3 flex items-center gap-3">
                        <div className="w-4 h-4 rounded-full border-2 border-[#00D2B4] border-t-transparent animate-spin shrink-0" />
                        <p className="text-[#00D2B4] text-sm font-mono">{statusMsg}</p>
                      </div>
                    )}
                    {error && <p className="text-red-400 text-xs font-mono">{error}</p>}
                    <div className="flex gap-3">
                      <button onClick={onClose} className="btn-ghost flex-1 py-3 rounded-xl text-sm">Cancel</button>
                      <button onClick={execute} disabled={step === 1}
                        className="btn-teal flex-1 py-3 rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
                        <Icon name="zap" size={14} />
                        {step === 1 ? 'Executing...' : 'Confirm DCA'}
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default function SmartPage({ wallet, network, balance }) {
  const [activeTab, setActiveTab] = useState('dca')
  const [data, setData] = useState(loadSmartData())
  const [tokens, setTokens] = useState([])
  const [loadingTokens, setLoadingTokens] = useState(true)
  const XRD = network === 'mainnet' ? XRD_MAINNET : XRD_STOKENET
  const [dcaToken, setDcaToken] = useState('')
  const [dcaAmount, setDcaAmount] = useState(data.dca?.amount || '')
  const [dcaFrequency, setDcaFrequency] = useState(data.dca?.frequency || 'weekly')
  const [dcaHistory, setDcaHistory] = useState(data.dca?.history || [])
  const [tokenSearch, setTokenSearch] = useState('')
  const [showDCAModal, setShowDCAModal] = useState(false)
  const [schedules, setSchedules] = useState(data.schedules || [])
  const [newSchedule, setNewSchedule] = useState({ to: '', amount: '', date: '', label: '' })
  const [compoundThreshold, setCompoundThreshold] = useState(data.autoCompound?.threshold || '10')
  const [autoCompound, setAutoCompound] = useState(data.autoCompound?.active || false)
  const [spendLimit, setSpendLimit] = useState(data.spendLimit?.daily || '')
  const [spendLimitActive, setSpendLimitActive] = useState(data.spendLimit?.active || false)

  useEffect(() => {
    getAstrlTokens().then(list => {
      setTokens(list)
      if (!dcaToken && list.length > 0) setDcaToken(data.dca?.token || list[0]?.address || '')
      setLoadingTokens(false)
    })
  }, [network])

  const selectedToken = tokens.find(t => t.address === dcaToken)
  const filteredTokens = tokens.filter(t =>
    t.symbol?.toLowerCase().includes(tokenSearch.toLowerCase()) ||
    t.name?.toLowerCase().includes(tokenSearch.toLowerCase())
  )

  function saveDCA() {
    const updated = { ...data, dca: { active: true, amount: dcaAmount, token: dcaToken, frequency: dcaFrequency, history: dcaHistory } }
    setData(updated); saveSmartData(updated)
  }

  function onDCASuccess() {
    const entry = { date: new Date().toISOString(), amount: dcaAmount, token: selectedToken?.symbol || dcaToken.slice(9, 15), tokenAddress: dcaToken }
    const history = [entry, ...(data.dca?.history || [])].slice(0, 20)
    const updated = { ...data, dca: { active: true, amount: dcaAmount, token: dcaToken, frequency: dcaFrequency, history } }
    setData(updated); saveSmartData(updated); setDcaHistory(history); setShowDCAModal(false)
  }

  function addSchedule() {
    if (!newSchedule.to || !newSchedule.amount || !newSchedule.date) return
    const updated = [...schedules, { ...newSchedule, id: Date.now(), status: 'pending' }]
    setSchedules(updated); saveSmartData({ ...data, schedules: updated })
    setNewSchedule({ to: '', amount: '', date: '', label: '' })
  }

  function removeSchedule(id) {
    const updated = schedules.filter(s => s.id !== id)
    setSchedules(updated); saveSmartData({ ...data, schedules: updated })
  }

  const tabs = [
    { id: 'dca', label: 'DCA' },
    { id: 'scheduled', label: 'Scheduled' },
    { id: 'autocompound', label: 'Auto-Compound' },
    { id: 'limits', label: 'Limits' },
  ]

  return (
    <div className="px-6 flex flex-col gap-4">
      {showDCAModal && selectedToken && dcaAmount && (
        <DCASwapModal token={selectedToken} amount={dcaAmount} wallet={wallet}
          network={network} XRD={XRD} onClose={() => setShowDCAModal(false)} onSuccess={onDCASuccess} />
      )}

      <div className="pt-2">
        <h2 className="text-2xl font-bold text-[#E8F8F6] mb-1">Smart Wallet</h2>
        <p className="text-[#3A7A72] text-xs font-mono">Automation & advanced features</p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition-all ${activeTab === t.id ? 'btn-teal' : 'btn-ghost'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'dca' && (
        <div className="flex flex-col gap-4">
          <div className="glass rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <Icon name="trending" size={18} className="text-[#00D2B4]" />
              <h3 className="text-base font-bold text-[#E8F8F6]">Dollar Cost Averaging</h3>
            </div>
            <p className="text-[#3A7A72] text-xs mb-4 leading-relaxed">
              Buy tokens with XRD via Astrolescent — best price across Oci, C9 & DefiPlaza.
            </p>
            {loadingTokens ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-6 h-6 rounded-full border-2 border-[#00D2B4] border-t-transparent animate-spin" />
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="glass rounded-xl p-3">
                  <p className="text-[#3A7A72] text-xs font-mono mb-2">BUY TOKEN</p>
                  {selectedToken && (
                    <div className="flex items-center gap-2 mb-2 p-2 glass-teal rounded-lg">
                      <TokenLogo token={selectedToken} size={24} />
                      <span className="text-[#E8F8F6] text-sm font-bold">{selectedToken.symbol}</span>
                      <span className="text-[#3A7A72] text-xs">{selectedToken.name}</span>
                    </div>
                  )}
                  <input type="text" placeholder="Search token..."
                    value={tokenSearch} onChange={e => setTokenSearch(e.target.value)}
                    className="w-full bg-transparent text-[#E8F8F6] text-sm outline-none placeholder-[#2A5550] border-b border-[rgba(0,210,180,0.1)] pb-1 mb-2" />
                  <div className="max-h-36 overflow-y-auto flex flex-col gap-1">
                    {filteredTokens.slice(0, 50).map(t => (
                      <button key={t.address} onClick={() => { setDcaToken(t.address); setTokenSearch('') }}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors ${dcaToken === t.address ? 'glass-teal' : 'hover:bg-[rgba(0,210,180,0.04)]'}`}>
                        <TokenLogo token={t} size={20} />
                        <span className="text-[#E8F8F6] text-xs font-semibold">{t.symbol}</span>
                        <span className="text-[#3A7A72] text-xs truncate">{t.name}</span>
                        {t.price_usd && <span className="text-[#2A5550] text-xs font-mono ml-auto">${parseFloat(t.price_usd).toFixed(4)}</span>}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="glass rounded-xl px-4 py-3">
                  <p className="text-[#3A7A72] text-xs font-mono mb-1">SPEND PER INTERVAL (XRD)</p>
                  <input type="number" placeholder="10.00" value={dcaAmount}
                    onChange={e => setDcaAmount(e.target.value)}
                    className="w-full bg-transparent text-[#E8F8F6] text-xl font-bold outline-none placeholder-[#2A5550]" />
                </div>

                <div className="flex gap-2">
                  {['daily', 'weekly', 'monthly'].map(f => (
                    <button key={f} onClick={() => setDcaFrequency(f)}
                      className={`flex-1 py-2 rounded-xl text-xs font-semibold capitalize transition-all ${dcaFrequency === f ? 'btn-teal' : 'btn-ghost'}`}>
                      {f}
                    </button>
                  ))}
                </div>

                {dcaAmount && selectedToken && (
                  <div className="glass-teal rounded-xl px-4 py-3 flex flex-col gap-1">
                    <div className="flex justify-between">
                      <span className="text-[#3A7A72] text-xs font-mono">BUYING</span>
                      <div className="flex items-center gap-1">
                        <TokenLogo token={selectedToken} size={14} />
                        <span className="text-[#00D2B4] text-xs font-bold">{selectedToken.symbol}</span>
                      </div>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#3A7A72] text-xs font-mono">SPENDING</span>
                      <span className="text-[#E8F8F6] text-xs font-mono">{dcaAmount} XRD / {dcaFrequency}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#3A7A72] text-xs font-mono">YEARLY</span>
                      <span className="text-[#E8F8F6] text-xs font-mono">
                        {(parseFloat(dcaAmount) * (dcaFrequency === 'daily' ? 365 : dcaFrequency === 'weekly' ? 52 : 12)).toFixed(0)} XRD
                      </span>
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <button onClick={saveDCA} disabled={!dcaAmount || !dcaToken}
                    className="btn-ghost flex-1 py-3 rounded-xl text-sm font-semibold disabled:opacity-50">
                    Save Plan
                  </button>
                  <button onClick={() => setShowDCAModal(true)} disabled={!dcaAmount || !dcaToken}
                    className="btn-teal flex-1 py-3 rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
                    <Icon name="zap" size={14} /> Execute DCA
                  </button>
                </div>
              </div>
            )}
          </div>

          {dcaHistory.length > 0 && (
            <div>
              <p className="text-[#2A5550] text-xs font-mono tracking-widest uppercase mb-2">HISTORY</p>
              <div className="flex flex-col gap-2">
                {dcaHistory.slice(0, 5).map((h, i) => (
                  <div key={i} className="glass rounded-xl px-4 py-2.5 flex items-center justify-between">
                    <div>
                      <p className="text-[#E8F8F6] text-sm font-semibold">{h.amount} XRD → {h.token}</p>
                      <p className="text-[#3A7A72] text-xs font-mono">{new Date(h.date).toLocaleDateString()}</p>
                    </div>
                    <Icon name="check" size={14} className="text-[#00D2B4]" />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'scheduled' && (
        <div className="flex flex-col gap-4">
          <div className="glass rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-4">
              <Icon name="activity" size={18} className="text-[#00D2B4]" />
              <h3 className="text-base font-bold text-[#E8F8F6]">Scheduled Transactions</h3>
            </div>
            <div className="flex flex-col gap-2">
              <div className="glass rounded-xl px-4 py-3">
                <p className="text-[#3A7A72] text-xs font-mono mb-1">LABEL</p>
                <input type="text" placeholder="e.g. Monthly payment"
                  value={newSchedule.label} onChange={e => setNewSchedule(s => ({ ...s, label: e.target.value }))}
                  className="w-full bg-transparent text-[#E8F8F6] text-sm outline-none placeholder-[#2A5550]" />
              </div>
              <div className="glass rounded-xl px-4 py-3">
                <p className="text-[#3A7A72] text-xs font-mono mb-1">TO ADDRESS</p>
                <input type="text" placeholder="account_rdx1..."
                  value={newSchedule.to} onChange={e => setNewSchedule(s => ({ ...s, to: e.target.value }))}
                  className="w-full bg-transparent text-[#E8F8F6] text-sm font-mono outline-none placeholder-[#2A5550]"
                  autoCapitalize="none" autoCorrect="off" />
              </div>
              <div className="flex gap-2">
                <div className="glass rounded-xl px-4 py-3 flex-1">
                  <p className="text-[#3A7A72] text-xs font-mono mb-1">AMOUNT (XRD)</p>
                  <input type="number" placeholder="0.00"
                    value={newSchedule.amount} onChange={e => setNewSchedule(s => ({ ...s, amount: e.target.value }))}
                    className="w-full bg-transparent text-[#E8F8F6] text-sm outline-none placeholder-[#2A5550]" />
                </div>
                <div className="glass rounded-xl px-4 py-3 flex-1">
                  <p className="text-[#3A7A72] text-xs font-mono mb-1">DATE</p>
                  <input type="date" value={newSchedule.date}
                    onChange={e => setNewSchedule(s => ({ ...s, date: e.target.value }))}
                    className="w-full bg-transparent text-[#E8F8F6] text-sm outline-none" />
                </div>
              </div>
              <button onClick={addSchedule}
                className="btn-teal w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2">
                <Icon name="plus" size={14} /> Add Schedule
              </button>
            </div>
          </div>
          {schedules.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-[#2A5550] text-xs font-mono tracking-widest uppercase">UPCOMING ({schedules.length})</p>
              {schedules.map(s => {
                const isDue = new Date(s.date) <= new Date()
                return (
                  <div key={s.id} className={`glass rounded-2xl px-4 py-3 flex items-center gap-3 ${isDue ? 'border border-[rgba(0,210,180,0.3)]' : ''}`}>
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isDue ? 'glass-teal' : 'glass'}`}>
                      <Icon name="activity" size={16} className={isDue ? 'text-[#00D2B4]' : 'text-[#3A7A72]'} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[#E8F8F6] text-sm font-semibold truncate">{s.label || 'Scheduled TX'}</p>
                      <p className="text-[#3A7A72] text-xs font-mono">{s.date} · {s.amount} XRD</p>
                      {isDue && <p className="text-[#00D2B4] text-xs font-mono">Due — execute from Send page</p>}
                    </div>
                    <button onClick={() => removeSchedule(s.id)} className="text-red-400 shrink-0">
                      <Icon name="trash" size={14} />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {activeTab === 'autocompound' && (
        <div className="glass rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-4">
            <Icon name="refresh" size={18} className="text-[#00D2B4]" />
            <h3 className="text-base font-bold text-[#E8F8F6]">Auto-Compound Staking</h3>
          </div>
          <p className="text-[#3A7A72] text-xs mb-4 leading-relaxed">
            Track when to re-stake rewards. When rewards exceed the threshold, go to DeFi → Staking to re-stake manually.
          </p>
          <div className="flex flex-col gap-3">
            <div className="glass rounded-xl px-4 py-3">
              <p className="text-[#3A7A72] text-xs font-mono mb-1">THRESHOLD (XRD)</p>
              <input type="number" placeholder="10.00" value={compoundThreshold}
                onChange={e => setCompoundThreshold(e.target.value)}
                className="w-full bg-transparent text-[#E8F8F6] text-xl font-bold outline-none placeholder-[#2A5550]" />
            </div>
            {autoCompound && (
              <div className="glass-teal rounded-xl p-3 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#00D2B4]" />
                <span className="text-[#00D2B4] text-sm font-semibold">Active — {data.autoCompound?.threshold} XRD threshold</span>
              </div>
            )}
            <button onClick={() => {
              const updated = { ...data, autoCompound: { active: true, threshold: compoundThreshold } }
              setData(updated); saveSmartData(updated); setAutoCompound(true)
            }} className="btn-teal w-full py-3 rounded-xl text-sm font-semibold flex items-center justify-center gap-2">
              <Icon name="refresh" size={14} />
              {autoCompound ? 'Update Threshold' : 'Enable Auto-Compound'}
            </button>
          </div>
        </div>
      )}

      {activeTab === 'limits' && (
        <div className="glass rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-4">
            <Icon name="shield" size={18} className="text-[#00D2B4]" />
            <h3 className="text-base font-bold text-[#E8F8F6]">Daily Spending Limit</h3>
          </div>
          {spendLimitActive ? (
            <div className="flex flex-col gap-3">
              <div className="glass-teal rounded-xl p-3 flex items-center gap-2">
                <Icon name="shield" size={14} className="text-[#00D2B4]" />
                <span className="text-[#00D2B4] text-sm font-semibold">Limit: {data.spendLimit?.daily} XRD/day</span>
              </div>
              <button onClick={() => {
                const updated = { ...data, spendLimit: { active: false } }
                setData(updated); saveSmartData(updated); setSpendLimitActive(false)
              }} className="w-full py-3 rounded-xl text-sm font-semibold text-red-400 border border-red-900/40 bg-red-900/10">
                Remove Limit
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="glass rounded-xl px-4 py-3">
                <p className="text-[#3A7A72] text-xs font-mono mb-1">DAILY LIMIT (XRD)</p>
                <input type="number" placeholder="100.00" value={spendLimit}
                  onChange={e => setSpendLimit(e.target.value)}
                  className="w-full bg-transparent text-[#E8F8F6] text-xl font-bold outline-none placeholder-[#2A5550]" />
              </div>
              <button onClick={() => {
                const updated = { ...data, spendLimit: { active: true, daily: spendLimit } }
                setData(updated); saveSmartData(updated); setSpendLimitActive(true)
              }} disabled={!spendLimit}
                className="btn-teal w-full py-3 rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
                <Icon name="shield" size={14} /> Set Limit
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
