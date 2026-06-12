# PocketGuard

Your child's first crypto wallet — with your rules built in.

Built on Arbitrum Sepolia (Layer 2 testnet) using:
- ERC-4337 Smart Accounts (@metamask/smart-accounts-kit)
- ERC-7715 Session Key Permissions
- ERC-7710 Gasless Transactions via 1Shot API
- Venice AI (x402 payments)
- MetaMask Snap (wallet-level protection)

## Getting Started

```bash
npm install --legacy-peer-deps
npm run dev
```

## Environment Variables

Copy `.env.local` and fill in:
- `VENICE_API_KEY`
- `ONESHOT_RPC_URL`
- `NEXT_PUBLIC_APP_URL`

## Snap Server (for wallet-level protection)

```bash
cd snap
node serve.js
```

Runs on `http://localhost:8080`
