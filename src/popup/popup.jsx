import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import browser from 'webextension-polyfill'
import { useState, useEffect } from 'react'
import '../index.css'

// Pages
import Welcome from './pages/Welcome'
import CreateWallet from './pages/CreateWallet'
import ImportWallet from './pages/ImportWallet'
import Unlock from './pages/Unlock'
import Dashboard from './pages/Dashboard'
import DappConnect from './pages/DappConnect'
import DappSign from './pages/DappSign'

function App() {
  const [state, setState] = useState(null)

  useEffect(() => {
    browser.runtime.sendMessage({ type: 'GET_STATE' }).then(setState)
  }, [])

  if (!state) return (
    <div className="min-h-screen bg-[#040E0E] flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-[#00D2B4] border-t-transparent animate-spin" />
    </div>
  )

  return (
    <HashRouter>
      <Routes>
        <Route path="/dapp-connect" element={<DappConnect />} />
        <Route path="/dapp-sign" element={<DappSign />} />
        {!state.hasWallet ? (
          <>
            <Route path="/" element={<Welcome />} />
            <Route path="/create" element={<CreateWallet />} />
            <Route path="/import" element={<ImportWallet />} />
            <Route path="*" element={<Navigate to="/" />} />
          </>
        ) : state.locked ? (
          <>
            <Route path="/" element={<Unlock onUnlock={() => browser.runtime.sendMessage({ type: 'GET_STATE' }).then(setState)} />} />
            <Route path="*" element={<Navigate to="/" />} />
          </>
        ) : (
          <>
            <Route path="/" element={<Dashboard session={state.session} onLock={() => browser.runtime.sendMessage({ type: 'LOCK' }).then(() => browser.runtime.sendMessage({ type: 'GET_STATE' }).then(setState))} />} />
            <Route path="*" element={<Navigate to="/" />} />
          </>
        )}
      </Routes>
    </HashRouter>
  )
}

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>)
