export async function requestNotificationPermission() {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  const result = await Notification.requestPermission()
  return result === 'granted'
}

export function sendNotification(title, body, icon = '/icon.svg') {
  if (!('Notification' in window)) return
  if (Notification.permission !== 'granted') return
  if (navigator.serviceWorker?.controller) {
    navigator.serviceWorker.ready.then(reg => {
      reg.showNotification(title, { body, icon })
    })
  } else {
    new Notification(title, { body, icon })
  }
}

export async function watchIncomingTx(address, network, lastKnownCount, onNewTx) {
  // Store last TX count in sessionStorage
  const key = `radiant_tx_count_${address}`
  const stored = parseInt(sessionStorage.getItem(key) || '0')
  if (lastKnownCount > stored) {
    sessionStorage.setItem(key, lastKnownCount.toString())
    if (stored > 0) onNewTx()
  }
}
