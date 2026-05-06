// Brute force protection
const ATTEMPT_KEY = 'radiant_failed_attempts'
const LOCKOUT_KEY = 'radiant_lockout_until'
const MAX_ATTEMPTS = 5
const LOCKOUT_DURATION = 5 * 60 * 1000 // 5 minutes

export function getFailedAttempts() {
  return parseInt(localStorage.getItem(ATTEMPT_KEY) || '0')
}

export function isLockedOut() {
  const until = parseInt(localStorage.getItem(LOCKOUT_KEY) || '0')
  if (Date.now() < until) return true
  if (until > 0) clearLockout()
  return false
}

export function getLockoutRemaining() {
  const until = parseInt(localStorage.getItem(LOCKOUT_KEY) || '0')
  return Math.max(0, Math.ceil((until - Date.now()) / 1000))
}

export function recordFailedAttempt() {
  const attempts = getFailedAttempts() + 1
  localStorage.setItem(ATTEMPT_KEY, attempts.toString())
  if (attempts >= MAX_ATTEMPTS) {
    localStorage.setItem(LOCKOUT_KEY, (Date.now() + LOCKOUT_DURATION).toString())
  }
  return attempts
}

export function clearLockout() {
  localStorage.removeItem(ATTEMPT_KEY)
  localStorage.removeItem(LOCKOUT_KEY)
}

// Sanitize input to prevent XSS
export function sanitizeAddress(addr) {
  return addr.replace(/[^a-z0-9_]/g, '').trim()
}

// Validate Radix address format
export function isValidRadixAddress(addr) {
  if (!addr) return false
  const validPrefixes = ['account_rdx1', 'account_tdx_2_1', 'component_rdx1', 'component_tdx_2_1']
  return validPrefixes.some(p => addr.startsWith(p)) && addr.length > 20
}

// Validate resource address
export function isValidResourceAddress(addr) {
  if (!addr) return false
  return (addr.startsWith('resource_rdx1') || addr.startsWith('resource_tdx_2_1')) && addr.length > 20
}

// Clear sensitive data from memory (best effort)
export function clearSensitiveData() {
  // Called after operations that handle private keys
  if (typeof window !== 'undefined' && window.gc) window.gc()
}
