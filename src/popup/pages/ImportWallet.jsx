import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import browser from 'webextension-polyfill'
import { validateMnemonic, mnemonicToKeypair, encryptWallet } from '@/lib/wallet'

export default function ImportWallet() {
  const navigate = useNavigate()
  const [phrase, setPhrase] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [pathType, setPathType] = useState('radix')
  const [step, setStep] = useState(0)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function validate() {
    const cleaned = phrase.trim().toLowerCase().replace(/\s+/g, ' ')
    const wc = cleaned.split(' ').length
    if (wc !== 12 && wc !== 24) { setError('Must be 12 or 24 words'); return }
    if (!validateMnemonic(cleaned)) { setError('Invalid seed phrase'); return }
    setError(''); setStep(1)
  }

  async function finish() {
    if (password.length < 8) { setError('Min 8 characters'); return }
    if (password !== confirm) { setError('Passwords do not match'); return }
    setLoading(true)
    try {
      const cleaned = phrase.trim().toLowerCase().replace(/\s+/g, ' ')
      const keypair = await mnemonicToKeypair(cleaned, 'mainnet', pathType)
      const walletData = {
        address: keypair.address,
        publicKey: keypair.publicKey,
        privateKey: keypair.privateKey,
        mnemonic: cleaned,
        pathType,
        network: 'mainnet',
        accounts: [{ name: 'Account 1', address: keypair.address, publicKey: keypair.publicKey }],
      }
      const encrypted = await encryptWallet(walletData, password)
      await browser.storage.local.set({ wallet: encrypted, locked: true })
      navigate('/')
    } catch (e) { setError(e.message) }
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-[#040E0E] flex flex-col px-6 py-8 gap-5">
      <button onClick={() => step === 0 ? navigate('/') : setStep(0)}
        className="text-[#3A7A72] text-sm self-start">← Back</button>

      {step === 0 && (
        <>
          <div className="text-center">
            <h2 className="text-2xl font-black text-[#E8F8F6] mb-1">Import Wallet</h2>
            <p className="text-[#3A7A72] text-sm">Enter your seed phrase</p>
          </div>
          <textarea value={phrase} onChange={e => setPhrase(e.target.value)}
            placeholder="word1 word2 word3 ..."
            rows={4} autoCapitalize="none" autoCorrect="off" spellCheck="false"
            className="glass rounded-2xl px-4 py-3 text-[#E8F8F6] text-sm font-mono outline-none placeholder-[#2A5550] resize-none" />
          <div className="glass rounded-2xl p-4 flex flex-col gap-2">
            <p className="text-[#3A7A72] text-xs font-mono tracking-widest">DERIVATION PATH</p>
            {[
              { id: 'radix', label: 'Radix Official', path: "m/44'/1022'/1'/525'/1460'/0'", desc: 'From Radix Wallet app' },
              { id: 'radiant', label: 'Radiant Legacy', path: "m/44'/1022'/0'/0/0", desc: 'From Radiant Wallet' },
            ].map(p => (
              <button key={p.id} onClick={() => setPathType(p.id)}
                className={`flex items-start gap-3 p-3 rounded-xl text-left ${pathType === p.id ? 'glass-teal' : 'glass'}`}>
                <div className={`w-4 h-4 rounded-full border-2 mt-0.5 shrink-0 flex items-center justify-center ${pathType === p.id ? 'border-[#00D2B4]' : 'border-[#2A5550]'}`}>
                  {pathType === p.id && <div className="w-2 h-2 rounded-full bg-[#00D2B4]" />}
                </div>
                <div>
                  <p className="text-[#E8F8F6] text-sm font-semibold">{p.label}</p>
                  <p className="text-[#3A7A72] text-xs font-mono">{p.path}</p>
                  <p className="text-[#2A5550] text-xs mt-0.5">{p.desc}</p>
                </div>
              </button>
            ))}
          </div>
          {error && <p className="text-red-400 text-xs font-mono">{error}</p>}
          <button onClick={validate} className="btn-teal w-full py-4 rounded-2xl text-base font-bold mt-auto">
            Continue
          </button>
        </>
      )}

      {step === 1 && (
        <>
          <div className="text-center">
            <h2 className="text-xl font-black text-[#E8F8F6] mb-1">Set Password</h2>
          </div>
          <div className="flex flex-col gap-3">
            <div className="glass rounded-xl px-4 py-3">
              <p className="text-[#3A7A72] text-xs font-mono mb-1">PASSWORD</p>
              <input type="password" placeholder="Min 8 characters"
                value={password} onChange={e => setPassword(e.target.value)}
                className="w-full bg-transparent text-[#E8F8F6] text-sm outline-none placeholder-[#2A5550]" />
            </div>
            <div className="glass rounded-xl px-4 py-3">
              <p className="text-[#3A7A72] text-xs font-mono mb-1">CONFIRM</p>
              <input type="password" placeholder="Confirm password"
                value={confirm} onChange={e => setConfirm(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && finish()}
                className="w-full bg-transparent text-[#E8F8F6] text-sm outline-none placeholder-[#2A5550]" />
            </div>
          </div>
          {error && <p className="text-red-400 text-xs font-mono">{error}</p>}
          <button onClick={finish} disabled={loading}
            className="btn-teal w-full py-4 rounded-2xl text-base font-bold disabled:opacity-50 mt-auto">
            {loading ? 'Importing...' : 'Import Wallet'}
          </button>
        </>
      )}
    </div>
  )
}
