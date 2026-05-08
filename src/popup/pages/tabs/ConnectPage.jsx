import { useState, useEffect } from 'react'
import { getConnectedDapps, removeConnectedDapp, addConnectedDapp, generateRadixWalletDeeplink } from '../../../lib/dappConnect'
import Icon from '../../../components/ui/Icon'

const POPULAR_DAPPS = [
  { name: 'Ociswap', origin: 'https://ociswap.com', icon: 'trending', desc: 'DEX & liquidity' },
  { name: 'CaviarNine', origin: 'https://app.caviarnine.com', icon: 'layers', desc: 'Concentrated AMM' },
  { name: 'DefiPlaza', origin: 'https://defiplaza.net', icon: 'database', desc: 'Multi-token DEX' },
  { name: 'Radix Dashboard', origin: 'https://dashboard.radixdlt.com', icon: 'activity', desc: 'Official dashboard' },
]

export default function ConnectPage({ wallet, network }) {
  const [connectedDapps, setConnectedDapps] = useState(getConnectedDapps())
  const [customUrl, setCustomUrl] = useState('')
  const [customName, setCustomName] = useState('')
  const [showManual, setShowManual] = useState(false)
  const [connectMode, setConnectMode] = useState('radiant') // 'radiant' | 'official'
  const [copied, setCopied] = useState('')

  async function copyAddress() {
    const { copyToClipboard } = await import('../../../lib/clipboard')
    await copyToClipboard(wallet.address)
    setCopied('address')
    setTimeout(() => setCopied(''), 2000)
  }

  function connectToDapp(dapp) {
    if (connectMode === 'official') {
      // Redirect to official Radix Wallet
      const deeplink = generateRadixWalletDeeplink(dapp.name, dapp.origin, network)
      window.location.href = deeplink
      return
    }
    // Connect with Radiant
    const updated = addConnectedDapp({
      name: dapp.name,
      origin: dapp.origin,
      icon: dapp.icon,
    })
    setConnectedDapps(updated)
  }

  function connectCustomDapp() {
    if (!customUrl || !customName) return
    try {
      const url = new URL(customUrl)
      const updated = addConnectedDapp({
        name: customName,
        origin: url.origin,
        icon: 'globe',
      })
      setConnectedDapps(updated)
      setCustomUrl('')
      setCustomName('')
      setShowManual(false)
    } catch {
      alert('Invalid URL')
    }
  }

  function disconnect(origin) {
    const updated = removeConnectedDapp(origin)
    setConnectedDapps(updated)
  }

  const isConnected = (origin) => connectedDapps.some(d => d.origin === origin)

  return (
    <div className="px-6 flex flex-col gap-4">
      <div className="pt-2">
        <h2 className="text-2xl font-bold text-[#E8F8F6] mb-1">dApp Connect</h2>
        <p className="text-[#3A7A72] text-xs font-mono">Connect wallet to Radix dApps</p>
      </div>

      {/* Connection mode */}
      <div className="glass rounded-2xl p-4">
        <p className="text-[#3A7A72] text-xs font-mono mb-3 tracking-widest">CONNECTION MODE</p>
        <div className="flex gap-2">
          <button onClick={() => setConnectMode('radiant')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${connectMode === 'radiant' ? 'btn-teal' : 'btn-ghost'}`}>
            Radiant Wallet
          </button>
          <button onClick={() => setConnectMode('official')}
            className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${connectMode === 'official' ? 'btn-teal' : 'btn-ghost'}`}>
            Radix Official
          </button>
        </div>
        <p className="text-[#2A5550] text-xs mt-2 leading-relaxed">
          {connectMode === 'radiant'
            ? 'Use Radiant Wallet address for dApp connections. Copy address to paste in dApp.'
            : 'Redirect to official Radix Wallet app for signing. Best for security.'}
        </p>
      </div>

      {/* Your address */}
      <div className="glass-teal rounded-2xl p-4">
        <p className="text-[#3A7A72] text-xs font-mono mb-2 tracking-widest">YOUR ADDRESS</p>
        <div className="flex items-center gap-2">
          <p className="text-[#E8F8F6] text-xs font-mono flex-1 truncate">{wallet.address}</p>
          <button onClick={copyAddress} className="glass rounded-lg p-2 shrink-0">
            <Icon name={copied === 'address' ? 'check' : 'copy'} size={14} className="text-[#00D2B4]" />
          </button>
        </div>
        <p className="text-[#2A5550] text-xs mt-2">Copy this address to connect to any dApp manually</p>
      </div>

      {/* Connected dApps */}
      {connectedDapps.length > 0 && (
        <div>
          <p className="text-[#2A5550] text-xs font-mono tracking-widest uppercase mb-3">
            Connected ({connectedDapps.length})
          </p>
          <div className="flex flex-col gap-2">
            {connectedDapps.map(dapp => (
              <div key={dapp.origin} className="glass rounded-2xl px-4 py-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl glass-teal flex items-center justify-center shrink-0">
                  <Icon name={dapp.icon || 'globe'} size={18} className="text-[#00D2B4]" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[#E8F8F6] text-sm font-semibold">{dapp.name}</p>
                  <p className="text-[#3A7A72] text-xs font-mono truncate">{dapp.origin}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <div className="w-2 h-2 rounded-full bg-[#00D2B4]" />
                  <button onClick={() => disconnect(dapp.origin)}
                    className="text-red-400 p-1">
                    <Icon name="close" size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Popular dApps */}
      <div>
        <p className="text-[#2A5550] text-xs font-mono tracking-widest uppercase mb-3">Popular dApps</p>
        <div className="flex flex-col gap-2">
          {POPULAR_DAPPS.map(dapp => (
            <div key={dapp.origin} className="glass rounded-2xl px-4 py-3 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl glass-teal flex items-center justify-center shrink-0">
                <Icon name={dapp.icon} size={18} className="text-[#00D2B4]" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[#E8F8F6] text-sm font-semibold">{dapp.name}</p>
                <p className="text-[#3A7A72] text-xs">{dapp.desc}</p>
              </div>
              {isConnected(dapp.origin) ? (
                <button onClick={() => disconnect(dapp.origin)}
                  className="text-xs font-mono text-red-400 border border-red-900/40 rounded-lg px-2 py-1">
                  Revoke
                </button>
              ) : (
                <button onClick={() => connectToDapp(dapp)}
                  className="btn-teal px-3 py-2 rounded-xl text-xs font-semibold flex items-center gap-1">
                  <Icon name="zap" size={12} />
                  Connect
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Manual connect */}
      <div>
        <button onClick={() => setShowManual(s => !s)}
          className="btn-ghost w-full py-3 rounded-xl text-sm flex items-center justify-center gap-2">
          <Icon name="plus" size={14} />
          Connect Custom dApp
        </button>

        {showManual && (
          <div className="glass rounded-2xl p-4 mt-3 flex flex-col gap-3">
            <div className="glass rounded-xl px-4 py-3">
              <p className="text-[#3A7A72] text-xs font-mono mb-1">DAPP NAME</p>
              <input type="text" placeholder="My dApp"
                value={customName} onChange={e => setCustomName(e.target.value)}
                className="w-full bg-transparent text-[#E8F8F6] text-sm outline-none placeholder-[#2A5550]" />
            </div>
            <div className="glass rounded-xl px-4 py-3">
              <p className="text-[#3A7A72] text-xs font-mono mb-1">URL</p>
              <input type="text" placeholder="https://mydapp.com"
                value={customUrl} onChange={e => setCustomUrl(e.target.value)}
                className="w-full bg-transparent text-[#E8F8F6] text-sm font-mono outline-none placeholder-[#2A5550]"
                autoCapitalize="none" autoCorrect="off" />
            </div>
            <button onClick={connectCustomDapp}
              className="btn-teal w-full py-3 rounded-xl text-sm font-semibold">
              Add & Connect
            </button>
          </div>
        )}
      </div>

      {/* How it works */}
      <div className="glass rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Icon name="info" size={14} className="text-[#00D2B4] shrink-0" />
          <p className="text-[#00D2B4] text-sm font-semibold">How dApp Connect works</p>
        </div>
        <div className="flex flex-col gap-2">
          {[
            { step: '1', text: 'Open the dApp in your browser' },
            { step: '2', text: 'Find "Connect Wallet" button in the dApp' },
            { step: '3', text: 'Choose "Manual" or paste your address' },
            { step: '4', text: 'For signing: use Radiant to sign manifests manually' },
          ].map(item => (
            <div key={item.step} className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-lg glass-teal flex items-center justify-center text-xs font-bold text-[#00D2B4] shrink-0 mt-0.5">
                {item.step}
              </div>
              <p className="text-[#3A7A72] text-xs leading-relaxed">{item.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
