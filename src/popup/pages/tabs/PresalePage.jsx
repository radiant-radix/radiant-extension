import { useState, useEffect } from 'react'
import { PRESALE_CONFIG, calcRdt, getOnChainStats } from '../../../lib/presale'
import { buildAndSignTransferTx, submitTx } from '../../../lib/transaction'
import { loadWallet, decryptWallet } from '../../../lib/wallet'
import Icon from '../../../components/ui/Icon'

function ProgressBar({ pct }) {
  return (
    <div className="w-full h-3 bg-[#0A1A1A] rounded-full overflow-hidden">
      <div className="h-full rounded-full transition-all duration-700"
        style={{ width: `${Math.min(pct, 100)}%`, background: 'linear-gradient(90deg, #00D2B4, #00FFD1)' }} />
    </div>
  )
}

const XRD_MAINNET  = 'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd'
const XRD_STOKENET = 'resource_tdx_2_1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxtfd2jc'

export default function PresalePage({ wallet, network, balance }) {
  const [stats, setStats]               = useState(null)
  const [loadingStats, setLoadingStats] = useState(true)
  const [xrdAmount, setXrdAmount]       = useState('')
  const [rdtAmount, setRdtAmount]       = useState('')
  const [password, setPassword]         = useState('')
  const [status, setStatus]             = useState('idle')
  const [txHash, setTxHash]             = useState('')
  const [errMsg, setErrMsg]             = useState('')

  useEffect(() => {
    getOnChainStats(network).then(s => { setStats(s); setLoadingStats(false) })
  }, [network])

  function handleXrdInput(val) {
    setXrdAmount(val)
    setRdtAmount(val ? calcRdt(parseFloat(val)).toFixed(2) : '')
  }

  function handleBuyClick() {
    setErrMsg('')
    const amt = parseFloat(xrdAmount)
    if (!amt || amt < 500)                   { setErrMsg('Minimum purchase is 500 XRD.'); return }
    if (amt > 100000)                        { setErrMsg('Maximum purchase is 100,000 XRD.'); return }
    if (parseFloat(balance || 0) < amt + 2) { setErrMsg('Insufficient XRD (need ~2 XRD extra for fees).'); return }
    setStatus('confirm')
  }

  async function handleConfirm() {
    if (!password) { setErrMsg('Enter your wallet password.'); return }
    setErrMsg('')

    try {
      setStatus('signing')

      const encrypted = await loadWallet()
      if (!encrypted) {
        setErrMsg('Wallet not found. Please re-import your wallet.')
        setStatus('confirm')
        return
      }

      // decryptWallet bisa return Promise (new crypto) atau object (legacy)
      const decrypted = await Promise.resolve(decryptWallet(encrypted, password))
      if (!decrypted) {
        setErrMsg('Wrong password.')
        setStatus('confirm')
        return
      }

      const xrdResource = network === 'mainnet' ? XRD_MAINNET : XRD_STOKENET
      const { compiledHex, intentHash } = await buildAndSignTransferTx({
        privateKeyHex:   decrypted.privateKey,
        fromAddress:     wallet.address,
        toAddress:       PRESALE_CONFIG.treasuryAddress,
        resourceAddress: xrdResource,
        amount:          parseFloat(xrdAmount),
        network,
      })

      setStatus('submitting')
      const result = await submitTx(compiledHex, network)

      if (result?.transaction_status === 'CommittedSuccess' || result?.duplicate || intentHash) {
        setTxHash(intentHash || result?.intent_hash || '')
        setPassword('')
        setStatus('success')
      } else {
        throw new Error(result?.message || 'Transaction failed.')
      }
    } catch (e) {
      console.error(e)
      setErrMsg(e.message || 'Transaction failed.')
      setStatus('confirm')
    }
  }

  function reset() {
    setStatus('idle'); setErrMsg(''); setXrdAmount('')
    setRdtAmount(''); setTxHash(''); setPassword('')
  }

  const pct       = stats ? (stats.rdtSold / PRESALE_CONFIG.totalRdtForSale) * 100 : 0
  const isSoldOut = stats?.isSoldOut
  const isLoading = status === 'signing' || status === 'submitting'

  return (
    <div className="px-6 flex flex-col gap-4 pb-8">
      <div className="pt-2">
        <h2 className="text-2xl font-bold text-[#E8F8F6] mb-1">RDT Presale</h2>
        <p className="text-[#3A7A72] text-xs font-mono">Radiant Token — Early Access</p>
      </div>

      {/* Token Info */}
      <div className="glass-teal rounded-2xl p-5 flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl glass flex items-center justify-center shrink-0">
            <svg width="24" height="24" viewBox="0 0 200 200" fill="none">
              <polygon points="100,20 180,150 20,150" stroke="#00D2B4" strokeWidth="12" strokeLinejoin="round" fill="none"/>
              <circle cx="100" cy="120" r="18" fill="#00D2B4"/>
            </svg>
          </div>
          <div>
            <p className="text-[#E8F8F6] text-lg font-black">RADIANT (RDT)</p>
            <p className="text-[#3A7A72] text-xs font-mono">Native wallet token</p>
          </div>
          <div className="ml-auto text-right">
            <p className="text-[#00D2B4] text-lg font-black">0.001</p>
            <p className="text-[#3A7A72] text-xs font-mono">XRD / RDT</p>
          </div>
        </div>

        {/* Progress */}
        <div>
          <div className="flex justify-between mb-2">
            <span className="text-[#3A7A72] text-xs font-mono">SOLD</span>
            <span className="text-[#E8F8F6] text-xs font-mono">
              {loadingStats ? '...' : `${(stats?.rdtSold || 0).toLocaleString()} / 600,000,000 RDT`}
            </span>
          </div>
          <ProgressBar pct={loadingStats ? 0 : pct} />
          <div className="flex justify-between mt-1.5">
            <span className="text-[#3A7A72] text-xs font-mono">{pct.toFixed(2)}% filled</span>
            <span className="text-[#3A7A72] text-xs font-mono">
              {loadingStats ? '...' : `${(stats?.xrdRaised || 0).toLocaleString()} XRD raised`}
            </span>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'PRICE',   value: '0.001 XRD' },
            { label: 'MIN BUY', value: '500 XRD'   },
            { label: 'MAX BUY', value: '100K XRD'  },
          ].map(s => (
            <div key={s.label} className="glass rounded-xl p-2.5 text-center">
              <p className="text-[#3A7A72] text-xs font-mono">{s.label}</p>
              <p className="text-[#E8F8F6] text-xs font-bold mt-0.5">{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Tokenomics */}
      <div className="glass rounded-2xl p-4 flex flex-col gap-2">
        <p className="text-[#2A5550] text-xs font-mono tracking-widest">TOKENOMICS</p>
        {[
          { label: 'Presale (60%)',   value: '600,000,000 RDT',   color: 'text-[#00D2B4]'  },
          { label: 'Liquidity (25%)', value: '250,000,000 RDT',   color: 'text-yellow-400' },
          { label: 'Community (10%)', value: '100,000,000 RDT',   color: 'text-purple-400' },
          { label: 'Team (5%)',       value: '50,000,000 RDT',    color: 'text-blue-400'   },
          { label: 'Total Supply',    value: '1,000,000,000 RDT', color: 'text-[#E8F8F6]'  },
        ].map(item => (
          <div key={item.label} className="flex justify-between">
            <span className="text-[#3A7A72] text-xs font-mono">{item.label}</span>
            <span className={`text-xs font-mono font-bold ${item.color}`}>{item.value}</span>
          </div>
        ))}
        <div className="mt-2 pt-2 border-t border-[rgba(0,210,180,0.08)]">
          <p className="text-[#2A5550] text-xs leading-relaxed">
            RDT is the native token of Radiant Wallet. Not investment advice. Participate at your own risk.
          </p>
        </div>
      </div>

      {/* SOLD OUT */}
      {isSoldOut && (
        <div className="glass rounded-2xl p-5 text-center">
          <p className="text-[#00D2B4] text-lg font-bold">🎉 Presale Sold Out!</p>
          <p className="text-[#3A7A72] text-xs mt-1">All 600,000,000 RDT have been sold.</p>
        </div>
      )}

      {/* SUCCESS */}
      {status === 'success' && (
        <div className="glass-teal rounded-2xl p-5 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <Icon name="check-circle" size={20} className="text-[#00D2B4]" />
            <p className="text-[#E8F8F6] font-bold">Payment Sent!</p>
          </div>
          <p className="text-[#3A7A72] text-xs">
            You sent <span className="text-[#E8F8F6] font-bold">{xrdAmount} XRD</span>. You will receive{' '}
            <span className="text-[#00D2B4] font-bold">{parseFloat(rdtAmount).toLocaleString()} RDT</span> within 24 hours.
          </p>
          {txHash && (
            <div className="glass rounded-xl px-3 py-2">
              <p className="text-[#3A7A72] text-xs font-mono mb-1">TX HASH</p>
              <p className="text-[#E8F8F6] text-xs font-mono break-all">{txHash}</p>
            </div>
          )}
          <button onClick={reset} className="btn-ghost w-full py-3 rounded-xl text-sm mt-1">
            Buy More
          </button>
        </div>
      )}

      {/* BUY FORM */}
      {!isSoldOut && status !== 'success' && (
        <div className="flex flex-col gap-3">
          <p className="text-[#2A5550] text-xs font-mono tracking-widest">BUY RDT</p>

          <div className="glass rounded-2xl p-4 flex flex-col gap-3">
            <div>
              <p className="text-[#3A7A72] text-xs font-mono mb-2">YOU PAY (XRD)</p>
              <input type="number" placeholder="0.00"
                value={xrdAmount} onChange={e => handleXrdInput(e.target.value)}
                disabled={isLoading || status === 'confirm'}
                className="w-full bg-transparent text-[#E8F8F6] text-3xl font-black outline-none placeholder-[#2A5550] disabled:opacity-50" />
              <div className="flex gap-2 mt-2">
                {[500, 5000, 25000, 'MAX'].map(v => (
                  <button key={v}
                    disabled={isLoading || status === 'confirm'}
                    onClick={() => handleXrdInput(v === 'MAX' ? Math.min(parseFloat(balance || 0) - 2, 100000).toFixed(2) : v.toString())}
                    className="btn-ghost px-2.5 py-1 rounded-lg text-xs font-mono disabled:opacity-40">
                    {v}
                  </button>
                ))}
              </div>
            </div>
            <div className="border-t border-[rgba(0,210,180,0.08)] pt-3">
              <p className="text-[#3A7A72] text-xs font-mono mb-1">YOU RECEIVE (RDT)</p>
              <p className="text-[#00D2B4] text-3xl font-black">
                {rdtAmount ? parseFloat(rdtAmount).toLocaleString('en-US', { maximumFractionDigits: 2 }) : '0.00'}
              </p>
            </div>
          </div>

          {/* PASSWORD CONFIRM */}
          {status === 'confirm' && (
            <div className="glass-teal rounded-2xl p-4 flex flex-col gap-3">
              <div className="flex justify-between text-xs font-mono">
                <span className="text-[#3A7A72]">SENDING</span>
                <span className="text-[#E8F8F6] font-bold">{xrdAmount} XRD</span>
              </div>
              <div className="flex justify-between text-xs font-mono">
                <span className="text-[#3A7A72]">RECEIVING</span>
                <span className="text-[#00D2B4] font-bold">{parseFloat(rdtAmount).toLocaleString()} RDT</span>
              </div>
              <div className="border-t border-[rgba(0,210,180,0.15)] pt-3">
                <p className="text-[#3A7A72] text-xs font-mono mb-2">ENTER PASSWORD TO CONFIRM</p>
                <input type="password" placeholder="Wallet password"
                  value={password} onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleConfirm()}
                  autoFocus
                  className="w-full glass rounded-xl px-3 py-3 text-[#E8F8F6] text-sm outline-none placeholder-[#2A5550]" />
              </div>
              {errMsg && (
                <div className="flex items-center gap-2">
                  <Icon name="alert-circle" size={14} className="text-red-400 shrink-0" />
                  <p className="text-red-400 text-xs">{errMsg}</p>
                </div>
              )}
              <div className="flex gap-2">
                <button onClick={() => { setStatus('idle'); setErrMsg(''); setPassword('') }}
                  className="btn-ghost flex-1 py-3 rounded-xl text-sm">
                  Cancel
                </button>
                <button onClick={handleConfirm}
                  disabled={isLoading}
                  className="btn-teal flex-1 py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 disabled:opacity-50">
                  {isLoading
                    ? <><Icon name="loader" size={14} className="animate-spin" /> {status === 'signing' ? 'Signing...' : 'Submitting...'}</>
                    : <><Icon name="zap" size={14} /> Confirm</>
                  }
                </button>
              </div>
            </div>
          )}

          {status !== 'confirm' && (
            <>
              {errMsg && status === 'idle' && (
                <div className="glass rounded-xl px-3 py-2.5 flex items-start gap-2">
                  <Icon name="alert-circle" size={14} className="text-red-400 shrink-0 mt-0.5" />
                  <p className="text-red-400 text-xs">{errMsg}</p>
                </div>
              )}
              <button onClick={handleBuyClick}
                disabled={isLoading || !xrdAmount || parseFloat(xrdAmount) < 500}
                className="btn-teal w-full py-4 rounded-2xl text-base font-bold disabled:opacity-50 flex items-center justify-center gap-2">
                {isLoading
                  ? <><Icon name="loader" size={16} className="animate-spin" /> {status === 'signing' ? 'Signing...' : 'Submitting...'}</>
                  : <><Icon name="zap" size={16} /> Buy RDT</>
                }
              </button>
              <p className="text-[#2A5550] text-xs text-center">
                XRD sent directly from your wallet. RDT delivered within 24h.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  )
}
