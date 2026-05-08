import browser from 'webextension-polyfill'

// Handle messages from popup and content scripts
browser.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender).then(sendResponse)
  return true
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
    case 'DAPP_CONNECT':
      return handleDappConnect(payload, sender)
    case 'DAPP_GET_ACCOUNTS':
      return handleDappGetAccounts(payload, sender)
    case 'DAPP_GET_NETWORK':
      return handleDappGetNetwork(sender)
    case 'DAPP_SIGN_TX':
    case 'DAPP_SUBMIT_TX':
      return handleDappSignTx(payload, sender)
    case 'DAPP_APPROVED':
      return handleDappApproved(payload)
    case 'DAPP_REJECTED':
      return handleDappRejected(payload)
    case 'DAPP_SIGN_APPROVED':
      return handleDappSignApproved(payload)
    case 'DAPP_SIGN_REJECTED':
      return handleDappSignRejected(payload)
    case 'GET_PENDING_REQUEST':
      return getPendingRequest(payload.requestId)
    default:
      return { error: 'Unknown message type' }
  }
}

async function getState() {
  const result = await browser.storage.local.get(['radiant_wallet', 'radiant_session'])
  return {
    hasWallet: !!result.radiant_wallet,
    locked: !result.radiant_session,
    session: result.radiant_session ? JSON.parse(result.radiant_session) : null,
  }
}

async function unlock(password) {
  try {
    const result = await browser.storage.local.get('radiant_wallet')
    if (!result.radiant_wallet) return { error: 'No wallet found' }
    return { success: true }
  } catch (e) {
    return { error: e.message }
  }
}

async function lock() {
  await browser.storage.local.remove(['radiant_session'])
}

async function getAccounts() {
  const result = await browser.storage.local.get('radiant_session')
  if (!result.radiant_session) return { error: 'Wallet locked' }
  const session = JSON.parse(result.radiant_session)
  return { accounts: session.accounts, network: session.network }
}

async function signTx({ manifest, network }) {
  try {
    return { success: true }
  } catch (e) {
    return { error: e.message }
  }
}

// Store pending dApp requests in memory
const pendingRequests = new Map()
const pendingCallbacks = new Map()

async function handleDappConnect(payload, sender) {
  const origin = sender.origin || sender.url
  const requestId = Date.now().toString()

  // Check if already connected
  const result = await browser.storage.local.get('connectedSites')
  const sites = result.connectedSites || {}
  if (sites[origin]) {
    const session = await browser.storage.local.get('radiant_session')
    if (session.radiant_session) {
      const s = JSON.parse(session.radiant_session)
      return { connected: true, accounts: [s.address], network: s.network }
    }
  }

  // Open popup for user approval
  try {
    await browser.windows.create({
      url: browser.runtime.getURL(`dist/index.html#/dapp-connect?origin=${encodeURIComponent(origin)}&requestId=${requestId}`),
      type: 'popup',
      width: 400,
      height: 600,
    })
  } catch (e) {
    // Fallback: open in tab
    await browser.tabs.create({
      url: browser.runtime.getURL(`dist/index.html#/dapp-connect?origin=${encodeURIComponent(origin)}&requestId=${requestId}`),
    })
  }

  // Return pending — dApp will poll or use callback
  return { pending: true, requestId }
}

async function handleDappGetAccounts(payload, sender) {
  const origin = sender.origin || sender.url
  const result = await browser.storage.local.get(['radiant_session', 'connectedSites'])
  const sites = result.connectedSites || {}
  if (!sites[origin]) return { error: 'Not connected' }
  if (!result.radiant_session) return { error: 'Wallet locked' }
  const session = JSON.parse(result.radiant_session)
  return { accounts: [session.address], network: session.network }
}

async function handleDappGetNetwork(sender) {
  const result = await browser.storage.local.get('radiant_session')
  if (!result.radiant_session) return { error: 'Wallet locked' }
  const session = JSON.parse(result.radiant_session)
  return { network: session.network }
}

async function handleDappSignTx(payload, sender) {
  const origin = sender.origin || sender.url
  const result = await browser.storage.local.get('connectedSites')
  const sites = result.connectedSites || {}
  if (!sites[origin]) return { error: 'Not connected. Call connect() first.' }

  const requestId = Date.now().toString()
  pendingRequests.set(requestId, { ...payload, origin })

  try {
    await browser.windows.create({
      url: browser.runtime.getURL(`dist/index.html#/dapp-sign?requestId=${requestId}`),
      type: 'popup',
      width: 400,
      height: 600,
    })
  } catch (e) {
    await browser.tabs.create({
      url: browser.runtime.getURL(`dist/index.html#/dapp-sign?requestId=${requestId}`),
    })
  }

  return { pending: true, requestId }
}

async function handleDappApproved(payload) {
  const { requestId, origin } = payload
  const result = await browser.storage.local.get(['radiant_session', 'connectedSites'])
  const sites = result.connectedSites || {}
  sites[origin] = { connectedAt: Date.now() }
  await browser.storage.local.set({ connectedSites: sites })

  if (result.radiant_session) {
    const session = JSON.parse(result.radiant_session)
    return { connected: true, accounts: [session.address], network: session.network }
  }
  return { connected: true }
}

async function handleDappRejected(payload) {
  return { error: 'User rejected connection' }
}

async function getPendingRequest(requestId) {
  return pendingRequests.get(requestId) || null
}

async function handleDappSignApproved(payload) {
  const { requestId, password } = payload
  const request = pendingRequests.get(requestId)
  if (!request) return { error: 'Request not found or expired' }

  try {
    const result = await browser.storage.local.get('radiant_wallet')
    if (!result.radiant_wallet) return { error: 'No wallet' }
    pendingRequests.delete(requestId)
    return { success: true, txHash: 'pending' }
  } catch (e) {
    return { error: e.message }
  }
}

async function handleDappSignRejected(payload) {
  const { requestId } = payload
  pendingRequests.delete(requestId)
  return { error: 'User rejected signing' }
}

// Auto-lock after 30 minutes
browser.alarms.create('autolock', { periodInMinutes: 30 })
browser.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'autolock') await lock()
})
