import { useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import Icon from '../../components/ui/Icon'

export default function Welcome() {
  const navigate = useNavigate()
  const [visible, setVisible] = useState(false)

  useEffect(() => { setTimeout(() => setVisible(true), 100) }, [])

  return (
    <div className="min-h-screen bg-[#040E0E] flex flex-col items-center justify-center relative overflow-hidden px-6">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-[radial-gradient(ellipse,rgba(0,210,180,0.12)_0%,transparent_70%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(0,210,180,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(0,210,180,0.025)_1px,transparent_1px)] bg-[size:60px_60px] pointer-events-none" />

      <div className={`relative z-10 flex flex-col items-center text-center max-w-sm w-full transition-all duration-700 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>

        <div className="animate-float mb-8">
          <div className="w-24 h-24 rounded-3xl glass-teal flex items-center justify-center animate-glow-pulse">
            <svg width="44" height="44" viewBox="0 0 48 48" fill="none">
              <polygon points="24,4 44,36 4,36" fill="none" stroke="#00D2B4" strokeWidth="2.5" strokeLinejoin="round"/>
              <polygon points="24,14 36,36 12,36" fill="rgba(0,210,180,0.12)" stroke="#80EEE0" strokeWidth="1.5" strokeLinejoin="round"/>
              <circle cx="24" cy="28" r="3" fill="#00D2B4"/>
            </svg>
          </div>
        </div>

        <h1 className="text-5xl font-black leading-none mb-2">
          <span className="teal-text">Radiant</span>
        </h1>
        <p className="text-sm text-[#2A5550] font-mono tracking-[0.35em] uppercase mb-2">Wallet</p>
        <p className="text-[#3A7A72] text-sm leading-relaxed mb-12">
          The most powerful Radix wallet.<br/>Built for developers. Made for everyone.
        </p>

        <div className="w-full flex flex-col gap-3">
          <button onClick={() => navigate('/create')} className="btn-teal w-full py-4 rounded-2xl text-base font-semibold">
            Create New Wallet
          </button>
          <button onClick={() => navigate('/import')} className="btn-ghost w-full py-4 rounded-2xl text-base font-semibold">
            Import Existing Wallet
          </button>
        </div>

        <div className="mt-10 flex items-center gap-2">
          <Icon name="shield" size={12} className="text-[#1A4040]" />
          <p className="text-[#1A4040] text-xs font-mono">Non-custodial · Open Source · Radix Babylon</p>
        </div>
      </div>
    </div>
  )
}
