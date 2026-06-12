import { createPublicClient, http, type Address, type CustomSource } from 'viem';
import { arbitrumSepolia } from 'viem/chains';
import { Implementation, toMetaMaskSmartAccount } from '@metamask/smart-accounts-kit';
import { CONTRACTS } from '../contracts/addresses';

// Initialize the standard public client on Arbitrum Sepolia
export const publicClient = createPublicClient({
  chain: arbitrumSepolia,
  transport: http(CONTRACTS.rpc),
});

/**
 * Derives the counterfactual address of a user's MetaMask Smart Account.
 * Useful for fast client-side checks before the account is initialized with a signer.
 */
export async function getSmartAccountAddress(signerAddress: string): Promise<string> {
  const dummySigner: CustomSource = {
    address: signerAddress as Address,
    signMessage: async () => '0x',
    signTransaction: async () => '0x',
    signTypedData: async () => '0x',
  };

  const account = await toMetaMaskSmartAccount({
    client: publicClient,
    implementation: Implementation.Hybrid,
    deployParams: [signerAddress as Address, [], [], []],
    deploySalt: '0x0',
    signer: { account: dummySigner },
  });

  return account.address;
}

/**
 * Creates or retrieves a MetaMask Smart Account instance using a connected signer.
 */
export async function getOrCreateSmartAccount(
  signerAddress: string,
  walletClient: any // Passing Viem WalletClient from Wagmi
): Promise<any> {
  if (!walletClient) {
    throw new Error('Wallet client is required to instantiate Smart Account');
  }

  // Create MetaMask Smart Account with walletClient as the signer
  const smartAccount = await toMetaMaskSmartAccount({
    client: publicClient,
    implementation: Implementation.Hybrid,
    deployParams: [signerAddress as Address, [], [], []],
    deploySalt: '0x0',
    signer: { walletClient },
  });

  return smartAccount;
}

/**
 * Checks if the smart account contract has been deployed on-chain.
 */
export async function isSmartAccountDeployed(address: string): Promise<boolean> {
  try {
    const code = await publicClient.getBytecode({
      address: address as Address,
    });
    return code !== undefined && code !== '0x';
  } catch (error) {
    console.error('Error checking deployment status:', error);
    return false;
  }
}
