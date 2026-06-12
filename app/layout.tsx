import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PocketGuard — Parental crypto wallet for kids',
  description: "Set spending limits, approve destinations, and protect your child's crypto wallet with programmable rules on Arbitrum Sepolia.",
  keywords: ['Web3', 'Parental Controls', 'MetaMask', 'ERC-7715', 'Smart Accounts', 'PocketGuard', 'Arbitrum'],
  openGraph: {
    title: 'PocketGuard',
    description: "Your child's first crypto wallet — with your rules built in.",
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
