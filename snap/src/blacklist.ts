/**
 * Default hardcoded blacklist — betting/gambling contracts on Arbitrum Sepolia.
 * These are always blocked even if the live API is unreachable.
 */
export const DEFAULT_BLACKLIST: string[] = [
  // Polymarket prediction market (mock Arbitrum address)
  '0x4de23f3f0fb3318287378adbde030cf61714b2f3',
  // Shuffle Gaming contract
  '0xda7320ddebe7964ba029472e38e75c417a2a9448',
  // Generic betting placeholder
  '0x9999999999999999999999999999999999999999',
];

export const BLOCKED_CATEGORIES: Record<string, string> = {
  '0x4de23f3f0fb3318287378adbde030cf61714b2f3': 'Polymarket (Prediction Market / Gambling)',
  '0xda7320ddebe7964ba029472e38e75c417a2a9448': 'Shuffle Gaming (Crypto Casino)',
  '0x9999999999999999999999999999999999999999': 'Blocked Betting Platform',
};

/**
 * Attempts to fetch the live blacklist from the PocketGuard parent app.
 * Falls back to DEFAULT_BLACKLIST if the request fails or times out.
 */
export async function fetchLiveBlacklist(appUrl: string): Promise<string[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);

    const response = await fetch(`${appUrl}/api/snap-blacklist`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) return DEFAULT_BLACKLIST;

    const data = (await response.json()) as { blacklist: string[] };
    if (!Array.isArray(data.blacklist)) return DEFAULT_BLACKLIST;

    // Merge live list with defaults so hardcoded ones are always included
    const merged = new Set([
      ...DEFAULT_BLACKLIST,
      ...data.blacklist.map((a) => a.toLowerCase()),
    ]);
    return Array.from(merged);
  } catch {
    return DEFAULT_BLACKLIST;
  }
}
