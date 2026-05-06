import { RadixDappToolkit, RadixNetwork } from '@radixdlt/radix-dapp-toolkit'

let rdt = null

export function initDappToolkit(network = 'mainnet') {
  if (rdt) return rdt
  try {
    rdt = RadixDappToolkit({
      dAppDefinitionAddress: 'account_rdx12xewm2nf9r5cht95pug3kc6xffp2kcwtvjeay7r74tjc3qaenwewvc',
      networkId: network === 'mainnet' ? RadixNetwork.Mainnet : RadixNetwork.Stokenet,
      applicationName: 'Radiant Wallet',
      applicationVersion: '0.1.0',
    })
    return rdt
  } catch (e) {
    console.error('dApp toolkit init failed:', e)
    return null
  }
}

export function getDappToolkit() { return rdt }

// Store connected dApps
const DAPPS_KEY = 'radiant_connected_dapps'

export function getConnectedDapps() {
  try { return JSON.parse(localStorage.getItem(DAPPS_KEY) || '[]') }
  catch { return [] }
}

export function addConnectedDapp(dapp) {
  const dapps = getConnectedDapps()
  const existing = dapps.findIndex(d => d.origin === dapp.origin)
  if (existing >= 0) {
    dapps[existing] = { ...dapps[existing], ...dapp, lastConnected: Date.now() }
  } else {
    dapps.push({ ...dapp, connectedAt: Date.now(), lastConnected: Date.now() })
  }
  localStorage.setItem(DAPPS_KEY, JSON.stringify(dapps))
  return dapps
}

export function removeConnectedDapp(origin) {
  const dapps = getConnectedDapps().filter(d => d.origin !== origin)
  localStorage.setItem(DAPPS_KEY, JSON.stringify(dapps))
  return dapps
}

// Generate connection deeplink for Radix Wallet official
export function generateRadixWalletDeeplink(dappName, dappOrigin, network = 'mainnet') {
  const params = new URLSearchParams({
    dAppDefinitionAddress: 'account_rdx12xewm2nf9r5cht95pug3kc6xffp2kcwtvjeay7r74tjc3qaenwewvc',
    networkId: network === 'mainnet' ? '1' : '2',
    dAppName: dappName,
    dAppOrigin: dappOrigin,
  })
  return `radixwallet://connect?${params.toString()}`
}

// Check if running in dApp context (embedded)
export function isDappContext() {
  try {
    return window.self !== window.top || !!window.opener
  } catch {
    return true
  }
}
