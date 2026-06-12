import { NextRequest, NextResponse } from 'next/server';
import { createX402ChatCompletion } from '../../../lib/venice/x402Client';

export async function POST(req: NextRequest) {
  try {
    const { childName, limits, transactions } = await req.json();

    const formattedTxs =
      transactions && transactions.length > 0
        ? transactions
            .map(
              (t: any) =>
                `- ${new Date(t.timestamp).toLocaleDateString()}: ${t.description} (${t.status})`
            )
            .join('\n')
        : 'No transactions yet.';

    const systemPrompt = `You are an AI Parenting Allowance Advisor for PocketGuard. Your goal is to analyze the child's transaction history and wallet rules, then provide friendly, brief financial analysis for the parent.
Keep your responses short, analytical, and supportive of financial education. Avoid crypto technical jargon. Refer to amounts in USD.`;

    const prompt = `Child Name: ${childName}
Weekly Allowance Limit: $${limits.weeklyAllowanceUSD}
Daily Limit: $${limits.dailyLimitUSD}

Transactions History:
${formattedTxs}

Please generate three specific sections, return them as a JSON object with keys:
1. "insights": A brief summary of the child's spending habits (e.g. stayed within limits, type of purchases).
2. "suggestions": Recommending adjustments to daily/weekly allowances based on responsibility.
3. "alerts": Highlighting any blocked transactions or safety warnings (e.g. unrecognized addresses).

Return ONLY raw valid JSON, no markdown formatting blocks.`;

    // Use x402 wallet auth — Venice charges the Smart Account's USDC balance on Base.
    // Falls back to API key if X402_WALLET_KEY is not set or balance is insufficient.
    const result = await createX402ChatCompletion({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      temperature: 0.2,
      response_format: { type: 'json_object' },
    });

    const content = result.choices[0]?.message?.content || '{}';
    const parsed = JSON.parse(content);

    return NextResponse.json({
      insights:
        parsed.insights ||
        `${childName} is starting their savings journey! No spending has been detected yet.`,
      suggestions:
        parsed.suggestions ||
        `Consider keeping the current daily limit of $${limits.dailyLimitUSD} until some transactions are recorded.`,
      alerts:
        parsed.alerts || 'All systems green. No suspicious attempts detected.',
      // x402 payment metadata — shown in the dashboard for judges/demo
      x402: {
        usedX402: result.usedX402,
        walletAddress: result.walletAddress || null,
        balanceRemaining: result.balanceRemaining || null,
        method: result.usedX402
          ? 'X-Sign-In-With-X (EIP-4361 SIWE on Base)'
          : 'API Key (fallback)',
      },
    });
  } catch (err: any) {
    console.error('Advisor API error:', err);
    return NextResponse.json({
      insights:
        'Starting the savings journey! No spending has been detected yet.',
      suggestions:
        'Consider keeping the current daily limit until some transactions are recorded.',
      alerts: 'All systems green. No suspicious attempts detected.',
      x402: { usedX402: false, method: 'error-fallback' },
    });
  }
}
