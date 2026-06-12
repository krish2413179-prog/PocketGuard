/**
 * PocketGuard Snap — client-side installer utility.
 *
 * The Snap ID during local development is: local:http://localhost:8080
 * In production (after publishing to npm): npm:pocketguard-snap
 */

// Switch this to 'npm:pocketguard-snap' after publishing
export const SNAP_ID = 'local:http://localhost:8080';
export const SNAP_VERSION = '1.0.0';

export type SnapInstallStatus =
  | 'not_installed'
  | 'installing'
  | 'installed'
  | 'error'
  | 'unsupported';

/**
 * Checks if MetaMask Flask (Snap-capable) is available.
 */
export function isFlaskAvailable(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.ethereum !== 'undefined' &&
    window.ethereum.isMetaMask === true
  );
}

/**
 * Checks if the current MetaMask install supports Snaps
 * by attempting wallet_getSnaps. Regular MetaMask will
 * either throw or return nothing — Flask returns the snaps map.
 */
async function isSnapCapable(): Promise<boolean> {
  if (!isFlaskAvailable()) return false;
  try {
    const result = await window.ethereum.request({ method: 'wallet_getSnaps' });
    // Regular MetaMask returns undefined or throws; Flask returns an object
    return typeof result === 'object' && result !== null;
  } catch {
    return false;
  }
}

/**
 * Checks if the PocketGuard Snap is currently installed.
 */
export async function isSnapInstalled(): Promise<boolean> {
  if (!isFlaskAvailable()) return false;

  try {
    const snaps = await window.ethereum.request({
      method: 'wallet_getSnaps',
    });
    return !!snaps?.[SNAP_ID];
  } catch {
    return false;
  }
}

/**
 * Installs the PocketGuard Snap.
 * Returns true on success, throws on failure.
 */
export async function installSnap(): Promise<boolean> {
  if (!isFlaskAvailable()) {
    throw new Error(
      'MetaMask is not detected. Please install MetaMask to use PocketGuard Safety.'
    );
  }

  const result = await window.ethereum.request({
    method: 'wallet_requestSnaps',
    params: {
      [SNAP_ID]: { version: `^${SNAP_VERSION}` },
    },
  });

  return !!result?.[SNAP_ID];
}

/**
 * Syncs the parent's blacklist to the PocketGuard backend,
 * which the Snap fetches on every transaction.
 */
export async function syncBlacklistToSnap(addresses: string[]): Promise<void> {
  try {
    await fetch('/api/snap-blacklist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'sync', addresses }),
    });
  } catch (err) {
    console.warn('Failed to sync blacklist to snap endpoint:', err);
  }
}

/**
 * Gets the current Snap installation status.
 * Returns 'unsupported' for regular MetaMask (non-Flask).
 */
export async function getSnapStatus(): Promise<SnapInstallStatus> {
  if (!isFlaskAvailable()) return 'unsupported';
  try {
    const capable = await isSnapCapable();
    if (!capable) return 'unsupported';
    const installed = await isSnapInstalled();
    return installed ? 'installed' : 'not_installed';
  } catch {
    return 'error';
  }
}
