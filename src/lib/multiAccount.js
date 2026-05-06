import * as bip39 from 'bip39'
import { HDKey } from '@scure/bip32'
import { LTSRadixEngineToolkit, PrivateKey, NetworkId } from '@radixdlt/radix-engine-toolkit'

export async function deriveAccount(mnemonic, index = 0, network = 'mainnet', options = {}) {
  const seed = await bip39.mnemonicToSeed(mnemonic.trim().toLowerCase())
  const hdkey = HDKey.fromMasterSeed(seed)
  const pathType = options?.pathType || 'radiant'
  const baseMainnet = "m/44'/1022'/1'/525'/1460'"
  const baseStokenet = "m/44'/1022'/2'/525'/1460'"
  const path = pathType === 'radix'
    ? `${network === 'mainnet' ? baseMainnet : baseStokenet}/${index}'`
    : `m/44'/1022'/0'/0/${index}`
  const child = hdkey.derive(path)
  const privateKey = new PrivateKey.Ed25519(child.privateKey)
  const networkId = network === 'mainnet' ? NetworkId.Mainnet : NetworkId.Stokenet
  const address = await LTSRadixEngineToolkit.Derive.virtualAccountAddress(
    privateKey.publicKey(),
    networkId
  )
  return {
    index,
    name: `Account ${index + 1}`,
    address,
    publicKey: privateKey.publicKeyHex(),
    privateKey: Buffer.from(child.privateKey).toString('hex'),
  }
}

export async function deriveMultipleAccounts(mnemonic, count = 5, network = 'mainnet') {
  const accounts = []
  for (let i = 0; i < count; i++) {
    const acc = await deriveAccount(mnemonic, i, network)
    accounts.push(acc)
  }
  return accounts
}
