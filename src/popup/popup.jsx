import { StrictMode, useState, useEffect } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import browser from 'webextension-polyfill'
import '../index.css'

import Welcome from './pages/Welcome'
import CreateWallet from './pages/CreateWallet'
import ImportWallet from './pages/ImportWallet'
import Dashboard from './pages/Dashboard'
import LockScreen from '../../components/wallet/LockScreen'
import DappConnect from './pages/DappConnect'
import DappSign from './pages/DappSign'

import { walletExists, loadSession } from '../../lib/wallet'
import { isLocked } from '../../lib/lock'

function App() {
  const [state, setState] = useState('checking')
  const [session, setSession] = useState(null)

  useEffect(() => {
    if (!walletExists()) { setState('no-wallet'); return }
    if (isLocked()) { setState('locked'); return }
    const s = loadSession()
    if (s) { setSession(s); setState('unlocked') }
    else setState('locked')
  }, [])

  if (state === 'checking') return (
    <div className="min-h-screen bg-[#040E0E] flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-[#00D2B4] border-t-transparent animate-spin" />
    </div>
  )

  return (
    <HashRouter>
      <Routes>
        <Route path="/dapp-connect" element={<DappConnect />} />
        <Route path="/dapp-sign" element={<DappSign />} />
        {state === 'no-wallet' && (
          <>
            <Route path="/" element={<Welcome />} />
            <Route path="/create" element={<CreateWallet />} />
            <Route path="/import" element={<ImportWallet />} />
            <Route path="*" element={<Navigate to="/" />} />
          </>
        )}
        {state === 'locked' && (
          <>
            <Route path="/" element={
              <LockScreen
                onUnlock={(s) => { setSession(s); setState('unlocked') }}
                onWalletDeleted={() => setState('no-wallet')}
              />
            } />
            <Route path="*" element={<Navigate to="/" />} />
          </>
        )}
        {state === 'unlocked' && (
          <>
            <Route path="/" element={<Dashboard />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="*" element={<Navigate to="/" />} />
          </>
        )}
      </Routes>
    </HashRouter>
  )
}

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>)
