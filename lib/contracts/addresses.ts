export const CONTRACTS = {
  chainId: 421614,
  rpc: 'https://sepolia-rollup.arbitrum.io/rpc',
  explorer: 'https://sepolia.arbiscan.io',

  // Uniswap V3 on Arbitrum Sepolia
  uniswapV3Router: '0x101F443B4d1b059569D643917553c771E1b9663E',
  uniswapV3Quoter: '0x2779a0CC1c3e0E44D2542EC3e79e3864Ae93Ef0d',

  // Test tokens on Arbitrum Sepolia
  WETH: '0x980B62Da83eFf3D4576C647993b0c1D7faf17c73',
  USDC: '0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d',
} as const;

export type TokenSymbol = 'WETH' | 'USDC';

export const TOKEN_DETAILS = {
  WETH: {
    symbol: 'WETH',
    address: CONTRACTS.WETH,
    decimals: 18,
    name: 'Wrapped Ether'
  },
  USDC: {
    symbol: 'USDC',
    address: CONTRACTS.USDC,
    decimals: 6,
    name: 'USD Coin'
  }
} as const;
