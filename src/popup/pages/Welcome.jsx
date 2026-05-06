import { useNavigate } from 'react-router-dom'

export default function Welcome() {
  const navigate = useNavigate()
  return (
    <div className="w-full h-full bg-[#040E0E] flex flex-col items-center justify-center px-6 gap-6 relative overflow-hidden"
      style={{minHeight: '600px'}}>
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-[250px] bg-[radial-gradient(ellipse,rgba(0,210,180,0.12)_0%,transparent_70%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(0,210,180,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(0,210,180,0.02)_1px,transparent_1px)] bg-[size:40px_40px] pointer-events-none" />

      <div className="relative flex flex-col items-center gap-4">
        <svg width="72" height="72" viewBox="0 0 200 200" fill="none">
          <polygon points="100,20 180,150 20,150" stroke="#00D2B4" strokeWidth="8" strokeLinejoin="round" fill="none"/>
          <circle cx="100" cy="118" r="14" fill="#00D2B4"/>
        </svg>
        <div className="text-center">
          <h1 className="text-4xl font-black text-[#E8F8F6] tracking-tight mb-2">Radiant</h1>
          <p className="text-[#3A7A72] text-sm leading-relaxed">
            Non-custodial Radix wallet.<br/>Your keys, your assets.
          </p>
        </div>
      </div>

      <div className="relative flex flex-col gap-3 w-full">
        <button onClick={() => navigate('/create')}
          className="w-full py-4 rounded-2xl text-base font-bold text-[#040E0E] transition-all active:scale-[0.98]"
          style={{background: '#00D2B4'}}>
          Create New Wallet
        </button>
        <button onClick={() => navigate('/import')}
          className="w-full py-4 rounded-2xl text-base font-semibold text-[#00D2B4] border border-[rgba(0,210,180,0.3)] bg-transparent transition-all active:scale-[0.98] hover:border-[#00D2B4] hover:bg-[rgba(0,210,180,0.05)]">
          Import Existing Wallet
        </button>
      </div>

      <p className="relative text-[#1A4040] text-xs">radixradiant.xyz</p>
    </div>
  )
}
