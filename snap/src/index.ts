import type { OnTransactionHandler, OnInstallHandler } from '@metamask/snaps-sdk';
import { panel, text, heading, divider, copyable } from '@metamask/snaps-sdk';
import { DEFAULT_BLACKLIST, BLOCKED_CATEGORIES, fetchLiveBlacklist } from './blacklist';

// The PocketGuard app URL — snap will fetch the live blacklist from here.
// In production this would be your deployed domain.
const POCKETGUARD_APP_URL = 'https://pocketguard-e096.onrender.com';

/**
 * onInstall — runs once when the snap is installed.
 * Shows a welcome message explaining what it does.
 */
export const onInstall: OnInstallHandler = async () => {
  await snap.request({
    method: 'snap_dialog',
    params: {
      type: 'alert',
      content: panel([
        heading('🛡️ PocketGuard Safety Snap Installed!'),
        divider(),
        text('This snap protects your child by automatically **blocking transactions** to gambling and betting contracts.'),
        divider(),
        text('**How it works:**'),
        text('• Every transaction you try to sign will be checked against a blacklist'),
        text('• Betting sites (Polymarket, Shuffle Gaming, etc.) are blocked instantly'),
        text('• Blocked transactions show a clear warning before you can sign'),
        divider(),
        text('Your parent manages the blocked list from the PocketGuard dashboard.'),
        text('Stay safe! 🐷'),
      ]),
    },
  });
};

/**
 * onTransaction — runs for EVERY transaction the user tries to sign, from ANY website.
 * This is the core protection: checks the destination against the blacklist.
 */
export const onTransaction: OnTransactionHandler = async ({ transaction, transactionOrigin }) => {
  const toAddress = (transaction.to as string | undefined)?.toLowerCase();
  const fromAddress = (transaction.from as string | undefined)?.toLowerCase() || '';

  if (!toAddress) {
    // Contract deployment — not a concern for kid spending
    return { content: panel([text('ℹ️ Contract deployment transaction.')]) };
  }

  // Fetch the live blacklist from PocketGuard (falls back to defaults if offline)
  let blacklist = DEFAULT_BLACKLIST;
  try {
    const localRes = await fetch('http://localhost:3000/api/snap-blacklist');
    if (localRes.ok) {
      const data = await localRes.json() as { blacklist: string[] };
      if (Array.isArray(data.blacklist)) {
        blacklist = Array.from(new Set([...DEFAULT_BLACKLIST, ...data.blacklist.map(a => a.toLowerCase())]));
      }
    } else {
      throw new Error('Local offline');
    }
  } catch {
    blacklist = await fetchLiveBlacklist(POCKETGUARD_APP_URL);
  }

  const isBlocked = blacklist.includes(toAddress);

  if (isBlocked) {
    const category = BLOCKED_CATEGORIES[toAddress] || 'Gambling / Betting Platform';
    const origin = transactionOrigin || 'unknown site';

    return {
      content: panel([
        heading('🚫 Transaction Blocked by PocketGuard'),
        divider(),
        text(`**This transaction has been flagged and blocked.**`),
        divider(),
        text(`**You are trying to send to:**`),
        copyable(transaction.to as string),
        divider(),
        text(`**Blocked reason:** ${category}`),
        text(`**Requested by:** ${origin}`),
        divider(),
        text('⚠️ Your parents have blocked this address because it is a **gambling or betting platform**. This transaction is not allowed.'),
        divider(),
        text('If you think this is a mistake, ask your parents to update your PocketGuard settings.'),
        text('🐷 PocketGuard is keeping your crypto safe!'),
      ]),
      severity: 'critical',
    };
  }

  // Address is safe — show a brief safety confirmation
  let isSafe = [
    '0x980b62da83eff3d4576c647993b0c1d7faf17c73', // WETH
    '0x75faf114eafb1bdbe2f0316df893fd58ce46aa4d', // USDC
  ].includes(toAddress);

  if (!isSafe) {
    const urls = ['http://localhost:3000', POCKETGUARD_APP_URL];
    for (const url of urls) {
      try {
        const response = await fetch(`${url}/api/verify-address?address=${toAddress}&parent=${fromAddress}`);
        if (response.ok) {
          const data = await response.json() as { isSafe: boolean };
          if (data.isSafe) {
            isSafe = true;
            break;
          }
        }
      } catch {
        // Continue to next URL
      }
    }
  }

  if (isSafe) {
    return {
      content: panel([
        heading('✅ PocketGuard: Safe Transaction'),
        text('This is a **PocketGuard-approved** destination. You are good to go!'),
      ]),
    };
  }

  // Unknown address — warn but don't block
  return {
    content: panel([
      heading('⚠️ PocketGuard: Unrecognized Address'),
      divider(),
      text('This address is **not on your approved list**.'),
      text('Make sure you know where you are sending your money!'),
      divider(),
      text(`Sending to:`),
      copyable(transaction.to as string),
      divider(),
      text('Ask your parents to add this address to your approved list if it is safe.'),
    ]),
    severity: 'critical',
  };
};
