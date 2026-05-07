import { useState } from 'react'
import { getGatewayUrl } from '../../lib/gateway'
import { copyToClipboard } from '../../lib/clipboard'
import { loadWallet, decryptWallet } from '../../lib/wallet'
import { buildAndSignTransferTx, submitTx, getTxStatus } from '../../lib/transaction'

const SAMPLE_REQUESTS = [
  { label: 'Account Details', method: 'POST', endpoint: '/state/entity/details',
    body: (addr) => JSON.stringify({ addresses: [addr], opt_ins: { explicit_metadata: ['name','symbol','description'] } }, null, 2) },
  { label: 'TX History', method: 'POST', endpoint: '/stream/transactions',
    body: (addr) => JSON.stringify({ affected_global_entities_filter: [addr], limit_per_page: 5, opt_ins: { balance_changes: true } }, null, 2) },
  { label: 'TX Status', method: 'POST', endpoint: '/transaction/status',
    body: () => JSON.stringify({ intent_hash: 'txid_rdx1...' }, null, 2) },
  { label: 'Gateway Status', method: 'POST', endpoint: '/status/gateway-status',
    body: () => JSON.stringify({}, null, 2) },
  { label: 'Validators', method: 'POST', endpoint: '/state/validators/list',
    body: () => JSON.stringify({ at_ledger_state: null }, null, 2) },
  { label: 'Token Metadata', method: 'POST', endpoint: '/state/entity/details',
    body: () => JSON.stringify({ addresses: ['resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd'], opt_ins: { explicit_metadata: ['name','symbol','description','icon_url'] } }, null, 2) },
  { label: 'NFT IDs', method: 'POST', endpoint: '/state/non-fungible/ids',
    body: () => JSON.stringify({ resource_address: 'resource_rdx1...' }, null, 2) },
  { label: 'Preview TX', method: 'POST', endpoint: '/transaction/preview',
    body: (addr) => JSON.stringify({
      manifest: `CALL_METHOD Address("${addr}") "lock_fee" Decimal("2");`,
      blobs_hex: [], start_epoch_inclusive: 0, end_epoch_exclusive: 1,
      notary_public_key: { key_type: 'EddsaEd25519', key_hex: '0'.repeat(64) },
      notary_is_signatory: true, tip_percentage: 0, nonce: 1, signer_public_keys: [],
      flags: { use_free_credit: true, assume_all_signature_proofs: true, skip_epoch_check: true },
    }, null, 2) },
]

const MANIFEST_TEMPLATES = [
  {
    label: 'Transfer XRD',
    fields: ['to', 'amount'],
    build: (from, { to, amount }) => `CALL_METHOD
    Address("${from}")
    "lock_fee"
    Decimal("2");
CALL_METHOD
    Address("${from}")
    "withdraw"
    Address("resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd")
    Decimal("${amount || '1'}");
TAKE_FROM_WORKTOP
    Address("resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd")
    Decimal("${amount || '1'}")
    Bucket("xfer");
CALL_METHOD
    Address("${to || 'account_rdx1...'}")
    "try_deposit_or_abort"
    Bucket("xfer")
    Enum<0u8>();`,
  },
  {
    label: 'Transfer Token',
    fields: ['to', 'amount', 'resource'],
    build: (from, { to, amount, resource }) => `CALL_METHOD
    Address("${from}")
    "lock_fee"
    Decimal("2");
CALL_METHOD
    Address("${from}")
    "withdraw"
    Address("${resource || 'resource_rdx1...'}")
    Decimal("${amount || '1'}");
TAKE_FROM_WORKTOP
    Address("${resource || 'resource_rdx1...'}")
    Decimal("${amount || '1'}")
    Bucket("xfer");
CALL_METHOD
    Address("${to || 'account_rdx1...'}")
    "try_deposit_or_abort"
    Bucket("xfer")
    Enum<0u8>();`,
  },
  {
    label: 'Lock Fee Only',
    fields: ['fee'],
    build: (from, { fee }) => `CALL_METHOD
    Address("${from}")
    "lock_fee"
    Decimal("${fee || '2'}");`,
  },
  {
    label: 'Custom',
    fields: [],
    build: (from) => `# Write your manifest here\nCALL_METHOD\n    Address("${from}")\n    "lock_fee"\n    Decimal("2");`,
  },
]

export default function DevPage({ wallet, network }) {
  const [activeSection, setActiveSection] = useState('playground')
  const [selectedReq, setSelectedReq] = useState(0)
  const [body, setBody] = useState(SAMPLE_REQUESTS[0].body(wallet.address))
  const [response, setResponse] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState('')
  // Manifest
  const [selectedTemplate, setSelectedTemplate] = useState(0)
  const [fields, setFields] = useState({})
  const [builtManifest, setBuiltManifest] = useState('')
  const [customManifest, setCustomManifest] = useState('')
  const [signing, setSigning] = useState(false)
  const [signPassword, setSignPassword] = useState('')
  const [signError, setSignError] = useState('')
  const [signResult, setSignResult] = useState(null)
  const [signStatus, setSignStatus] = useState('')
  // Inspector
  const [inspectAddr, setInspectAddr] = useState('')
  const [inspectResult, setInspectResult] = useState('')
  const [inspecting, setInspecting] = useState(false)

  async function sendRequest() {
    setLoading(true)
    setResponse('')
    try {
      const req = SAMPLE_REQUESTS[selectedReq]
      const res = await fetch(getGatewayUrl(network) + req.endpoint, {
        method: req.method,
        headers: { 'Content-Type': 'application/json' },
        body,
      })
      setResponse(JSON.stringify(await res.json(), null, 2))
    } catch (e) { setResponse('Error: ' + e.message) }
    setLoading(false)
  }

  function buildManifest() {
    const template = MANIFEST_TEMPLATES[selectedTemplate]
    const result = template.build(wallet.address, fields)
    setBuiltManifest(result)
    setCustomManifest(result)
  }

  async function signAndSend() {
    if (!signPassword) { setSignError('Enter password'); return }
    setSigning(true)
    setSignError('')
    setSignResult(null)
    setSignStatus('Decrypting...')
    try {
      const encrypted = loadWallet()
      const decrypted = decryptWallet(encrypted, signPassword)
      if (!decrypted) { setSignError('Wrong password'); setSigning(false); return }

      setSignStatus('Building TX...')
      // Use custom manifest via raw signing
      const { RadixEngineToolkit, PrivateKey, NetworkId } = await import('@radixdlt/radix-engine-toolkit')
      const networkId = network === 'mainnet' ? NetworkId.Mainnet : NetworkId.Stokenet
      const privateKeyBytes = Uint8Array.from(Buffer.from(decrypted.privateKey, 'hex'))
      const privateKey = new PrivateKey.Ed25519(privateKeyBytes)

      const epochRes = await fetch(getGatewayUrl(network) + '/status/gateway-status', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}),
      })
      const epochData = await epochRes.json()
      const currentEpoch = epochData?.ledger_state?.epoch || 0

      const intent = {
        header: {
          networkId, startEpochInclusive: currentEpoch, endEpochExclusive: currentEpoch + 10,
          nonce: Math.floor(Math.random() * 0xFFFFFFFF),
          notaryPublicKey: privateKey.publicKey(), notaryIsSignatory: true, tipPercentage: 0,
        },
        manifest: { instructions: { kind: 'String', value: customManifest }, blobs: [] },
        message: { kind: 'None' },
      }

      const intentHash = await RadixEngineToolkit.Intent.intentHash(intent)
      const sig = privateKey.signToSignatureWithPublicKey(intentHash.hash)
      const signedIntent = { intent, intentSignatures: [sig] }
      const signedHash = await RadixEngineToolkit.SignedIntent.signedIntentHash(signedIntent)
      const notarySig = privateKey.signToSignature(signedHash.hash)
      const notarized = { signedIntent, notarySignature: notarySig }
      const compiled = await RadixEngineToolkit.NotarizedTransaction.compile(notarized)
      const compiledHex = Buffer.from(compiled).toString('hex')

      setSignStatus('Submitting...')
      const result = await submitTx(compiledHex, network)
      if (result?.error_message) { setSignError(result.error_message); setSigning(false); return }

      const txHash = result?.transaction_intent_hash || intentHash.id
      setSignStatus('Confirming...')
      let attempts = 0
      const poll = setInterval(async () => {
        attempts++
        const status = await getTxStatus(txHash, network)
        const s = status?.status || status?.intent_status
        if (s === 'CommittedSuccess' || s === 'CommittedFailure' || attempts > 15) {
          clearInterval(poll)
          setSignResult({ hash: txHash, status: s || 'Submitted' })
          setSigning(false)
          setSignStatus('')
        }
      }, 2000)
    } catch (e) {
      setSignError(e?.message || 'Unknown error')
      setSigning(false)
    }
  }

  async function inspectAddress() {
    if (!inspectAddr.trim()) return
    setInspecting(true)
    setInspectResult('')
    try {
      const res = await fetch(getGatewayUrl(network) + '/state/entity/details', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          addresses: [inspectAddr.trim()],
          opt_ins: { explicit_metadata: ['name','symbol','description','icon_url','tags'], ancestor_identities: true },
        }),
      })
      setInspectResult(JSON.stringify(await res.json(), null, 2))
    } catch (e) { setInspectResult('Error: ' + e.message) }
    setInspecting(false)
  }

  async function cp(text, key) {
    await copyToClipboard(text)
    setCopied(key)
    setTimeout(() => setCopied(''), 2000)
  }

  const sections = [
    { id: 'playground', label: 'API Playground' },
    { id: 'manifest', label: 'Manifest' },
    { id: 'inspector', label: 'Inspector' },
    { id: 'info', label: 'Wallet Info' },
  ]

  return (
    <div className="px-6 flex flex-col gap-4">
      <div className="pt-2">
        <h2 className="font-display text-2xl font-700 text-[#E8F8F6] mb-1">Developer Tools</h2>
        <p className="text-[#3A7A72] text-xs font-mono">Gateway API · {network}</p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {sections.map(s => (
          <button key={s.id} onClick={() => setActiveSection(s.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-display font-600 whitespace-nowrap transition-all ${activeSection === s.id ? 'btn-teal' : 'btn-ghost'}`}>
            {s.label}
          </button>
        ))}
      </div>

      {/* API PLAYGROUND */}
      {activeSection === 'playground' && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-2">
            {SAMPLE_REQUESTS.map((req, i) => (
              <button key={i} onClick={() => { setSelectedReq(i); setBody(req.body(wallet.address)); setResponse('') }}
                className={`glass rounded-xl px-4 py-2.5 flex items-center gap-3 text-left transition-all ${selectedReq === i ? 'border border-[rgba(0,210,180,0.4)]' : 'teal-border'}`}>
                <span className="text-[#00D2B4] text-xs font-mono bg-[rgba(0,210,180,0.1)] px-2 py-0.5 rounded shrink-0">{req.method}</span>
                <div className="min-w-0">
                  <p className="text-[#E8F8F6] text-sm font-display font-600">{req.label}</p>
                  <p className="text-[#3A7A72] text-xs font-mono truncate">{req.endpoint}</p>
                </div>
              </button>
            ))}
          </div>

          <div className="glass rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 border-b border-[rgba(0,210,180,0.08)]">
              <span className="text-[#3A7A72] text-xs font-mono">REQUEST BODY</span>
              <span className="text-[#00D2B4] text-xs font-mono truncate ml-2">{SAMPLE_REQUESTS[selectedReq].endpoint}</span>
            </div>
            <textarea value={body} onChange={e => setBody(e.target.value)} rows={6}
              className="w-full bg-transparent px-4 py-3 text-[#E8F8F6] text-xs font-mono outline-none resize-none" />
          </div>

          <button onClick={sendRequest} disabled={loading} className="btn-teal w-full py-3 rounded-xl text-sm disabled:opacity-50">
            {loading ? '⏳ Sending...' : '▶ Send Request'}
          </button>

          {response && (
            <div className="glass rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 border-b border-[rgba(0,210,180,0.08)]">
                <span className="text-[#3A7A72] text-xs font-mono">RESPONSE</span>
                <button onClick={() => cp(response, 'res')} className="text-[#00D2B4] text-xs font-mono">
                  {copied === 'res' ? '✓' : '⧉ copy'}
                </button>
              </div>
              <pre className="px-4 py-3 text-[#7ABFB8] text-xs font-mono overflow-x-auto max-h-72 overflow-y-auto leading-relaxed">{response}</pre>
            </div>
          )}
        </div>
      )}

      {/* MANIFEST BUILDER */}
      {activeSection === 'manifest' && (
        <div className="flex flex-col gap-3">
          <p className="text-[#2A5550] text-xs font-mono tracking-widest uppercase">Template</p>
          <div className="flex gap-2 flex-wrap">
            {MANIFEST_TEMPLATES.map((t, i) => (
              <button key={i} onClick={() => { setSelectedTemplate(i); setFields({}) }}
                className={`px-3 py-1.5 rounded-xl text-xs font-display font-600 transition-all ${selectedTemplate === i ? 'btn-teal' : 'btn-ghost'}`}>
                {t.label}
              </button>
            ))}
          </div>

          {/* Dynamic fields */}
          {MANIFEST_TEMPLATES[selectedTemplate].fields.map(field => (
            <div key={field} className="glass rounded-xl px-4 py-3">
              <p className="text-[#3A7A72] text-xs font-mono mb-1">{field.toUpperCase()}</p>
              <input type={field === 'amount' || field === 'fee' ? 'number' : 'text'}
                placeholder={field === 'to' ? 'account_rdx1...' : field === 'resource' ? 'resource_rdx1...' : '0.00'}
                value={fields[field] || ''}
                onChange={e => setFields(f => ({ ...f, [field]: e.target.value }))}
                className="w-full bg-transparent text-[#E8F8F6] text-sm font-mono outline-none placeholder-[#2A5550]"
                autoCapitalize="none" autoCorrect="off" />
            </div>
          ))}

          <button onClick={buildManifest} className="btn-teal w-full py-3 rounded-xl text-sm">⚙ Build Manifest</button>

          {(builtManifest || selectedTemplate === 3) && (
            <>
              <div className="glass rounded-2xl overflow-hidden">
                <div className="flex items-center justify-between px-4 py-2 border-b border-[rgba(0,210,180,0.08)]">
                  <span className="text-[#3A7A72] text-xs font-mono">
                    {selectedTemplate === 3 ? 'CUSTOM MANIFEST (editable)' : 'MANIFEST (editable)'}
                  </span>
                  <button onClick={() => cp(customManifest, 'manifest')} className="text-[#00D2B4] text-xs font-mono">
                    {copied === 'manifest' ? '✓' : '⧉ copy'}
                  </button>
                </div>
                <textarea
                  value={customManifest}
                  onChange={e => setCustomManifest(e.target.value)}
                  rows={8}
                  placeholder="Write your manifest here..."
                  className="w-full bg-transparent px-4 py-3 text-[#7ABFB8] text-xs font-mono outline-none resize-none leading-relaxed"
                />
              </div>

              {/* Sign & Submit */}
              <div className="glass-teal rounded-2xl px-4 py-4 flex flex-col gap-3">
                <p className="text-[#00D2B4] text-xs font-mono tracking-widest">SIGN & SUBMIT</p>
                <div className="glass rounded-xl px-4 py-3">
                  <input type="password" placeholder="Enter password to sign"
                    value={signPassword} onChange={e => setSignPassword(e.target.value)}
                    className="w-full bg-transparent text-[#E8F8F6] text-sm outline-none placeholder-[#2A5550]" />
                </div>
                {signing && (
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full border-2 border-[#00D2B4] border-t-transparent animate-spin shrink-0" />
                    <p className="text-[#00D2B4] text-xs font-mono">{signStatus}</p>
                  </div>
                )}
                {signError && <p className="text-red-400 text-xs font-mono">{signError}</p>}
                {signResult && (
                  <div className="glass rounded-xl px-3 py-2">
                    <p className={`text-xs font-mono ${signResult.status === 'CommittedSuccess' ? 'text-[#00D2B4]' : 'text-red-400'}`}>
                      {signResult.status}
                    </p>
                    <p className="text-[#3A7A72] text-xs font-mono break-all mt-1">{signResult.hash}</p>
                  </div>
                )}
                <button onClick={signAndSend} disabled={signing || !customManifest}
                  className="btn-teal w-full py-3 rounded-xl text-sm disabled:opacity-50">
                  {signing ? 'Signing...' : '✓ Sign & Submit Manifest'}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* STATE INSPECTOR */}
      {activeSection === 'inspector' && (
        <div className="flex flex-col gap-3">
          <p className="text-[#2A5550] text-xs font-mono tracking-widest uppercase">Inspect Any Entity</p>
          <div className="glass rounded-xl px-4 py-3">
            <p className="text-[#3A7A72] text-xs font-mono mb-1">ADDRESS</p>
            <input type="text" placeholder="account_rdx1... / component_rdx1... / resource_rdx1..."
              value={inspectAddr} onChange={e => setInspectAddr(e.target.value)}
              className="w-full bg-transparent text-[#E8F8F6] text-sm font-mono outline-none placeholder-[#2A5550]"
              autoCapitalize="none" autoCorrect="off" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button onClick={() => setInspectAddr(wallet.address)} className="btn-ghost py-2.5 rounded-xl text-xs">My Account</button>
            <button onClick={() => setInspectAddr('resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd')}
              className="btn-ghost py-2.5 rounded-xl text-xs">XRD Resource</button>
          </div>

          <button onClick={inspectAddress} disabled={inspecting}
            className="btn-teal w-full py-3 rounded-xl text-sm disabled:opacity-50">
            {inspecting ? '⏳ Loading...' : '🔍 Inspect'}
          </button>

          {inspectResult && (
            <div className="glass rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 border-b border-[rgba(0,210,180,0.08)]">
                <span className="text-[#3A7A72] text-xs font-mono">RESULT</span>
                <button onClick={() => cp(inspectResult, 'inspect')} className="text-[#00D2B4] text-xs font-mono">
                  {copied === 'inspect' ? '✓' : '⧉ copy'}
                </button>
              </div>
              <pre className="px-4 py-3 text-[#7ABFB8] text-xs font-mono overflow-x-auto max-h-72 overflow-y-auto leading-relaxed">{inspectResult}</pre>
            </div>
          )}
        </div>
      )}

      {/* WALLET INFO */}
      {activeSection === 'info' && (
        <div className="flex flex-col gap-3">
          {[
            { label: 'ADDRESS', value: wallet.address },
            { label: 'PUBLIC KEY', value: wallet.publicKey },
            { label: 'NETWORK', value: network.toUpperCase() },
            { label: 'GATEWAY URL', value: getGatewayUrl(network) },
          ].map(item => (
            <div key={item.label} className="glass rounded-2xl px-4 py-3">
              <div className="flex items-center justify-between mb-1">
                <p className="text-[#2A5550] text-xs font-mono">{item.label}</p>
                <button onClick={() => cp(item.value, item.label)} className="text-[#00D2B4] text-xs font-mono">
                  {copied === item.label ? '✓' : '⧉'}
                </button>
              </div>
              <p className="text-[#E8F8F6] text-xs font-mono break-all leading-relaxed">{item.value}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
