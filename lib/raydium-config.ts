import { Raydium, TxVersion } from '@raydium-io/raydium-sdk-v2';
import { Connection, PublicKey } from '@solana/web3.js';

export interface RaydiumConfig {
  connection: Connection;
  raydium: Raydium;
}

export async function initRaydium(userPublicKey: string | PublicKey): Promise<Raydium> {
  if (!userPublicKey) {
    throw new Error('Wallet public key is required. Please connect your wallet.');
  }

  const network = process.env.NEXT_PUBLIC_NETWORK || 'mainnet';
  const cluster = network === 'devnet' ? 'devnet' : 'mainnet';

  let rpcEndpoint: string;
  
  // Use custom RPC endpoint if provided
  if (process.env.NEXT_PUBLIC_RPC_ENDPOINT) {
    rpcEndpoint = process.env.NEXT_PUBLIC_RPC_ENDPOINT;
  } else {
    // Use Helius for both mainnet and devnet
    const heliusKey = process.env.NEXT_PUBLIC_HELIUS_API_KEY;
    if (!heliusKey) {
      throw new Error('NEXT_PUBLIC_HELIUS_API_KEY is required. Please add it to your .env.local file.');
    }
    
    if (network === 'devnet') {
      rpcEndpoint = `https://devnet.helius-rpc.com/?api-key=${heliusKey}`;
    } else {
      rpcEndpoint = `https://mainnet.helius-rpc.com/?api-key=${heliusKey}`;
    }
  }

  const connection = new Connection(rpcEndpoint, 'confirmed');

  // Use connected wallet's public key as owner
  const owner = typeof userPublicKey === 'string' ? new PublicKey(userPublicKey) : userPublicKey;

  const raydium = await Raydium.load({
    owner,
    connection,
    cluster,
    disableFeatureCheck: true,
    disableLoadToken: false,
    blockhashCommitment: 'finalized',
  });

  return raydium;
}

export function isValidCpmm(programId: string): boolean {
  const network = process.env.NEXT_PUBLIC_NETWORK || 'mainnet';
  
  // Network-specific CPMM program IDs
  const mainnetCpmmIds = [
    'CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C', // CPMM mainnet program
  ];
  
  const devnetCpmmIds = [
    'DRaycpLY18LhpbydsBWbVJtxpNv9oXPgjRSfpF2bWpYb', // CPMM devnet program
  ];

  const cpmmProgramIds = network === 'devnet' ? devnetCpmmIds : mainnetCpmmIds;
  return cpmmProgramIds.includes(programId);
}
