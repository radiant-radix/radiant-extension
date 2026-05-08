import { useSearchParams, useNavigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { loadSession } from '../../lib/wallet'
import { extensionStorage } from '../../lib/extensionStorage'
import Icon from '../../components/ui/Icon'

export default function DappConnect() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const origin = decodeURIComponent(params.get('origin') || 'Unknown site')
  const requestId = params.get('requestId')

  const [loading, setLoading] = useState(false)
  const [session, setSession] = useState(null)
  const [accounts, setAccounts] = useState([])
  const [selectedAccounts, setSelectedAccounts] = useState([])
  const [persona, setPersona] = useState('')

  useEffect(() => {
    async function init() {
      const s = await loadSession()
      if (!s) { navigate('/unlock'); return }
      setSession(s)
      const accs = s.accounts || [{ name: 'Account 1', address: s.address }]
      setAccounts(accs)
      // Select all by default
      setSelectedAccounts(accs.map(a => a.address))
      // Default persona name
      setPersona(s.personaName || 'My Persona')
    }
    init()
  }, [])

  function toggleAccount(address) {
    setSelectedAccounts(prev =>
      prev.includes(address)
        ? prev.filter(a => a !== address)
        : [...prev, address]
    )
  }

  async function approve() {
    if (selectedAccounts.length === 0) return
    setLoading(true)
    try {
      // Save connected site
      const existing = await extensionStorage.getItem('connectedSites')
      const sites = existing ? JSON.parse(existing) : {}
      sites[origin] = {
        connectedAt: Date.now(),
        accounts: selectedAccounts,
        persona,
        network: session.network,
      }
      await extensionStorage.setItem('connectedSites', JSON.stringify(sites))

      // Save approval result so content script can poll it
      const approvalKey = `dapp_request_${requestId}`
      await extensionStorage.setItem(approvalKey, JSON.stringify({
        approved: true,
        accounts: selectedAccounts,
        network: session.network,
        persona,
      }))
    } catch (e) {
      console.error('Approve error:', e)
    }
    setLoading(false)
    window.close()
  }

  async function reject() {
    try {
      const approvalKey = `dapp_request_${requestId}`
      await extensionStorage.setItem(approvalKey, JSON.stringify({ approved: false }))
    } catch (e) {}
    window.close()
  }

  // Get favicon
  const faviconUrl = origin !== 'Unknown site'
    ? `${origin}/favicon.ico`
    : null

  if (!session) {
    return (
      <div className="min-h-screen bg-[#040E0E] flex items-center justify-center">
        <div className="text-[#00D2B4] text-sm animate-pulse font-mono">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#040E0E] flex flex-col px-6 py-8 gap-5">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[300px] bg-[radial-gradient(ellipse,rgba(0,210,180,0.08)_0%,transparent_70%)] pointer-events-none" />

      {/* Header */}
      <div className="relative z-10 text-center">
        <div className="flex items-center justify-center gap-3 mb-3">
          {faviconUrl && (
            <img src={faviconUrl} className="w-10 h-10 rounded-xl" onError={e => e.target.style.display='none'} />
          )}
          {!faviconUrl && (
            <div className="w-10 h-10 glass-teal rounded-xl flex items-center justify-center">
              <Icon name="external" size={18} className="text-[#00D2B4]" />
            </div>
          )}
          <div className="text-left">
            <p className="text-[#E8F8F6] text-sm font-bold truncate max-w-[200px]">{origin}</p>
            <p className="text-[#3A7A72] text-xs font-mono">Wants to connect</p>
          </div>
        </div>
        <h2 className="text-xl font-black text-[#E8F8F6]">Connect to Radiant</h2>
      </div>

      {/* Persona */}
      <div className="relative z-10 glass rounded-2xl p-4">
        <p className="text-[#3A7A72] text-xs font-mono tracking-widest mb-2">PERSONA</p>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl glass-teal flex items-center justify-center text-lg shrink-0">
            👤
          </div>
          <input
            type="text"
            value={persona}
            onChange={e => setPersona(e.target.value)}
            className="flex-1 bg-transparent text-[#E8F8F6] text-sm font-semibold outline-none"
            placeholder="Persona name"
          />
          <Icon name="edit" size={14} className="text-[#3A7A72] shrink-0" />
        </div>
        <p className="text-[#2A5550] text-xs mt-2">This is your identity shown to the dApp</p>
      </div>

      {/* Select Accounts */}
      <div className="relative z-10">
        <p className="text-[#3A7A72] text-xs font-mono tracking-widest mb-3">SELECT ACCOUNTS TO SHARE</p>
        <div className="flex flex-col gap-2">
          {accounts.map((acc, i) => {
            const selected = selectedAccounts.includes(acc.address)
            return (
              <button key={i} onClick={() => toggleAccount(acc.address)}
                className={`glass rounded-2xl px-4 py-3 flex items-center gap-3 text-left transition-all ${selected ? 'border border-[rgba(0,210,180,0.4)]' : ''}`}>
                <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${selected ? 'bg-[#00D2B4] border-[#00D2B4]' : 'border-[#2A5550]'}`}>
                  {selected && <Icon name="check" size={12} className="text-[#040E0E]" />}
                </div>
                <div className="w-9 h-9 rounded-xl glass-teal flex items-center justify-center text-sm font-bold text-[#00D2B4] shrink-0">
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[#E8F8F6] text-sm font-semibold">{acc.name || `Account ${i + 1}`}</p>
                  <p className="text-[#3A7A72] text-xs font-mono truncate">{acc.address?.slice(0, 24)}...</p>
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Permissions */}
      <div className="relative z-10 glass rounded-2xl p-4">
        <p className="text-[#3A7A72] text-xs font-mono tracking-widest mb-2">PERMISSIONS</p>
        {[
          'View selected account addresses',
          'Request transaction signatures',
          'Read current network'
        ].map(p => (
          <div key={p} className="flex items-center gap-2 py-1">
            <Icon name="check" size={13} className="text-[#00D2B4] shrink-0" />
            <span className="text-[#7ABFB8] text-xs">{p}</span>
          </div>
        ))}
      </div>

      {/* Buttons */}
      <div className="relative z-10 flex gap-3 mt-auto">
        <button onClick={reject}
          className="btn-ghost flex-1 py-3 rounded-xl text-sm font-semibold">
          Reject
        </button>
        <button onClick={approve} disabled={loading || selectedAccounts.length === 0}
          className="btn-teal flex-1 py-3 rounded-xl text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2">
          {loading
            ? <div className="w-4 h-4 rounded-full border-2 border-[#040E0E] border-t-transparent animate-spin" />
            : <>
                <Icon name="zap" size={14} />
                Connect
              </>
          }
        </button>
      </div>
    </div>
  )
}
