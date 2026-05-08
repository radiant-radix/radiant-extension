// Inject window.radiant provider into every page
;(function() {
  if (window.radiant) return

  window.radiant = {
    isRadiant: true,
    version: '1.0.0',
    _callbacks: {},
    _requestId: 0,

    _sendMessage(type, payload) {
      return new Promise((resolve, reject) => {
        const requestId = ++this._requestId
        this._callbacks[requestId] = { resolve, reject }
        window.postMessage({ source: 'radiant-dapp', type, payload, requestId }, '*')
      })
    },

    async connect() {
      return this._sendMessage('DAPP_CONNECT', {})
    },

    async getAccounts() {
      return this._sendMessage('DAPP_GET_ACCOUNTS', {})
    },

    async getNetwork() {
      return this._sendMessage('DAPP_GET_NETWORK', {})
    },

    async signTransaction(manifest) {
      return this._sendMessage('DAPP_SIGN_TX', { manifest })
    },

    async sendTransaction(manifest) {
      return this._sendMessage('DAPP_SUBMIT_TX', { manifest })
    },

    on(event, callback) {
      if (!this._listeners) this._listeners = {}
      if (!this._listeners[event]) this._listeners[event] = []
      this._listeners[event].push(callback)
    },

    emit(event, data) {
      if (!this._listeners?.[event]) return
      this._listeners[event].forEach(cb => cb(data))
    },
  }

  // Listen for responses from extension background
  window.addEventListener('message', (event) => {
    if (event.source !== window) return
    if (event.data?.source !== 'radiant-extension') return
    const { requestId, result, error } = event.data
    const cb = window.radiant._callbacks[requestId]
    if (!cb) return
    delete window.radiant._callbacks[requestId]
    if (error) cb.reject(new Error(error))
    else cb.resolve(result)
  })

  // Relay messages from page to background service worker
  window.addEventListener('message', (event) => {
    if (event.source !== window) return
    if (event.data?.source !== 'radiant-dapp') return
    const { type, payload, requestId } = event.data

    chrome.runtime.sendMessage({ type, payload }).then(async response => {
      // If pending, poll chrome.storage for result
      if (response?.pending && response?.requestId) {
        const approvalKey = `dapp_request_${response.requestId}`
        let attempts = 0
        const maxAttempts = 120 // Poll for up to 2 minutes

        const poll = setInterval(() => {
          attempts++
          chrome.storage.local.get([approvalKey], (result) => {
            const data = result[approvalKey]
            if (data) {
              clearInterval(poll)
              // Clean up storage
              chrome.storage.local.remove([approvalKey])
              const parsed = JSON.parse(data)
              window.postMessage({
                source: 'radiant-extension',
                requestId,
                result: parsed.approved ? parsed : null,
                error: parsed.approved ? null : 'User rejected request',
              }, '*')
            }
            if (attempts >= maxAttempts) {
              clearInterval(poll)
              window.postMessage({
                source: 'radiant-extension',
                requestId,
                result: null,
                error: 'Request timed out',
              }, '*')
            }
          })
        }, 1000) // Poll every second
      } else {
        // Direct response
        window.postMessage({
          source: 'radiant-extension',
          requestId,
          result: response,
          error: response?.error || null,
        }, '*')
      }
    }).catch(err => {
      window.postMessage({
        source: 'radiant-extension',
        requestId,
        result: null,
        error: err.message,
      }, '*')
    })
  })

  window.dispatchEvent(new Event('radiant#initialized'))
  console.log('Radiant Wallet provider injected')
})()
