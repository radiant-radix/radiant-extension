import { useState, useEffect } from 'react'
import { loadWallet, decryptWallet, saveSession, deleteWallet } from '../../lib/wallet'
import { unlock } from '../../lib/lock'
import {
  isLockedOut, getLockoutRemaining, recordFailedAttempt,
  clearLockout, getFailedAttempts
} from '../../lib/security'
import Icon from '../ui/Icon'

const MAX_ATTEMPTS = 5

export default function LockScreen({ onUnlock, onWalletDeleted }) {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showForgot, setShowForgot] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState('')
  const [deleteError, setDeleteError] = useState('')
  const [lockoutSeconds, setLockoutSeconds] = useState(0)
  const [attempts, setAttempts] = useState(getFailedAttempts())

  useEffect(() => {
    if (isLockedOut()) {
      const interval = setInterval(() => {
        const remaining = getLockoutRemaining()
        setLockoutSeconds(remaining)
        if (remaining <= 0) clearInterval(interval)
      }, 1000)
      setLockoutSeconds(getLockoutRemaining())
      return () => clearInterval(interval)
    }
  }, [attempts])

  async function handleUnlock() {
    setError('')
    if (!password) { setError('Enter your password'); return }
    if (isLockedOut()) {
      setError(`Too many attempts. Wait ${getLockoutRemaining()}s`)
      return
    }
    setLoading(true)
    try {
      const encrypted = loadWallet()
      const decrypted = await decryptWallet(encrypted, password)
      if (!decrypted) {
        const att = recordFailedAttempt()
        setAttempts(att)
        const remaining = MAX_ATTEMPTS - att
        if (remaining > 0) {
          setError(`Wrong password. ${remaining} attempt${remaining !== 1 ? 's' : ''} remaining.`)
        } else {
          setError(`Too many attempts. Locked for 5 minutes.`)
          setLockoutSeconds(300)
        }
        setLoading(false)
        return
      }
      clearLockout()
      const sessionData = {
        address: decrypted.address,
        publicKey: decrypted.publicKey,
        accounts: decrypted.accounts,
        createdAt: decrypted.createdAt,
      }
      saveSession(sessionData)
      unlock()
      onUnlock(sessionData)
    } catch {
      setError('Failed to unlock. Try again.')
    }
    setLoading(false)
  }

  function handleDeleteWallet() {
    if (confirmDelete !== 'DELETE') { setDeleteError('Type DELETE to confirm'); return }
    deleteWallet()
    clearLockout()
    onWalletDeleted?.()
  }

  const locked = lockoutSeconds > 0

  return (
    <div className="min-h-screen bg-[#040E0E] flex flex-col items-center justify-center relative overflow-hidden px-6">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[400px] bg-[radial-gradient(ellipse,rgba(0,210,180,0.1)_0%,transparent_70%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(0,210,180,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,210,180,0.02)_1px,transparent_1px)] bg-[size:60px_60px] pointer-events-none" />

      <div className="relative z-10 w-full max-w-sm flex flex-col items-center gap-6">
        <div className="animate-float">
          <div className="w-20 h-20 rounded-3xl glass-teal flex items-center justify-center animate-glow-pulse">
            <svg width="40" height="40" viewBox="0 0 48 48" fill="none">
              <polygon points="24,4 44,36 4,36" fill="none" stroke="#00D2B4" strokeWidth="2.5" strokeLinejoin="round"/>
              <polygon points="24,14 36,36 12,36" fill="rgba(0,210,180,0.12)" stroke="#80EEE0" strokeWidth="1.5" strokeLinejoin="round"/>
              <circle cx="24" cy="28" r="3" fill="#00D2B4"/>
            </svg>
          </div>
        </div>

        <div className="text-center">
          <h1 className="text-3xl font-black teal-text mb-1">Radiant</h1>
          <p className="text-[#2A5550] text-xs font-mono tracking-widest">WALLET LOCKED</p>
        </div>

        {!showForgot ? (
          <>
            {locked && (
              <div className="w-full glass-teal rounded-2xl px-4 py-3 flex items-center gap-3">
                <Icon name="lock" size={16} className="text-red-400 shrink-0" />
                <p className="text-red-400 text-sm font-mono">Locked. Wait {lockoutSeconds}s</p>
              </div>
            )}

            <div className="w-full flex flex-col gap-3">
              <div className="glass rounded-2xl px-4 py-4 flex items-center gap-3">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter password to unlock"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && !locked && handleUnlock()}
                  className="flex-1 bg-transparent text-[#E8F8F6] text-base outline-none placeholder-[#2A5550]"
                  autoFocus disabled={locked}
                />
                <button onClick={() => setShowPassword(s => !s)} className="text-[#2A5550]">
                  <Icon name={showPassword ? 'eyeOff' : 'eye'} size={16} />
                </button>
              </div>

              {/* Attempt indicator */}
              {attempts > 0 && !locked && (
                <div className="flex gap-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className={`h-1 flex-1 rounded-full ${i < attempts ? 'bg-red-500' : 'bg-[#0D2020]'}`} />
                  ))}
                </div>
              )}

              {error && (
                <div className="flex items-center gap-2">
                  <Icon name="warning" size={14} className="text-red-400 shrink-0" />
                  <p className="text-red-400 text-sm font-mono">{error}</p>
                </div>
              )}

              <button onClick={handleUnlock} disabled={loading || locked}
                className="btn-teal w-full py-4 rounded-2xl text-base font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
                <Icon name="lock" size={16} />
                {loading ? 'Unlocking...' : 'Unlock Wallet'}
              </button>
            </div>

            <button onClick={() => setShowForgot(true)} className="text-[#2A5550] text-xs font-mono underline underline-offset-2">
              Forgot password?
            </button>
          </>
        ) : (
          <div className="w-full flex flex-col gap-4">
            <div className="glass-teal rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Icon name="info" size={14} className="text-[#00D2B4] shrink-0" />
                <p className="text-[#00D2B4] text-sm font-semibold">Reset Wallet</p>
              </div>
              <p className="text-[#7ABFB8] text-xs leading-relaxed">
                Delete this wallet and restore it using your 24-word seed phrase. Make sure you have it before proceeding.
              </p>
            </div>

            <div className="glass rounded-2xl px-4 py-4 border border-red-900/30">
              <div className="flex items-center gap-2 mb-3">
                <Icon name="warning" size={14} className="text-red-400 shrink-0" />
                <p className="text-red-400 text-xs font-mono tracking-widest">IRREVERSIBLE ACTION</p>
              </div>
              <p className="text-[#3A7A72] text-xs mb-3">
                Type <span className="text-red-400 font-mono font-bold">DELETE</span> to confirm:
              </p>
              <input type="text" placeholder="Type DELETE"
                value={confirmDelete} onChange={e => setConfirmDelete(e.target.value)}
                className="w-full glass rounded-xl px-4 py-3 text-[#E8F8F6] text-sm font-mono outline-none placeholder-[#2A5550] mb-3"
                autoCapitalize="none" autoCorrect="off" />
              {deleteError && <p className="text-red-400 text-xs font-mono mb-3">{deleteError}</p>}
              <button onClick={handleDeleteWallet}
                className="w-full py-3 rounded-xl text-sm font-semibold text-red-400 border border-red-900/40 bg-red-900/10 flex items-center justify-center gap-2">
                <Icon name="trash" size={14} />
                Delete Wallet & Reset
              </button>
            </div>

            <button onClick={() => { setShowForgot(false); setConfirmDelete(''); setDeleteError('') }}
              className="btn-ghost w-full py-3 rounded-xl text-sm flex items-center justify-center gap-2">
              <Icon name="back" size={14} />
              Back to Unlock
            </button>
          </div>
        )}

        <div className="flex items-center gap-2">
          <Icon name="shield" size={12} className="text-[#1A4040]" />
          <p className="text-[#1A4040] text-xs font-mono">AES-256 Encrypted · Non-custodial</p>
        </div>
      </div>
    </div>
  )
}
