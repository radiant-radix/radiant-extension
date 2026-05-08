;(function () {
  if (window.radiant && window.radix) return

  // ─── Internal message bus ───────────────────────────────────────────────────
  const callbacks = {}
  let reqId = 0

  function sendToBackground(type, payload) {
    return new Promise((resolve, reject) => {
      const id = ++reqId
      callbacks[id] = { resolve, reject }
      window.postMessage({ source: 'radiant-dapp', type, payload, requestId: id }, '*')
    })
  }

  // Poll chrome.storage for approval result (after popup opens)
  function pollApproval(storageKey, requestId, timeoutMs = 120000) {
    return new Promise((resolve, reject) => {
      const start = Date.now()
      const interval = setInterval(() => {
        chrome.storage.local.get([storageKey], (result) => {
          if (result[storageKey]) {
            clearInterval(interval)
            chrome.storage.local.remove([storageKey])
            const data = JSON.parse(result[storageKey])
            if (data.approved) resolve(data)
            else reject(new Error('User rejected request'))
          }
          if (Date.now() - start > timeoutMs) {
            clearInterval(interval)
            reject(new Error('Request timed out'))
          }
        })
      }, 800)
    })
  }

  // ─── window.radiant — Radiant native API ───────────────────────────────────
  window.radiant = {
    isRadiant: true,
    version: '1.0.0',
    _listeners: {},

    async connect() {
      const res = await sendToBackground('DAPP_CONNECT', {})
      if (res?.pending) return pollApproval(`dapp_request_${res.requestId}`)
      return res
    },
    async getAccounts() { return sendToBackground('DAPP_GET_ACCOUNTS', {}) },
    async getNetwork()  { return sendToBackground('DAPP_GET_NETWORK', {}) },
    async signTransaction(manifest) {
      const res = await sendToBackground('DAPP_SIGN_TX', { manifest })
      if (res?.pending) return pollApproval(`dapp_request_${res.requestId}`)
      return res
    },
    async sendTransaction(manifest) {
      const res = await sendToBackground('DAPP_SUBMIT_TX', { manifest })
      if (res?.pending) return pollApproval(`dapp_request_${res.requestId}`)
      return res
    },
    on(event, cb) {
      if (!this._listeners[event]) this._listeners[event] = []
      this._listeners[event].push(cb)
    },
    emit(event, data) {
      (this._listeners[event] || []).forEach(cb => cb(data))
    },
  }

  // ─── window.radix — Radix dApp Toolkit compatible provider ─────────────────
  // Implements the wallet-sdk provider interface so RDT auto-detects Radiant
  const radixProvider = {
    isRadix: true,
    isRadiant: true,
    name: 'Radiant Wallet',
    version: '1.0.0',

    // RDT calls this to open wallet & request accounts
    async request(method, params) {
      if (method === 'wallet_requestAccounts' || method === 'connect') {
        const res = await sendToBackground('DAPP_CONNECT', params || {})
        if (res?.pending) {
          const approval = await pollApproval(`dapp_request_${res.requestId}`)
          return {
            accounts: (approval.accounts || []).map(addr => ({
              address: addr,
              appearanceId: 0,
              label: 'Account 1',
            })),
            persona: {
              identityAddress: approval.persona || 'My Persona',
              label: approval.persona || 'My Persona',
            },
          }
        }
        if (res?.connected) {
          return {
            accounts: (res.accounts || []).map(addr => ({
              address: addr,
              appearanceId: 0,
              label: 'Account 1',
            })),
          }
        }
        throw new Error(res?.error || 'Connection failed')
      }

      if (method === 'wallet_getAccounts' || method === 'getAccounts') {
        const res = await sendToBackground('DAPP_GET_ACCOUNTS', {})
        if (res?.error) throw new Error(res.error)
        return {
          accounts: (res.accounts || []).map(addr => ({
            address: addr,
            appearanceId: 0,
            label: 'Account 1',
          }))
        }
      }

      if (method === 'wallet_signTransaction' || method === 'signTransaction') {
        const res = await sendToBackground('DAPP_SIGN_TX', params || {})
        if (res?.pending) return pollApproval(`dapp_request_${res.requestId}`)
        if (res?.error) throw new Error(res.error)
        return res
      }

      if (method === 'wallet_sendTransaction' || method === 'sendTransaction') {
        const res = await sendToBackground('DAPP_SUBMIT_TX', params || {})
        if (res?.pending) return pollApproval(`dapp_request_${res.requestId}`)
        if (res?.error) throw new Error(res.error)
        return res
      }

      throw new Error(`Unknown method: ${method}`)
    },

    // RDT v2 uses send() instead of request()
    async send(input) {
      const { discriminator, items } = input || {}

      if (discriminator === 'authorizedRequest' || discriminator === 'unauthorizedRequest') {
        const res = await sendToBackground('DAPP_CONNECT', { discriminator, items })
        if (res?.pending) {
          const approval = await pollApproval(`dapp_request_${res.requestId}`)
          // Format response to match RDT expected shape
          return {
            discriminator: 'success',
            items: {
              discriminator: 'authorizedRequest',
              auth: {
                discriminator: 'loginWithoutChallenge',
                persona: {
                  identityAddress: approval.persona || 'radiant-persona',
                  label: approval.persona || 'My Persona',
                },
              },
              ongoingAccounts: approval.accounts
                ? {
                    accounts: approval.accounts.map((addr, i) => ({
                      address: addr,
                      appearanceId: i,
                      label: `Account ${i + 1}`,
                    }))
                  }
                : undefined,
            }
          }
        }
        if (res?.connected) {
          return {
            discriminator: 'success',
            items: {
              discriminator: 'authorizedRequest',
              auth: { discriminator: 'loginWithoutChallenge', persona: { identityAddress: 'radiant-persona', label: 'My Persona' } },
              ongoingAccounts: {
                accounts: (res.accounts || []).map((addr, i) => ({
                  address: addr, appearanceId: i, label: `Account ${i + 1}`
                }))
              }
            }
          }
        }
        return { discriminator: 'failure', error: res?.error || 'Connection failed' }
      }

      if (discriminator === 'sendTransaction') {
        const manifest = items?.transactionManifest
        const res = await sendToBackground('DAPP_SUBMIT_TX', { manifest })
        if (res?.pending) {
          const result = await pollApproval(`dapp_request_${res.requestId}`)
          return { discriminator: 'success', items: { transactionIntentHash: result.txHash || '' } }
        }
        if (res?.error) return { discriminator: 'failure', error: res.error }
        return { discriminator: 'success', items: { transactionIntentHash: res.txHash || '' } }
      }

      return { discriminator: 'failure', error: 'Unknown discriminator' }
    },

    // RDT subscribes to state changes
    _subs: {},
    subscribe(event, cb) {
      if (!this._subs[event]) this._subs[event] = []
      this._subs[event].push(cb)
      return () => { this._subs[event] = this._subs[event].filter(s => s !== cb) }
    },
    _emit(event, data) {
      (this._subs[event] || []).forEach(cb => cb(data))
    },
  }

  window.radix = radixProvider

  // Also set on globalThis for module contexts
  if (typeof globalThis !== 'undefined') {
    globalThis.radix = radixProvider
    globalThis.radiant = window.radiant
  }

  // ─── Relay page → background ────────────────────────────────────────────────
  window.addEventListener('message', (event) => {
    if (event.source !== window) return
    if (event.data?.source !== 'radiant-dapp') return
    const { type, payload, requestId } = event.data

    chrome.runtime.sendMessage({ type, payload }).then(response => {
      if (response?.pending && response?.requestId) {
        pollApproval(`dapp_request_${response.requestId}`)
          .then(data => {
            window.postMessage({ source: 'radiant-extension', requestId, result: data, error: null }, '*')
          })
          .catch(err => {
            window.postMessage({ source: 'radiant-extension', requestId, result: null, error: err.message }, '*')
          })
      } else {
        window.postMessage({
          source: 'radiant-extension',
          requestId,
          result: response,
          error: response?.error || null,
        }, '*')
      }
    }).catch(err => {
      window.postMessage({ source: 'radiant-extension', requestId, result: null, error: err.message }, '*')
    })
  })

  // ─── Announce provider (EIP-6963 style for Radix ecosystem) ────────────────
  window.dispatchEvent(new CustomEvent('radix#initialized', { detail: radixProvider }))
  window.dispatchEvent(new Event('radiant#initialized'))

  console.log('%c Radiant Wallet injected ✓', 'color: #00D2B4; font-weight: bold;')
})()
