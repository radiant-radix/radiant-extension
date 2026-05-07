// Extension storage adapter - replaces localStorage for Chrome extension
const isExtension = typeof chrome !== 'undefined' && chrome.storage

export async function extGet(key) {
  if (!isExtension) return localStorage.getItem(key)
  return new Promise(resolve => {
    chrome.storage.local.get(key, result => resolve(result[key] || null))
  })
}

export async function extSet(key, value) {
  if (!isExtension) { localStorage.setItem(key, value); return }
  return new Promise(resolve => {
    chrome.storage.local.set({ [key]: value }, resolve)
  })
}

export async function extRemove(key) {
  if (!isExtension) { localStorage.removeItem(key); return }
  return new Promise(resolve => {
    chrome.storage.local.remove(key, resolve)
  })
}

export function extGetSync(key) {
  return localStorage.getItem(key)
}
