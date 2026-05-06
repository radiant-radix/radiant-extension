const LOCK_TIMEOUT = 5 * 60 * 1000 // 5 minutes
const SESSION_KEY = 'radiant_unlocked'

export function setLastActive() {
  sessionStorage.setItem('radiant_last_active', Date.now().toString())
}

export function isLocked() {
  // If no unlock flag, always locked
  const unlocked = sessionStorage.getItem(SESSION_KEY)
  if (!unlocked) return true
  const last = sessionStorage.getItem('radiant_last_active')
  if (!last) return true
  return Date.now() - parseInt(last) > LOCK_TIMEOUT
}

export function unlock() {
  sessionStorage.setItem(SESSION_KEY, '1')
  setLastActive()
}

export function lock() {
  sessionStorage.removeItem(SESSION_KEY)
  sessionStorage.removeItem('radiant_last_active')
  sessionStorage.removeItem('radiant_session')
}
