import { useEffect, useRef, useState } from 'react'
import { BrowserQRCodeReader } from '@zxing/library'

export default function QRScanner({ onScan, onClose }) {
  const videoRef = useRef(null)
  const [error, setError] = useState('')
  const [scanning, setScanning] = useState(true)
  const readerRef = useRef(null)

  useEffect(() => {
    const reader = new BrowserQRCodeReader()
    readerRef.current = reader

    reader.listVideoInputDevices().then(devices => {
      if (devices.length === 0) {
        setError('No camera found')
        return
      }
      const deviceId = devices[devices.length - 1]?.deviceId
      reader.decodeFromVideoDevice(deviceId, videoRef.current, (result, err) => {
        if (result) {
          const text = result.getText()
          if (text.startsWith('account_') || text.startsWith('component_')) {
            setScanning(false)
            onScan(text)
          } else {
            setError('Not a valid Radix address QR code')
          }
        }
      })
    }).catch(e => {
      setError('Camera access denied. Please allow camera permission.')
    })

    return () => {
      try { readerRef.current?.reset() } catch {}
    }
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[#040E0E]">
      <div className="relative z-10 flex items-center gap-4 px-6 pt-12 pb-4">
        <button onClick={onClose} className="w-10 h-10 rounded-xl glass-teal flex items-center justify-center text-[#00D2B4]">←</button>
        <h2 className="font-display text-lg font-700 text-[#E8F8F6]">Scan QR Code</h2>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 gap-6">
        <div className="relative w-full max-w-sm aspect-square rounded-3xl overflow-hidden border-2 border-[rgba(0,210,180,0.3)]">
          <video ref={videoRef} className="w-full h-full object-cover" />
          {/* Scanning overlay */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="w-48 h-48 border-2 border-[#00D2B4] rounded-2xl relative">
              <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-[#00D2B4] rounded-tl-lg" />
              <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-[#00D2B4] rounded-tr-lg" />
              <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-[#00D2B4] rounded-bl-lg" />
              <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-[#00D2B4] rounded-br-lg" />
              {scanning && (
                <div className="absolute inset-x-0 top-0 h-0.5 bg-[#00D2B4] animate-[scanLine_2s_linear_infinite]" />
              )}
            </div>
          </div>
          {/* Dim overlay outside scan area */}
          <div className="absolute inset-0 bg-black/40 pointer-events-none" style={{
            maskImage: 'radial-gradient(ellipse 192px 192px at center, transparent 0%, black 100%)',
            WebkitMaskImage: 'radial-gradient(ellipse 192px 192px at center, transparent 0%, black 100%)',
          }} />
        </div>

        {error && (
          <div className="glass-teal rounded-2xl px-4 py-3 w-full max-w-sm">
            <p className="text-red-400 text-sm font-mono text-center">{error}</p>
          </div>
        )}

        <p className="text-[#3A7A72] text-sm text-center font-mono">
          Point camera at a Radix account QR code
        </p>
      </div>
    </div>
  )
}
