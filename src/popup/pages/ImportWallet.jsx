import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { validateMnemonic, mnemonicToKeypair, encryptWallet, saveWallet, saveSession, deriveAllPaths } from '../../lib/wallet'

export default function ImportWallet() {
  const navigate = useNavigate()
  const [mnemonicInput, setMnemonicInput] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [step, setStep] = useState(0)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [pathType, setPathType] = useState('radix')
  const [allAddresses, setAllAddresses] = useState([])
  const [findingAddresses, setFindingAddresses] = useState(false)
  const [selectedAddress, setSelectedAddress] = useState(null)

  async function handleFindAddresses() {
    const cleaned = mnemonicInput.trim().toLowerCase().replace(/\s+/g, ' ')
    const wc = cleaned.split(' ').length
    if (wc !== 12 && wc !== 24) { setError('Seed phrase must be 12 or 24 words'); return }
    if (!validateMnemonic(cleaned)) { setError('Invalid seed phrase'); return }
    setFindingAddresses(true)
    setError('')
    try {
      const results = await deriveAllPaths(cleaned, 'mainnet')
      setAllAddresses(results)
    } catch (e) { setError(e.message) }
    setFindingAddresses(false)
  }

  function handleValidate() {
    setError('')
    const cleaned = mnemonicInput.trim().toLowerCase().replace(/\s+/g, ' ')
    const wordCount = cleaned.split(' ').length
    if (wordCount !== 12 && wordCount !== 24) {
      setError('Seed phrase must be 12 or 24 words')
      return
    }
    if (!validateMnemonic(cleaned)) {
      setError('Invalid seed phrase. Check your words and try again.')
      return
    }
    setStep(1)
  }

  async function handleImport() {
    setError('')
    if (password.length < 8) { setError('Password must be at least 8 characters'); return }
    if (password !== confirmPassword) { setError('Passwords do not match'); return }
    setLoading(true)
    try {
      const cleaned = mnemonicInput.trim().toLowerCase().replace(/\s+/g, ' ')
      let keypair
      if (selectedAddress) {
        keypair = selectedAddress
      } else {
        keypair = await mnemonicToKeypair(cleaned, 'mainnet', pathType)
      }
      const walletData = {
        address: keypair.address,
        publicKey: keypair.publicKey,
        accounts: [{ name: 'Account 1', address: keypair.address, publicKey: keypair.publicKey }],
        createdAt: Date.now(),
        imported: true,
        pathType: selectedAddress?.type || pathType,
      }
      const sensitiveData = { ...walletData, privateKey: keypair.privateKey, mnemonic: cleaned }
      const encrypted = await encryptWallet(sensitiveData, password)
      saveWallet(encrypted)
      saveSession(walletData)
      navigate('/dashboard')
    } catch (e) {
      setError('Failed to import wallet. Try again.')
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#040E0E] flex flex-col relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-[radial-gradient(ellipse,rgba(0,210,180,0.1)_0%,transparent_70%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(0,210,180,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,210,180,0.02)_1px,transparent_1px)] bg-[size:60px_60px] pointer-events-none" />

      {/* Header */}
      <div className="relative z-10 flex items-center gap-4 px-6 pt-12 pb-6">
        <button onClick={() => step === 0 ? navigate('/') : setStep(0)}
          className="w-10 h-10 rounded-xl glass-teal flex items-center justify-center text-[#00D2B4]">
          ←
        </button>
        <div>
          <h2 className="font-display text-lg font-700 text-[#E8F8F6]">Import Wallet</h2>
          <p className="text-xs text-[#3A7A72] font-mono">Step {step + 1} of 2 — {step === 0 ? 'Seed Phrase' : 'Set Password'}</p>
        </div>
      </div>

      {/* Progress */}
      <div className="relative z-10 px-6 mb-8">
        <div className="h-1 bg-[#0D2020] rounded-full">
          <div className="h-1 bg-gradient-to-r from-[#00A890] to-[#00D2B4] rounded-full transition-all duration-500"
            style={{ width: `${(step + 1) / 2 * 100}%` }} />
        </div>
      </div>

      <div className="relative z-10 flex-1 px-6 pb-8">

        {/* STEP 0: Enter seed phrase */}
        {step === 0 && (
          <div className="flex flex-col gap-5">
            <div className="text-center">
              <h3 className="font-display text-2xl font-700 text-[#E8F8F6] mb-1">Enter Seed Phrase</h3>
              <p className="text-[#3A7A72] text-sm">Enter your 12 or 24 word seed phrase separated by spaces.</p>
            </div>
            <textarea
              value={mnemonicInput}
              onChange={e => setMnemonicInput(e.target.value)}
              placeholder="word1 word2 word3 ... word24"
              rows={5}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck="false"
              className="glass rounded-2xl px-4 py-4 text-[#E8F8F6] text-sm font-mono outline-none placeholder-[#2A5550] resize-none w-full leading-relaxed"
            />
            <div className="glass-teal rounded-2xl p-4">
              <p className="text-[#00D2B4] text-xs font-mono font-500 mb-1">⚠ Security Warning</p>
              <p className="text-[#7ABFB8] text-xs leading-relaxed">Only enter your seed phrase on trusted devices. Make sure no one is watching your screen.</p>
            </div>
            {allAddresses.length > 0 && (
              <div className="glass rounded-2xl p-4 flex flex-col gap-2">
                <p className="text-[#3A7A72] text-xs font-mono tracking-widest mb-1">YOUR ADDRESSES</p>
                <p className="text-[#2A5550] text-xs mb-2">Select the path that matches your wallet app:</p>
                {allAddresses.map((r, i) => (
                  <button key={i} onClick={() => {
                    setPathType(r.type === 'radix' ? 'radix' : 'radiant')
                    setSelectedAddress(r)
                    setAllAddresses([])
                  }}
                    className="glass rounded-xl p-3 text-left hover:border hover:border-[rgba(0,210,180,0.3)] transition-all">
                    <p className="text-[#00D2B4] text-xs font-semibold mb-0.5">{r.label}</p>
                    <p className="text-[#3A7A72] text-xs font-mono mb-1">{r.path}</p>
                    <p className="text-[#E8F8F6] text-xs font-mono break-all">{r.address}</p>
                    <p className="text-[#2A5550] text-xs mt-1">Tap to select this path</p>
                  </button>
                ))}
              </div>
            )}
            {error && <p className="text-red-400 text-sm text-center font-mono">{error}</p>}
            <button onClick={handleFindAddresses} disabled={findingAddresses}
              className="btn-ghost w-full py-3 rounded-2xl text-sm disabled:opacity-50 flex items-center justify-center gap-2">
              {findingAddresses
                ? <div className="w-4 h-4 rounded-full border-2 border-[#00D2B4] border-t-transparent animate-spin" />
                : null}
              {findingAddresses ? 'Finding addresses...' : 'Find My Address'}
            </button>
            <button onClick={handleValidate} className="btn-teal w-full py-4 rounded-2xl text-base">
              Continue with selected path →
            </button>
          </div>
        )}

        {/* STEP 1: Password */}
        {step === 1 && (
          <div className="flex flex-col gap-5">
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl glass-teal flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl">✓</span>
              </div>
              <h3 className="font-display text-2xl font-700 text-[#E8F8F6] mb-1">Seed Phrase Valid!</h3>
              <p className="text-[#3A7A72] text-sm">Now set a password to encrypt your wallet.</p>
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
            </div>
            {/* Derivation Path Selector */}
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
                    <p className="text-[#2A5550] text-xs mt-0.5">Use if created in Radiant Wallet</p>
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
                    <p className="text-[#2A5550] text-xs mt-0.5">Use if created in official Radix Wallet</p>
                  </div>
                </button>
              </div>
            </div>

            {error && <p className="text-red-400 text-sm text-center font-mono">{error}</p>}
            <button onClick={handleImport} disabled={loading}
              className="btn-teal w-full py-4 rounded-2xl text-base disabled:opacity-50">
              {loading ? 'Importing...' : 'Import Wallet'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
