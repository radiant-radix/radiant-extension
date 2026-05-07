import * as bip39 from 'bip39'
import { extGet, extSet, extRemove } from './extensionStorage'
import { HDKey } from '@scure/bip32'
import HDKeySlip10 from 'micro-key-producer/slip10.js'
import CryptoJS from 'crypto-js'
import { LTSRadixEngineToolkit, PrivateKey, NetworkId } from '@radixdlt/radix-engine-toolkit'
import { encryptData, decryptData, isLegacyEncryption } from './crypto'

// Radiant default path (legacy)
const DERIVATION_PATH = "m/44'/1022'/0'/0/0"
// Radix official Babylon path
// CAP26 - Radix official Babylon derivation (from Sargon source)
// m/44'/1022'/{networkId}'/525'/1460'/{index}' - ALL components hardened
export const RADIX_BABYLON_PATH_MAINNET = "m/44'/1022'/1'/525'/1460'/0'"
export const RADIX_BABYLON_PATH_STOKENET = "m/44'/1022'/2'/525'/1460'/0'"

// All known paths for "Find My Address" feature
export const RADIX_PATHS = {
  mainnet: [
    // CAP26 Babylon - account index 0..4
    ...Array.from({length: 5}, (_, i) => ({
      path: `m/44'/1022'/1'/525'/1460'/${i}'`,
      label: `Radix Babylon Account ${i+1}`,
      type: "radix", curve: "ed25519"
    })),
    // Olympia Secp256k1
    { path: "m/44'/1022'/0'/0/0'", label: "Radix Olympia (Secp256k1)", type: "olympia", curve: "secp256k1" },
    { path: "m/44'/1022'/0'/0/0",  label: "Radix BIP44 (Secp256k1)", type: "bip44strict", curve: "secp256k1" },
    // Radiant legacy Ed25519
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
  // Use already-imported modules (no dynamic import needed)
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
      // Avoid duplicate addresses
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
  // New Web Crypto encryption — return promise
  return decryptData(cipher, password)
}

export async function saveWallet(encryptedData) {
  await extSet('radiant_wallet', encryptedData)
}

export async function loadWallet() {
  return await extGet('radiant_wallet')
}

export async function walletExists() {
  try { return !!(await extGet('radiant_wallet')) } catch { return false }
}

export async function deleteWallet() {
  await extRemove('radiant_wallet')
  sessionStorage.removeItem('radiant_session')
}

export async function saveSession(walletData) {
  await extSet('radiant_session', JSON.stringify(walletData))
}

export async function loadSession() {
  try {
    const data = await extGet('radiant_session')
    return data ? JSON.parse(data) : null
  } catch { return null }
}
