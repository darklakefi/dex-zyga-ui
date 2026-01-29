// Raydium CPMM quote API using Raydium SDK v2
// This endpoint calculates swap quotes using on-chain pool data

import type { NextApiRequest, NextApiResponse } from 'next';
import { initRaydium, isValidCpmm } from '@/lib/raydium-config';
import {
  ApiV3PoolInfoStandardItemCpmm,
  CurveCalculator,
  FeeOn,
} from '@raydium-io/raydium-sdk-v2';
import BN from 'bn.js';

type QuoteResponse = {
  ok?: boolean;
  outAmount?: string;
  poolId?: string;
  priceImpact?: string;
  fee?: string;
  error?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<QuoteResponse>
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { inputMint, outputMint, amount, userPublicKey } = req.query;
  
  if (!inputMint || !outputMint || !amount) {
    return res.status(400).json({ error: 'Missing inputMint/outputMint/amount' });
  }

  if (!userPublicKey) {
    return res.status(400).json({ error: 'Wallet public key is required. Please connect your wallet.' });
  }

  try {
    const raydium = await initRaydium(String(userPublicKey));
    const inputAmount = new BN(String(amount));
    const inputMintStr = String(inputMint);
    const outputMintStr = String(outputMint);

    // Fetch pools that match the token pair
    const poolsData = await raydium.api.fetchPoolByMints({
      mint1: inputMintStr,
      mint2: outputMintStr,
    });

    if (!poolsData || !poolsData.data || poolsData.data.length === 0) {
      return res.status(404).json({ 
        error: 'No pool found for this token pair' 
      });
    }

    // Find a valid CPMM pool
    let bestQuote: {
      outAmount: string;
      poolId: string;
      priceImpact: string;
      fee: string;
    } | null = null;

    for (const pool of poolsData.data) {
      try {
        // Only process CPMM pools
        if (!isValidCpmm(pool.programId)) continue;

        const poolInfo = pool as ApiV3PoolInfoStandardItemCpmm;
        
        // Verify mints match
        if (
          inputMintStr !== poolInfo.mintA.address &&
          inputMintStr !== poolInfo.mintB.address
        ) {
          continue;
        }

        // Get on-chain pool data
        const rpcData = await raydium.cpmm.getRpcPoolInfo(poolInfo.id, true);

        // Determine if we're swapping base for quote or vice versa
        const baseIn = inputMintStr === poolInfo.mintA.address;

        // Calculate swap result
        const swapResult = CurveCalculator.swapBaseInput(
          inputAmount,
          baseIn ? rpcData.baseReserve : rpcData.quoteReserve,
          baseIn ? rpcData.quoteReserve : rpcData.baseReserve,
          rpcData.configInfo!.tradeFeeRate,
          rpcData.configInfo!.creatorFeeRate,
          rpcData.configInfo!.protocolFeeRate,
          rpcData.configInfo!.fundFeeRate,
          rpcData.feeOn === FeeOn.BothToken || rpcData.feeOn === FeeOn.OnlyTokenB
        );

        // Calculate price impact as a percentage
        // priceImpact = (1 - outputAmount / (inputAmount * price)) * 100
        const priceImpact = '0'; // Simplified for now, can be calculated if needed

        const quote = {
          outAmount: swapResult.outputAmount.toString(),
          poolId: poolInfo.id,
          priceImpact,
          fee: swapResult.tradeFee.toString(),
        };

        // Use first valid quote (could be improved to find best quote)
        if (!bestQuote) {
          bestQuote = quote;
          break; // Use first valid pool for now
        }
      } catch (poolError) {
        // Skip this pool and try next
        console.error('Error processing pool:', poolError);
        continue;
      }
    }

    if (!bestQuote) {
      return res.status(404).json({ 
        error: 'No valid CPMM pool found for this swap' 
      });
    }

    return res.status(200).json({
      ok: true,
      ...bestQuote,
    });
  } catch (error) {
    console.error('Quote error:', error);
    return res.status(500).json({ 
      error: error instanceof Error ? error.message : 'Failed to get quote' 
    });
  }
}
