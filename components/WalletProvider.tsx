import { FC, ReactNode, useMemo } from 'react';
import { ConnectionProvider, WalletProvider as SolanaWalletProvider } from '@solana/wallet-adapter-react';
import { PhantomWalletAdapter, SolflareWalletAdapter, TrustWalletAdapter } from '@solana/wallet-adapter-wallets';
import type { WalletError } from '@solana/wallet-adapter-base';

interface Props {
  children: ReactNode;
}

export const WalletProvider: FC<Props> = ({ children }) => {
  // Network configuration based on environment
  const network = process.env.NEXT_PUBLIC_NETWORK || 'mainnet';
  
  const endpoint = useMemo(() => {
    // Use custom RPC endpoint if provided
    if (process.env.NEXT_PUBLIC_RPC_ENDPOINT) {
      return process.env.NEXT_PUBLIC_RPC_ENDPOINT;
    }
    
    // Use Helius for both mainnet and devnet
    const heliusKey = process.env.NEXT_PUBLIC_HELIUS_API_KEY;
    if (!heliusKey) {
      throw new Error('NEXT_PUBLIC_HELIUS_API_KEY is required. Please add it to your .env.local file.');
    }
    
    if (network === 'devnet') {
      return `https://devnet.helius-rpc.com/?api-key=${heliusKey}`;
    } else {
      return `https://mainnet.helius-rpc.com/?api-key=${heliusKey}`;
    }
  }, [network]);

  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
      new TrustWalletAdapter(),
    ],
    []
  );

  const onError = (error: WalletError) => {
    console.error('Wallet error:', error);
  };

  return (
    <ConnectionProvider endpoint={endpoint}>
      <SolanaWalletProvider wallets={wallets} onError={onError} autoConnect>
        {children}
      </SolanaWalletProvider>
    </ConnectionProvider>
  );
};
