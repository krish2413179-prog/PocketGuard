import { NextResponse } from 'next/server';

/**
 * Public endpoint — returns the current blacklist for the PocketGuard Snap.
 * The Snap fetches this on every transaction to get the parent's live blocked list.
 *
 * In production this would read from a DB. For the hackathon demo it returns
 * the default betting/gambling addresses plus any passed via query param.
 */

// Default hardcoded betting/gambling addresses (mirrors snap/src/blacklist.ts)
const DEFAULT_BLACKLIST = [
  '0x4de23f3f0fb3318287378adbde030cf61714b2f3', // Polymarket
  '0xda7320ddebe7964ba029472e38e75c417a2a9448', // Shuffle Gaming
  '0x9999999999999999999999999999999999999999', // Generic betting
];

// In-memory store for dynamically added addresses (parent dashboard pushes here)
// In production: use a real database keyed by parent wallet address
const dynamicBlacklist: Set<string> = new Set();

export async function GET() {
  const merged = [...new Set([...DEFAULT_BLACKLIST, ...dynamicBlacklist])];

  return NextResponse.json(
    { blacklist: merged, count: merged.length },
    {
      headers: {
        // Allow the Snap (running inside MetaMask extension) to fetch this
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST',
        'Cache-Control': 'no-store',
      },
    }
  );
}

export async function POST(req: Request) {
  try {
    const body = await req.json();

    if (body.action === 'add' && typeof body.address === 'string') {
      dynamicBlacklist.add(body.address.toLowerCase());
      return NextResponse.json({ success: true, count: dynamicBlacklist.size });
    }

    if (body.action === 'remove' && typeof body.address === 'string') {
      dynamicBlacklist.delete(body.address.toLowerCase());
      return NextResponse.json({ success: true, count: dynamicBlacklist.size });
    }

    if (body.action === 'sync' && Array.isArray(body.addresses)) {
      // Parent dashboard bulk-syncs their full blacklist
      dynamicBlacklist.clear();
      body.addresses.forEach((a: string) => dynamicBlacklist.add(a.toLowerCase()));
      return NextResponse.json({ success: true, count: dynamicBlacklist.size });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
