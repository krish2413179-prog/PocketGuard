import { CONTRACTS } from '../contracts/addresses';
import { createPublicClient, createWalletClient, http, custom } from 'viem';
import { arbitrumSepolia } from 'viem/chains';

// Correct 1Shot public relayer endpoint (no API key needed for testnet)
const ONESHOT_RPC_URL = process.env.ONESHOT_RPC_URL || 'https://relayer.1shotapi.com/relayers';
const ONESHOT_API_KEY = process.env.ONESHOT_API_KEY || '';

interface RelayTransactionParams {
  to: string;
  data: string;
  value?: string;
  permissionContext: string; // hex-encoded delegation context from ERC-7715
  smartAccountAddress: string;
  permissionId: string;
}

interface RelayResult {
  txHash: string;
  explorerUrl: string;
  userOpHash?: string;
}

async function oneshotRpc(method: string, params: any[]): Promise<any> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (ONESHOT_API_KEY) headers['Authorization'] = `Bearer ${ONESHOT_API_KEY}`;

  const response = await fetch(ONESHOT_RPC_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
  });

  if (!response.ok) {
    throw new Error(`1Shot RPC HTTP error: ${response.status} ${response.statusText}`);
  }

  const json = await response.json();
  if (json.error) {
    throw new Error(`1Shot RPC error: ${json.error.message || JSON.stringify(json.error)}`);
  }
  return json.result;
}

/**
 * Relay a transaction via 1Shot using EIP-7710 delegation context.
 * For demo permissionContexts (0xdemo_...) falls back to a direct MetaMask send.
 */
export async function relayTransaction(params: RelayTransactionParams): Promise<RelayResult> {
  // Demo mode: skip 1Shot and send directly via the connected MetaMask wallet.
  // This keeps the demo fully functional without a real ERC-7715 session key.
  const isDemo = params.permissionContext.startsWith('0xdemo_');
  if (isDemo) {
    return relayViaMetaMask(params);
  }

  // 1. Get fee data from 1Shot
  let feeData: any;
  try {
    feeData = await oneshotRpc('relayer_getFeeData', [
      {
        chainId: `0x${CONTRACTS.chainId.toString(16)}`,
        from: params.smartAccountAddress,
        to: params.to,
        data: params.data,
        value: params.value || '0x0',
      },
    ]);
  } catch (err) {
    console.error('1Shot getFeeData failed, falling back to MetaMask relay:', err);
    return relayViaMetaMask(params);
  }

  // 2. Send the 7710 transaction with permission context
  const txParams: any = {
    chainId: `0x${CONTRACTS.chainId.toString(16)}`,
    from: params.smartAccountAddress,
    to: params.to,
    data: params.data,
    value: params.value || '0x0',
    permissionContext: params.permissionContext,
  };

  if (feeData?.maxFeePerGas) txParams.maxFeePerGas = feeData.maxFeePerGas;
  if (feeData?.maxPriorityFeePerGas) txParams.maxPriorityFeePerGas = feeData.maxPriorityFeePerGas;

  const submitResult = await oneshotRpc('relayer_send7710Transaction', [txParams]);

  if (!submitResult?.transactionHash && !submitResult?.hash) {
    throw new Error('1Shot did not return a transaction hash');
  }

  const txHash = submitResult.transactionHash || submitResult.hash;

  // 3. Poll for status
  let confirmed = false;
  let attempts = 0;
  while (!confirmed && attempts < 30) {
    await new Promise((r) => setTimeout(r, 2000));
    try {
      const status = await oneshotRpc('relayer_getStatus', [{ transactionHash: txHash }]);
      if (status?.status === 'confirmed' || status?.status === 'success') {
        confirmed = true;
      } else if (status?.status === 'failed') {
        throw new Error(`Transaction failed: ${status.reason || 'Unknown reason'}`);
      }
    } catch (_) {
      // Continue polling even on status check errors
    }
    attempts++;
  }

  return {
    txHash,
    explorerUrl: `${CONTRACTS.explorer}/tx/${txHash}`,
  };
}

/**
 * Send the transaction directly via MetaMask (browser wallet).
 * Used for demo permissionContexts and as 1Shot fallback.
 * The parent's connected EOA sends ETH directly — no gas sponsorship needed for demo.
 */
async function relayViaMetaMask(params: RelayTransactionParams): Promise<RelayResult> {
  if (typeof window === 'undefined' || !window.ethereum) {
    throw new Error('MetaMask not available. Please connect your wallet and try again.');
  }

  const accounts: string[] = await window.ethereum.request({ method: 'eth_accounts' });
  if (!accounts || accounts.length === 0) {
    throw new Error('No MetaMask account connected. Please connect your wallet first.');
  }

  const wc = createWalletClient({
    account: accounts[0] as `0x${string}`,
    chain: arbitrumSepolia,
    transport: custom(window.ethereum),
  });

  const pc = createPublicClient({ chain: arbitrumSepolia, transport: http(CONTRACTS.rpc) });

  const valueWei = params.value && params.value !== '0x0'
    ? BigInt(params.value)
    : 0n;

  const hash = await wc.sendTransaction({
    to: params.to as `0x${string}`,
    data: (params.data || '0x') as `0x${string}`,
    value: valueWei,
  });

  // Wait for on-chain confirmation
  await pc.waitForTransactionReceipt({ hash });

  return {
    txHash: hash,
    explorerUrl: `${CONTRACTS.explorer}/tx/${hash}`,
  };
}

/**
 * Estimate relay fee for a transaction.
 */
export async function estimateRelayFee(params: {
  to: string;
  data: string;
  value?: string;
  from: string;
}): Promise<bigint> {
  try {
    const feeData = await oneshotRpc('relayer_getFeeData', [
      {
        chainId: `0x${CONTRACTS.chainId.toString(16)}`,
        ...params,
        value: params.value || '0x0',
      },
    ]);
    return BigInt(feeData?.estimatedFee || feeData?.fee || '0');
  } catch {
    return 0n;
  }
}
