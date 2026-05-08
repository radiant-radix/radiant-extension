import { useState, useEffect } from 'react'
import { loadWallet, decryptWallet } from '../../lib/wallet'
import { buildAndSignTransferTx, submitTx, getTxStatus, estimateFee } from '../../lib/transaction'
import { copyToClipboard } from '../../lib/clipboard'
import { getContacts } from '../../lib/addressBook'
import QRScanner from './QRScanner'

const XRD_MAINNET = 'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd'
const XRD_STOKENET = 'resource_tdx_2_1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxtfd2jc'

export default function Send({ wallet, network, token, onClose, onSuccess }) {
  const [toAddress, setToAddress] = useState('')
  const [amount, setAmount] = useState('')
  const [password, setPassword] = useState('')
  const [step, setStep] = useState(0)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [txResult, setTxResult] = useState(null)
  const [statusMsg, setStatusMsg] = useState('')
  const [estimatedFee, setEstimatedFee] = useState(null)
  const [estimatingFee, setEstimatingFee] = useState(false)
  const [showManifest, setShowManifest] = useState(false)
  const [manifest, setManifest] = useState('')
  const [copiedHash, setCopiedHash] = useState(false)
  const [contacts, setContacts] = useState([])
  const [showContacts, setShowContacts] = useState(false)
  const [searchContact, setSearchContact] = useState('')
  const [showScanner, setShowScanner] = useState(false)

  const XRD = network === 'mainnet' ? XRD_MAINNET : XRD_STOKENET
  const selectedResource = token?.resource_address || XRD
  const isXRD = selectedResource === XRD
  const tokenLabel = isXRD ? 'XRD' : selectedResource.slice(0, 12) + '...'

  useEffect(() => { setContacts(getContacts()) }, [])

  const filteredContacts = contacts.filter(c =>
    c.name.toLowerCase().includes(searchContact.toLowerCase()) ||
    c.address.toLowerCase().includes(searchContact.toLowerCase())
  )

  async function handleReview() {
    setError('')
    const validPrefixes = ['account_rdx', 'account_tdx', 'component_rdx', 'component_tdx']
    if (!validPrefixes.some(p => toAddress.startsWith(p))) { setError('Invalid Radix address'); return }
    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) { setError('Enter a valid amount'); return }
    setStep(1)
    setEstimatingFee(true)
    const fee = await estimateFee({ fromAddress: wallet.address, toAddress, resourceAddress: selectedResource, amount, network })
    setEstimatedFee(fee)
    setEstimatingFee(false)
    const amountStr = parseFloat(amount).toFixed(8)
    setManifest(`CALL_METHOD
    Address("${wallet.address}")
    "lock_fee"
    Decimal("2");
CALL_METHOD
    Address("${wallet.address}")
    "withdraw"
    Address("${selectedResource}")
    Decimal("${amountStr}");
TAKE_FROM_WORKTOP
    Address("${selectedResource}")
    Decimal("${amountStr}")
    Bucket("xfer");
CALL_METHOD
    Address("${toAddress}")
    "try_deposit_or_abort"
    Bucket("xfer")
    Enum<0u8>();`)
  }

  async function handleSend() {
    setError('')
    if (!password) { setError('Enter your password'); return }
    setLoading(true)
    setStatusMsg('Decrypting wallet...')
    try {
      const encrypted = await loadWallet()
      const decrypted = await decryptWallet(encrypted, password)
      if (!decrypted) { setError('Wrong password'); setLoading(false); return }
      setStatusMsg('Building & signing transaction...')
      const { compiledHex, intentHash } = await buildAndSignTransferTx({
        privateKeyHex: decrypted.privateKey,
        fromAddress: wallet.address,
        toAddress,
        resourceAddress: selectedResource,
        amount: parseFloat(amount).toString(),
        network,
      })
      setStatusMsg('Submitting to network...')
      const result = await submitTx(compiledHex, network)
      if (result?.error_message) { setError(result.error_message); setLoading(false); return }
      const txHash = result?.transaction_intent_hash || intentHash
      setStatusMsg('Waiting for confirmation...')
      let attempts = 0
      const poll = setInterval(async () => {
        attempts++
        try {
          const status = await getTxStatus(txHash, network)
          const s = status?.status || status?.intent_status
          if (s === 'CommittedSuccess') {
            clearInterval(poll)
            setTxResult({ hash: txHash, status: 'CommittedSuccess' })
            setStep(2); setLoading(false); onSuccess?.()
          } else if (s === 'CommittedFailure' || s === 'Rejected') {
            clearInterval(poll)
            setError('Transaction failed: ' + (status?.error_message || s))
            setLoading(false)
          } else if (attempts > 15) {
            clearInterval(poll)
            setTxResult({ hash: txHash, status: 'Submitted' })
            setStep(2); setLoading(false); onSuccess?.()
          }
        } catch {}
      }, 2000)
    } catch (e) {
      setError('Transaction failed: ' + (e?.message || 'Unknown error'))
      setLoading(false)
    }
  }

  if (showScanner) {
    return <QRScanner onScan={(addr) => { setToAddress(addr); setShowScanner(false) }} onClose={() => setShowScanner(false)} />
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={!loading ? onClose : undefined}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative z-10 w-full max-w-sm bg-[#071414] rounded-t-3xl p-6 border-t border-[rgba(0,210,180,0.15)] max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>
        <div className="w-10 h-1 bg-[#1A4040] rounded-full mx-auto mb-6" />

        {step === 0 && (
          <>
            <h3 className="font-display text-xl font-700 text-[#E8F8F6] text-center mb-6">Send {tokenLabel}</h3>
            <div className="flex flex-col gap-3 mb-4">
              {token && !isXRD && (
                <div className="glass-teal rounded-xl px-4 py-2 flex items-center gap-2">
                  <span className="text-[#00D2B4] text-xs font-mono">TOKEN</span>
                  <span className="text-[#E8F8F6] text-xs font-mono truncate flex-1">{selectedResource.slice(0,30)}...</span>
                </div>
              )}
              <div className="glass rounded-xl px-4 py-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[#3A7A72] text-xs font-mono">TO ADDRESS</p>
                  <div className="flex gap-3">
                    {contacts.length > 0 && (
                      <button onClick={() => setShowContacts(s => !s)} className="text-[#00D2B4] text-xs font-mono">
                        {showContacts ? 'hide' : '📋 contacts'}
                      </button>
                    )}
                    <button onClick={() => setShowScanner(true)} className="text-[#00D2B4] text-xs font-mono">📷 scan</button>
                  </div>
                </div>
                <input type="text" placeholder="account_rdx1..."
                  value={toAddress} onChange={e => setToAddress(e.target.value)}
                  className="w-full bg-transparent text-[#E8F8F6] text-sm font-mono outline-none placeholder-[#2A5550]"
                  autoCapitalize="none" autoCorrect="off" />
              </div>

              {showContacts && contacts.length > 0 && (
                <div className="glass rounded-xl overflow-hidden">
                  <div className="px-3 py-2 border-b border-[rgba(0,210,180,0.08)]">
                    <input type="text" placeholder="Search contacts..."
                      value={searchContact} onChange={e => setSearchContact(e.target.value)}
                      className="w-full bg-transparent text-[#E8F8F6] text-xs outline-none placeholder-[#2A5550]" />
                  </div>
                  <div className="max-h-40 overflow-y-auto">
                    {filteredContacts.map(c => (
                      <button key={c.id} onClick={() => { setToAddress(c.address); setShowContacts(false) }}
                        className="w-full px-3 py-2.5 flex items-center gap-3 text-left hover:bg-[rgba(0,210,180,0.05)]">
                        <div className="w-8 h-8 rounded-lg glass-teal flex items-center justify-center text-xs font-display font-700 text-[#00D2B4] shrink-0">
                          {c.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[#E8F8F6] text-sm font-display font-600">{c.name}</p>
                          <p className="text-[#3A7A72] text-xs font-mono truncate">{c.address.slice(0,22)}...</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="glass rounded-xl px-4 py-3">
                <p className="text-[#3A7A72] text-xs font-mono mb-1">AMOUNT ({tokenLabel})</p>
                <input type="number" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)}
                  className="w-full bg-transparent text-[#E8F8F6] text-2xl font-display font-700 outline-none placeholder-[#2A5550]" />
              </div>
            </div>
            {error && <p className="text-red-400 text-sm text-center font-mono mb-3">{error}</p>}
            <button onClick={handleReview} className="btn-teal w-full py-4 rounded-2xl text-base">Review Transaction →</button>
          </>
        )}

        {step === 1 && (
          <>
            <h3 className="font-display text-xl font-700 text-[#E8F8F6] text-center mb-4">Confirm</h3>
            <div className="glass-teal rounded-2xl p-4 mb-4 flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <span className="text-[#3A7A72] text-xs font-mono">SENDING</span>
                <span className="text-[#00D2B4] font-display font-700 text-lg">{amount} {tokenLabel}</span>
              </div>
              <div className="border-t border-[rgba(0,210,180,0.1)] pt-3">
                <span className="text-[#3A7A72] text-xs font-mono block mb-1">TO</span>
                {contacts.find(c => c.address === toAddress) && (
                  <span className="text-[#00D2B4] text-xs font-display font-600 block mb-1">
                    {contacts.find(c => c.address === toAddress)?.name}
                  </span>
                )}
                <span className="text-[#E8F8F6] text-xs font-mono break-all">{toAddress}</span>
              </div>
              <div className="border-t border-[rgba(0,210,180,0.1)] pt-3 flex justify-between items-center">
                <span className="text-[#3A7A72] text-xs font-mono">NETWORK FEE</span>
                {estimatingFee ? (
                  <div className="h-4 w-20 bg-[#0D2020] rounded animate-pulse" />
                ) : (
                  <span className="text-[#7ABFB8] text-xs font-mono">~{estimatedFee || '0.25'} XRD</span>
                )}
              </div>
              <div className="border-t border-[rgba(0,210,180,0.1)] pt-3 flex justify-between">
                <span className="text-[#3A7A72] text-xs font-mono">NETWORK</span>
                <span className={`text-xs font-mono ${network === 'mainnet' ? 'text-[#00D2B4]' : 'text-yellow-400'}`}>{network}</span>
              </div>
            </div>

            <button onClick={() => setShowManifest(s => !s)}
              className="w-full text-left glass rounded-xl px-4 py-2.5 mb-3 flex items-center justify-between">
              <span className="text-[#3A7A72] text-xs font-mono">TRANSACTION MANIFEST</span>
              <span className="text-[#00D2B4] text-xs font-mono">{showManifest ? '▲ hide' : '▼ show'}</span>
            </button>
            {showManifest && (
              <div className="glass rounded-xl p-3 mb-3 max-h-40 overflow-y-auto">
                <pre className="text-[#7ABFB8] text-xs font-mono leading-relaxed whitespace-pre-wrap break-all">{manifest}</pre>
              </div>
            )}

            <div className="glass rounded-xl px-4 py-3 mb-4">
              <p className="text-[#3A7A72] text-xs font-mono mb-1">PASSWORD</p>
              <input type="password" placeholder="Enter password to sign"
                value={password} onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleSend()}
                className="w-full bg-transparent text-[#E8F8F6] text-sm outline-none placeholder-[#2A5550]" />
            </div>

            {loading && (
              <div className="glass-teal rounded-xl px-4 py-3 mb-4 flex items-center gap-3">
                <div className="w-4 h-4 rounded-full border-2 border-[#00D2B4] border-t-transparent animate-spin shrink-0" />
                <p className="text-[#00D2B4] text-sm font-mono">{statusMsg}</p>
              </div>
            )}
            {error && <p className="text-red-400 text-sm text-center font-mono mb-3">{error}</p>}

            <div className="flex gap-3">
              <button onClick={() => setStep(0)} disabled={loading} className="btn-ghost flex-1 py-4 rounded-2xl text-sm disabled:opacity-30">← Back</button>
              <button onClick={handleSend} disabled={loading} className="btn-teal flex-1 py-4 rounded-2xl text-sm disabled:opacity-50">
                {loading ? 'Signing...' : '✓ Sign & Send'}
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <div className="flex flex-col items-center text-center gap-4 py-4">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center animate-glow-pulse ${txResult?.status === 'CommittedSuccess' ? 'glass-teal' : 'glass'}`}>
              <span className="text-2xl">{txResult?.status === 'CommittedSuccess' ? '✓' : '⏳'}</span>
            </div>
            <h3 className="font-display text-xl font-700 text-[#E8F8F6]">
              {txResult?.status === 'CommittedSuccess' ? 'Transaction Confirmed! 🎉' : 'Transaction Submitted!'}
            </h3>
            <p className="text-[#3A7A72] text-sm">
              {txResult?.status === 'CommittedSuccess' ? `Successfully sent ${amount} ${tokenLabel}` : 'Your transaction is being processed.'}
            </p>
            {txResult?.hash && (
              <div className="glass rounded-xl px-4 py-3 w-full text-left">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[#2A5550] text-xs font-mono">TX HASH</p>
                  <button onClick={async () => {
                    await copyToClipboard(txResult.hash)
                    setCopiedHash(true)
                    setTimeout(() => setCopiedHash(false), 2000)
                  }} className="text-[#00D2B4] text-xs font-mono">{copiedHash ? '✓ copied' : '⧉ copy'}</button>
                </div>
                <p className="text-[#E8F8F6] text-xs font-mono break-all leading-relaxed">{txResult.hash}</p>
              </div>
            )}
            <div className={`rounded-xl px-4 py-2 w-full text-center ${txResult?.status === 'CommittedSuccess' ? 'glass-teal' : 'glass'}`}>
              <p className={`text-xs font-mono ${txResult?.status === 'CommittedSuccess' ? 'text-[#00D2B4]' : 'text-[#7ABFB8]'}`}>
                {txResult?.status || 'Submitted'}
              </p>
            </div>
            {txResult?.hash && (
              <button onClick={() => window.open(`https://${network === 'stokenet' ? 'stokenet-' : ''}dashboard.radixdlt.com/transaction/${txResult.hash}`, '_blank')}
                className="btn-ghost w-full py-3 rounded-xl text-sm">🔍 View on Radix Dashboard</button>
            )}
            <button onClick={onClose} className="btn-teal w-full py-4 rounded-2xl text-base">Done ✓</button>
          </div>
        )}
      </div>
    </div>
  )
}
