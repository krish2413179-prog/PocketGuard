import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs';
import * as path from 'path';

const STORE_PATH = process.env.NODE_ENV === 'production'
  ? '/tmp/pocketguard-family.json'
  : path.join(process.cwd(), '.next', 'family-store.json');

function readStore(): Record<string, any> {
  try {
    if (fs.existsSync(STORE_PATH)) {
      const raw = fs.readFileSync(STORE_PATH, 'utf8');
      return JSON.parse(raw);
    }
  } catch { /* corrupted file — start fresh */ }
  return {};
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const address = searchParams.get('address')?.toLowerCase().trim();

  if (!address) {
    return NextResponse.json({ error: 'Address is required' }, { status: 400 });
  }

  const store = readStore();
  let isSafe = false;

  // Search if the address is a registered child's smart account address or in their whitelist
  for (const key of Object.keys(store)) {
    const config = store[key];
    if (config?.smartAccountAddress?.toLowerCase() === address) {
      isSafe = true;
      break;
    }
    if (Array.isArray(config?.whitelist) && config.whitelist.some((a: string) => a.toLowerCase() === address)) {
      isSafe = true;
      break;
    }
  }

  return NextResponse.json(
    { isSafe },
    {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Cache-Control': 'no-store',
      },
    }
  );
}

export async function OPTIONS() {
  return new NextResponse(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
