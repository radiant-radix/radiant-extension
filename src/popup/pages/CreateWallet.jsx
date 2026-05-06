import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import browser from 'webextension-polyfill'
import { generateMnemonic, mnemonicToKeypair, encryptWallet } from '@/lib/wallet'

export default function CreateWallet() {
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [mnemonic, setMnemonic] = useState('')
  const [words, setWords] = useState([])
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [pathType, setPathType] = useState('radix')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function generate() {
    const m = generateMnemonic()
    setMnemonic(m)
    setWords(m.split(' '))
    setStep(1)
  }

  async function finish() {
    if (password.length < 8) { setError('Min 8 characters'); return }
    if (password !== confirm) { setError('Passwords do not match'); return }
    setLoading(true)
    try {
      const keypair = await mnemonicToKeypair(mnemonic, 'mainnet', pathType)
      const walletData = {
        address: keypair.address,
        publicKey: keypair.publicKey,
        privateKey: keypair.privateKey,
        mnemonic,
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
      <button onClick={() => step === 0 ? navigate('/') : setStep(s => s-1)}
        className="text-[#3A7A72] text-sm self-start">← Back</button>

      {step === 0 && (
        <>
          <div className="text-center">
            <h2 className="text-2xl font-black text-[#E8F8F6] mb-1">Create Wallet</h2>
            <p className="text-[#3A7A72] text-sm">Generate a new 24-word seed phrase</p>
          </div>
          <div className="glass rounded-2xl p-4 flex flex-col gap-2">
            <p className="text-[#3A7A72] text-xs font-mono tracking-widest">DERIVATION PATH</p>
            {[
              { id: 'radix', label: 'Radix Official', desc: 'Compatible with Radix Wallet app', path: "m/44'/1022'/1'/525'/1460'/0'" },
              { id: 'radiant', label: 'Radiant Legacy', desc: 'Radiant Wallet only', path: "m/44'/1022'/0'/0/0" },
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
          <button onClick={generate} className="btn-teal w-full py-4 rounded-2xl text-base font-bold mt-auto">
            Generate Seed Phrase
          </button>
        </>
      )}

      {step === 1 && (
        <>
          <div className="text-center">
            <h2 className="text-xl font-black text-[#E8F8F6] mb-1">Your Seed Phrase</h2>
            <p className="text-[#3A7A72] text-xs">Write these 24 words down and keep them safe.</p>
          </div>
          <div className="glass rounded-2xl p-4 grid grid-cols-3 gap-2">
            {words.map((w, i) => (
              <div key={i} className="glass rounded-lg px-2 py-1.5 flex items-center gap-1.5">
                <span className="text-[#2A5550] text-xs font-mono w-4">{i+1}.</span>
                <span className="text-[#E8F8F6] text-xs font-mono">{w}</span>
              </div>
            ))}
          </div>
          <div className="glass-teal rounded-xl p-3">
            <p className="text-[#00D2B4] text-xs leading-relaxed">
              Never share your seed phrase. Anyone with these words can access your wallet.
            </p>
          </div>
          <button onClick={() => setStep(2)} className="btn-teal w-full py-4 rounded-2xl text-base font-bold">
            I've saved my phrase
          </button>
        </>
      )}

      {step === 2 && (
        <>
          <div className="text-center">
            <h2 className="text-xl font-black text-[#E8F8F6] mb-1">Set Password</h2>
            <p className="text-[#3A7A72] text-sm">Encrypts your wallet locally</p>
          </div>
          <div className="flex flex-col gap-3">
            <div className="glass rounded-xl px-4 py-3">
              <p className="text-[#3A7A72] text-xs font-mono mb-1">PASSWORD</p>
              <input type="password" placeholder="Min 8 characters"
                value={password} onChange={e => setPassword(e.target.value)}
                className="w-full bg-transparent text-[#E8F8F6] text-sm outline-none placeholder-[#2A5550]" />
            </div>
            <div className="glass rounded-xl px-4 py-3">
              <p className="text-[#3A7A72] text-xs font-mono mb-1">CONFIRM PASSWORD</p>
              <input type="password" placeholder="Confirm password"
                value={confirm} onChange={e => setConfirm(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && finish()}
                className="w-full bg-transparent text-[#E8F8F6] text-sm outline-none placeholder-[#2A5550]" />
            </div>
          </div>
          {error && <p className="text-red-400 text-xs font-mono">{error}</p>}
          <button onClick={finish} disabled={loading}
            className="btn-teal w-full py-4 rounded-2xl text-base font-bold disabled:opacity-50 mt-auto">
            {loading ? 'Creating...' : 'Create Wallet'}
          </button>
        </>
      )}
    </div>
  )
}
