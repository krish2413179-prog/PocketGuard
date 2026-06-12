import { createVeniceChatCompletion, veniceModel, AGENT_SYSTEM_PROMPT } from './client';
import { AGENT_TOOLS, checkAllowance, getTokenPrice, getPortfolio, getGasEstimate, encodeSwapCalldata, encodeERC20Transfer, resolveTokenAddress } from './tools';
import { CONTRACTS } from '../contracts/addresses';
import { relayTransaction } from '../oneshot/relayer';
import type { AgentStep, PermissionGrant } from '../../types';
import { parseEther, parseUnits, formatEther } from 'viem';

type OnStep = (step: AgentStep) => void;

function makeStep(type: AgentStep['type'], icon: string, content: string, extra: Partial<AgentStep> = {}): AgentStep {
  return {
    id: `step_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    type, icon, content,
    timestamp: Date.now(),
    status: 'success',
    ...extra,
  };
}

async function executeTool(name: string, args: any, permission: PermissionGrant, onStep: OnStep): Promise<string> {
  switch (name) {
    case 'check_allowance': {
      const result = await checkAllowance(
        args.permissionId || permission.permissionId,
        args.smartAccountAddress || permission.smartAccountAddress
      );
      return JSON.stringify(result);
    }

    case 'get_token_price': {
      const result = await getTokenPrice(args.tokenSymbol);
      return JSON.stringify(result);
    }

    case 'get_portfolio': {
      const result = await getPortfolio(args.accountAddress || permission.smartAccountAddress);
      return JSON.stringify(result);
    }

    case 'get_gas_estimate': {
      const result = await getGasEstimate(args.to, args.data, args.value);
      return JSON.stringify(result);
    }

    case 'swap_tokens': {
      onStep(makeStep('tool_call', '⚡', `Building swap: ${args.amountIn} ${args.tokenIn} → ${args.tokenOut}...`, { status: 'pending' }));

      const tokenInAddr = resolveTokenAddress(args.tokenIn);
      const tokenOutAddr = resolveTokenAddress(args.tokenOut);
      const isUSDCIn = args.tokenIn.toUpperCase() === 'USDC';
      const amountIn = isUSDCIn ? parseUnits(args.amountIn, 6) : parseEther(args.amountIn);

      // Check allowance
      const cap = BigInt(permission.spendingCapWei);
      const used = BigInt(permission.usedAllowanceWei);
      const remaining = cap - used;
      const nativeAmount = isUSDCIn ? 0n : amountIn;
      if (nativeAmount > remaining && !isUSDCIn) {
        return JSON.stringify({ error: `Insufficient allowance. Need ${args.amountIn} ETH but only ${formatEther(remaining > 0n ? remaining : 0n)} ETH remaining.` });
      }

      const calldata = encodeSwapCalldata({ tokenIn: tokenInAddr, tokenOut: tokenOutAddr, amountIn, recipient: permission.smartAccountAddress });
      const isETHInput = args.tokenIn.toUpperCase() === 'ETH';
      const value = isETHInput ? amountIn.toString() : '0';

      onStep(makeStep('tool_call', '🚀', 'Submitting via 1Shot gasless relayer...', { status: 'pending' }));

      try {
        const result = await relayTransaction({
          to: CONTRACTS.uniswapV3Router,
          data: calldata,
          value,
          permissionContext: permission.permissionContext,
          smartAccountAddress: permission.smartAccountAddress,
          permissionId: permission.permissionId,
        });
        onStep(makeStep('tx', '✅', `Swap confirmed!`, { txHash: result.txHash, explorerUrl: result.explorerUrl, status: 'success' }));
        return JSON.stringify({ success: true, txHash: result.txHash, explorerUrl: result.explorerUrl, message: `Swapped ${args.amountIn} ${args.tokenIn} → ${args.tokenOut}. Tx: ${result.txHash}` });
      } catch (err: any) {
        return JSON.stringify({ error: `Relay failed: ${err.message}` });
      }
    }

    case 'send_payment': {
      onStep(makeStep('tool_call', '💸', `Sending ${args.amount} ${args.token} to ${args.to.slice(0, 10)}...`, { status: 'pending' }));

      const isNative = args.token.toUpperCase() === 'ETH';
      const isUSDC = args.token.toUpperCase() === 'USDC';
      const amountWei = isUSDC ? parseUnits(args.amount, 6) : parseEther(args.amount);
      const tokenAddr = resolveTokenAddress(args.token);

      const calldata = isNative ? ('0x' as `0x${string}`) : encodeERC20Transfer(args.to, amountWei);
      const to = isNative ? args.to : tokenAddr;
      const value = isNative ? amountWei.toString() : '0';

      // Check allowance for native ETH sends
      if (isNative) {
        const cap = BigInt(permission.spendingCapWei);
        const used = BigInt(permission.usedAllowanceWei);
        const remaining = cap - used;
        if (amountWei > remaining) {
          return JSON.stringify({ error: `Insufficient allowance. Need ${args.amount} ETH but only ${formatEther(remaining > 0n ? remaining : 0n)} ETH remaining.` });
        }
      }

      onStep(makeStep('tool_call', '🚀', 'Submitting via 1Shot gasless relayer...', { status: 'pending' }));

      try {
        const result = await relayTransaction({
          to, data: calldata, value,
          permissionContext: permission.permissionContext,
          smartAccountAddress: permission.smartAccountAddress,
          permissionId: permission.permissionId,
        });
        onStep(makeStep('tx', '✅', `Payment sent!`, { txHash: result.txHash, explorerUrl: result.explorerUrl, status: 'success' }));
        return JSON.stringify({ success: true, txHash: result.txHash, explorerUrl: result.explorerUrl, message: `Sent ${args.amount} ${args.token} to ${args.to}` });
      } catch (err: any) {
        return JSON.stringify({ error: `Relay failed: ${err.message}` });
      }
    }

    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
}

export async function runAgentLoop(
  userMessage: string,
  permission: PermissionGrant,
  onStep: OnStep
): Promise<string> {
  const capEth = formatEther(BigInt(permission.spendingCapWei));
  const usedEth = formatEther(BigInt(permission.usedAllowanceWei));

  const messages: any[] = [
    {
      role: 'system',
      content: `${AGENT_SYSTEM_PROMPT}

Active Permission Grant:
- ID: ${permission.permissionId}
- Spending Cap: ${capEth} ETH
- Used So Far: ${usedEth} ETH
- Daily Limit: ${formatEther(BigInt(permission.dailyLimitWei))} ETH
- Smart Account: ${permission.smartAccountAddress}
- Expires: ${new Date(permission.expiryTimestamp * 1000).toISOString()}
- Allowed Targets: ${permission.allowedTargets.length > 0 ? permission.allowedTargets.join(', ') : 'All addresses'}`,
    },
    { role: 'user', content: userMessage },
  ];

  let iterations = 0;
  const MAX_ITERATIONS = 10;

  while (iterations < MAX_ITERATIONS) {
    iterations++;

    onStep(makeStep('thinking', '🤔', iterations === 1 ? 'Analyzing your request...' : 'Processing results...', { status: 'pending' }));

    const response = await createVeniceChatCompletion({
      model: veniceModel,
      messages,
      tools: AGENT_TOOLS,
      tool_choice: 'auto',
      temperature: 0.1,
      max_tokens: 2048,
    });

    const choice = response.choices[0];
    if (!choice) break;

    messages.push(choice.message);

    // No tool calls = final answer
    if (!choice.message.tool_calls || choice.message.tool_calls.length === 0) {
      const finalText = choice.message.content || 'Task completed.';
      onStep(makeStep('message', '💬', finalText, { status: 'success' }));
      return finalText;
    }

    // Execute tool calls
    for (const toolCall of choice.message.tool_calls) {
      const toolName = toolCall.function.name;
      let toolArgs: any = {};
      try { toolArgs = JSON.parse(toolCall.function.arguments); } catch {}

      onStep(makeStep('tool_call', getToolIcon(toolName), `Calling ${toolName.replace(/_/g, ' ')}...`, { status: 'pending' }));

      const result = await executeTool(toolName, toolArgs, permission, onStep);
      let parsedResult: any = {};
      try { parsedResult = JSON.parse(result); } catch {}

      if (parsedResult.error) {
        onStep(makeStep('error', '❌', `${toolName}: ${parsedResult.error}`, { status: 'error' }));
      } else {
        onStep(makeStep('tool_result', getToolIcon(toolName), getToolResultPreview(toolName, parsedResult), { status: 'success' }));
      }

      messages.push({ role: 'tool', tool_call_id: toolCall.id, content: result });
    }
  }

  return 'Agent loop completed.';
}

function getToolIcon(toolName: string): string {
  const icons: Record<string, string> = {
    check_allowance: '🔍', get_token_price: '📊', get_portfolio: '💼',
    get_gas_estimate: '⛽', swap_tokens: '💱', send_payment: '💸',
  };
  return icons[toolName] || '🔧';
}

function getToolResultPreview(toolName: string, result: any): string {
  switch (toolName) {
    case 'check_allowance': return `Remaining: ${result.remaining} | Used: ${result.used}`;
    case 'get_token_price': return `${result.token}: ${result.formattedPrice}`;
    case 'get_portfolio': {
      const bals = result.balances?.map((b: any) => `${b.balance} ${b.token}`).join(', ');
      return `Portfolio: ${bals || 'loaded'}`;
    }
    case 'get_gas_estimate': return `Gas est: ${result.estimatedCostETH} ETH`;
    default: return JSON.stringify(result).slice(0, 120);
  }
}
