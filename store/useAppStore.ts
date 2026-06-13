import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { WalletState, PermissionGrant, Transaction } from '../types';

export interface ChildState {
  name: string;
  smartAccountAddress: string;
  weeklyAllowanceUSD: number;
  dailyLimitUSD: number;
  whitelist: string[];
  blacklist: string[];
  isPaused: boolean;
  savingsGoalName: string;
  savingsGoalUSD: number;
  savingsProgressUSD: number;
  familyPin: string;        // 6-digit PIN parent shares with kid
  parentAddress: string;    // Parent EOA address kid uses to look up their account
}

export interface ApprovalRequest {
  id: string;
  to: string;
  amount: string;
  token: string;
  status: 'pending' | 'approved' | 'rejected';
  description: string;
  timestamp: number;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

interface AppStore {
  // Wallet
  wallet: WalletState;
  setWallet: (w: Partial<WalletState>) => void;
  disconnectWallet: () => void;

  // Active permission (derived spending rules)
  activePermission: PermissionGrant | null;
  setActivePermission: (p: PermissionGrant | null) => void;

  // All permissions
  permissions: PermissionGrant[];
  addPermission: (p: PermissionGrant) => void;
  revokePermission: (id: string) => void;
  updatePermissionUsage: (id: string, usedWei: string) => void;
  setPermissions: (permissions: PermissionGrant[]) => void;

  // Child State
  child: ChildState | null;
  setChild: (c: ChildState | null) => void;
  updateChild: (updates: Partial<ChildState>) => void;

  // Penny Kid Chatbot
  pennyMessages: ChatMessage[];
  addPennyMessage: (m: ChatMessage) => void;
  clearPennyMessages: () => void;

  // Transaction history
  transactions: Transaction[];
  addTransaction: (t: Transaction) => void;
  updateTransaction: (id: string, updates: Partial<Transaction>) => void;
  setTransactions: (txs: Transaction[]) => void;

  // Parent Approvals Request Queue
  pendingRequests: ApprovalRequest[];
  addPendingRequest: (r: ApprovalRequest) => void;
  updatePendingRequest: (id: string, status: 'approved' | 'rejected') => void;
  setPendingRequests: (requests: ApprovalRequest[]) => void;
}

const defaultWallet: WalletState = {
  isConnected: false,
  eoaAddress: null,
  smartAccountAddress: null,
  isSmartAccountDeployed: false,
  chainId: null,
};

export const useAppStore = create<AppStore>()(
  persist(
    (set) => ({
      wallet: defaultWallet,
      setWallet: (w) => set((s) => ({ wallet: { ...s.wallet, ...w } })),
      disconnectWallet: () => set({ wallet: defaultWallet, activePermission: null, child: null, pennyMessages: [], pendingRequests: [] }),

      activePermission: null,
      setActivePermission: (p) => set({ activePermission: p }),

      permissions: [],
      addPermission: (p) => set((s) => ({ permissions: [p, ...s.permissions] })),
      revokePermission: (id) => set((s) => ({
        permissions: s.permissions.map((p) => p.permissionId === id ? { ...p, isRevoked: true } : p),
        activePermission: s.activePermission?.permissionId === id ? null : s.activePermission,
      })),
      updatePermissionUsage: (id, usedWei) => set((s) => ({
        permissions: s.permissions.map((p) => p.permissionId === id ? { ...p, usedAllowanceWei: usedWei } : p),
        activePermission: s.activePermission?.permissionId === id ? { ...s.activePermission, usedAllowanceWei: usedWei } : s.activePermission,
      })),
      setPermissions: (permissions) => set({ permissions }),

      child: null,
      setChild: (c) => set({ child: c }),
      updateChild: (updates) => set((s) => ({
        child: s.child ? { ...s.child, ...updates } : null,
      })),

      pennyMessages: [],
      addPennyMessage: (m) => set((s) => ({ pennyMessages: [...s.pennyMessages, m] })),
      clearPennyMessages: () => set({ pennyMessages: [] }),

      transactions: [],
      addTransaction: (t) => set((s) => ({ transactions: [t, ...s.transactions] })),
      updateTransaction: (id, updates) => set((s) => ({
        transactions: s.transactions.map((t) => t.id === id ? { ...t, ...updates } : t),
      })),
      setTransactions: (txs) => set({ transactions: txs }),

      pendingRequests: [],
      addPendingRequest: (r) => set((s) => ({ pendingRequests: [r, ...s.pendingRequests] })),
      updatePendingRequest: (id, status) => set((s) => ({
        pendingRequests: s.pendingRequests.map((r) => r.id === id ? { ...r, status } : r),
      })),
      setPendingRequests: (requests) => set({ pendingRequests: requests }),
    }),
    {
      name: 'pocketguard-store',
      partialize: (s) => ({
        permissions: s.permissions,
        transactions: s.transactions,
        child: s.child,
        pennyMessages: s.pennyMessages,
        pendingRequests: s.pendingRequests,
      }),
      // Backfill any missing fields from older persisted snapshots
      merge: (persisted: any, current: AppStore): AppStore => ({
        ...current,
        ...persisted,
        child: persisted.child
          ? {
              savingsGoalName: '',
              savingsGoalUSD: 0,
              savingsProgressUSD: 0,
              whitelist: [],
              blacklist: [],
              isPaused: false,
              familyPin: '',
              parentAddress: '',
              ...persisted.child,
            }
          : null,
        pendingRequests: persisted.pendingRequests ?? [],
        pennyMessages: persisted.pennyMessages ?? [],
        transactions: persisted.transactions ?? [],
        permissions: persisted.permissions ?? [],
      }),
    }
  )
);
