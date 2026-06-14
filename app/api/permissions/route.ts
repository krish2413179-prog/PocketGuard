import { NextRequest, NextResponse } from 'next/server';
import { readPermissionsStore, writePermissionsStore } from '../../../lib/db';
import type { PermissionGrant } from '../../../types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  const account = searchParams.get('account');
  const permissionsStore = await readPermissionsStore();

  if (id) {
    const permission = permissionsStore.find((p: PermissionGrant) => p.permissionId === id);
    if (!permission) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ permission });
  }
  if (account) {
    const filtered = permissionsStore.filter((p: PermissionGrant) => p.smartAccountAddress === account && !p.isRevoked);
    return NextResponse.json({ permissions: filtered });
  }
  return NextResponse.json({ permissions: permissionsStore });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const permissionsStore = await readPermissionsStore();

  if (body.action === 'create') {
    const grant: PermissionGrant = {
      permissionId: `perm_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      token: body.token,
      tokenSymbol: body.tokenSymbol,
      spendingCapWei: body.spendingCapWei,
      dailyLimitWei: body.dailyLimitWei,
      usedAllowanceWei: '0',
      expiryTimestamp: body.expiryTimestamp,
      allowedTargets: body.allowedTargets || [],
      description: body.description || 'AI Agent Permission',
      permissionContext: body.permissionContext || '0x',
      smartAccountAddress: body.smartAccountAddress,
      createdAt: Date.now(),
      isRevoked: false,
    };
    permissionsStore.unshift(grant);
    await writePermissionsStore(permissionsStore);
    return NextResponse.json({ permission: grant });
  }

  if (body.action === 'revoke') {
    const perm = permissionsStore.find((p: PermissionGrant) => p.permissionId === body.permissionId);
    if (!perm) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    perm.isRevoked = true;
    await writePermissionsStore(permissionsStore);
    return NextResponse.json({ success: true });
  }

  if (body.action === 'updateUsage') {
    const perm = permissionsStore.find((p: PermissionGrant) => p.permissionId === body.permissionId);
    if (!perm) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    perm.usedAllowanceWei = body.usedAllowanceWei;
    await writePermissionsStore(permissionsStore);
    return NextResponse.json({ success: true, permission: perm });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
