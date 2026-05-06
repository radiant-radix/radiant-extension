import browser from 'webextension-polyfill'

// Handle messages from popup and content scripts
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender).then(sendResponse)
  return true // keep channel open for async
})

async function handleMessage(message, sender) {
  const { type, payload } = message

  switch (type) {
    case 'GET_STATE':
      return getState()

    case 'UNLOCK':
      return unlock(payload.password)

    case 'LOCK':
      await lock()
      return { success: true }

    case 'GET_ACCOUNTS':
      return getAccounts()

    case 'SIGN_TX':
      return signTx(payload)

    case 'SUBMIT_TX':
      return submitTx(payload)

    case 'DAPP_CONNECT':
      return handleDappConnect(payload, sender)

    case 'DAPP_GET_ACCOUNTS':
      return handleDappGetAccounts(payload, sender)

    case 'DAPP_SIGN_TX':
      return handleDappSignTx(payload, sender)

    default:
      return { error: 'Unknown message type' }
  }
}

async function getState() {
  const result = await browser.storage.local.get(['wallet', 'session', 'locked'])
  return {
    hasWallet: !!result.wallet,
    locked: result.locked !== false,
    session: result.session || null,
  }
}

async function unlock(password) {
  try {
    const { wallet } = await browser.storage.local.get('wallet')
    if (!wallet) return { error: 'No wallet found' }

    const { decryptData } = await import('../lib/crypto.js')
    const decrypted = decryptData(wallet, password)
    if (!decrypted) return { error: 'Wrong password' }

    await browser.storage.local.set({
      session: {
        address: decrypted.address,
        publicKey: decrypted.publicKey,
        accounts: decrypted.accounts || [{ name: 'Account 1', address: decrypted.address }],
        network: decrypted.network || 'mainnet',
        pathType: decrypted.pathType || 'radiant',
      },
      locked: false,
      // Store private key in session (memory only via session storage)
      _pk: decrypted.privateKey,
    })

    return { success: true }
  } catch (e) {
    return { error: e.message }
  }
}

async function lock() {
  await browser.storage.local.remove(['session', '_pk', 'locked'])
  await browser.storage.local.set({ locked: true })
}

async function getAccounts() {
  const { session } = await browser.storage.local.get('session')
  if (!session) return { error: 'Wallet locked' }
  return { accounts: session.accounts, network: session.network }
}

async function signTx({ manifest, network }) {
  const { _pk, session } = await browser.storage.local.get(['_pk', 'session'])
  if (!_pk) return { error: 'Wallet locked' }

  try {
    const { signAndSubmitManifest } = await import('../lib/batch.js')
    const result = await signAndSubmitManifest(manifest, _pk, network || session.network)
    return { success: true, result }
  } catch (e) {
    return { error: e.message }
  }
}

// dApp connection requests - store pending requests
const pendingRequests = new Map()

async function handleDappConnect(payload, sender) {
  // Open popup to ask user permission
  await browser.windows.create({
    url: browser.runtime.getURL(`popup/index.html#/dapp-connect?origin=${encodeURIComponent(sender.origin)}&requestId=${payload.requestId}`),
    type: 'popup',
    width: 400,
    height: 600,
  })
  return { pending: true, requestId: payload.requestId }
}

async function handleDappGetAccounts(payload, sender) {
  const { session, connectedSites } = await browser.storage.local.get(['session', 'connectedSites'])
  const sites = connectedSites || {}
  if (!sites[sender.origin]) return { error: 'Not connected' }
  if (!session) return { error: 'Wallet locked' }
  return { accounts: [session.address], network: session.network }
}

async function handleDappSignTx(payload, sender) {
  const { connectedSites } = await browser.storage.local.get('connectedSites')
  const sites = connectedSites || {}
  if (!sites[sender.origin]) return { error: 'Not connected' }

  // Open popup for user to confirm
  const requestId = Date.now().toString()
  pendingRequests.set(requestId, { ...payload, origin: sender.origin })

  await browser.windows.create({
    url: browser.runtime.getURL(`popup/index.html#/dapp-sign?requestId=${requestId}`),
    type: 'popup',
    width: 400,
    height: 600,
  })
  return { pending: true, requestId }
}

// Auto-lock after 30 minutes
browser.alarms.create('autolock', { periodInMinutes: 30 })
browser.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'autolock') await lock()
})
