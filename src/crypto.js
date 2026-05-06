// Modern encryption using Web Crypto API + PBKDF2
const ITERATIONS = 100000
const KEY_LENGTH = 256
const SALT_LENGTH = 32
const IV_LENGTH = 12

async function deriveKey(password, salt) {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  )
}

export async function encryptData(data, password) {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH))
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH))
  const key = await deriveKey(password, salt)
  const enc = new TextEncoder()
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(JSON.stringify(data))
  )
  // Combine salt + iv + encrypted data
  const result = new Uint8Array(salt.length + iv.length + encrypted.byteLength)
  result.set(salt, 0)
  result.set(iv, salt.length)
  result.set(new Uint8Array(encrypted), salt.length + iv.length)
  return btoa(String.fromCharCode(...result))
}

export async function decryptData(ciphertext, password) {
  try {
    const data = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0))
    const salt = data.slice(0, SALT_LENGTH)
    const iv = data.slice(SALT_LENGTH, SALT_LENGTH + IV_LENGTH)
    const encrypted = data.slice(SALT_LENGTH + IV_LENGTH)
    const key = await deriveKey(password, salt)
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      encrypted
    )
    return JSON.parse(new TextDecoder().decode(decrypted))
  } catch {
    return null
  }
}

// Check if this is old crypto-js format (starts with 'U2Fs')
export function isLegacyEncryption(ciphertext) {
  return ciphertext && ciphertext.startsWith('U2Fs')
}
