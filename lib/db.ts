import * as fs from 'fs';
import * as path from 'path';

// Local fallback store paths
const FAMILY_STORE_PATH = path.join(process.cwd(), 'store', 'family-store.json');
const PERMS_STORE_PATH = path.join(process.cwd(), 'store', 'permissions-store.json');
const TXS_STORE_PATH = path.join(process.cwd(), 'store', 'transactions-store.json');

async function runKvCommand(command: any[]): Promise<any> {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;
  if (!url || !token) return null;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(command),
      cache: 'no-store'
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.result;
  } catch (e) {
    console.error('[KV Error]:', e);
    return null;
  }
}

// ── Family Config ───────────────────────────────────────────────────────────
export async function readFamilyStore(): Promise<Record<string, any>> {
  if (process.env.KV_REST_API_URL) {
    const data = await runKvCommand(['get', 'pocketguard:family_store']);
    if (data) {
      try {
        return typeof data === 'string' ? JSON.parse(data) : data;
      } catch {
        return {};
      }
    }
  }
  
  try {
    if (fs.existsSync(FAMILY_STORE_PATH)) {
      return JSON.parse(fs.readFileSync(FAMILY_STORE_PATH, 'utf8'));
    }
  } catch {}
  return {};
}

export async function writeFamilyStore(data: Record<string, any>): Promise<void> {
  if (process.env.KV_REST_API_URL) {
    await runKvCommand(['set', 'pocketguard:family_store', JSON.stringify(data)]);
    return;
  }

  try {
    const dir = path.dirname(FAMILY_STORE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(FAMILY_STORE_PATH, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error('[family-store] write failed:', e);
  }
}

// ── Agent Permissions ────────────────────────────────────────────────────────
export async function readPermissionsStore(): Promise<any[]> {
  if (process.env.KV_REST_API_URL) {
    const data = await runKvCommand(['get', 'pocketguard:permissions_store']);
    if (data) {
      try {
        return typeof data === 'string' ? JSON.parse(data) : data;
      } catch {
        return [];
      }
    }
  }

  try {
    if (fs.existsSync(PERMS_STORE_PATH)) {
      return JSON.parse(fs.readFileSync(PERMS_STORE_PATH, 'utf8'));
    }
  } catch {}
  return [];
}

export async function writePermissionsStore(perms: any[]): Promise<void> {
  if (process.env.KV_REST_API_URL) {
    await runKvCommand(['set', 'pocketguard:permissions_store', JSON.stringify(perms)]);
    return;
  }

  try {
    const dir = path.dirname(PERMS_STORE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(PERMS_STORE_PATH, JSON.stringify(perms, null, 2), 'utf8');
  } catch (e) {
    console.error('[permissions-store] write failed:', e);
  }
}

// ── Agent Transactions ───────────────────────────────────────────────────────
export async function readTransactionsStore(): Promise<any[]> {
  if (process.env.KV_REST_API_URL) {
    const data = await runKvCommand(['get', 'pocketguard:transactions_store']);
    if (data) {
      try {
        return typeof data === 'string' ? JSON.parse(data) : data;
      } catch {
        return [];
      }
    }
  }

  try {
    if (fs.existsSync(TXS_STORE_PATH)) {
      return JSON.parse(fs.readFileSync(TXS_STORE_PATH, 'utf8'));
    }
  } catch {}
  return [];
}

export async function writeTransactionsStore(txs: any[]): Promise<void> {
  if (process.env.KV_REST_API_URL) {
    await runKvCommand(['set', 'pocketguard:transactions_store', JSON.stringify(txs)]);
    return;
  }

  try {
    const dir = path.dirname(TXS_STORE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(TXS_STORE_PATH, JSON.stringify(txs, null, 2), 'utf8');
  } catch (e) {
    console.error('[transactions-store] write failed:', e);
  }
}
