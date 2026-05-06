import * as bip39 from 'bip39'
import { HDKey } from '@scure/bip32'
import CryptoJS from 'crypto-js'
import { LTSRadixEngineToolkit, PrivateKey, NetworkId } from '@radixdlt/radix-engine-toolkit'
import { encryptData, decryptData, isLegacyEncryption } from './crypto'

// Radiant default path (legacy)
const DERIVATION_PATH = "m/44'/1022'/0'/0/0"
// Radix official Babylon path
export const RADIX_BABYLON_PATH_MAINNET = "m/44'/1022'/1'/525'/1460'/0'"
export const RADIX_BABYLON_PATH_STOKENET = "m/44'/1022'/2'/525'/1460'/0'"

export function getDerivationPath(network = 'mainnet', type = 'radiant') {
  if (type === 'radix') {
    return network === 'mainnet' ? RADIX_BABYLON_PATH_MAINNET : RADIX_BABYLON_PATH_STOKENET
  }
  return DERIVATION_PATH
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
  localStorage.setItem('radiant_wallet', encryptedData)
}

export function loadWallet() {
  return localStorage.getItem('radiant_wallet')
}

export function walletExists() {
  return !!localStorage.getItem('radiant_wallet')
}

export function deleteWallet() {
  localStorage.removeItem('radiant_wallet')
  sessionStorage.removeItem('radiant_session')
}

export function saveSession(walletData) {
  sessionStorage.setItem('radiant_session', JSON.stringify(walletData))
}

export function loadSession() {
  try {
    return JSON.parse(sessionStorage.getItem('radiant_session'))
  } catch { return null }
}
