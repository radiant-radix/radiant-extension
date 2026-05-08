import * as bip39 from 'bip39'
import { HDKey } from '@scure/bip32'
import HDKeySlip10 from 'micro-key-producer/slip10.js'
import CryptoJS from 'crypto-js'
import { LTSRadixEngineToolkit, PrivateKey, NetworkId } from '@radixdlt/radix-engine-toolkit'
import { encryptData, decryptData, isLegacyEncryption } from './crypto'
import storage from './extensionStorage.js'

const WALLET_KEY = 'radiant_wallet'
const SESSION_KEY = 'radiant_session'

// Radiant default path (legacy)
const DERIVATION_PATH = "m/44'/1022'/0'/0/0"

// CAP26 - Radix official Babylon derivation paths
export const RADIX_BABYLON_PATH_MAINNET = "m/44'/1022'/1'/525'/1460'/0'"
export const RADIX_BABYLON_PATH_STOKENET = "m/44'/1022'/2'/525'/1460'/0'"

// All known paths for "Find My Address" feature
export const RADIX_PATHS = {
  mainnet: [
    ...Array.from({length: 5}, (_, i) => ({
      path: `m/44'/1022'/1'/525'/1460'/${i}'`,
      label: `Radix Babylon Account ${i+1}`,
      type: "radix", curve: "ed25519"
    })),
    { path: "m/44'/1022'/0'/0/0'", label: "Radix Olympia (Secp256k1)", type: "olympia", curve: "secp256k1" },
    { path: "m/44'/1022'/0'/0/0",  label: "Radix BIP44 (Secp256k1)", type: "bip44strict", curve: "secp256k1" },
    { path: "m/44'/1022'/0'/0/0",  label: "Radiant Legacy (Ed25519)", type: "radiant", curve: "ed25519" },
  ],
  stokenet: [
    ...Array.from({length: 5}, (_, i) => ({
      path: `m/44'/1022'/2'/525'/1460'/${i}'`,
      label: `Radix Babylon Stokenet Account ${i+1}`,
      type: "radix", curve: "ed25519"
    })),
    { path: "m/44'/1022'/0'/0/0'", label: "Radix Olympia (Secp256k1)", type: "olympia", curve: "secp256k1" },
    { path: "m/44'/1022'/0'/0/0",  label: "Radiant Legacy (Ed25519)", type: "radiant", curve: "ed25519" },
  ]
}

export function getDerivationPath(network = 'mainnet', type = 'radiant') {
  if (type === 'radix') {
    return network === 'mainnet' ? RADIX_BABYLON_PATH_MAINNET : RADIX_BABYLON_PATH_STOKENET
  }
  return DERIVATION_PATH
}

// Try all known paths and return derived addresses
export async function deriveAllPaths(mnemonic, network = 'mainnet') {
  const seed = await bip39.mnemonicToSeed(mnemonic.trim().toLowerCase())
  const hdkey = HDKey.fromMasterSeed(seed)
  const networkId = network === 'mainnet' ? NetworkId.Mainnet : NetworkId.Stokenet
  const pathEntries = RADIX_PATHS[network] || RADIX_PATHS.mainnet
  const results = []

  for (const entry of pathEntries) {
    try {
      let child
      if (entry.curve === 'secp256k1') {
        child = hdkey.derive(entry.path)
      } else {
        child = HDKeySlip10.fromMasterSeed(seed).derive(entry.path)
      }
      if (!child.privateKey) continue
      let address
      if (entry.curve === 'secp256k1') {
        const privateKey = new PrivateKey.Secp256k1(child.privateKey)
        address = await LTSRadixEngineToolkit.Derive.virtualAccountAddress(
          privateKey.publicKey(), networkId
        )
      } else {
        const privateKey = new PrivateKey.Ed25519(child.privateKey)
        address = await LTSRadixEngineToolkit.Derive.virtualAccountAddress(
          privateKey.publicKey(), networkId
        )
      }
      if (results.find(r => r.address === address)) continue
      results.push({
        path: entry.path,
        label: entry.label,
        type: entry.type,
        curve: entry.curve,
        address,
        privateKey: Buffer.from(child.privateKey).toString('hex')
      })
    } catch { continue }
  }
  return results
}

export function generateMnemonic() {
  return bip39.generateMnemonic(256)
}

export function validateMnemonic(mnemonic) {
  return bip39.validateMnemonic(mnemonic.trim().toLowerCase())
}

export async function mnemonicToKeypair(mnemonic, network = 'mainnet', pathType = 'radiant') {
  const seed = await bip39.mnemonicToSeed(mnemonic.trim().toLowerCase())
  const hdkey = HDKey.fromMasterSeed(seed)
  const path = getDerivationPath(network, pathType)
  const child = hdkey.derive(path)
  const privateKey = new PrivateKey.Ed25519(child.privateKey)
  const networkId = network === 'mainnet' ? NetworkId.Mainnet : NetworkId.Stokenet
  const address = await LTSRadixEngineToolkit.Derive.virtualAccountAddress(
    privateKey.publicKey(), networkId
  )
  return {
    privateKey: Buffer.from(child.privateKey).toString('hex'),
    publicKey: privateKey.publicKeyHex(),
    address,
  }
}

export async function encryptWallet(data, password) {
  return encryptData(data, password)
}

export function decryptWallet(cipher, password) {
  if (!cipher) return null
  // Handle legacy crypto-js encryption
  if (isLegacyEncryption(cipher)) {
    try {
      const bytes = CryptoJS.AES.decrypt(cipher, password)
      return JSON.parse(bytes.toString(CryptoJS.enc.Utf8))
    } catch { return null }
  }
  // New Web Crypto encryption — returns a promise
  return decryptData(cipher, password)
}

// Save encrypted wallet string to chrome.storage
export async function saveWallet(encryptedData) {
  await storage.setItem(WALLET_KEY, encryptedData)
}

// Load encrypted wallet string from chrome.storage
export async function loadWallet() {
  return await storage.getItem(WALLET_KEY)
}

// Check if wallet exists in chrome.storage
export async function walletExists() {
  const data = await storage.getItem(WALLET_KEY)
  return data !== null
}

// Delete wallet and session from chrome.storage
export async function deleteWallet() {
  await storage.removeItem(WALLET_KEY)
  await storage.removeItem(SESSION_KEY)
}

// Save decrypted session data to chrome.storage
export async function saveSession(walletData) {
  await storage.setItem(SESSION_KEY, JSON.stringify(walletData))
}

// Load session data from chrome.storage
export async function loadSession() {
  try {
    const data = await storage.getItem(SESSION_KEY)
    return data ? JSON.parse(data) : null
  } catch { return null }
}

// Clear session (lock the wallet)
export async function clearSession() {
  await storage.removeItem(SESSION_KEY)
}
