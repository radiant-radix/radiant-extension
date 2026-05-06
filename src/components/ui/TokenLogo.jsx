import { useState } from 'react'

const KNOWN_LOGOS = {
  'resource_rdx1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxradxrd': 'https://assets.radixdlt.com/icons/icon-xrd-32x32.png',
  'resource_tdx_2_1tknxxxxxxxxxradxrdxxxxxxxxx009923554798xxxxxxxxxtfd2jc': 'https://assets.radixdlt.com/icons/icon-xrd-32x32.png',
}

const KNOWN_TOKENS = {
  mainnet: {
    'resource_rdx1t4dy69k6s0gv040xa64cyadyefczlu3zruy4pqfzjsqn7fv3wj4g2': { symbol: 'OCI', logo: 'https://ociswap.com/icons/oci.png' },
  },
  stokenet: {},
}

export default function TokenLogo({ address, symbol, network = 'mainnet', size = 40 }) {
  const [imgError, setImgError] = useState(false)

  const knownToken = KNOWN_TOKENS[network]?.[address]
  const logoUrl = knownToken?.logo || KNOWN_LOGOS[address]
  const displaySymbol = symbol || knownToken?.symbol || address?.slice(9, 13)?.toUpperCase() || '??'

  const colors = ['text-[#00D2B4]', 'text-yellow-400', 'text-purple-400', 'text-blue-400', 'text-pink-400', 'text-green-400']
  const colorIndex = address ? address.charCodeAt(address.length - 1) % colors.length : 0

  if (logoUrl && !imgError) {
    return (
      <div className="rounded-xl overflow-hidden glass-teal flex items-center justify-center shrink-0 bg-white/5"
        style={{ width: size, height: size }}>
        <img src={logoUrl} alt={displaySymbol}
          className="w-3/4 h-3/4 object-contain"
          onError={() => setImgError(true)} />
      </div>
    )
  }

  return (
    <div className="rounded-xl glass-teal flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}>
      <span className={`font-bold ${colors[colorIndex]}`}
        style={{ fontSize: size * 0.28 }}>
        {displaySymbol.slice(0, 4)}
      </span>
    </div>
  )
}
