import { type Address, createWalletClient, custom } from 'viem';
import { erc7715ProviderActions } from '@metamask/smart-accounts-kit/actions';
import { publicClient } from './smartAccount';
import { CONTRACTS } from '../contracts/addresses';

export interface PermissionConfig {
  token: string;           // ERC-20 contract address, or WETH/USDC, or '0x0000000000000000000000000000000000000000' for native ETH
  spendingCapWei: bigint;  // Max total spend
  dailyLimitWei: bigint;   // Max daily spend
  expiryTimestamp: number; // Unix timestamp
  allowedTargets: string[]; // Whitelisted target contracts
  description: string;     // Description of the permission
}

export interface PermissionGrant {
  permissionId: string;
  token: string;
  spendingCapWei: string;  // Stringified for JSON compatibility
  dailyLimitWei: string;   // Stringified for JSON compatibility
  usedAllowanceWei: string; // Tracked locally / on-chain
  expiryTimestamp: number;
  allowedTargets: string[];
  description: string;
  permissionContext: string; // Signed delegation context (hex string)
  smartAccountAddress: string;
  createdAt: number;
}

/**
 * Requests permissions from MetaMask using ERC-7715.
 */
export async function grantAgentPermission(
  config: PermissionConfig,
  smartAccountAddress: string,
  agentAddress: string
): Promise<PermissionGrant> {
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error('MetaMask is not installed or available');
  }

  // Extend wallet client with ERC-7715 advanced permissions actions
  const walletClient = createWalletClient({
    transport: custom(window.ethereum),
  }).extend(erc7715ProviderActions());

  const isNative = config.token === '0x0000000000000000000000000000000000000000' || !config.token;
  const permissionType = isNative ? 'native-token-allowance' : 'erc20-token-allowance';

  const permissionData: any = {
    allowanceAmount: config.spendingCapWei,
    justification: config.description,
  };

  if (!isNative) {
    permissionData.tokenAddress = config.token as Address;
  }

  // Request permissions via MetaMask
  const response = await walletClient.requestExecutionPermissions([
    {
      chainId: CONTRACTS.chainId,
      expiry: config.expiryTimestamp,
      to: agentAddress as Address, // Agent session key address receives the authority
      permission: {
        type: permissionType,
        data: permissionData,
        isAdjustmentAllowed: true,
      },
    },
  ]);

  if (!response || response.length === 0) {
    throw new Error('No permissions returned from wallet');
  }

  const granted = response[0];
  const permissionContext = (granted as any).permissionContext || '0x';

  // Create unique permission ID (hash/combination)
  const permissionId = `perm_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  const grant: PermissionGrant = {
    permissionId,
    token: config.token,
    spendingCapWei: config.spendingCapWei.toString(),
    dailyLimitWei: config.dailyLimitWei.toString(),
    usedAllowanceWei: '0',
    expiryTimestamp: config.expiryTimestamp,
    allowedTargets: config.allowedTargets,
    description: config.description,
    permissionContext,
    smartAccountAddress,
    createdAt: Date.now(),
  };

  // Save permission state to local store / api database
  await savePermissionToBackend(grant);

  return grant;
}

/**
 * Saves permission details to backend API database.
 */
async function savePermissionToBackend(grant: PermissionGrant): Promise<void> {
  const response = await fetch('/api/permissions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action: 'create', grant }),
  });

  if (!response.ok) {
    throw new Error('Failed to save permission grant to server');
  }
}

/**
 * Revokes an active permission grant.
 */
export async function revokePermission(permissionId: string): Promise<void> {
  const response = await fetch('/api/permissions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action: 'revoke', permissionId }),
  });

  if (!response.ok) {
    throw new Error('Failed to revoke permission on server');
  }
}

/**
 * Retrieves all active permissions for a smart account.
 */
export async function getActivePermissions(smartAccountAddress: string): Promise<PermissionGrant[]> {
  const response = await fetch(`/api/permissions?address=${smartAccountAddress}`);
  if (!response.ok) {
    throw new Error('Failed to fetch active permissions');
  }
  const data = await response.json();
  return data.permissions || [];
}

/**
 * Computes remaining allowance for a permission grant.
 */
export async function getRemainingAllowance(permissionId: string): Promise<bigint> {
  const response = await fetch(`/api/permissions?id=${permissionId}`);
  if (!response.ok) {
    throw new Error('Failed to fetch permission details');
  }
  const data = await response.json();
  const grant: PermissionGrant = data.permission;
  if (!grant) return 0n;

  const cap = BigInt(grant.spendingCapWei);
  const used = BigInt(grant.usedAllowanceWei);
  const remaining = cap - used;

  return remaining > 0n ? remaining : 0n;
}
