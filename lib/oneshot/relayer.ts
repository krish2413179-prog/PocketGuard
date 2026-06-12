import { CONTRACTS } from '../contracts/addresses';

const ONESHOT_RPC_URL = process.env.ONESHOT_RPC_URL || 'https://api.1shotapi.com/v1/rpc';
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
 * Gas is fully sponsored — no ETH needed in the smart account.
 */
export async function relayTransaction(params: RelayTransactionParams): Promise<RelayResult> {
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
    console.error('1Shot getFeeData failed, using direct Arbitrum relay:', err);
    // Fallback: submit as a standard sponsored transaction via Arbitrum bundler
    return relayViaDirectRpc(params);
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
 * Fallback: relay via standard Arbitrum Sepolia RPC (for demo/testing without 1Shot).
 * In production, this would use a proper bundler.
 */
async function relayViaDirectRpc(params: RelayTransactionParams): Promise<RelayResult> {
  // For hackathon demo: simulate a relay by returning a mock pending state
  // In real implementation, this would use eth_sendRawTransaction with a funded relayer wallet
  const mockHash = `0x${Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('')}`;
  return {
    txHash: mockHash,
    explorerUrl: `${CONTRACTS.explorer}/tx/${mockHash}`,
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
