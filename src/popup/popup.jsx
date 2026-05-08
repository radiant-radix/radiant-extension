import { Routes, Route, Navigate } from 'react-router-dom';
import Welcome from './pages/Welcome.jsx';
import CreateWallet from './pages/CreateWallet.jsx';
import ImportWallet from './pages/ImportWallet.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Unlock from './pages/Unlock.jsx';
import DappConnect from './pages/DappConnect.jsx';
import DappSign from './pages/DappSign.jsx';

export default function Popup() {
  return (
    <Routes>
      <Route path="/" element={<Welcome />} />
      <Route path="/create" element={<CreateWallet />} />
      <Route path="/import" element={<ImportWallet />} />
      <Route path="/unlock" element={<Unlock />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/dapp-connect" element={<DappConnect />} />
      <Route path="/dapp-sign" element={<DappSign />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
