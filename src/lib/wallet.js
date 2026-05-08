import storage from './extensionStorage.js';

const WALLET_KEY = 'radiant_wallet';
const SESSION_KEY = 'radiant_session';

// Check if a wallet already exists in storage
export async function walletExists() {
  const data = await storage.getItem(WALLET_KEY);
  return data !== null;
}

// Save a new wallet (encrypted mnemonic, address, etc.)
export async function saveWallet(walletData) {
  await storage.setItem(WALLET_KEY, JSON.stringify(walletData));
}

// Load wallet data from storage
export async function loadWallet() {
  const data = await storage.getItem(WALLET_KEY);
  return data ? JSON.parse(data) : null;
}

// Delete wallet and session (full reset)
export async function deleteWallet() {
  await storage.removeItem(WALLET_KEY);
  await storage.removeItem(SESSION_KEY);
}

// Save session state (unlock state)
export async function saveSession(sessionData) {
  await storage.setItem(SESSION_KEY, JSON.stringify(sessionData));
}

// Load current session from storage
export async function loadSession() {
  const data = await storage.getItem(SESSION_KEY);
  return data ? JSON.parse(data) : null;
}

// Clear session (lock the wallet)
export async function clearSession() {
  await storage.removeItem(SESSION_KEY);
}
