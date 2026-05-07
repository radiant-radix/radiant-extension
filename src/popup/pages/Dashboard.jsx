import { useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { loadSession, saveSession, loadWallet, decryptWallet, deleteWallet } from '../lib/wallet'
import { getTransactionHistory, getEntityDetails } from '../lib/gateway'
import { getXRDPrice } from '../lib/price'
import { deriveAccount } from '../lib/multiAccount'
import { lock } from '../lib/lock'
import { copyToClipboard } from '../lib/clipboard'
import { exportTxHistoryCSV } from '../lib/export'
import Receive from '../components/wallet/Receive'
import Send from '../components/wallet/Send'
import BatchSend from '../components/wallet/BatchSend'
import Swap from '../components/wallet/Swap'
import Home from './Home'
import AssetsPage from './tabs/AssetsPage'
import DevPage from './tabs/DevPage'
import DeFiPage from './tabs/DeFiPage'
import SettingsPage from './tabs/SettingsPage'
import SmartPage from './tabs/SmartPage'
import PresalePage from './tabs/PresalePage'
import ConnectPage from './tabs/ConnectPage'
import Icon from '../components/ui/Icon'

export default function Dashboard() {
  const navigate = useNavigate()
  const [wallet, setWallet] = useState(null)
  const [accounts, setAccounts] = useState([])
  const [activeAccount, setActiveAccount] = useState(0)
  const [balance, setBalance] = useState(null)
  const [usdPrice, setUsdPrice] = useState(0)
  const [txHistory, setTxHistory] = useState([])
  const [allTokens, setAllTokens] = useState([])
  const [loadingBalance, setLoadingBalance] = useState(true)
  const [loadingTx, setLoadingTx] = useState(true)
  const [copied, setCopied] = useState(false)
  const [network, setNetwork] = useState('mainnet')
  const [activeTab, setActiveTab] = useState('home')
  const [showReceive, setShowReceive] = useState(false)
  const [showSend, setShowSend] = useState(false)
  const [showBatch, setShowBatch] = useState(false)
  const [showSwap, setShowSwap] = useState(false)
  const [sendToken, setSendToken] = useState(null)
  const [selectedTx, setSelectedTx] = useState(null)
  const [showAccounts, setShowAccounts] = useState(false)
  const [addingAccount, setAddingAccount] = useState(false)
  const [showNetworkModal, setShowNetworkModal] = useState(false)
  const [pendingNetwork, setPendingNetwork] = useState(null)
  const [networkPassword, setNetworkPassword] = useState('')

  useEffect(() => {
    const session = loadSession()
    if (!session) { navigate('/'); return }
    setWallet(session)
    setAccounts(session.accounts || [{ name: 'Account 1', address: session.address, publicKey: session.publicKey }])
  }, [])

  const pathType = loadSession()?.pathType || 'radiant'

  useEffect(() => {
    function handleSelectTx(e) { setSelectedTx(e.detail) }
    window.addEventListener('selectTx', handleSelectTx)
    return () => window.removeEventListener('selectTx', handleSelectTx)
  }, [])

  const currentAddress = accounts[activeAccount]?.address || wallet?.address

  const fetchData = useCallback(async () => {
    if (!currentAddress) return
    setLoadingBalance(true)
    setLoadingTx(true)
    try {
      const [entity, txs, price] = await Promise.all([
        getEntityDetails(currentAddress, network),
        getTransactionHistory(currentAddress, network),
        getXRDPrice(),
      ])
      const fungibles = entity?.fungible_resources?.items || []
      const XRD = network === 'mainnet'
        ? 'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd'
        : 'resource_tdx_2_1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxtfd2jc'
      const xrdItem = fungibles.find(i => i.resource_address === XRD)
      const xrdBal = xrdItem
        ? parseFloat(xrdItem.vaults?.items?.[0]?.amount || xrdItem.amount || xrdItem.aggregated_amount || 0) : 0
      const tokens = fungibles.map(f => ({
        resource_address: f.resource_address,
        amount: f.vaults?.items?.[0]?.amount || f.amount || f.aggregated_amount || '0',
      }))
      setBalance(xrdBal)
      setAllTokens(tokens)
      setTxHistory(txs)
      setUsdPrice(price)
    } catch (e) { console.error('fetchData:', e); setBalance(0) }
    setLoadingBalance(false)
    setLoadingTx(false)
  }, [currentAddress, network])

  useEffect(() => { fetchData() }, [fetchData])

  async function handleNetworkChange(newNetwork) {
    if (newNetwork === network) return
    setShowNetworkModal(true)
    setPendingNetwork(newNetwork)
  }

  async function confirmNetworkSwitch(password) {
    setShowNetworkModal(false)
    if (!password) return
    try {
      const encrypted = loadWallet()
      if (!encrypted) return
      const decrypted = await decryptWallet(encrypted, password)
      if (!decrypted) { alert('Wrong password'); return }
      const newAccounts = []
      for (let i = 0; i < accounts.length; i++) {
        const acc = await deriveAccount(decrypted.mnemonic, i, pendingNetwork, { pathType })
        newAccounts.push({ name: accounts[i].name, address: acc.address, publicKey: acc.publicKey })
      }
      setAccounts(newAccounts)
      setActiveAccount(0)
      setNetwork(pendingNetwork)
      const session = loadSession()
      const networkAddresses = session?.networkAddresses || {}
      networkAddresses[pendingNetwork] = newAccounts
      saveSession({ ...session, networkAddresses, network: pendingNetwork })
    } catch (e) { console.error('network switch:', e) }
    setPendingNetwork(null)
  }

  async function addAccount() {
    setAddingAccount(true)
    try {
      const encrypted = loadWallet()
      const password = prompt('Enter password to add account:')
      if (!password) { setAddingAccount(false); return }
      const decrypted = await decryptWallet(encrypted, password)
      if (!decrypted) { alert('Wrong password'); setAddingAccount(false); return }
      const newIndex = accounts.length
      const newAcc = await deriveAccount(decrypted.mnemonic, newIndex, network, { pathType })
      const updatedAccounts = [...accounts, { name: `Account ${newIndex + 1}`, address: newAcc.address, publicKey: newAcc.publicKey }]
      setAccounts(updatedAccounts)
      const session = loadSession()
      saveSession({ ...session, accounts: updatedAccounts })
      setActiveAccount(newIndex)
      setShowAccounts(false)
    } catch (e) { console.error('addAccount:', e) }
    setAddingAccount(false)
  }

  function handleRenameAccount(index, newName) {
    const updated = accounts.map((acc, i) => i === index ? { ...acc, name: newName } : acc)
    setAccounts(updated)
    saveSession({ ...loadSession(), accounts: updated })
  }

  async function copyAddress() {
    if (!currentAddress) return
    await copyToClipboard(currentAddress)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleLogout() {
    if (!confirm('Disconnect wallet?')) return
    deleteWallet()
    navigate('/')
  }

  function handleLock() {
    lock()
    window.location.reload()
  }

  function handleSendToken(token) { setSendToken(token); setShowSend(true) }

  function formatDate(timestamp) {
    if (!timestamp) return ''
    return new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  if (!wallet) return null

  const tabs = [
    { icon: 'home', label: 'Home', id: 'home' },
    { icon: 'coins', label: 'Assets', id: 'assets' },
    { icon: 'zap', label: 'Smart', id: 'smart' },
    { icon: 'zap', label: 'RDT', id: 'presale' },
    { icon: 'layers', label: 'DeFi', id: 'defi' },
    { icon: "settings", label: "Settings", id: "settings" }, { icon: "code", label: "Dev", id: "dev" },
  ]

  return (
    <div className="min-h-screen bg-[#040E0E] flex flex-col relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[500px] h-[300px] bg-[radial-gradient(ellipse,rgba(0,210,180,0.1)_0%,transparent_70%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(0,210,180,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,210,180,0.02)_1px,transparent_1px)] bg-[size:60px_60px] pointer-events-none" />

      {showReceive && <Receive address={currentAddress} onClose={() => setShowReceive(false)} />}
      {showSend && <Send wallet={{ ...wallet, address: currentAddress }} network={network} token={sendToken}
        onClose={() => { setShowSend(false); setSendToken(null) }} onSuccess={fetchData} />}
      {showBatch && <BatchSend wallet={{ ...wallet, address: currentAddress }} network={network}
        onClose={() => setShowBatch(false)} onSuccess={fetchData} />}
      {showSwap && <Swap wallet={{ ...wallet, address: currentAddress }} network={network}
        balance={balance} onClose={() => setShowSwap(false)} onSuccess={fetchData} />}

      {/* TX Detail Modal */}
      {selectedTx && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setSelectedTx(null)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative z-10 w-full max-w-sm bg-[#071414] rounded-t-3xl p-6 border-t border-[rgba(0,210,180,0.15)]"
            onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-[#1A4040] rounded-full mx-auto mb-6" />
            <h3 className="text-xl font-bold text-[#E8F8F6] text-center mb-6">Transaction Detail</h3>
            <div className="flex flex-col gap-3">
              {[
                { label: 'STATUS', value: selectedTx.transaction_status, color: selectedTx.transaction_status === 'CommittedSuccess' ? 'text-[#00D2B4]' : 'text-red-400' },
                { label: 'DATE', value: formatDate(selectedTx.confirmed_at) },
                { label: 'EPOCH', value: selectedTx.epoch?.toString() || 'N/A' },
                { label: 'FEE PAID', value: selectedTx.fee_paid ? parseFloat(selectedTx.fee_paid).toFixed(4) + ' XRD' : 'N/A' },
              ].map(item => (
                <div key={item.label} className="glass rounded-xl px-4 py-3 flex justify-between items-center">
                  <span className="text-[#3A7A72] text-xs font-mono">{item.label}</span>
                  <span className={`text-sm font-mono ${item.color || 'text-[#E8F8F6]'}`}>{item.value}</span>
                </div>
              ))}
              {selectedTx.intent_hash && (
                <div className="glass rounded-xl px-4 py-3">
                  <p className="text-[#3A7A72] text-xs font-mono mb-1">TX HASH</p>
                  <p className="text-[#E8F8F6] text-xs font-mono break-all">{selectedTx.intent_hash}</p>
                </div>
              )}
              {selectedTx.balance_changes?.fungible_balance_changes?.length > 0 && (
                <div className="glass rounded-xl px-4 py-3">
                  <p className="text-[#3A7A72] text-xs font-mono mb-2">BALANCE CHANGES</p>
                  {selectedTx.balance_changes.fungible_balance_changes.map((c, i) => (
                    <div key={i} className="flex justify-between py-1">
                      <span className="text-[#3A7A72] text-xs font-mono truncate flex-1 mr-2">{c.entity_address?.slice(0,16)}...</span>
                      <span className={`text-xs font-mono shrink-0 ${parseFloat(c.balance_change) >= 0 ? 'text-[#00D2B4]' : 'text-red-400'}`}>
                        {parseFloat(c.balance_change) >= 0 ? '+' : ''}{parseFloat(c.balance_change).toFixed(4)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              <div className="flex gap-2">
                <button onClick={() => exportTxHistoryCSV([selectedTx], currentAddress, network)}
                  className="btn-ghost flex-1 py-3 rounded-xl text-sm flex items-center justify-center gap-1">
                  <Icon name="download" size={14} /> Export
                </button>
                <button onClick={() => window.open(`https://${network === 'stokenet' ? 'stokenet-' : ''}dashboard.radixdlt.com/transaction/${selectedTx.intent_hash}`, '_blank')}
                  className="btn-ghost flex-1 py-3 rounded-xl text-sm flex items-center justify-center gap-1">
                  <Icon name="external" size={14} /> View
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Network Switch Modal */}
      {showNetworkModal && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => { setShowNetworkModal(false); setPendingNetwork(null); setNetworkPassword('') }}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative z-10 w-full max-w-sm bg-[#071414] rounded-t-3xl p-6 border-t border-[rgba(0,210,180,0.15)]"
            onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-[#1A4040] rounded-full mx-auto mb-6" />
            <h3 className="text-xl font-bold text-[#E8F8F6] text-center mb-2">Switch to {pendingNetwork}</h3>
            <p className="text-[#3A7A72] text-xs text-center font-mono mb-6">Enter password to derive {pendingNetwork} address</p>
            <div className="glass rounded-xl px-4 py-3 mb-4">
              <p className="text-[#3A7A72] text-xs font-mono mb-1">PASSWORD</p>
              <input type="password" placeholder="Enter wallet password"
                value={networkPassword} onChange={e => setNetworkPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && confirmNetworkSwitch(networkPassword)}
                className="w-full bg-transparent text-[#E8F8F6] text-sm outline-none placeholder-[#2A5550]"
                autoFocus />
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setShowNetworkModal(false); setPendingNetwork(null); setNetworkPassword('') }}
                className="btn-ghost flex-1 py-3 rounded-xl text-sm">Cancel</button>
              <button onClick={() => { confirmNetworkSwitch(networkPassword); setNetworkPassword('') }}
                className="btn-teal flex-1 py-3 rounded-xl text-sm font-semibold">Confirm</button>
            </div>
          </div>
        </div>
      )}

      {/* Account Switcher */}
      {showAccounts && (
        <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={() => setShowAccounts(false)}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div className="relative z-10 w-full max-w-sm bg-[#071414] rounded-t-3xl p-6 border-t border-[rgba(0,210,180,0.15)]"
            onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1 bg-[#1A4040] rounded-full mx-auto mb-6" />
            <h3 className="text-xl font-bold text-[#E8F8F6] mb-4">Accounts</h3>
            <div className="flex flex-col gap-2 mb-4">
              {accounts.map((acc, i) => (
                <button key={i} onClick={() => { setActiveAccount(i); setShowAccounts(false) }}
                  className={`glass rounded-2xl px-4 py-3 flex items-center gap-3 text-left transition-all ${activeAccount === i ? 'border border-[rgba(0,210,180,0.4)]' : 'teal-border'}`}>
                  <div className="w-10 h-10 rounded-xl glass-teal flex items-center justify-center text-sm font-bold text-[#00D2B4] shrink-0">{i + 1}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[#E8F8F6] text-sm font-semibold">{acc.name}</p>
                    <p className="text-[#3A7A72] text-xs font-mono truncate">{acc.address?.slice(0,22)}...</p>
                  </div>
                  {activeAccount === i && <Icon name="check" size={16} className="text-[#00D2B4] shrink-0" />}
                </button>
              ))}
            </div>
            <button onClick={addAccount} disabled={addingAccount}
              className="btn-teal w-full py-3 rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2">
              <Icon name="plus" size={14} />
              {addingAccount ? 'Deriving...' : 'Add Account'}
            </button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between px-6 pt-12 pb-4">
        <button onClick={() => setShowAccounts(true)} className="flex items-center gap-2">
          <div className="w-9 h-9 rounded-xl glass-teal flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 200 200" fill="none">
              <polygon points="100,28 178,152 22,152" stroke="#00D2B4" strokeWidth="6" strokeLinejoin="round" fill="none"/>
              <circle cx="100" cy="124" r="14" fill="#00D2B4"/>
            </svg>
          </div>
          <div className="text-left">
            <span className="text-sm font-bold teal-text block">{accounts[activeAccount]?.name || 'Account 1'}</span>
            <span className={`text-xs font-mono ${network === 'mainnet' ? 'text-[#00D2B4]' : 'text-yellow-400'}`}>
              {network}
            </span>
          </div>
        </button>
        <div className="flex items-center gap-2">
          <button onClick={() => handleNetworkChange(network === 'mainnet' ? 'stokenet' : 'mainnet')}
            className="glass rounded-lg px-3 py-1.5 flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${network === 'mainnet' ? 'bg-[#00D2B4]' : 'bg-yellow-400'}`} />
            <span className={`text-xs font-mono ${network === 'mainnet' ? 'text-[#00D2B4]' : 'text-yellow-400'}`}>
              {network === 'mainnet' ? 'Mainnet' : 'Stokenet'}
            </span>
          </button>
          <button onClick={() => setShowBatch(true)} title="Batch Send"
            className="w-9 h-9 rounded-xl glass flex items-center justify-center text-[#3A7A72]">
            <Icon name="layers" size={15} />
          </button>
          <button onClick={() => exportTxHistoryCSV(txHistory, currentAddress, network)} title="Export CSV"
            className="w-9 h-9 rounded-xl glass flex items-center justify-center text-[#3A7A72]">
            <Icon name="download" size={15} />
          </button>
          <button onClick={handleLock} title="Lock wallet"
            className="w-9 h-9 rounded-xl glass flex items-center justify-center text-[#3A7A72]">
            <Icon name="lock" size={15} />
          </button>
        </div>
      </div>

      <div className="relative z-10 flex-1 overflow-y-auto pb-24">
        {activeTab === 'home' && (
          <Home
            wallet={wallet} balance={balance} txHistory={txHistory}
            loadingBalance={loadingBalance} loadingTx={loadingTx}
            usdPrice={usdPrice} network={network} currentAddress={currentAddress}
            allTokens={allTokens}
            onSend={() => setShowSend(true)}
            onReceive={() => setShowReceive(true)}
            onSwap={() => setShowSwap(true)}
            onRefresh={fetchData}
            copied={copied} onCopy={copyAddress}
          />
        )}
        {activeTab === 'assets' && <AssetsPage wallet={{ ...wallet, address: currentAddress }}
          network={network} tokens={allTokens} loading={loadingBalance} onSend={handleSendToken} />}
        {activeTab === 'smart' && <SmartPage wallet={{ ...wallet, address: currentAddress }}
          network={network} balance={balance} />}
        {activeTab === 'presale' && <PresalePage wallet={{ ...wallet, address: currentAddress }} network={network} balance={balance} />}
        {activeTab === 'defi' && <DeFiPage wallet={{ ...wallet, address: currentAddress }} network={network} />}
        {activeTab === 'dev' && <DevPage wallet={{ ...wallet, address: currentAddress }} network={network} />}
        {activeTab === 'settings' && <SettingsPage
          wallet={{ ...wallet, address: currentAddress }}
          network={network} accounts={accounts} activeAccount={activeAccount}
          onLogout={handleLogout} onNetworkChange={handleNetworkChange}
          onRenameAccount={handleRenameAccount}
        />}
      </div>

      {/* Bottom Nav */}
      <div className="fixed bottom-0 left-0 right-0 z-20 glass border-t border-[rgba(0,210,180,0.08)] px-6 py-3">
        <div className="flex justify-around max-w-sm mx-auto">
          {tabs.map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className="flex flex-col items-center gap-1 py-1">
              <Icon name={tab.icon} size={20}
                className={`transition-colors ${activeTab === tab.id ? 'text-[#00D2B4]' : 'text-[#2A5550]'}`} />
              <span className={`text-xs transition-colors ${activeTab === tab.id ? 'text-[#00D2B4]' : 'text-[#2A5550]'}`}>
                {tab.label}
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
