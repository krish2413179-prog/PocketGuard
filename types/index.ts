// Shared TypeScript types for PermissionPilot

export interface PermissionGrant {
  permissionId: string;
  token: string;
  tokenSymbol: string;
  spendingCapWei: string;
  dailyLimitWei: string;
  usedAllowanceWei: string;
  expiryTimestamp: number;
  allowedTargets: string[];
  description: string;
  permissionContext: string;
  smartAccountAddress: string;
  createdAt: number;
  isRevoked?: boolean;
}

export interface AgentStep {
  id: string;
  type: 'thinking' | 'tool_call' | 'tool_result' | 'message' | 'error' | 'tx';
  icon: string;
  content: string;
  txHash?: string;
  explorerUrl?: string;
  timestamp: number;
  status: 'pending' | 'success' | 'error';
}

export interface AgentMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  steps?: AgentStep[];
  timestamp: number;
}

export interface Transaction {
  id: string;
  txHash: string;
  explorerUrl: string;
  type: 'swap' | 'send' | 'check' | 'approve' | 'other';
  description: string;
  amount?: string;
  token?: string;
  status: 'pending' | 'success' | 'failed';
  timestamp: number;
  smartAccountAddress: string;
  permissionId?: string;
}

export interface WalletState {
  isConnected: boolean;
  eoaAddress: string | null;
  smartAccountAddress: string | null;
  isSmartAccountDeployed: boolean;
  chainId: number | null;
}

export interface AppStats {
  ethBalance: string;
  activePermissionsCount: number;
  totalSpentThisSession: string;
  remainingAllowance: string;
}

declare global {
  interface Window {
    ethereum?: any;
  }
}

