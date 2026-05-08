import { useState } from 'react'
import { loadWallet, decryptWallet, loadSession, saveSession } from '../../../lib/wallet'
import { getContacts, addContact, deleteContact, editContact } from '../../../lib/addressBook'
import { copyToClipboard } from '../../../lib/clipboard'


export default function SettingsPage({ wallet, network, onLogout, onNetworkChange, accounts, activeAccount, onRenameAccount }) {
  const [activeSection, setActiveSection] = useState('general')
  const [showPhrase, setShowPhrase] = useState(false)
  const [showPrivKey, setShowPrivKey] = useState(false)
  const [password, setPassword] = useState('')
  const [privKeyPassword, setPrivKeyPassword] = useState('')
  const [phrase, setPhrase] = useState('')
  const [privKey, setPrivKey] = useState('')
  const [phraseError, setPhraseError] = useState('')
  const [privKeyError, setPrivKeyError] = useState('')
  const [showPasswordInput, setShowPasswordInput] = useState(false)
  const [showPrivKeyInput, setShowPrivKeyInput] = useState(false)
  const [copied, setCopied] = useState('')
  const [contacts, setContacts] = useState(getContacts())
  const [newName, setNewName] = useState('')
  const [newAddress, setNewAddress] = useState('')
  const [contactError, setContactError] = useState('')
  const [editId, setEditId] = useState(null)
  const [editName, setEditName] = useState('')
  const [renamingAccount, setRenamingAccount] = useState(null)
  const [renameValue, setRenameValue] = useState('')

  async function revealPhrase() {
    setPhraseError('')
    const encrypted = await loadWallet()
    const decrypted = await decryptWallet(encrypted, password)
    if (!decrypted) { setPhraseError('Wrong password'); return }
    setPhrase(decrypted.mnemonic)
    setShowPhrase(true)
    setShowPasswordInput(false)
    setPassword('')
  }

  async function revealPrivKey() {
    setPrivKeyError('')
    const encrypted = await loadWallet()
    const decrypted = await decryptWallet(encrypted, privKeyPassword)
    if (!decrypted) { setPrivKeyError('Wrong password'); return }
    // Get private key for active account
    const pk = decrypted.accounts?.[activeAccount]?.privateKey || decrypted.privateKey
    setPrivKey(pk)
    setShowPrivKey(true)
    setShowPrivKeyInput(false)
    setPrivKeyPassword('')
  }

  async function copyText(text, key) {
    await copyToClipboard(text)
    setCopied(key)
    setTimeout(() => setCopied(''), 2000)
  }

  function handleAddContact() {
    setContactError('')
    if (!newName.trim()) { setContactError('Enter a name'); return }
    if (!newAddress.trim()) { setContactError('Enter an address'); return }
    try {
      const updated = addContact(newName.trim(), newAddress.trim())
      setContacts(updated)
      setNewName('')
      setNewAddress('')
    } catch (e) { setContactError(e.message) }
  }

  function handleDelete(id) {
    if (!confirm('Delete this contact?')) return
    setContacts(deleteContact(id))
  }

  function handleEdit(id) {
    if (!editName.trim()) return
    setContacts(editContact(id, editName.trim()))
    setEditId(null)
    setEditName('')
  }

  function handleRenameAccount(index) {
    if (!renameValue.trim()) return
    onRenameAccount(index, renameValue.trim())
    setRenamingAccount(null)
    setRenameValue('')
  }

  const sections = ['general', 'security', 'contacts', 'about']

  return (
    <div className="px-6 flex flex-col gap-4 pb-4">
      <div className="pt-2">
        <h2 className="font-display text-2xl font-700 text-[#E8F8F6] mb-1">Settings</h2>
        <p className="text-[#3A7A72] text-xs font-mono">Wallet configuration</p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {sections.map(s => (
          <button key={s} onClick={() => setActiveSection(s)}
            className={`px-3 py-1.5 rounded-xl text-xs font-display font-600 capitalize whitespace-nowrap transition-all ${activeSection === s ? 'btn-teal' : 'btn-ghost'}`}>
            {s}
          </button>
        ))}
      </div>

      {/* GENERAL */}
      {activeSection === 'general' && (
        <div className="flex flex-col gap-3">
          {/* Network */}
          <div className="glass rounded-2xl px-4 py-4">
            <p className="text-[#3A7A72] text-xs font-mono mb-3 tracking-widest">NETWORK</p>
            <div className="flex gap-2">
              {['mainnet', 'stokenet'].map(n => (
                <button key={n} onClick={() => onNetworkChange(n)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-display font-600 capitalize transition-all ${network === n ? 'btn-teal' : 'btn-ghost'}`}>
                  {n === 'mainnet' ? 'Mainnet' : 'Stokenet'}
                </button>
              ))}
            </div>

          </div>

          {/* Accounts */}
          <div className="glass rounded-2xl px-4 py-4">
            <p className="text-[#3A7A72] text-xs font-mono mb-3 tracking-widest">ACCOUNTS</p>
            <div className="flex flex-col gap-2">
              {(accounts || [{ name: 'Account 1', address: wallet.address }]).map((acc, i) => (
                <div key={i} className={`glass rounded-xl px-3 py-3 ${i === activeAccount ? 'border border-[rgba(0,210,180,0.3)]' : ''}`}>
                  {renamingAccount === i ? (
                    <div className="flex gap-2 items-center">
                      <input value={renameValue} onChange={e => setRenameValue(e.target.value)}
                        placeholder="Account name"
                        className="flex-1 bg-transparent text-[#E8F8F6] text-sm outline-none border-b border-[rgba(0,210,180,0.3)]" />
                      <button onClick={() => handleRenameAccount(i)} className="text-[#00D2B4] text-xs font-mono">save</button>
                      <button onClick={() => setRenamingAccount(null)} className="text-[#2A5550] text-xs font-mono">cancel</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg glass-teal flex items-center justify-center text-xs font-display font-700 text-[#00D2B4] shrink-0">{i + 1}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[#E8F8F6] text-sm font-display font-600">{acc.name}</p>
                        <p className="text-[#3A7A72] text-xs font-mono truncate">{acc.address?.slice(0,20)}...</p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button onClick={async () => { await copyText(acc.address, `addr${i}`) }}
                          className="text-[#2A5550] text-xs font-mono">{copied === `addr${i}` ? '✓' : '⧉'}</button>
                        <button onClick={() => { setRenamingAccount(i); setRenameValue(acc.name) }}
                          className="text-[#2A5550] text-xs font-mono">rename</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* SECURITY */}
      {activeSection === 'security' && (
        <div className="flex flex-col gap-3">
          {/* Seed phrase */}
          <div className="glass rounded-2xl px-4 py-4">
            <p className="text-[#3A7A72] text-xs font-mono mb-3 tracking-widest">SEED PHRASE</p>
            {!showPhrase && !showPasswordInput && (
              <button onClick={() => setShowPasswordInput(true)} className="btn-ghost w-full py-3 rounded-xl text-sm">
                🔑 Reveal Seed Phrase
              </button>
            )}
            {showPasswordInput && (
              <div className="flex flex-col gap-3">
                <div className="glass rounded-xl px-4 py-3 flex items-center gap-2">
                  <input type="password" placeholder="Enter password" value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="flex-1 bg-transparent text-[#E8F8F6] text-sm outline-none placeholder-[#2A5550]" />
                </div>
                {phraseError && <p className="text-red-400 text-xs font-mono">{phraseError}</p>}
                <div className="flex gap-2">
                  <button onClick={() => setShowPasswordInput(false)} className="btn-ghost flex-1 py-2.5 rounded-xl text-sm">Cancel</button>
                  <button onClick={revealPhrase} className="btn-teal flex-1 py-2.5 rounded-xl text-sm">Reveal</button>
                </div>
              </div>
            )}
            {showPhrase && (
              <div className="flex flex-col gap-3">
                <div className="glass-teal rounded-xl p-3">
                  <p className="text-[#00D2B4] text-xs font-mono mb-2">⚠ NEVER SHARE THIS</p>
                  <div className="grid grid-cols-3 gap-1.5">
                    {phrase.split(' ').map((word, i) => (
                      <div key={i} className="bg-[#071414] rounded-lg px-2 py-1.5 flex items-center gap-1">
                        <span className="text-[#2A5550] font-mono text-xs">{i+1}.</span>
                        <span className="text-[#E8F8F6] text-xs font-500">{word}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => copyText(phrase, 'phrase')} className="btn-ghost flex-1 py-2.5 rounded-xl text-sm">
                    {copied === 'phrase' ? '✓ Copied' : '⧉ Copy'}
                  </button>
                  <button onClick={() => { setShowPhrase(false); setPhrase('') }}
                    className="flex-1 py-2.5 rounded-xl text-sm font-display font-600 text-red-400 border border-red-900/40">
                    Hide
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Private key */}
          <div className="glass rounded-2xl px-4 py-4">
            <p className="text-[#3A7A72] text-xs font-mono mb-3 tracking-widest">PRIVATE KEY (Account {activeAccount + 1})</p>
            {!showPrivKey && !showPrivKeyInput && (
              <button onClick={() => setShowPrivKeyInput(true)} className="btn-ghost w-full py-3 rounded-xl text-sm">
                🗝 Export Private Key
              </button>
            )}
            {showPrivKeyInput && (
              <div className="flex flex-col gap-3">
                <div className="glass-teal rounded-xl p-3 mb-1">
                  <p className="text-[#00D2B4] text-xs font-mono">⚠ WARNING: Never share your private key!</p>
                </div>
                <div className="glass rounded-xl px-4 py-3">
                  <input type="password" placeholder="Enter password" value={privKeyPassword}
                    onChange={e => setPrivKeyPassword(e.target.value)}
                    className="w-full bg-transparent text-[#E8F8F6] text-sm outline-none placeholder-[#2A5550]" />
                </div>
                {privKeyError && <p className="text-red-400 text-xs font-mono">{privKeyError}</p>}
                <div className="flex gap-2">
                  <button onClick={() => setShowPrivKeyInput(false)} className="btn-ghost flex-1 py-2.5 rounded-xl text-sm">Cancel</button>
                  <button onClick={revealPrivKey} className="btn-teal flex-1 py-2.5 rounded-xl text-sm">Export</button>
                </div>
              </div>
            )}
            {showPrivKey && (
              <div className="flex flex-col gap-3">
                <div className="glass rounded-xl px-4 py-3">
                  <p className="text-[#E8F8F6] text-xs font-mono break-all leading-relaxed">{privKey}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => copyText(privKey, 'privkey')} className="btn-ghost flex-1 py-2.5 rounded-xl text-sm">
                    {copied === 'privkey' ? '✓ Copied' : '⧉ Copy'}
                  </button>
                  <button onClick={() => { setShowPrivKey(false); setPrivKey('') }}
                    className="flex-1 py-2.5 rounded-xl text-sm font-display font-600 text-red-400 border border-red-900/40">
                    Hide
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Danger zone */}
          <div className="glass rounded-2xl px-4 py-4 border border-red-900/30">
            <p className="text-red-500 text-xs font-mono mb-3 tracking-widest">DANGER ZONE</p>
            <button onClick={onLogout}
              className="w-full py-3 rounded-xl text-sm font-display font-600 text-red-400 border border-red-900/40 bg-red-900/10">
              ⏻ Disconnect Wallet
            </button>
            <p className="text-[#2A5550] text-xs mt-2 text-center">Back up your seed phrase first!</p>
          </div>
        </div>
      )}

      {/* CONTACTS */}
      {activeSection === 'contacts' && (
        <div className="flex flex-col gap-3">
          <p className="text-[#2A5550] text-xs font-mono tracking-widest uppercase">Add Contact</p>
          <div className="flex flex-col gap-2">
            <div className="glass rounded-xl px-4 py-3">
              <input type="text" placeholder="Name" value={newName} onChange={e => setNewName(e.target.value)}
                className="w-full bg-transparent text-[#E8F8F6] text-sm outline-none placeholder-[#2A5550]" />
            </div>
            <div className="glass rounded-xl px-4 py-3">
              <input type="text" placeholder="account_rdx1..." value={newAddress} onChange={e => setNewAddress(e.target.value)}
                className="w-full bg-transparent text-[#E8F8F6] text-sm font-mono outline-none placeholder-[#2A5550]"
                autoCapitalize="none" autoCorrect="off" />
            </div>
            {contactError && <p className="text-red-400 text-xs font-mono">{contactError}</p>}
            <button onClick={handleAddContact} className="btn-teal w-full py-3 rounded-xl text-sm">+ Add Contact</button>
          </div>

          <p className="text-[#2A5550] text-xs font-mono tracking-widest uppercase mt-2">Saved ({contacts.length})</p>
          {contacts.length === 0 ? (
            <div className="glass rounded-2xl p-6 text-center">
              <p className="text-[#3A7A72] text-sm">No contacts yet</p>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {contacts.map(c => (
                <div key={c.id} className="glass rounded-2xl px-4 py-3">
                  {editId === c.id ? (
                    <div className="flex gap-2">
                      <input value={editName} onChange={e => setEditName(e.target.value)}
                        className="flex-1 bg-transparent text-[#E8F8F6] text-sm outline-none border-b border-[rgba(0,210,180,0.3)]" />
                      <button onClick={() => handleEdit(c.id)} className="text-[#00D2B4] text-xs font-mono">save</button>
                      <button onClick={() => setEditId(null)} className="text-[#2A5550] text-xs font-mono">cancel</button>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl glass-teal flex items-center justify-center text-sm font-display font-700 text-[#00D2B4] shrink-0">
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[#E8F8F6] text-sm font-display font-600">{c.name}</p>
                        <p className="text-[#3A7A72] text-xs font-mono truncate">{c.address.slice(0,22)}...</p>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <button onClick={() => copyText(c.address, `contact${c.id}`)}
                          className="text-[#2A5550] text-xs font-mono">{copied === `contact${c.id}` ? '✓' : '⧉'}</button>
                        <button onClick={() => { setEditId(c.id); setEditName(c.name) }}
                          className="text-[#2A5550] text-xs font-mono">edit</button>
                        <button onClick={() => handleDelete(c.id)}
                          className="text-red-500 text-xs font-mono">del</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ABOUT */}
      {activeSection === 'about' && (
        <div className="flex flex-col gap-3">
          <div className="glass-teal rounded-3xl p-6 flex flex-col items-center text-center gap-3">
            <div className="w-16 h-16 rounded-2xl glass-teal flex items-center justify-center animate-glow-pulse">
              <svg width="32" height="32" viewBox="0 0 48 48" fill="none">
                <polygon points="24,4 44,36 4,36" fill="none" stroke="#00D2B4" strokeWidth="2.5" strokeLinejoin="round"/>
                <polygon points="24,14 36,36 12,36" fill="rgba(0,210,180,0.12)" stroke="#80EEE0" strokeWidth="1.5" strokeLinejoin="round"/>
                <circle cx="24" cy="28" r="3" fill="#00D2B4"/>
              </svg>
            </div>
            <div>
              <h3 className="font-display text-2xl font-800 teal-text">Radiant Wallet</h3>
              <p className="text-[#3A7A72] text-xs font-mono mt-1">The most powerful Radix wallet</p>
            </div>
          </div>
          <div className="glass rounded-2xl px-4 py-4 flex flex-col gap-3">
            {[
              { label: 'Version', value: '0.1.0-beta' },
              { label: 'Network', value: network === 'mainnet' ? 'Radix Mainnet' : 'Stokenet' },
              { label: 'Chain', value: 'Radix Babylon' },
              { label: 'License', value: 'MIT' },
              { label: 'Non-custodial', value: '✓ Yes' },
              { label: 'Open Source', value: '✓ GitHub' },
            ].map(item => (
              <div key={item.label} className="flex justify-between items-center">
                <span className="text-[#3A7A72] text-sm">{item.label}</span>
                <span className="text-[#E8F8F6] text-sm font-mono">{item.value}</span>
              </div>
            ))}
          </div>
          <a href="https://github.com/radiant-radix/radiant-wallet" target="_blank" rel="noopener noreferrer"
            className="btn-ghost w-full py-3 rounded-xl text-sm text-center">
            ⭐ Star on GitHub
          </a>
          <div className="glass rounded-2xl px-4 py-4 text-center">
            <p className="text-[#2A5550] text-xs font-mono leading-relaxed">
              Built with ❤ on Radix DLT<br/>
              Not affiliated with Radix DLT Ltd<br/>
              Use at your own risk — Beta software
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
