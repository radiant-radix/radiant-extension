import { useState, useEffect } from 'react'
import { loadWallet, decryptWallet } from '../../lib/wallet'
import { signAndSubmitManifest } from '../../lib/batch'
import { getTxStatus } from '../../lib/transaction'
import { getAstrlTokens, getAstrlQuote } from '../../lib/astrolescent'
import Icon from '../ui/Icon'

const XRD_MAINNET = 'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd'
const XRD_STOKENET = 'resource_tdx_2_1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxtfd2jc'
const XRD_TOKEN = {
  address: XRD_MAINNET,
  symbol: 'XRD',
  name: 'Radix',
  icon_url: 'https://assets.radixdlt.com/icons/icon-xrd-32x32.png',
}

function TokenLogo({ token, size = 24 }) {
  const [err, setErr] = useState(false)
  const logo = token?.icon_url
  const symbol = (token?.symbol || '??').slice(0, 4)
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

function TokenDropdown({ tokens, selected, onSelect, search, onSearch }) {
  const filtered = tokens.filter(t =>
    t.symbol?.toLowerCase().includes(search.toLowerCase()) ||
    t.name?.toLowerCase().includes(search.toLowerCase())
  )
  return (
    <div className="glass rounded-xl mt-1 max-h-48 overflow-y-auto z-[300] relative">
      <div className="sticky top-0 bg-[#071414] px-3 py-2 border-b border-[rgba(0,210,180,0.1)]">
        <input type="text" placeholder="Search token..." value={search}
          onChange={e => onSearch(e.target.value)}
          className="w-full bg-transparent text-[#E8F8F6] text-sm outline-none placeholder-[#2A5550]"
          autoFocus />
      </div>
      {filtered.length === 0 && (
        <p className="text-[#3A7A72] text-xs text-center py-4">No tokens found</p>
      )}
      {filtered.map(t => (
        <button key={t.address} onClick={() => onSelect(t)}
          className={`w-full px-3 py-2.5 flex items-center gap-3 text-left hover:bg-[rgba(0,210,180,0.05)] ${selected?.address === t.address ? 'bg-[rgba(0,210,180,0.08)]' : ''}`}>
          <TokenLogo token={t} size={22} />
          <div className="flex-1 min-w-0">
            <span className="text-[#E8F8F6] text-sm font-semibold">{t.symbol}</span>
            <span className="text-[#3A7A72] text-xs ml-2 truncate">{t.name}</span>
          </div>
          {t.price_usd && (
            <span className="text-[#3A7A72] text-xs font-mono shrink-0">${parseFloat(t.price_usd).toFixed(4)}</span>
          )}
        </button>
      ))}
    </div>
  )
}

export default function Swap({ wallet, network, onClose, onSuccess, balance }) {
  const XRD = network === 'mainnet' ? XRD_MAINNET : XRD_STOKENET
  const xrdToken = { ...XRD_TOKEN, address: XRD }

  const [tokens, setTokens] = useState([])
  const [fromToken, setFromToken] = useState(xrdToken)
  const [toToken, setToToken] = useState(null)
  const [inputAmount, setInputAmount] = useState('')
  const [outputAmount, setOutputAmount] = useState('')
  const [priceImpact, setPriceImpact] = useState(null)
  const [pool, setPool] = useState(null)
  const [manifest, setManifest] = useState(null)
  const [quoting, setQuoting] = useState(false)
  const [loadingTokens, setLoadingTokens] = useState(true)
  const [showFromList, setShowFromList] = useState(false)
  const [showToList, setShowToList] = useState(false)
  const [searchFrom, setSearchFrom] = useState('')
  const [searchTo, setSearchTo] = useState('')
  const [slippage, setSlippage] = useState(1)
  const [step, setStep] = useState(0)
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [statusMsg, setStatusMsg] = useState('')
  const [error, setError] = useState('')
  const [txResult, setTxResult] = useState(null)

  useEffect(() => {
    getAstrlTokens().then(list => {
      setTokens(list)
      setToToken(list.find(t => t.symbol === 'ASTRL') || list[0] || null)
      setLoadingTokens(false)
    })
  }, [network])

  function reset() {
    setOutputAmount(''); setManifest(null); setPool(null); setError(''); setPriceImpact(null)
  }

  async function handleGetQuote() {
    if (!fromToken || !toToken || !inputAmount || parseFloat(inputAmount) <= 0) {
      setError('Fill in all fields'); return
    }
    setQuoting(true); setError(''); setOutputAmount(''); setPriceImpact(null); setManifest(null)

    const result = await getAstrlQuote({
      inputToken: fromToken.address,
      outputToken: toToken.address,
      inputAmount: parseFloat(inputAmount),
      fromAddress: wallet.address,
    })
    if (!result || !result.manifest) {
      setError('No route found for this pair.')
      setQuoting(false); return
    }
    setPool({ blueprint_name: 'Astrolescent', name: 'Multi-DEX', fee_rate: 0.01 })
    setOutputAmount(parseFloat(result.outputTokens).toFixed(6))
    setPriceImpact(result.priceImpact)
    setManifest(result.manifest)
    setQuoting(false)
  }

  async function handleSwap() {
    if (!password) { setError('Enter password'); return }
    setLoading(true); setStatusMsg('Decrypting...'); setError('')
    try {
      const encrypted = loadWallet()
      const decrypted = await decryptWallet(encrypted, password)
      if (!decrypted) { setError('Wrong password'); setLoading(false); return }
      setStatusMsg('Signing...')
      const fullManifest = `CALL_METHOD\n    Address("${wallet.address}")\n    "lock_fee"\n    Decimal("2");\n` + manifest
      const result = await signAndSubmitManifest(fullManifest, decrypted.privateKey, network)
      if (result?.error_message) { setError(result.error_message); setLoading(false); return }
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
            setStep(2); setLoading(false)
            if (s === 'CommittedSuccess') onSuccess?.()
          }
        }, 2000)
      } else {
        setTxResult({ hash: null, status: 'Submitted' })
        setStep(2); setLoading(false)
      }
    } catch (e) {
      setError(e?.message || 'Swap failed'); setLoading(false)
    }
  }

  function swapDirection() {
    const tmp = fromToken
    setFromToken(toToken || xrdToken)
    setToToken(tmp)
    reset()
  }

  const allFromTokens = [xrdToken, ...tokens]

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={!loading ? onClose : undefined}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative z-10 w-full max-w-sm bg-[#071414] rounded-t-3xl p-6 border-t border-[rgba(0,210,180,0.15)] max-h-[92vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>
        <div className="w-10 h-1 bg-[#1A4040] rounded-full mx-auto mb-6" />

        {step === 0 && (
          <>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-[#E8F8F6]">Swap</h3>
              <div className="flex items-center gap-2">
                {pool && <span className="text-[#3A7A72] text-xs font-mono">{pool.blueprint_name}</span>}
                <a href="https://astrolescent.com" target="_blank" rel="noopener noreferrer"
                  className="text-[#3A7A72] text-xs font-mono hover:text-[#00D2B4] flex items-center gap-1">
                  <Icon name="external" size={11} /> Astrolescent
                </a>
              </div>
            </div>

            {/* Slippage */}
            <div className="flex items-center gap-2 mb-4">
              <span className="text-[#3A7A72] text-xs font-mono shrink-0">Slippage:</span>
              {[0.5, 1, 2, 5].map(s => (
                <button key={s} onClick={() => { setSlippage(s); reset() }}
                  className={`px-2.5 py-1 rounded-lg text-xs font-mono transition-all ${slippage === s ? 'btn-teal' : 'btn-ghost'}`}>
                  {s}%
                </button>
              ))}
            </div>

              <div className="flex flex-col gap-3">
                {/* FROM */}
                <div className="glass rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[#3A7A72] text-xs font-mono">FROM</p>
                    <button onClick={() => { setShowFromList(s => !s); setShowToList(false); setSearchFrom('') }}
                      className="glass-teal rounded-xl px-3 py-2 flex items-center gap-2">
                      <TokenLogo token={fromToken} size={18} />
                      <span className="text-[#E8F8F6] text-sm font-bold">{fromToken?.symbol}</span>
                      <Icon name="chevronDown" size={12} className="text-[#3A7A72]" />
                    </button>
                  </div>
                  {showFromList && (
                    <TokenDropdown tokens={loadingTokens ? [xrdToken] : allFromTokens} selected={fromToken}
                      search={searchFrom} onSearch={setSearchFrom}
                      onSelect={t => { setFromToken(t); setShowFromList(false); reset() }} />
                  )}
                  <input type="number" placeholder="0.00" value={inputAmount}
                    onChange={e => { setInputAmount(e.target.value); reset() }}
                    className="w-full bg-transparent text-[#E8F8F6] text-3xl font-black outline-none placeholder-[#2A5550] mt-2" />
                </div>

                {/* SWAP DIRECTION */}
                <div className="flex justify-center -my-1 z-10">
                  <button onClick={swapDirection}
                    className="w-10 h-10 rounded-xl glass-teal flex items-center justify-center">
                    <Icon name="refresh" size={16} className="text-[#00D2B4]" />
                  </button>
                </div>

                {/* TO */}
                <div className="glass rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-[#3A7A72] text-xs font-mono">TO (estimated)</p>
                    <button onClick={() => { setShowToList(s => !s); setShowFromList(false); setSearchTo('') }}
                      className="glass-teal rounded-xl px-3 py-2 flex items-center gap-2">
                      <TokenLogo token={toToken} size={18} />
                      <span className="text-[#E8F8F6] text-sm font-bold">{toToken?.symbol || 'Select'}</span>
                      <Icon name="chevronDown" size={12} className="text-[#3A7A72]" />
                    </button>
                  </div>
                  {showToList && (
                    <TokenDropdown tokens={loadingTokens ? [] : tokens} selected={toToken}
                      search={searchTo} onSearch={setSearchTo}
                      onSelect={t => { setToToken(t); setShowToList(false); reset() }} />
                  )}
                  <div className="text-[#E8F8F6] text-3xl font-black mt-2 min-h-[44px] flex items-center">
                    {quoting
                      ? <div className="w-6 h-6 rounded-full border-2 border-[#00D2B4] border-t-transparent animate-spin" />
                      : outputAmount || <span className="text-[#2A5550]">0.00</span>
                    }
                  </div>
                </div>

                {/* Pool info */}
                {pool && outputAmount && (
                  <div className="glass-teal rounded-xl px-4 py-2.5 flex flex-col gap-1.5">
                    <div className="flex justify-between">
                      <span className="text-[#3A7A72] text-xs font-mono">Pool</span>
                      <span className="text-[#E8F8F6] text-xs font-mono">{pool.name || pool.blueprint_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#3A7A72] text-xs font-mono">Fee</span>
                      <span className="text-[#E8F8F6] text-xs font-mono">{(parseFloat(pool.fee_rate || 0) * 100).toFixed(2)}%</span>
                    </div>
                    {priceImpact && (
                      <div className="flex justify-between">
                        <span className="text-[#3A7A72] text-xs font-mono">Price Impact</span>
                        <span className={`text-xs font-mono font-semibold ${parseFloat(priceImpact) > 5 ? 'text-red-400' : 'text-[#E8F8F6]'}`}>
                          ~{priceImpact}%
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-[#3A7A72] text-xs font-mono">Min received</span>
                      <span className="text-[#E8F8F6] text-xs font-mono">
                        {(parseFloat(outputAmount) * (1 - slippage / 100)).toFixed(6)} {toToken?.symbol}
                      </span>
                    </div>
                  </div>
                )}

                {error && (
                  <div className="glass rounded-xl px-4 py-3 flex items-start gap-2">
                    <Icon name="info" size={14} className="text-[#3A7A72] shrink-0 mt-0.5" />
                    <p className="text-[#7ABFB8] text-xs">{error}</p>
                  </div>
                )}

                {balance !== undefined && inputAmount && parseFloat(inputAmount) + 2 > parseFloat(balance || 0) && (
                  <div className="glass rounded-xl px-4 py-2.5 flex items-center gap-2">
                    <Icon name="info" size={14} className="text-yellow-400 shrink-0" />
                    <p className="text-yellow-400 text-xs">Balance may be insufficient (need ~2 XRD extra for fees)</p>
                  </div>
                )}
                <div className="flex gap-2 mt-1">
                  <button onClick={handleGetQuote}
                    disabled={quoting || !inputAmount || !toToken || fromToken?.address === toToken?.address}
                    className="btn-ghost flex-1 py-3 rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-1">
                    {quoting
                      ? <div className="w-4 h-4 rounded-full border-2 border-[#00D2B4] border-t-transparent animate-spin" />
                      : <Icon name="refresh" size={14} />}
                    {quoting ? 'Quoting...' : 'Get Quote'}
                  </button>
                  <button onClick={() => manifest ? setStep(1) : handleGetQuote()}
                    disabled={quoting || !inputAmount || !toToken || fromToken?.address === toToken?.address}
                    className="btn-teal flex-1 py-3 rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-1">
                    <Icon name="zap" size={14} />
                    {manifest ? 'Swap' : 'Preview'}
                  </button>
                </div>
                {loadingTokens && (
                  <p className="text-[#2A5550] text-xs text-center font-mono">Loading token list...</p>
                )}
              </div>
          </>
        )}

        {step === 1 && (
          <>
            <h3 className="text-xl font-bold text-[#E8F8F6] text-center mb-6">Confirm Swap</h3>
            <div className="glass-teal rounded-2xl p-4 mb-4 flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <span className="text-[#3A7A72] text-xs font-mono">YOU PAY</span>
                <div className="flex items-center gap-2">
                  <TokenLogo token={fromToken} size={18} />
                  <span className="text-[#E8F8F6] font-bold">{inputAmount} {fromToken?.symbol}</span>
                </div>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[#3A7A72] text-xs font-mono">YOU GET ≥</span>
                <div className="flex items-center gap-2">
                  <TokenLogo token={toToken} size={18} />
                  <span className="text-[#00D2B4] font-bold">
                    {(parseFloat(outputAmount) * (1 - slippage / 100)).toFixed(6)} {toToken?.symbol}
                  </span>
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-[#3A7A72] text-xs font-mono">SLIPPAGE</span>
                <span className="text-[#7ABFB8] text-xs font-mono">{slippage}%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#3A7A72] text-xs font-mono">NETWORK FEE</span>
                <span className="text-[#7ABFB8] text-xs font-mono">~2 XRD</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#3A7A72] text-xs font-mono">DEX</span>
                <span className="text-[#7ABFB8] text-xs font-mono">Astrolescent</span>
              </div>
            </div>

            <div className="glass rounded-xl px-4 py-3 mb-4">
              <p className="text-[#3A7A72] text-xs font-mono mb-1">WALLET PASSWORD</p>
              <input type="password" placeholder="Enter password to sign"
                value={password} onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSwap()}
                className="w-full bg-transparent text-[#E8F8F6] text-sm outline-none placeholder-[#2A5550]"
                autoFocus />
            </div>

            {loading && (
              <div className="glass-teal rounded-xl px-4 py-3 mb-3 flex items-center gap-3">
                <div className="w-4 h-4 rounded-full border-2 border-[#00D2B4] border-t-transparent animate-spin shrink-0" />
                <p className="text-[#00D2B4] text-sm font-mono">{statusMsg}</p>
              </div>
            )}
            {error && <p className="text-red-400 text-xs font-mono mb-3">{error}</p>}

            <div className="flex gap-3">
              <button onClick={() => { setStep(0); setError('') }} disabled={loading}
                className="btn-ghost flex-1 py-4 rounded-2xl text-sm disabled:opacity-30 flex items-center justify-center gap-1">
                <Icon name="back" size={14} /> Back
              </button>
              <button onClick={handleSwap} disabled={loading}
                className="btn-teal flex-1 py-4 rounded-2xl text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-1">
                <Icon name="zap" size={14} />
                {loading ? 'Swapping...' : 'Confirm Swap'}
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <div className="flex flex-col items-center text-center gap-4 py-4">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center ${txResult?.status === 'CommittedSuccess' ? 'glass-teal' : 'glass'}`}>
              <Icon name="check" size={28} className="text-[#00D2B4]" />
            </div>
            <h3 className="text-xl font-bold text-[#E8F8F6]">
              {txResult?.status === 'CommittedSuccess' ? 'Swap Confirmed!' : 'Swap Submitted!'}
            </h3>
            <p className="text-[#3A7A72] text-sm">{inputAmount} {fromToken?.symbol} → {toToken?.symbol}</p>
            {txResult?.hash && (
              <button onClick={() => window.open(`https://${network === 'stokenet' ? 'stokenet-' : ''}dashboard.radixdlt.com/transaction/${txResult.hash}`, '_blank')}
                className="btn-ghost w-full py-3 rounded-xl text-sm flex items-center justify-center gap-1">
                <Icon name="external" size={14} /> View on Explorer
              </button>
            )}
            <button onClick={onClose} className="btn-teal w-full py-4 rounded-2xl text-base font-semibold">Done</button>
          </div>
        )}
      </div>
    </div>
  )
}
