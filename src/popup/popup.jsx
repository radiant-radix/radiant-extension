import { useState, useEffect } from 'react';
import { walletExists, loadSession } from '../lib/wallet.js';
import Welcome from './pages/Welcome.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Unlock from './pages/Unlock.jsx';

export default function Popup() {
  // Possible states: loading | no-wallet | locked | unlocked
  const [appState, setAppState] = useState('loading');

  useEffect(() => {
    async function initApp() {
      try {
        const hasWallet = await walletExists();

        if (!hasWallet) {
          setAppState('no-wallet');
          return;
        }

        const session = await loadSession();

        if (session && session.unlocked) {
          setAppState('unlocked');
        } else {
          setAppState('locked');
        }
      } catch (err) {
        console.error('Failed to initialize app:', err);
        setAppState('no-wallet');
      }
    }

    initApp();
  }, []);

  // Called after wallet is successfully created or imported
  function handleWalletCreated() {
    setAppState('unlocked');
  }

  // Called after user successfully unlocks the wallet
  function handleUnlocked() {
    setAppState('unlocked');
  }

  // Called when user locks the wallet
  function handleLock() {
    setAppState('locked');
  }

  if (appState === 'loading') {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px] bg-gray-900">
        <div className="text-white text-sm animate-pulse">Loading...</div>
      </div>
    );
  }

  if (appState === 'no-wallet') {
    return <Welcome onWalletCreated={handleWalletCreated} />;
  }

  if (appState === 'locked') {
    return <Unlock onUnlocked={handleUnlocked} />;
  }

  return <Dashboard onLock={handleLock} />;
}
