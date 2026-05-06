import { useSearchParams } from 'react-router-dom'
import { useState } from 'react'
import browser from 'webextension-polyfill'
import Icon from '../../components/ui/Icon'

export default function DappConnect() {
  const [params] = useSearchParams()
  const origin = params.get('origin') || 'Unknown site'
  const requestId = params.get('requestId')
  const [loading, setLoading] = useState(false)

  async function approve() {
    setLoading(true)
    const { connectedSites } = await browser.storage.local.get('connectedSites')
    const sites = connectedSites || {}
    sites[origin] = { connectedAt: Date.now() }
    await browser.storage.local.set({ connectedSites: sites })
    await browser.runtime.sendMessage({ type: 'DAPP_APPROVED', payload: { requestId, origin } })
    window.close()
  }

  async function reject() {
    await browser.runtime.sendMessage({ type: 'DAPP_REJECTED', payload: { requestId } })
    window.close()
  }

  return (
    <div className="min-h-screen bg-[#040E0E] flex flex-col items-center justify-center px-6 gap-6">
      <div className="w-16 h-16 rounded-2xl glass-teal flex items-center justify-center">
        <Icon name="external" size={24} className="text-[#00D2B4]" />
      </div>
      <div className="text-center">
        <h2 className="text-xl font-black text-[#E8F8F6] mb-2">Connect Request</h2>
        <p className="text-[#3A7A72] text-sm mb-1">This site wants to connect to your wallet:</p>
        <p className="text-[#00D2B4] font-mono text-sm font-bold">{origin}</p>
      </div>
      <div className="glass rounded-2xl p-4 w-full text-sm flex flex-col gap-2">
        <p className="text-[#3A7A72] text-xs font-mono tracking-widest mb-1">PERMISSIONS</p>
        {['View your account address', 'Request transaction signatures'].map(p => (
          <div key={p} className="flex items-center gap-2">
            <Icon name="check" size={14} className="text-[#00D2B4] shrink-0" />
            <span className="text-[#E8F8F6] text-xs">{p}</span>
          </div>
        ))}
      </div>
      <div className="flex gap-3 w-full">
        <button onClick={reject} className="btn-ghost flex-1 py-3 rounded-xl text-sm">Reject</button>
        <button onClick={approve} disabled={loading}
          className="btn-teal flex-1 py-3 rounded-xl text-sm font-bold disabled:opacity-50">
          {loading ? 'Connecting...' : 'Connect'}
        </button>
      </div>
    </div>
  )
}
