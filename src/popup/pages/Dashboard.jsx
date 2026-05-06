import { useState, useEffect } from 'react'
import browser from 'webextension-polyfill'
import { getEntityDetails } from '@/lib/gateway'
import { getXRDPrice } from '@/lib/price'
import { copyToClipboard } from '@/lib/clipboard'
import Icon from '@/components/ui/Icon'

const XRD_MAINNET = 'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd'

export default function Dashboard({ session, onLock }) {
  const [balance, setBalance] = useState(null)
  const [usdPrice, setUsdPrice] = useState(0)
  const [tokens, setTokens] = useState([])
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [activeTab, setActiveTab] = useState('assets')

  const network = session?.network || 'mainnet'
  const address = session?.address || ''
  const XRD = network === 'mainnet' ? XRD_MAINNET : 'resource_tdx_2_1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxtfd2jc'

  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      try {
        const [entity, price] = await Promise.all([
          getEntityDetails(address, network),
          getXRDPrice(),
        ])
        const fungibles = entity?.fungible_resources?.items || []
        const xrdItem = fungibles.find(f => f.resource_address === XRD)
        const xrdBal = parseFloat(xrdItem?.vaults?.items?.[0]?.amount || 0)
        setBalance(xrdBal)
        setUsdPrice(price || 0)
        setTokens(fungibles.map(f => ({
          resource_address: f.resource_address,
          amount: f.vaults?.items?.[0]?.amount || '0',
        })))
      } catch { setBalance(0) }
      setLoading(false)
    }
    if (address) fetchData()
  }, [address, network])

  async function copy() {
    await copyToClipboard(address)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const shortAddr = address ? `${address.slice(0, 16)}...${address.slice(-6)}` : ''

  return (
    <div className="min-h-screen bg-[#040E0E] flex flex-col">
      {/* Header */}
      <div className="px-4 pt-8 pb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg width="24" height="24" viewBox="0 0 200 200" fill="none">
            <polygon points="100,20 180,150 20,150" stroke="#00D2B4" strokeWidth="10" strokeLinejoin="round" fill="none"/>
            <circle cx="100" cy="120" r="16" fill="#00D2B4"/>
          </svg>
          <span className="text-[#E8F8F6] font-bold text-sm">Radiant</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-mono ${network === 'mainnet' ? 'text-[#00D2B4] bg-[rgba(0,210,180,0.1)]' : 'text-yellow-400 bg-yellow-900/20'}`}>
            {network}
          </span>
        </div>
        <button onClick={onLock} className="w-8 h-8 glass rounded-lg flex items-center justify-center text-[#3A7A72]">
          <Icon name="lock" size={14} />
        </button>
      </div>

      {/* Balance Card */}
      <div className="px-4 mb-4">
        <div className="glass-teal rounded-2xl p-5 text-center">
          {loading ? (
            <div className="flex justify-center py-2">
              <div className="w-6 h-6 rounded-full border-2 border-[#00D2B4] border-t-transparent animate-spin" />
            </div>
          ) : (
            <>
              <p className="text-[#3A7A72] text-xs font-mono mb-1">TOTAL BALANCE</p>
              <p className="text-3xl font-black text-[#E8F8F6]">
                {(balance || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })}
                <span className="text-[#00D2B4] text-lg ml-2">XRD</span>
              </p>
              {usdPrice > 0 && (
                <p className="text-[#3A7A72] text-xs font-mono mt-1">
                  ≈ ${((balance || 0) * usdPrice).toFixed(2)} USD
                </p>
              )}
            </>
          )}
          <button onClick={copy}
            className="mt-3 flex items-center gap-1.5 mx-auto text-[#3A7A72] text-xs font-mono hover:text-[#00D2B4] transition-colors">
            <Icon name={copied ? 'check' : 'copy'} size={12} />
            {copied ? 'Copied!' : shortAddr}
          </button>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="px-4 grid grid-cols-3 gap-2 mb-4">
        {[
          { label: 'Send', icon: 'send', action: () => {} },
          { label: 'Receive', icon: 'download', action: () => {} },
          { label: 'Swap', icon: 'refresh', action: () => {} },
        ].map(btn => (
          <button key={btn.label} onClick={btn.action}
            className="glass rounded-xl py-3 flex flex-col items-center gap-1.5 active:scale-95 transition-all">
            <Icon name={btn.icon} size={18} className="text-[#00D2B4]" />
            <span className="text-[#E8F8F6] text-xs font-semibold">{btn.label}</span>
          </button>
        ))}
      </div>

      {/* Tokens */}
      <div className="px-4 flex-1">
        <p className="text-[#2A5550] text-xs font-mono tracking-widest mb-3">ASSETS ({tokens.length})</p>
        {loading ? (
          <div className="flex flex-col gap-2">
            {[1,2,3].map(i => <div key={i} className="h-14 bg-[#071414] rounded-xl animate-pulse" />)}
          </div>
        ) : tokens.length === 0 ? (
          <div className="glass rounded-xl p-6 text-center">
            <p className="text-[#3A7A72] text-sm">No assets found</p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {tokens.slice(0, 10).map((t, i) => (
              <div key={i} className="glass rounded-xl px-4 py-3 flex items-center justify-between">
                <div className="w-8 h-8 rounded-lg glass-teal flex items-center justify-center shrink-0">
                  <span className="text-[#00D2B4] text-xs font-bold">
                    {t.resource_address === XRD ? 'XRD' : t.resource_address.slice(9,12).toUpperCase()}
                  </span>
                </div>
                <div className="flex-1 ml-3">
                  <p className="text-[#E8F8F6] text-sm font-semibold">
                    {t.resource_address === XRD ? 'Radix' : t.resource_address.slice(0,20)+'...'}
                  </p>
                </div>
                <p className="text-[#E8F8F6] text-sm font-bold">
                  {parseFloat(t.amount).toLocaleString('en-US', { maximumFractionDigits: 4 })}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 flex justify-center">
        <a href="https://wallet.radixradiant.xyz" target="_blank" rel="noopener"
          className="text-[#1A4040] text-xs font-mono hover:text-[#3A7A72] transition-colors flex items-center gap-1">
          <Icon name="external" size={10} />
          Open full wallet
        </a>
      </div>
    </div>
  )
}
