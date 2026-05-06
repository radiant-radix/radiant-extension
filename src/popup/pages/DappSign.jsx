import { useSearchParams } from 'react-router-dom'
import { useState } from 'react'
import browser from 'webextension-polyfill'
import Icon from '@/components/ui/Icon'

export default function DappSign() {
  const [params] = useSearchParams()
  const requestId = params.get('requestId')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showManifest, setShowManifest] = useState(false)
  const [request, setRequest] = useState(null)

  useState(() => {
    browser.runtime.sendMessage({ type: 'GET_PENDING_REQUEST', payload: { requestId } })
      .then(r => setRequest(r))
  }, [])

  async function approve() {
    if (!password) { setError('Enter password'); return }
    setLoading(true); setError('')
    const result = await browser.runtime.sendMessage({
      type: 'DAPP_SIGN_APPROVED',
      payload: { requestId, password }
    })
    if (result?.error) { setError(result.error); setLoading(false); return }
    window.close()
  }

  async function reject() {
    await browser.runtime.sendMessage({ type: 'DAPP_SIGN_REJECTED', payload: { requestId } })
    window.close()
  }

  return (
    <div className="min-h-screen bg-[#040E0E] flex flex-col px-6 py-8 gap-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 glass-teal rounded-xl flex items-center justify-center">
          <Icon name="zap" size={18} className="text-[#00D2B4]" />
        </div>
        <div>
          <h2 className="text-lg font-black text-[#E8F8F6]">Sign Transaction</h2>
          <p className="text-[#3A7A72] text-xs font-mono">{request?.origin || 'dApp request'}</p>
        </div>
      </div>

      <div className="glass rounded-2xl p-4 flex flex-col gap-2">
        <div className="flex justify-between items-center">
          <p className="text-[#3A7A72] text-xs font-mono tracking-widest">TRANSACTION MANIFEST</p>
          <button onClick={() => setShowManifest(s => !s)}
            className="text-[#00D2B4] text-xs font-mono">
            {showManifest ? 'hide' : 'show'}
          </button>
        </div>
        {showManifest && request?.manifest && (
          <pre className="text-[#7ABFB8] text-xs font-mono overflow-x-auto max-h-32 overflow-y-auto leading-relaxed">
            {request.manifest}
          </pre>
        )}
        {!showManifest && (
          <p className="text-[#2A5550] text-xs">Click show to review the transaction details</p>
        )}
      </div>

      <div className="glass rounded-xl px-4 py-3">
        <p className="text-[#3A7A72] text-xs font-mono mb-1">PASSWORD</p>
        <input type="password" placeholder="Enter password to sign"
          value={password} onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && approve()}
          className="w-full bg-transparent text-[#E8F8F6] text-sm outline-none placeholder-[#2A5550]"
          autoFocus />
      </div>

      {error && <p className="text-red-400 text-xs font-mono">{error}</p>}

      <div className="flex gap-3 mt-auto">
        <button onClick={reject} className="btn-ghost flex-1 py-3 rounded-xl text-sm">Reject</button>
        <button onClick={approve} disabled={loading}
          className="btn-teal flex-1 py-3 rounded-xl text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-1">
          <Icon name="zap" size={14} />
          {loading ? 'Signing...' : 'Sign & Send'}
        </button>
      </div>
    </div>
  )
}
