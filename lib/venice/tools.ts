import { createPublicClient, http, formatEther, formatUnits, parseUnits, parseEther, encodeFunctionData, erc20Abi, type Address } from 'viem';
import { arbitrumSepolia } from 'viem/chains';
import { CONTRACTS } from '../contracts/addresses';

// Server-side only: public RPC client
const publicClient = createPublicClient({ chain: arbitrumSepolia, transport: http(CONTRACTS.rpc) });

const UNISWAP_V3_ROUTER_ABI = [
  {
    name: 'exactInputSingle',
    type: 'function',
    stateMutability: 'payable',
    inputs: [{ name: 'params', type: 'tuple', components: [
      { name: 'tokenIn', type: 'address' }, { name: 'tokenOut', type: 'address' },
      { name: 'fee', type: 'uint24' }, { name: 'recipient', type: 'address' },
      { name: 'deadline', type: 'uint256' }, { name: 'amountIn', type: 'uint256' },
      { name: 'amountOutMinimum', type: 'uint256' }, { name: 'sqrtPriceLimitX96', type: 'uint160' },
    ]}],
    outputs: [{ name: 'amountOut', type: 'uint256' }],
  },
] as const;

// ── Tool implementations ─────────────────────────────────────────────────────

export async function checkAllowance(permissionId: string, _smartAccountAddress: string) {
  try {
    // Read from the server-side in-memory store via internal fetch
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const res = await fetch(`${baseUrl}/api/permissions?id=${permissionId}`);
    if (!res.ok) return { error: 'Permission not found' };
    const data = await res.json();
    const grant = data.permission;
    if (!grant) return { error: 'Permission not found' };
    const cap = BigInt(grant.spendingCapWei);
    const used = BigInt(grant.usedAllowanceWei);
    const remaining = cap - used;
    return {
      permissionId,
      cap: formatEther(cap) + ' ETH',
      used: formatEther(used) + ' ETH',
      remaining: formatEther(remaining > 0n ? remaining : 0n) + ' ETH',
      dailyLimit: formatEther(BigInt(grant.dailyLimitWei)) + ' ETH',
      expiresIn: Math.max(0, grant.expiryTimestamp - Math.floor(Date.now() / 1000)) + ' seconds',
      isExpired: grant.expiryTimestamp < Math.floor(Date.now() / 1000),
    };
  } catch (e: any) { return { error: e.message }; }
}

export async function getTokenPrice(tokenSymbol: string) {
  try {
    const idMap: Record<string, string> = { ETH: 'ethereum', WETH: 'ethereum', USDC: 'usd-coin', ARB: 'arbitrum' };
    const id = idMap[tokenSymbol.toUpperCase()] || tokenSymbol.toLowerCase();
    const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`);
    const data = await res.json();
    const price = data[id]?.usd;
    if (!price) return { error: `Price not found for ${tokenSymbol}`, token: tokenSymbol, priceUSD: 0, formattedPrice: 'N/A' };
    return { token: tokenSymbol, priceUSD: price, formattedPrice: `$${price.toLocaleString()}` };
  } catch (e: any) { return { error: e.message, token: tokenSymbol, priceUSD: 0, formattedPrice: 'N/A' }; }
}

export async function getPortfolio(accountAddress: string) {
  try {
    const ethBalance = await publicClient.getBalance({ address: accountAddress as Address });
    const usdcBalance = await publicClient.readContract({ address: CONTRACTS.USDC as Address, abi: erc20Abi, functionName: 'balanceOf', args: [accountAddress as Address] });
    const wethBalance = await publicClient.readContract({ address: CONTRACTS.WETH as Address, abi: erc20Abi, functionName: 'balanceOf', args: [accountAddress as Address] });
    return {
      address: accountAddress,
      balances: [
        { token: 'ETH', balance: formatEther(ethBalance), raw: ethBalance.toString() },
        { token: 'USDC', balance: formatUnits(usdcBalance, 6), raw: usdcBalance.toString() },
        { token: 'WETH', balance: formatEther(wethBalance), raw: wethBalance.toString() },
      ],
    };
  } catch (e: any) { return { error: e.message, address: accountAddress, balances: [] }; }
}

export async function getGasEstimate(to: string, data: string, value: string = '0') {
  try {
    const gasPrice = await publicClient.getGasPrice();
    const gasLimit = await publicClient.estimateGas({
      to: to as Address,
      data: data as `0x${string}`,
      value: BigInt(value || '0'),
    });
    const gasCost = gasPrice * gasLimit;
    return { gasLimit: gasLimit.toString(), gasPrice: formatEther(gasPrice) + ' ETH/gas', estimatedCostETH: formatEther(gasCost), estimatedCostWei: gasCost.toString() };
  } catch (e: any) { return { error: e.message, gasLimit: '300000', gasPrice: '0.0000001 ETH/gas', estimatedCostETH: '0.00003' }; }
}

export function encodeSwapCalldata(params: {
  tokenIn: string; tokenOut: string; amountIn: bigint; recipient: string; slippage?: number;
}): `0x${string}` {
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 20);
  return encodeFunctionData({
    abi: UNISWAP_V3_ROUTER_ABI,
    functionName: 'exactInputSingle',
    args: [{
      tokenIn: params.tokenIn as Address, tokenOut: params.tokenOut as Address,
      fee: 3000, recipient: params.recipient as Address,
      deadline, amountIn: params.amountIn,
      amountOutMinimum: 0n, sqrtPriceLimitX96: 0n,
    }],
  });
}

export function encodeERC20Transfer(to: string, amount: bigint): `0x${string}` {
  return encodeFunctionData({ abi: erc20Abi, functionName: 'transfer', args: [to as Address, amount] });
}

export function resolveTokenAddress(tokenIn: string): string {
  const t = tokenIn.toUpperCase();
  if (t === 'ETH' || t === 'WETH') return CONTRACTS.WETH;
  if (t === 'USDC') return CONTRACTS.USDC;
  if (tokenIn.startsWith('0x')) return tokenIn;
  return CONTRACTS.WETH;
}

export const AGENT_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'check_allowance',
      description: 'Check remaining spending allowance for the current permission grant. Always call this first before any transaction.',
      parameters: {
        type: 'object',
        properties: {
          permissionId: { type: 'string', description: 'The permission grant ID' },
          smartAccountAddress: { type: 'string', description: 'The smart account address' },
        },
        required: ['permissionId', 'smartAccountAddress'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_token_price',
      description: 'Get current USD price of a token from CoinGecko.',
      parameters: {
        type: 'object',
        properties: { tokenSymbol: { type: 'string', description: 'Token symbol: ETH, USDC, WETH, ARB' } },
        required: ['tokenSymbol'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_portfolio',
      description: 'Get ETH, USDC, WETH balances of the smart account on Arbitrum Sepolia.',
      parameters: {
        type: 'object',
        properties: { accountAddress: { type: 'string', description: 'Smart account address' } },
        required: ['accountAddress'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_gas_estimate',
      description: 'Estimate gas cost for a transaction (for informational purposes — gas is actually sponsored by 1Shot).',
      parameters: {
        type: 'object',
        properties: {
          to: { type: 'string', description: 'Target contract address' },
          data: { type: 'string', description: 'Hex encoded calldata' },
          value: { type: 'string', description: 'ETH value in wei as string, default 0' },
        },
        required: ['to', 'data'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'swap_tokens',
      description: 'Swap tokens via Uniswap V3 on Arbitrum Sepolia. Gas is sponsored by 1Shot.',
      parameters: {
        type: 'object',
        properties: {
          tokenIn: { type: 'string', description: 'Input token: ETH, WETH, or USDC' },
          tokenOut: { type: 'string', description: 'Output token: ETH, WETH, or USDC' },
          amountIn: { type: 'string', description: 'Amount to swap in human units, e.g. "0.01"' },
          slippageTolerance: { type: 'number', description: 'Slippage % e.g. 0.5' },
        },
        required: ['tokenIn', 'tokenOut', 'amountIn'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'send_payment',
      description: 'Send ETH or ERC-20 tokens to an address (must be in allowedTargets).',
      parameters: {
        type: 'object',
        properties: {
          to: { type: 'string', description: 'Recipient address' },
          token: { type: 'string', description: 'Token: ETH, USDC, or WETH' },
          amount: { type: 'string', description: 'Amount in human units e.g. "5"' },
        },
        required: ['to', 'token', 'amount'],
      },
    },
  },
];
