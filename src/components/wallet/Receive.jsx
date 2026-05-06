import { QRCodeSVG } from 'qrcode.react'
import { useState } from 'react'
import { copyToClipboard } from '../../lib/clipboard'

export default function Receive({ address, onClose }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    const ok = await copyToClipboard(address)
    if (ok) {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative z-10 w-full max-w-sm bg-[#071414] rounded-t-3xl p-6 border-t border-[rgba(0,210,180,0.15)]"
        onClick={e => e.stopPropagation()}>
        <div className="w-10 h-1 bg-[#1A4040] rounded-full mx-auto mb-6" />
        <h3 className="font-display text-xl font-700 text-[#E8F8F6] text-center mb-6">Receive XRD</h3>

        <div className="flex justify-center mb-6">
          <div className="bg-white p-4 rounded-2xl">
            <QRCodeSVG value={address} size={180} bgColor="#ffffff" fgColor="#040E0E" level="M" />
          </div>
        </div>

        <div className="glass rounded-2xl px-4 py-3 mb-4">
          <p className="text-[#3A7A72] text-xs font-mono mb-2">YOUR ADDRESS</p>
          <p className="text-[#E8F8F6] text-xs font-mono break-all leading-relaxed select-all">{address}</p>
        </div>

        <button onClick={copy} className="btn-teal w-full py-4 rounded-2xl text-base mb-3">
          {copied ? '✓ Copied!' : '⧉ Copy Address'}
        </button>

        <p className="text-center text-[#2A5550] text-xs">Only send XRD and Radix tokens to this address</p>
      </div>
    </div>
  )
}
