import { config } from 'dotenv';
import { resolve } from 'path';
import { existsSync } from 'fs';

// Load environment variables from backend directory BEFORE other imports
// Try .env.local first, then fall back to .env
const envLocalPath = resolve(__dirname, '../.env.local');

if (existsSync(envLocalPath)) {
  config({ path: envLocalPath });
  console.log('📋 Loaded environment from .env.local');
} else {
  console.log('⚠️  No .env.local file found, using system environment variables');
}

import express, { Request, Response } from 'express';
import cors from 'cors';
import { generateSlippageProof } from './proof';
import { 
  Connection, 
  Keypair, 
  PublicKey, 
  Transaction,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
  createAssociatedTokenAccountInstruction,
  createTransferInstruction,
  getAssociatedTokenAddress,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';

const app = express();
const PORT = process.env.PORT || 4000;

// Log environment configuration on startup
console.log('🔧 Environment Configuration:');
console.log('   PORT:', PORT);
console.log('   NETWORK:', process.env.NETWORK || 'not set');
console.log('   HELIUS_API_KEY:', process.env.HELIUS_API_KEY?.slice(0, 10) + '...');
console.log('   FAUCET_PRIVATE_KEY:', process.env.FAUCET_PRIVATE_KEY?.slice(0, 10) + '...');

// Middleware
app.use(cors());
app.use(express.json());

// Token configurations for faucet
const FAUCET_TOKENS = {
  DLink: {
    mint: 'G3nB3rDsYEKKt1zGoYHr8mbrGeB1hViVzdzTZhzDM9J1',
    decimals: 6,
    amount: 10, // 10 DLink
  },
  dUSDC: {
    mint: 'USDCoctVLVnvTXBEuP9s8hntucdJokbo17RwHuNXemT',
    decimals: 6,
    amount: 0.01, // 0.01 dUSDC
  },
};

// Rate limiting configuration for faucet
const RATE_LIMIT_WINDOW_MS = 5000; // 5 seconds
const rateLimitMap = new Map<string, number>();

// Cleanup old entries every minute
setInterval(() => {
  const now = Date.now();
  for (const [key, timestamp] of rateLimitMap.entries()) {
    if (now - timestamp > RATE_LIMIT_WINDOW_MS) {
      rateLimitMap.delete(key);
    }
  }
}, 60000);

function checkRateLimit(identifier: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const lastRequest = rateLimitMap.get(identifier);

  if (lastRequest) {
    const timeSinceLastRequest = now - lastRequest;
    if (timeSinceLastRequest < RATE_LIMIT_WINDOW_MS) {
      const retryAfter = Math.ceil((RATE_LIMIT_WINDOW_MS - timeSinceLastRequest) / 1000);
      return { allowed: false, retryAfter };
    }
  }

  rateLimitMap.set(identifier, now);
  return { allowed: true };
}

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'zyga-proof-generator' });
});

// Generate proof instruction endpoint
app.post('/generate-proof-ix', async (req: Request, res: Response) => {
  try {
    const { actualAmount, minAmount } = req.body;

    // Validate input
    if (actualAmount === undefined || actualAmount === null || minAmount === undefined || minAmount === null) {
      return res.status(400).json({
        error: 'Missing required fields: actualAmount, minAmount'
      });
    }

    // Convert to bigint
    let actualAmountBigInt: bigint;
    let minAmountBigInt: bigint;

    try {
      actualAmountBigInt = BigInt(actualAmount);
      minAmountBigInt = BigInt(minAmount);
    } catch (error) {
      return res.status(400).json({
        error: 'Invalid amount format. Must be valid integers or strings representing integers.'
      });
    }

    // Validate amounts
    if (actualAmountBigInt < 0n || minAmountBigInt < 0n) {
      return res.status(400).json({
        error: 'Amounts must be non-negative'
      });
    }

    if (actualAmountBigInt <= minAmountBigInt) {
      return res.status(400).json({
        error: 'Actual amount must be greater than minimum amount'
      });
    }

    console.log(`Generating proof: actualAmount=${actualAmount}, minAmount=${minAmount}`);

    // Generate proof
    const proofBuffer = await generateSlippageProof(actualAmountBigInt, minAmountBigInt);

    // Convert buffer to base64 for transmission
    const proofBase64 = proofBuffer.toString('base64');

    res.json({
      success: true,
      proofIx: proofBase64,
      size: proofBuffer.length
    });

  } catch (error: any) {
    console.error('Proof generation error:', error);
    res.status(500).json({
      error: 'Proof generation failed',
      message: error.message
    });
  }
});

// Faucet endpoint
app.post('/faucet', async (req: Request, res: Response) => {
  try {
    const { walletAddress, tokenType } = req.body;

    // Validate input
    if (!walletAddress || !tokenType) {
      return res.status(400).json({
        error: 'Missing required fields: walletAddress, tokenType',
      });
    }

    if (tokenType !== 'DLink' && tokenType !== 'dUSDC') {
      return res.status(400).json({
        error: 'Invalid tokenType. Must be "DLink" or "dUSDC"',
      });
    }

    // Check if we're on devnet
    const network = process.env.NETWORK || 'mainnet';
    if (network !== 'devnet') {
      return res.status(403).json({
        error: 'Faucet is only available on devnet',
      });
    }

    // Rate limiting check (5 second cooldown per wallet)
    const rateLimitCheck = checkRateLimit(walletAddress);
    if (!rateLimitCheck.allowed) {
      return res.status(429).json({
        error: `Please wait ${rateLimitCheck.retryAfter} seconds before requesting again`,
        retryAfter: rateLimitCheck.retryAfter,
      });
    }

    // Get faucet private key from environment
    const faucetPrivateKey = process.env.FAUCET_PRIVATE_KEY;
    if (!faucetPrivateKey) {
      console.error('FAUCET_PRIVATE_KEY not configured');
      return res.status(500).json({
        error: 'Faucet not configured',
      });
    }

    // Initialize connection using Helius (same logic as frontend)
    const heliusKey = process.env.HELIUS_API_KEY;
    if (!heliusKey) {
      console.error('HELIUS_API_KEY not configured');
      return res.status(500).json({
        error: 'RPC endpoint not configured',
      });
    }
    
    const rpcUrl = network === 'devnet' 
      ? `https://devnet.helius-rpc.com/?api-key=${heliusKey}`
      : `https://mainnet.helius-rpc.com/?api-key=${heliusKey}`;
    
    const connection = new Connection(rpcUrl, 'confirmed');

    // Parse faucet keypair from private key
    const faucetKeypair = Keypair.fromSecretKey(
      Buffer.from(JSON.parse(faucetPrivateKey))
    );

    const tokenConfig = FAUCET_TOKENS[tokenType as keyof typeof FAUCET_TOKENS];
    const mintPubkey = new PublicKey(tokenConfig.mint);
    const recipientPubkey = new PublicKey(walletAddress);

    // Get associated token addresses
    const faucetTokenAccount = await getAssociatedTokenAddress(
      mintPubkey,
      faucetKeypair.publicKey,
      false,
      TOKEN_PROGRAM_ID
    );

    const recipientTokenAccount = await getAssociatedTokenAddress(
      mintPubkey,
      recipientPubkey,
      false,
      TOKEN_PROGRAM_ID
    );

    // Check if recipient token account exists
    const recipientAccountInfo = await connection.getAccountInfo(recipientTokenAccount);
    
    const transaction = new Transaction();

    // Create associated token account if it doesn't exist
    if (!recipientAccountInfo) {
      console.log('Creating token account for recipient:', recipientTokenAccount.toBase58());
      transaction.add(
        createAssociatedTokenAccountInstruction(
          faucetKeypair.publicKey, // payer
          recipientTokenAccount,
          recipientPubkey, // owner
          mintPubkey,
          TOKEN_PROGRAM_ID
        )
      );
    }

    // Calculate amount in base units (with decimals)
    const amountInBaseUnits = BigInt(
      Math.floor(tokenConfig.amount * Math.pow(10, tokenConfig.decimals))
    );

    // Add transfer instruction
    transaction.add(
      createTransferInstruction(
        faucetTokenAccount,
        recipientTokenAccount,
        faucetKeypair.publicKey,
        amountInBaseUnits,
        [],
        TOKEN_PROGRAM_ID
      )
    );

    // Send and confirm transaction
    console.log(`Sending ${tokenConfig.amount} ${tokenType} to ${walletAddress}...`);
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [faucetKeypair],
      {
        commitment: 'confirmed',
        skipPreflight: false,
      }
    );

    console.log(`Faucet transfer successful! Signature: ${signature}`);

    res.json({
      success: true,
      signature,
    });
  } catch (error: any) {
    console.error('Faucet error:', error);
    res.status(500).json({
      error: error.message || 'Failed to process faucet request',
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🛡️  Zyga Proof Generator running on port ${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/health`);
  console.log(`   Proof instruction endpoint: http://localhost:${PORT}/generate-proof-ix`);
  console.log(`   Faucet endpoint: http://localhost:${PORT}/faucet`);
});
