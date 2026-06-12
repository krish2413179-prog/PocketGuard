import { NextRequest, NextResponse } from 'next/server';
import { createX402ChatCompletion } from '../../../lib/venice/x402Client';

export async function POST(req: NextRequest) {
  try {
    const { message, childName, dailyLimit, balance, goal } = await req.json();

    const systemPrompt = `You are "Penny", a friendly, warm, and playful cartoon piggy bank money coach for a child named ${childName}.
Your goal is to teach children about money, allowance limits, savings goals, and smart spending in simple, friendly, child-safe language.
Keep responses short (1-3 sentences maximum). Use emojis frequently! Be supportive and encouraging.

Current wallet details:
- Balance: $${balance}
- Daily spending limit: $${dailyLimit}
- Savings goal: ${goal}

Always refer to these details to give personalized, helpful oink-themed tips.`;

    // x402 wallet auth — no API key needed
    const result = await createX402ChatCompletion({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ],
      temperature: 0.7,
      max_tokens: 150,
    });

    const reply =
      result.choices[0]?.message?.content ||
      "Oink! I didn't quite get that. Let's save some money together! 🐷";

    return NextResponse.json({
      reply,
      x402: {
        usedX402: result.usedX402,
        method: result.usedX402 ? 'x402-wallet-auth' : 'api-key-fallback',
      },
    });
  } catch (err: any) {
    console.error('Penny API error:', err);
    return NextResponse.json({
      reply: "Oink! I got a little distracted thinking about mud! What were you saying about saving? 🐷",
      x402: { usedX402: false, method: 'error-fallback' },
    });
  }
}
