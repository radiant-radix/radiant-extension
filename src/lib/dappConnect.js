import storage from './extensionStorage.js'

const DAPPS_KEY = 'radiant_connected_dapps'

export async function getConnectedDapps() {
  try {
    const data = await storage.getItem(DAPPS_KEY)
    return data ? JSON.parse(data) : []
  } catch { return [] }
}

export async function addConnectedDapp(dapp) {
  const dapps = await getConnectedDapps()
  const existing = dapps.findIndex(d => d.origin === dapp.origin)
  if (existing >= 0) {
    dapps[existing] = { ...dapps[existing], ...dapp, lastConnected: Date.now() }
  } else {
    dapps.push({ ...dapp, connectedAt: Date.now(), lastConnected: Date.now() })
  }
  await storage.setItem(DAPPS_KEY, JSON.stringify(dapps))
  return dapps
}

export async function removeConnectedDapp(origin) {
  const dapps = (await getConnectedDapps()).filter(d => d.origin !== origin)
  await storage.setItem(DAPPS_KEY, JSON.stringify(dapps))
  return dapps
}

export function generateRadixWalletDeeplink(dappName, dappOrigin, network = 'mainnet') {
  const params = new URLSearchParams({
    dAppDefinitionAddress: 'account_rdx12xewm2nf9r5cht95pug3kc6xffp2kcwtvjeay7r74tjc3qaenwewvc',
    networkId: network === 'mainnet' ? '1' : '2',
    dAppName: dappName,
    dAppOrigin: dappOrigin,
  })
  return `radixwallet://connect?${params.toString()}`
}
