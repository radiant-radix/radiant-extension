import { useState } from 'react'
import browser from 'webextension-polyfill'
import Icon from '../../components/ui/Icon'

export default function Unlock({ onUnlock }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleUnlock() {
    if (!password) return
    setLoading(true); setError('')
    const result = await browser.runtime.sendMessage({ type: 'UNLOCK', payload: { password } })
    if (result?.error) { setError(result.error); setLoading(false); return }
    onUnlock?.()
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#040E0E] flex flex-col items-center justify-center px-6 gap-6">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[300px] bg-[radial-gradient(ellipse,rgba(0,210,180,0.08)_0%,transparent_70%)] pointer-events-none" />
      <svg width="48" height="48" viewBox="0 0 200 200" fill="none">
        <polygon points="100,20 180,150 20,150" stroke="#00D2B4" strokeWidth="10" strokeLinejoin="round" fill="none"/>
        <circle cx="100" cy="120" r="16" fill="#00D2B4"/>
      </svg>
      <div className="text-center">
        <h2 className="text-2xl font-black text-[#E8F8F6] mb-1">Welcome back</h2>
        <p className="text-[#3A7A72] text-sm">Enter your password to unlock</p>
      </div>
      <div className="w-full max-w-xs flex flex-col gap-3">
        <div className="glass rounded-xl px-4 py-3">
          <p className="text-[#3A7A72] text-xs font-mono mb-1">PASSWORD</p>
          <input type="password" placeholder="Enter password"
            value={password} onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleUnlock()}
            className="w-full bg-transparent text-[#E8F8F6] text-sm outline-none placeholder-[#2A5550]"
            autoFocus />
        </div>
        {error && <p className="text-red-400 text-xs font-mono text-center">{error}</p>}
        <button onClick={handleUnlock} disabled={loading || !password}
          className="btn-teal w-full py-4 rounded-2xl text-base font-bold disabled:opacity-50 flex items-center justify-center gap-2">
          {loading
            ? <div className="w-5 h-5 rounded-full border-2 border-[#040E0E] border-t-transparent animate-spin" />
            : 'Unlock Wallet'}
        </button>
      </div>
    </div>
  )
}
