import { useState } from 'react'
import { loadWallet, decryptWallet } from '../../lib/wallet'
import { buildBatchManifest, signAndSubmitManifest } from '../../lib/batch'
import { simulateManifest, parseSimulationResult } from '../../lib/simulator'
import { isValidRadixAddress } from '../../lib/security'
import Icon from '../ui/Icon'

const XRD_MAINNET = 'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd'
const XRD_STOKENET = 'resource_tdx_2_1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxtfd2jc'

export default function BatchSend({ wallet, network, onClose, onSuccess }) {
  const [transfers, setTransfers] = useState([
    { to: '', amount: '', resource: '' },
    { to: '', amount: '', resource: '' },
  ])
  const [password, setPassword] = useState('')
  const [step, setStep] = useState(0)
  const [loading, setLoading] = useState(false)
  const [simulating, setSimulating] = useState(false)
  const [simResult, setSimResult] = useState(null)
  const [error, setError] = useState('')
  const [txResult, setTxResult] = useState(null)
  const [statusMsg, setStatusMsg] = useState('')
  const [manifest, setManifest] = useState('')

  const XRD = network === 'mainnet' ? XRD_MAINNET : XRD_STOKENET

  function updateTransfer(i, field, value) {
    const updated = [...transfers]
    updated[i] = { ...updated[i], [field]: value }
    setTransfers(updated)
  }

  function addRow() {
    setTransfers([...transfers, { to: '', amount: '', resource: '' }])
  }

  function removeRow(i) {
    if (transfers.length <= 2) return
    setTransfers(transfers.filter((_, idx) => idx !== i))
  }

  async function handleReview() {
    setError('')
    const valid = transfers.filter(t => t.to.trim() && t.amount)
    if (valid.length === 0) { setError('Add at least one transfer'); return }
    for (const t of valid) {
      if (!isValidRadixAddress(t.to)) { setError(`Invalid address: ${t.to.slice(0,20)}...`); return }
      if (isNaN(t.amount) || parseFloat(t.amount) <= 0) { setError('Invalid amount'); return }
    }
    const builtManifest = buildBatchManifest(wallet.address, valid, network)
    setManifest(builtManifest)
    setStep(1)
  }

  async function handleSimulate() {
    setSimulating(true)
    setSimResult(null)
    const result = await simulateManifest(manifest, wallet.address, network)
    setSimResult(parseSimulationResult(result))
    setSimulating(false)
  }

  async function handleSend() {
    setError('')
    if (!password) { setError('Enter password'); return }
    setLoading(true)
    setStatusMsg('Decrypting...')
    try {
      const encrypted = loadWallet()
      const decrypted = await decryptWallet(encrypted, password)
      if (!decrypted) { setError('Wrong password'); setLoading(false); return }
      setStatusMsg('Signing & submitting...')
      const result = await signAndSubmitManifest(manifest, decrypted.privateKey, network)
      if (result?.error_message) { setError(result.error_message); setLoading(false); return }
      setTxResult(result)
      setStep(2)
      onSuccess?.()
    } catch (e) {
      setError(e?.message || 'Transaction failed')
    }
    setLoading(false)
  }

  const validTransfers = transfers.filter(t => t.to.trim() && t.amount)

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={!loading ? onClose : undefined}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative z-10 w-full max-w-sm bg-[#071414] rounded-t-3xl p-6 border-t border-[rgba(0,210,180,0.15)] max-h-[92vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>
        <div className="w-10 h-1 bg-[#1A4040] rounded-full mx-auto mb-6" />

        {step === 0 && (
          <>
            <h3 className="text-xl font-bold text-[#E8F8F6] text-center mb-6">Batch Send</h3>
            <div className="flex flex-col gap-3 mb-4">
              {transfers.map((t, i) => (
                <div key={i} className="glass rounded-2xl p-3 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[#3A7A72] text-xs font-mono">TRANSFER {i + 1}</span>
                    {transfers.length > 2 && (
                      <button onClick={() => removeRow(i)} className="text-red-400">
                        <Icon name="trash" size={14} />
                      </button>
                    )}
                  </div>
                  <input type="text" placeholder="To: account_rdx1..."
                    value={t.to} onChange={e => updateTransfer(i, 'to', e.target.value)}
                    className="w-full bg-transparent text-[#E8F8F6] text-xs font-mono outline-none placeholder-[#2A5550] border-b border-[rgba(0,210,180,0.1)] pb-1"
                    autoCapitalize="none" autoCorrect="off" />
                  <div className="flex gap-2">
                    <input type="number" placeholder="Amount"
                      value={t.amount} onChange={e => updateTransfer(i, 'amount', e.target.value)}
                      className="flex-1 bg-transparent text-[#E8F8F6] text-sm outline-none placeholder-[#2A5550]" />
                    <input type="text" placeholder="Resource (blank=XRD)"
                      value={t.resource} onChange={e => updateTransfer(i, 'resource', e.target.value)}
                      className="flex-1 bg-transparent text-[#E8F8F6] text-xs font-mono outline-none placeholder-[#2A5550]"
                      autoCapitalize="none" autoCorrect="off" />
                  </div>
                </div>
              ))}
              <button onClick={addRow} className="btn-ghost w-full py-2.5 rounded-xl text-sm flex items-center justify-center gap-2">
                <Icon name="plus" size={14} />
                Add Transfer
              </button>
            </div>

            <div className="glass-teal rounded-xl px-4 py-2.5 mb-4 flex items-center justify-between">
              <span className="text-[#3A7A72] text-xs font-mono">TOTAL TRANSFERS</span>
              <span className="text-[#00D2B4] text-sm font-mono font-semibold">{validTransfers.length}</span>
            </div>

            {error && <p className="text-red-400 text-sm font-mono mb-3 flex items-center gap-1"><Icon name="warning" size={12} />{error}</p>}
            <button onClick={handleReview} className="btn-teal w-full py-4 rounded-2xl text-base font-semibold">
              Review Batch →
            </button>
          </>
        )}

        {step === 1 && (
          <>
            <h3 className="text-xl font-bold text-[#E8F8F6] text-center mb-4">Confirm Batch</h3>

            {/* Summary */}
            <div className="glass-teal rounded-2xl p-4 mb-4">
              <p className="text-[#3A7A72] text-xs font-mono mb-2">TRANSFERS ({validTransfers.length})</p>
              {validTransfers.map((t, i) => (
                <div key={i} className="flex items-center justify-between py-1.5 border-b border-[rgba(0,210,180,0.08)] last:border-0">
                  <span className="text-[#E8F8F6] text-xs font-mono truncate flex-1 mr-2">{t.to.slice(0,18)}...</span>
                  <span className="text-[#00D2B4] text-xs font-mono shrink-0">{t.amount} {t.resource ? 'TOKEN' : 'XRD'}</span>
                </div>
              ))}
            </div>

            {/* Simulate */}
            <button onClick={handleSimulate} disabled={simulating}
              className="btn-ghost w-full py-2.5 rounded-xl text-sm mb-3 flex items-center justify-center gap-2">
              <Icon name="zap" size={14} />
              {simulating ? 'Simulating...' : 'Simulate Transaction'}
            </button>

            {simResult && (
              <div className={`rounded-xl px-4 py-3 mb-3 ${simResult.success ? 'glass-teal' : 'border border-red-900/40 bg-red-900/10'}`}>
                <div className="flex items-center gap-2 mb-1">
                  <Icon name={simResult.success ? 'check' : 'warning'} size={14}
                    className={simResult.success ? 'text-[#00D2B4]' : 'text-red-400'} />
                  <span className={`text-sm font-semibold ${simResult.success ? 'text-[#00D2B4]' : 'text-red-400'}`}>
                    {simResult.success ? 'Simulation Passed' : 'Simulation Failed'}
                  </span>
                </div>
                {simResult.success && (
                  <p className="text-[#7ABFB8] text-xs font-mono">Est. fee: ~{simResult.fee} XRD</p>
                )}
                {simResult.error && <p className="text-red-400 text-xs font-mono">{simResult.error}</p>}
              </div>
            )}

            <div className="glass rounded-xl px-4 py-3 mb-4">
              <p className="text-[#3A7A72] text-xs font-mono mb-1">PASSWORD</p>
              <input type="password" placeholder="Enter password to sign"
                value={password} onChange={e => setPassword(e.target.value)}
                className="w-full bg-transparent text-[#E8F8F6] text-sm outline-none placeholder-[#2A5550]" />
            </div>

            {loading && (
              <div className="glass-teal rounded-xl px-4 py-3 mb-4 flex items-center gap-3">
                <div className="w-4 h-4 rounded-full border-2 border-[#00D2B4] border-t-transparent animate-spin shrink-0" />
                <p className="text-[#00D2B4] text-sm font-mono">{statusMsg}</p>
              </div>
            )}
            {error && <p className="text-red-400 text-sm font-mono mb-3 flex items-center gap-1"><Icon name="warning" size={12} />{error}</p>}

            <div className="flex gap-3">
              <button onClick={() => setStep(0)} disabled={loading}
                className="btn-ghost flex-1 py-4 rounded-2xl text-sm disabled:opacity-30 flex items-center justify-center gap-1">
                <Icon name="back" size={14} /> Back
              </button>
              <button onClick={handleSend} disabled={loading}
                className="btn-teal flex-1 py-4 rounded-2xl text-sm disabled:opacity-50 flex items-center justify-center gap-1">
                <Icon name="send" size={14} />
                {loading ? 'Signing...' : 'Sign & Send All'}
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <div className="flex flex-col items-center text-center gap-4 py-4">
            <div className="w-16 h-16 rounded-full glass-teal flex items-center justify-center animate-glow-pulse">
              <Icon name="check" size={28} className="text-[#00D2B4]" />
            </div>
            <h3 className="text-xl font-bold text-[#E8F8F6]">Batch Submitted!</h3>
            <p className="text-[#3A7A72] text-sm">{validTransfers.length} transfers sent in one transaction.</p>
            <button onClick={onClose} className="btn-teal w-full py-4 rounded-2xl text-base font-semibold">Done</button>
          </div>
        )}
      </div>
    </div>
  )
}
