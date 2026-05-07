import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { generateMnemonic, mnemonicToKeypair, encryptWallet, saveWallet, saveSession } from '../lib/wallet'

const STEPS = ['Generate', 'Backup', 'Verify', 'Password']

export default function CreateWallet() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [mnemonic, setMnemonic] = useState('')
  const [words, setWords] = useState([])
  const [verifyInputs, setVerifyInputs] = useState({})
  const [verifyIndexes, setVerifyIndexes] = useState([])
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [pathType, setPathType] = useState('radix')

  function handleGenerate() {
    const m = generateMnemonic()
    setMnemonic(m)
    setWords(m.split(' '))
    // Pick 4 random indexes to verify
    const idxs = []
    while (idxs.length < 4) {
      const r = Math.floor(Math.random() * 24)
      if (!idxs.includes(r)) idxs.push(r)
    }
    setVerifyIndexes(idxs.sort((a, b) => a - b))
    setStep(1)
  }

  function handleCopy() {
    navigator.clipboard.writeText(mnemonic)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleVerify() {
    setError('')
    for (const idx of verifyIndexes) {
      if ((verifyInputs[idx] || '').trim().toLowerCase() !== words[idx]) {
        setError(`Word #${idx + 1} is incorrect`)
        return
      }
    }
    setStep(3)
  }

  async function handleCreate() {
    setError('')
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    if (password !== confirmPassword) { setError('Passwords do not match'); return }
    setLoading(true)
    try {
      const keypair = await mnemonicToKeypair(mnemonic, 'mainnet', pathType)
      const walletData = {
        address: keypair.address,
        publicKey: keypair.publicKey,
        accounts: [{ name: 'Account 1', address: keypair.address, publicKey: keypair.publicKey }],
        createdAt: Date.now(),
      }
      const sensitiveData = { ...walletData, privateKey: keypair.privateKey, mnemonic }
      const encrypted = await encryptWallet(sensitiveData, password)
      saveWallet(encrypted)
      saveSession(walletData)
      navigate('/dashboard')
    } catch (e) {
      setError('Failed to create wallet. Try again.')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#040E0E] flex flex-col relative overflow-hidden">
      {/* Glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-[radial-gradient(ellipse,rgba(0,210,180,0.1)_0%,transparent_70%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(0,210,180,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,210,180,0.02)_1px,transparent_1px)] bg-[size:60px_60px] pointer-events-none" />

      {/* Header */}
      <div className="relative z-10 flex items-center gap-4 px-6 pt-12 pb-6">
        <button onClick={() => step === 0 ? navigate('/') : setStep(s => s - 1)}
          className="w-10 h-10 rounded-xl glass-teal flex items-center justify-center text-[#00D2B4]">
          ←
        </button>
        <div>
          <h2 className="font-display text-lg font-700 text-[#E8F8F6]">Create Wallet</h2>
          <p className="text-xs text-[#3A7A72] font-mono">Step {step + 1} of 4 — {STEPS[step]}</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="relative z-10 px-6 mb-8">
        <div className="h-1 bg-[#0D2020] rounded-full">
          <div className="h-1 bg-gradient-to-r from-[#00A890] to-[#00D2B4] rounded-full transition-all duration-500"
            style={{ width: `${((step + 1) / 4) * 100}%` }} />
        </div>
      </div>

      <div className="relative z-10 flex-1 px-6 pb-8">

        {/* STEP 0: Generate */}
        {step === 0 && (
          <div className="flex flex-col items-center text-center gap-6 pt-8">
            <div className="w-20 h-20 rounded-3xl glass-teal flex items-center justify-center animate-glow-pulse">
              <span className="text-3xl">🔑</span>
            </div>
            <div>
              <h3 className="font-display text-2xl font-700 text-[#E8F8F6] mb-2">Generate Seed Phrase</h3>
              <p className="text-[#3A7A72] text-sm leading-relaxed">
                We'll create a unique 24-word seed phrase.<br/>This is the master key to your wallet.
              </p>
            </div>
            <div className="glass-teal rounded-2xl p-4 w-full text-left">
              <p className="text-[#00D2B4] text-xs font-mono font-500 mb-1">⚠ IMPORTANT</p>
              <p className="text-[#7ABFB8] text-xs leading-relaxed">Never share your seed phrase with anyone. Anyone with this phrase can access your funds.</p>
            </div>
            <button onClick={handleGenerate} className="btn-teal w-full py-4 rounded-2xl text-base mt-4">
              Generate Seed Phrase
            </button>
          </div>
        )}

        {/* STEP 1: Backup */}
        {step === 1 && (
          <div className="flex flex-col gap-5">
            <div className="text-center">
              <h3 className="font-display text-2xl font-700 text-[#E8F8F6] mb-1">Back Up Seed Phrase</h3>
              <p className="text-[#3A7A72] text-sm">Write these 24 words in order. Keep them safe.</p>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {words.map((word, i) => (
                <div key={i} className="glass-teal rounded-xl px-3 py-2 flex items-center gap-2">
                  <span className="text-[#2A5550] font-mono text-xs w-5 text-right">{i + 1}.</span>
                  <span className="text-[#E8F8F6] text-xs font-500">{word}</span>
                </div>
              ))}
            </div>
            <button onClick={handleCopy}
              className="btn-ghost w-full py-3 rounded-xl text-sm flex items-center justify-center gap-2">
              {copied ? '✓ Copied!' : '📋 Copy All Words'}
            </button>
            <button onClick={() => setStep(2)} className="btn-teal w-full py-4 rounded-2xl text-base">
              I've Written It Down →
            </button>
          </div>
        )}

        {/* STEP 2: Verify */}
        {step === 2 && (
          <div className="flex flex-col gap-5">
            <div className="text-center">
              <h3 className="font-display text-2xl font-700 text-[#E8F8F6] mb-1">Verify Seed Phrase</h3>
              <p className="text-[#3A7A72] text-sm">Enter the missing words to confirm your backup.</p>
            </div>
            <div className="flex flex-col gap-3">
              {verifyIndexes.map(idx => (
                <div key={idx} className="glass rounded-xl px-4 py-3 flex items-center gap-3">
                  <span className="text-[#2A5550] font-mono text-sm w-8">#{idx + 1}</span>
                  <input
                    type="text"
                    placeholder={`Word ${idx + 1}`}
                    value={verifyInputs[idx] || ''}
                    onChange={e => setVerifyInputs(v => ({ ...v, [idx]: e.target.value }))}
                    className="flex-1 bg-transparent text-[#E8F8F6] text-sm outline-none placeholder-[#2A5550] font-mono"
                    autoCapitalize="none"
                    autoCorrect="off"
                  />
                </div>
              ))}
            </div>
            {error && <p className="text-red-400 text-sm text-center font-mono">{error}</p>}
            <button onClick={handleVerify} className="btn-teal w-full py-4 rounded-2xl text-base">
              Verify →
            </button>
          </div>
        )}

        {/* STEP 3: Password */}
        {step === 3 && (
          <div className="flex flex-col gap-5">
            <div className="text-center">
              <h3 className="font-display text-2xl font-700 text-[#E8F8F6] mb-1">Set Password</h3>
              <p className="text-[#3A7A72] text-sm">Encrypt your wallet with a strong password.</p>
            </div>
            <div className="flex flex-col gap-3">
              <div className="glass rounded-xl px-4 py-3 flex items-center gap-3">
                <span className="text-[#2A5550]">🔒</span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Password (min 8 chars)"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="flex-1 bg-transparent text-[#E8F8F6] text-sm outline-none placeholder-[#2A5550]"
                />
                <button onClick={() => setShowPassword(s => !s)} className="text-[#2A5550] text-xs">
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              <div className="glass rounded-xl px-4 py-3 flex items-center gap-3">
                <span className="text-[#2A5550]">🔒</span>
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Confirm password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="flex-1 bg-transparent text-[#E8F8F6] text-sm outline-none placeholder-[#2A5550]"
                />
              </div>
              {/* Derivation Path */}
              <div className="glass rounded-2xl p-4 flex flex-col gap-3">
                <p className="text-[#3A7A72] text-xs font-mono tracking-widest">DERIVATION PATH</p>
                <div className="flex flex-col gap-2">
                  <button onClick={() => setPathType('radiant')}
                    className={`flex items-start gap-3 p-3 rounded-xl text-left transition-all ${pathType === 'radiant' ? 'glass-teal' : 'glass'}`}>
                    <div className={`w-4 h-4 rounded-full border-2 mt-0.5 shrink-0 flex items-center justify-center ${pathType === 'radiant' ? 'border-[#00D2B4]' : 'border-[#2A5550]'}`}>
                      {pathType === 'radiant' && <div className="w-2 h-2 rounded-full bg-[#00D2B4]" />}
                    </div>
                    <div>
                      <p className="text-[#E8F8F6] text-sm font-semibold">Radiant (default)</p>
                      <p className="text-[#3A7A72] text-xs font-mono">m/44'/1022'/0'/0/0</p>
                      <p className="text-[#2A5550] text-xs mt-0.5">Only works with Radiant Wallet</p>
                    </div>
                  </button>
                  <button onClick={() => setPathType('radix')}
                    className={`flex items-start gap-3 p-3 rounded-xl text-left transition-all ${pathType === 'radix' ? 'glass-teal' : 'glass'}`}>
                    <div className={`w-4 h-4 rounded-full border-2 mt-0.5 shrink-0 flex items-center justify-center ${pathType === 'radix' ? 'border-[#00D2B4]' : 'border-[#2A5550]'}`}>
                      {pathType === 'radix' && <div className="w-2 h-2 rounded-full bg-[#00D2B4]" />}
                    </div>
                    <div>
                      <p className="text-[#E8F8F6] text-sm font-semibold">Radix Official</p>
                      <p className="text-[#3A7A72] text-xs font-mono">m/44'/1022'/1'/525'/1460'/0'</p>
                      <p className="text-[#2A5550] text-xs mt-0.5">Compatible with official Radix Wallet app</p>
                    </div>
                  </button>
                </div>
                {pathType === 'radix' && (
                  <div className="bg-yellow-900/20 border border-yellow-700/30 rounded-xl px-3 py-2.5">
                    <p className="text-yellow-400 text-xs leading-relaxed">
                      Warning: This path is compatible with the official Radix Wallet app. However, if you lose access to Radiant, you can recover this wallet using any BIP44-compatible wallet that supports Radix coin type 1022.
                    </p>
                  </div>
                )}
                {pathType === 'radiant' && (
                  <div className="bg-[rgba(0,210,180,0.05)] border border-[rgba(0,210,180,0.1)] rounded-xl px-3 py-2.5">
                    <p className="text-[#3A7A72] text-xs leading-relaxed">
                      Note: This wallet can only be recovered using Radiant Wallet. It will show a different address if imported into the official Radix Wallet app.
                    </p>
                  </div>
                )}
              </div>

              {/* Password strength */}
              {password.length > 0 && (
                <div className="flex gap-1">
                  {[1,2,3,4].map(i => (
                    <div key={i} className={`h-1 flex-1 rounded-full transition-all ${
                      password.length >= i * 3
                        ? i <= 2 ? 'bg-red-500' : i === 3 ? 'bg-yellow-500' : 'bg-[#00D2B4]'
                        : 'bg-[#0D2020]'
                    }`} />
                  ))}
                </div>
              )}
            </div>
            {error && <p className="text-red-400 text-sm text-center font-mono">{error}</p>}
            <button onClick={handleCreate} disabled={loading}
              className="btn-teal w-full py-4 rounded-2xl text-base disabled:opacity-50">
              {loading ? 'Creating Wallet...' : 'Create Wallet'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
