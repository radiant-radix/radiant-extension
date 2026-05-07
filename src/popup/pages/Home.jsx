import { useState, useEffect } from 'react'
import { requestNotificationPermission, sendNotification } from '../lib/notifications'
import { getResourceMetadata } from '../lib/metadata'
import { getAstrlTokens } from '../lib/astrolescent'
import Icon from '../components/ui/Icon'

export default function Home({
  wallet, balance, txHistory, loadingBalance, loadingTx,
  usdPrice, network, currentAddress, allTokens,
  onSend, onReceive, onSwap, onRefresh, copied, onCopy
}) {
  const [txSearch, setTxSearch] = useState('')
  const [notifEnabled, setNotifEnabled] = useState(
    typeof Notification !== 'undefined' && Notification?.permission === 'granted'
  )
  const [showSearch, setShowSearch] = useState(false)
  const [astrlTokenMap, setAstrlTokenMap] = useState({})

  useEffect(() => {
    const STATIC_MAP = {
      'resource_rdx1t4zds4xaephatvk5f4f58jt6x474t8n2eylaawyjgg3r6rhkxyr4d7': { symbol: 'RDT' },
      'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd': { symbol: 'XRD' },
    }
    getAstrlTokens().then(list => {
      const map = { ...STATIC_MAP }
      list.forEach(t => { map[t.address] = t })
      setAstrlTokenMap(map)
    })
  }, [])

  async function enableNotifications() {
    const ok = await requestNotificationPermission()
    setNotifEnabled(ok)
    if (ok) sendNotification('Radiant Wallet', 'Notifications enabled!')
  }

  function formatAmount(amount) {
    if (amount === null) return '...'
    return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  }

  function formatUSD(xrd) {
    if (!xrd || !usdPrice) return null
    return (xrd * usdPrice).toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 })
  }

  function formatDate(timestamp) {
    if (!timestamp) return ''
    return new Date(timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  }

  function getTxType(tx) {
    const changes = tx.balance_changes?.fungible_balance_changes || []
    const mine = changes.filter(c => c.entity_address === currentAddress)
    if (!mine.length) return { type: 'contract', amount: null, symbol: '' }
    // Pick largest absolute change
    const main = mine.reduce((a, b) =>
      Math.abs(parseFloat(a.balance_change)) >= Math.abs(parseFloat(b.balance_change)) ? a : b
    )
    const amt = parseFloat(main.balance_change)
    const XRD = 'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd'
    let symbol = 'XRD'
    if (main.resource_address !== XRD) {
      const found = astrlTokenMap[main.resource_address]
      if (found?.symbol) {
        symbol = found.symbol
      } else {
        // Fetch from gateway async and cache
        getResourceMetadata(main.resource_address, network).then(meta => {
          if (meta?.symbol) {
            setAstrlTokenMap(prev => ({ ...prev, [main.resource_address]: { symbol: meta.symbol } }))
          }
        })
        symbol = astrlTokenMap[main.resource_address]?.symbol || main.resource_address.slice(9, 13).toUpperCase()
      }
    }
    return { type: amt >= 0 ? 'received' : 'sent', amount: Math.abs(amt), symbol }
  }

  const shortAddr = currentAddress ? currentAddress.slice(0, 16) + '...' + currentAddress.slice(-6) : ''

  const filteredTx = txHistory.filter(tx => {
    if (!txSearch) return true
    const s = txSearch.toLowerCase()
    return tx.intent_hash?.toLowerCase().includes(s) ||
      tx.transaction_status?.toLowerCase().includes(s) ||
      tx.balance_changes?.fungible_balance_changes?.some(c =>
        c.entity_address?.toLowerCase().includes(s)
      )
  })

  return (
    <div className="px-6 flex flex-col gap-4">
      {/* Balance Card */}
      <div className="glass-teal rounded-3xl p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-[radial-gradient(circle,rgba(0,210,180,0.08)_0%,transparent_70%)]" />
        <p className="text-[#3A7A72] text-xs font-mono mb-2 tracking-widest">TOTAL BALANCE</p>
        <div className="flex items-end gap-2 mb-1">
          {loadingBalance ? (
            <div className="h-10 w-32 bg-[#0D2020] rounded-xl animate-pulse" />
          ) : (
            <>
              <span className="text-4xl font-black text-[#E8F8F6]">{formatAmount(balance)}</span>
              <span className="text-xl font-bold text-[#00D2B4] mb-1">XRD</span>
            </>
          )}
        </div>
        {!loadingBalance && balance !== null && usdPrice > 0 && (
          <p className="text-[#3A7A72] text-sm font-mono mb-1">{formatUSD(balance)}</p>
        )}
        {usdPrice > 0 && (
          <p className="text-[#2A5550] text-xs font-mono mb-3">1 XRD = ${usdPrice.toFixed(4)}</p>
        )}
        <button onClick={onCopy} className="flex items-center gap-2">
          <span className="text-[#2A5550] text-xs font-mono">{shortAddr}</span>
          <Icon name={copied ? 'check' : 'copy'} size={12} className="text-[#00D2B4]" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: 'send', label: 'Send', action: onSend },
          { icon: 'receive', label: 'Receive', action: onReceive },
          { icon: 'refresh', label: 'Swap', action: onSwap },
        ].map(a => (
          <button key={a.label} onClick={a.action}
            className="glass rounded-2xl py-4 flex flex-col items-center gap-2 teal-border transition-all active:scale-95">
            <Icon name={a.icon} size={22} className="text-[#00D2B4]" />
            <span className="text-[#7ABFB8] text-xs font-semibold">{a.label}</span>
          </button>
        ))}
      </div>

      {/* Notification banner */}
      {!notifEnabled && (
        <button onClick={enableNotifications}
          className="glass rounded-2xl px-4 py-3 flex items-center gap-3 w-full text-left teal-border">
          <Icon name="bell" size={18} className="text-[#00D2B4] shrink-0" />
          <div className="flex-1">
            <p className="text-[#E8F8F6] text-sm font-semibold">Enable Notifications</p>
            <p className="text-[#3A7A72] text-xs">Get alerted on incoming transactions</p>
          </div>
          <Icon name="chevronRight" size={16} className="text-[#3A7A72]" />
        </button>
      )}

      {/* TX History */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-[#2A5550] text-xs font-mono tracking-widest uppercase">
            Transactions {txHistory.length > 0 && `(${txHistory.length})`}
          </p>
          <div className="flex gap-2">
            <button onClick={() => setShowSearch(s => !s)}
              className="text-[#2A5550]"><Icon name="search" size={14} /></button>
            <button onClick={onRefresh}
              className="text-[#2A5550]"><Icon name="refresh" size={14} /></button>
          </div>
        </div>

        {showSearch && (
          <div className="glass rounded-xl px-4 py-2.5 flex items-center gap-2 mb-3">
            <Icon name="search" size={14} className="text-[#2A5550]" />
            <input type="text" placeholder="Search by hash, address..."
              value={txSearch} onChange={e => setTxSearch(e.target.value)}
              className="flex-1 bg-transparent text-[#E8F8F6] text-sm outline-none placeholder-[#2A5550]" />
            {txSearch && <button onClick={() => setTxSearch('')} className="text-[#2A5550]">
              <Icon name="close" size={12} />
            </button>}
          </div>
        )}

        {loadingTx ? (
          <div className="flex flex-col gap-2">
            {[1,2,3].map(i => <div key={i} className="h-16 bg-[#071414] rounded-2xl animate-pulse" />)}
          </div>
        ) : filteredTx.length === 0 ? (
          <div className="glass rounded-2xl p-6 flex flex-col items-center text-center">
            <Icon name="activity" size={28} className="text-[#1A4040] mb-2" />
            <p className="text-[#3A7A72] text-sm">{txSearch ? 'No matching transactions' : 'No transactions yet'}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {filteredTx.map((tx, i) => {
              const { type, amount, symbol } = getTxType(tx)
              return (
                <div key={i} className="glass rounded-2xl px-4 py-3 flex items-center gap-3 cursor-pointer active:scale-[0.98] transition-all"
                  onClick={() => window.dispatchEvent(new CustomEvent('selectTx', { detail: tx }))}>
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0
                    ${type === 'received' ? 'bg-[rgba(0,210,180,0.1)]' : type === 'sent' ? 'bg-[rgba(255,100,100,0.1)]' : 'bg-[rgba(255,255,255,0.05)]'}`}>
                    <Icon
                      name={type === 'received' ? 'receive' : type === 'sent' ? 'send' : 'activity'}
                      size={16}
                      className={type === 'received' ? 'text-[#00D2B4]' : type === 'sent' ? 'text-red-400' : 'text-[#3A7A72]'}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[#E8F8F6] text-sm font-semibold capitalize">{type}</p>
                    <p className="text-[#3A7A72] text-xs font-mono">{formatDate(tx.confirmed_at)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    {amount !== null && (
                      <p className={`text-sm font-bold ${type === 'received' ? 'text-[#00D2B4]' : 'text-red-400'}`}>
                        {type === 'received' ? '+' : '-'}{amount.toFixed(2)} {symbol}
                      </p>
                    )}
                    <p className="text-[#2A5550] text-xs font-mono">
                      {tx.transaction_status === 'CommittedSuccess' ? '✓' : '✗'}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
