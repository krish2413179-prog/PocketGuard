/**
 * Venice x402 Client
 *
 * Authenticates Venice AI requests using wallet-signed SIWE messages (X-Sign-In-With-X header)
 * instead of API keys. No ethers.js, no siwe package — built on viem only.
 *
 * Docs: https://docs.venice.ai/overview/guides/x402-venice-api
 */

import { privateKeyToAccount } from 'viem/accounts';
import { createWalletClient, http } from 'viem';
import { base } from 'viem/chains';

const VENICE_BASE_URL = process.env.VENICE_BASE_URL || 'https://api.venice.ai/api/v1';
const VENICE_MODEL = process.env.VENICE_MODEL || 'llama-3.3-70b';
const X402_WALLET_KEY = process.env.X402_WALLET_KEY as `0x${string}` | undefined;

export interface X402ChatParams {
  model?: string;
  messages: { role: 'system' | 'user' | 'assistant'; content: string }[];
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: 'json_object' | 'text' };
}

export interface X402ChatResult {
  choices: { message: { content: string } }[];
  usedX402: boolean;
  balanceRemaining?: string;
  walletAddress?: string;
}

/**
 * Generates a random alphanumeric nonce — replaces siwe's generateNonce().
 */
function generateNonce(len = 16): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < len; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Builds an EIP-4361 (SIWE) message string manually — no siwe/ethers package needed.
 * Venice validates this format for X-Sign-In-With-X authentication.
 */
function buildSiweMessage(params: {
  domain: string;
  address: string;
  statement: string;
  uri: string;
  version: string;
  chainId: number;
  nonce: string;
  issuedAt: string;
  expirationTime: string;
}): string {
  return [
    `${params.domain} wants you to sign in with your Ethereum account:`,
    params.address,
    '',
    params.statement,
    '',
    `URI: ${params.uri}`,
    `Version: ${params.version}`,
    `Chain ID: ${params.chainId}`,
    `Nonce: ${params.nonce}`,
    `Issued At: ${params.issuedAt}`,
    `Expiration Time: ${params.expirationTime}`,
  ].join('\n');
}

/**
 * Signs a SIWE message and returns a base64-encoded X-Sign-In-With-X header payload.
 */
async function buildSignInWithXHeader(
  walletKey: `0x${string}`,
  resourceUrl: string
): Promise<string> {
  const account = privateKeyToAccount(walletKey);
  const now = new Date();
  const expiry = new Date(now.getTime() + 5 * 60 * 1000);

  const message = buildSiweMessage({
    domain: 'api.venice.ai',
    address: account.address,
    statement: 'Sign in to Venice AI via PocketGuard x402',
    uri: resourceUrl,
    version: '1',
    chainId: 8453, // Base mainnet — where Venice x402 balances live
    nonce: generateNonce(),
    issuedAt: now.toISOString(),
    expirationTime: expiry.toISOString(),
  });

  // EIP-191 personal_sign via viem
  const walletClient = createWalletClient({
    account,
    chain: base,
    transport: http(),
  });
  const signature = await walletClient.signMessage({ message });

  const payload = JSON.stringify({
    address: account.address,
    message,
    signature,
    timestamp: now.getTime(),
    chainId: 8453,
  });

  return Buffer.from(payload, 'utf8').toString('base64');
}

/**
 * Main x402-authenticated Venice chat completion.
 * Falls back to API key auth if X402_WALLET_KEY is not set or balance is insufficient.
 */
export async function createX402ChatCompletion(params: X402ChatParams): Promise<X402ChatResult> {
  const resourceUrl = `${VENICE_BASE_URL}/chat/completions`;

  if (X402_WALLET_KEY) {
    try {
      const authHeader = await buildSignInWithXHeader(X402_WALLET_KEY, resourceUrl);
      const account = privateKeyToAccount(X402_WALLET_KEY);

      const response = await fetch(resourceUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Sign-In-With-X': authHeader,
        },
        body: JSON.stringify({
          model: params.model || VENICE_MODEL,
          messages: params.messages,
          temperature: params.temperature ?? 0.2,
          ...(params.max_tokens && { max_tokens: params.max_tokens }),
          ...(params.response_format && { response_format: params.response_format }),
        }),
      });

      if (response.status === 402) {
        console.warn('[x402] Insufficient balance — falling back to API key');
        throw new Error('x402_insufficient_balance');
      }

      if (!response.ok) {
        throw new Error(`Venice x402 error: ${response.status} ${response.statusText}`);
      }

      const balanceRemaining = response.headers.get('X-Balance-Remaining') || undefined;
      const data = await response.json();

      return {
        choices: data.choices,
        usedX402: true,
        balanceRemaining,
        walletAddress: account.address,
      };
    } catch (err: any) {
      if (err.message !== 'x402_insufficient_balance') {
        console.error('[x402] Request failed:', err.message);
      }
    }
  }

  // Fallback: API key auth
  const { createVeniceChatCompletion } = await import('./client');
  const result = await createVeniceChatCompletion({
    model: params.model || VENICE_MODEL,
    messages: params.messages,
    temperature: params.temperature ?? 0.2,
    ...(params.max_tokens && { max_tokens: params.max_tokens }),
    ...(params.response_format && { response_format: params.response_format }),
  });

  return { choices: result.choices, usedX402: false };
}
