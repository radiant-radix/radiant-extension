// Inject radiant provider into all tabs when extension loads
chrome.runtime.onInstalled.addListener(async () => {
  // Inject into all existing tabs
  const tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] })
  for (const tab of tabs) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['inject.js'],
      })
    } catch (e) {}
  }
})

// Inject into every new tab that loads
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete') return
  if (!tab.url?.startsWith('http')) return
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: ['inject.js'],
    })
  } catch (e) {}
})

// Handle messages from popup and content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender).then(sendResponse)
  return true
})

async function handleMessage(message, sender) {
  const { type, payload } = message

  switch (type) {
    case 'DAPP_CONNECT':
      return handleDappConnect(payload, sender)
    case 'DAPP_GET_ACCOUNTS':
      return handleDappGetAccounts(sender)
    case 'DAPP_GET_NETWORK':
      return handleDappGetNetwork(sender)
    case 'DAPP_SIGN_TX':
    case 'DAPP_SUBMIT_TX':
      return handleDappSignTx(payload, sender)
    case 'GET_PENDING_REQUEST':
      return getPendingRequest(payload.requestId)
    default:
      return { error: 'Unknown message type' }
  }
}

const pendingRequests = new Map()

async function handleDappConnect(payload, sender) {
  const origin = sender.origin || new URL(sender.url).origin
  const requestId = Date.now().toString()

  // Check if already connected
  const result = await chrome.storage.local.get(['connectedSites', 'radiant_session'])
  const sites = result.connectedSites || {}

  if (sites[origin] && result.radiant_session) {
    const session = JSON.parse(result.radiant_session)
    return {
      connected: true,
      accounts: sites[origin].accounts || [session.address],
      network: session.network || 'mainnet',
    }
  }

  // Open popup for approval
  try {
    await chrome.windows.create({
      url: chrome.runtime.getURL(`dist/index.html#/dapp-connect?origin=${encodeURIComponent(origin)}&requestId=${requestId}`),
      type: 'popup',
      width: 400,
      height: 600,
    })
  } catch (e) {
    await chrome.tabs.create({
      url: chrome.runtime.getURL(`dist/index.html#/dapp-connect?origin=${encodeURIComponent(origin)}&requestId=${requestId}`),
    })
  }

  return { pending: true, requestId }
}

async function handleDappGetAccounts(sender) {
  const origin = sender.origin || new URL(sender.url).origin
  const result = await chrome.storage.local.get(['connectedSites', 'radiant_session'])
  const sites = result.connectedSites || {}
  if (!sites[origin]) return { error: 'Not connected' }
  if (!result.radiant_session) return { error: 'Wallet locked' }
  const session = JSON.parse(result.radiant_session)
  return {
    accounts: sites[origin].accounts || [session.address],
    network: session.network || 'mainnet',
  }
}

async function handleDappGetNetwork(sender) {
  const result = await chrome.storage.local.get('radiant_session')
  if (!result.radiant_session) return { error: 'Wallet locked' }
  const session = JSON.parse(result.radiant_session)
  return { network: session.network || 'mainnet' }
}

async function handleDappSignTx(payload, sender) {
  const origin = sender.origin || new URL(sender.url).origin
  const result = await chrome.storage.local.get('connectedSites')
  const sites = result.connectedSites || {}
  if (!sites[origin]) return { error: 'Not connected. Call connect() first.' }

  const requestId = Date.now().toString()
  pendingRequests.set(requestId, { ...payload, origin })

  try {
    await chrome.windows.create({
      url: chrome.runtime.getURL(`dist/index.html#/dapp-sign?requestId=${requestId}`),
      type: 'popup',
      width: 400,
      height: 600,
    })
  } catch (e) {
    await chrome.tabs.create({
      url: chrome.runtime.getURL(`dist/index.html#/dapp-sign?requestId=${requestId}`),
    })
  }

  return { pending: true, requestId }
}

async function getPendingRequest(requestId) {
  return pendingRequests.get(requestId) || null
}

// Auto-lock after 30 minutes
chrome.alarms.create('autolock', { periodInMinutes: 30 })
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === 'autolock') {
    await chrome.storage.local.remove(['radiant_session'])
  }
})
