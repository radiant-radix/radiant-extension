import { useNavigate } from 'react-router-dom'

export default function Welcome() {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen bg-[#040E0E] flex flex-col items-center justify-center px-6 gap-6 relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[400px] h-[300px] bg-[radial-gradient(ellipse,rgba(0,210,180,0.1)_0%,transparent_70%)] pointer-events-none" />
      <div className="flex flex-col items-center gap-4">
        <svg width="64" height="64" viewBox="0 0 200 200" fill="none">
          <polygon points="100,20 180,150 20,150" stroke="#00D2B4" strokeWidth="10" strokeLinejoin="round" fill="none"/>
          <circle cx="100" cy="120" r="16" fill="#00D2B4"/>
        </svg>
        <h1 className="text-3xl font-black text-[#E8F8F6] tracking-tight">Radiant</h1>
        <p className="text-[#3A7A72] text-sm text-center leading-relaxed">
          Non-custodial Radix wallet.<br/>Your keys, your assets.
        </p>
      </div>
      <div className="flex flex-col gap-3 w-full max-w-xs">
        <button onClick={() => navigate('/create')}
          className="btn-teal w-full py-4 rounded-2xl text-base font-bold">
          Create New Wallet
        </button>
        <button onClick={() => navigate('/import')}
          className="btn-ghost w-full py-4 rounded-2xl text-base font-semibold">
          Import Existing Wallet
        </button>
      </div>
      <p className="text-[#1A4040] text-xs text-center">
        radixradiant.xyz
      </p>
    </div>
  )
}
