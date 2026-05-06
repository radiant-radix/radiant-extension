import Papa from 'papaparse'

export function exportTxHistoryCSV(txHistory, address, network) {
  const rows = txHistory.map(tx => {
    const changes = tx.balance_changes?.fungible_balance_changes || []
    const mine = changes.find(c => c.entity_address === address)
    const amount = mine ? parseFloat(mine.balance_change) : 0
    const type = !mine ? 'contract' : amount >= 0 ? 'received' : 'sent'
    return {
      date: tx.confirmed_at ? new Date(tx.confirmed_at).toISOString() : '',
      type,
      amount: Math.abs(amount).toFixed(8),
      resource: mine?.resource_address || '',
      status: tx.transaction_status || '',
      epoch: tx.epoch || '',
      fee_paid: tx.fee_paid || '',
      tx_hash: tx.intent_hash || '',
      network,
    }
  })

  const csv = Papa.unparse(rows)
  const blob = new Blob([csv], { type: 'text/csv' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `radiant-tx-${address.slice(0,16)}-${Date.now()}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

export function exportWalletDataJSON(walletData) {
  const data = {
    exported_at: new Date().toISOString(),
    address: walletData.address,
    public_key: walletData.publicKey,
    accounts: walletData.accounts?.map(a => ({
      name: a.name,
      address: a.address,
      public_key: a.publicKey,
    })),
    note: 'Private keys and seed phrase are NOT included in this export.',
  }
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `radiant-wallet-${Date.now()}.json`
  a.click()
  URL.revokeObjectURL(url)
}
