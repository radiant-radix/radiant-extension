import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { walletExists, loadSession } from '../lib/wallet.js';
import Popup from './popup.jsx';

export default function App() {
  const [ready, setReady] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    async function init() {
      try {
        const hasWallet = await walletExists();
        if (!hasWallet) {
          navigate('/', { replace: true });
        } else {
          const session = await loadSession();
          if (session && session.unlocked) {
            navigate('/dashboard', { replace: true });
          } else {
            navigate('/unlock', { replace: true });
          }
        }
      } catch (err) {
        console.error('Init error:', err);
        navigate('/', { replace: true });
      }
      setReady(true);
    }
    init();
  }, []);

  if (!ready) {
    return (
      <div className="flex items-center justify-center min-h-[600px] bg-[#040E0E]">
        <div className="text-[#00D2B4] text-sm animate-pulse font-mono">Loading...</div>
      </div>
    );
  }

  return <Popup />;
}
