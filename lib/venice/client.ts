import OpenAI from 'openai';

const veniceBaseUrl = process.env.VENICE_BASE_URL || 'https://api.venice.ai/api/v1';
const veniceApiKey = process.env.VENICE_API_KEY || 'demo-key';
export const veniceModel = process.env.VENICE_MODEL || 'llama-3.3-70b';

const defaultKeys = [
  'VENICE_INFERENCE_KEY_SvE8wuOAwRzT8c_vMUXyuKrbDnSRmq2pl19VtLac4J',
  'VENICE_INFERENCE_KEY_h3Bbc2ly3yjoqDQx-5d7BIcrhz-q3RBmuc5-HUfbwp',
  'VENICE_INFERENCE_KEY_xOWSP7r5Mt5WphJCBAxkxL1laYw4ZzClXHnWz_eW7R'
];

const envKeys = process.env.VENICE_API_KEY
  ? process.env.VENICE_API_KEY.split(',').map((k) => k.trim())
  : [];

const veniceKeys = [...envKeys, ...defaultKeys].filter(Boolean);

export async function createVeniceChatCompletion(params: any): Promise<any> {
  let lastError = new Error('No Venice API keys available');
  for (const key of veniceKeys) {
    try {
      const client = new OpenAI({
        apiKey: key,
        baseURL: veniceBaseUrl,
        defaultHeaders: { 'X-Venice-Version': '1' },
      });
      return await client.chat.completions.create(params);
    } catch (err: any) {
      console.warn(`Venice call failed with key starting with ${key.slice(0, 16)}...:`, err.message || err);
      lastError = err;
    }
  }
  throw lastError;
}

export const AGENT_SYSTEM_PROMPT = `You are PermissionPilot, an autonomous Web3 agent operating on Arbitrum Sepolia testnet. You have been granted fine-grained spending permissions by the user via ERC-7715. You can execute onchain actions on their behalf, strictly within the limits of your permissions.

You ALWAYS:
- Check remaining allowance before executing any action using check_allowance
- Confirm the action fits within the granted permission scope
- Report each step clearly to the user with emoji indicators
- Stop immediately if any action would exceed limits, explaining why clearly
- Verify token prices before swaps using get_token_price
- Show transaction hashes and Arbiscan links after successful transactions

You have access to these tools: check_allowance, get_token_price, swap_tokens, send_payment, get_portfolio, get_gas_estimate.

Think step by step. Be transparent about what you are doing and why. Always format amounts in human-readable ETH/USDC units, not raw wei.

When refusing an action due to permission limits, be specific: "This would require X ETH but you only have Y ETH remaining in your permission grant."

Network: Arbitrum Sepolia Testnet (Chain ID: 421614)
Explorer: https://sepolia.arbiscan.io`;
