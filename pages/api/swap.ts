// Raydium CPMM swap execution API
// This endpoint prepares swap transactions that can be signed by the user's wallet
// Supports instruction injection for future custom logic

import type { NextApiRequest, NextApiResponse } from 'next';
import { initRaydium, isValidCpmm } from '@/lib/raydium-config';
import {
  ApiV3PoolInfoStandardItemCpmm,
  CurveCalculator,
  FeeOn,
  TxVersion,
} from '@raydium-io/raydium-sdk-v2';
import BN from 'bn.js';
import { Connection, PublicKey, TransactionInstruction } from '@solana/web3.js';
import { createWrapSOLInstructions, needsSOLWrap } from '@/lib/sol-wrap-utils';

type SwapResponse = {
  ok?: boolean;
  serializedTransaction?: string;
  error?: string;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SwapResponse>
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    inputMint,
    outputMint,
    amount,
    slippage = 0.005, // 0.5% default
    poolId,
    userPublicKey,
    // Future: additionalInstructions can be passed here for injection
  } = req.body;

  if (!inputMint || !outputMint || !amount || !poolId || !userPublicKey) {
    return res.status(400).json({
      error: 'Missing required fields: inputMint, outputMint, amount, poolId, userPublicKey',
    });
  }

  try {
    const raydium = await initRaydium(userPublicKey);
    const inputAmount = new BN(String(amount));
    const inputMintStr = String(inputMint);

    // Fetch the specific pool
    const poolData = await raydium.api.fetchPoolById({ ids: poolId });
    
    if (!poolData || poolData.length === 0) {
      return res.status(404).json({ error: 'Pool not found' });
    }

    const poolInfo = poolData[0] as ApiV3PoolInfoStandardItemCpmm;

    if (!isValidCpmm(poolInfo.programId)) {
      return res.status(400).json({ error: 'Pool is not a valid CPMM pool' });
    }

    // Get on-chain pool data
    const rpcData = await raydium.cpmm.getRpcPoolInfo(poolInfo.id, true);

    // Determine swap direction
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

    // Build swap transaction
    // Note: We use a temporary owner here - the actual signing will happen client-side
    const { transaction } = await raydium.cpmm.swap({
      poolInfo,
      inputAmount,
      swapResult,
      slippage: Number(slippage),
      baseIn,
      txVersion: TxVersion.V0,
      
      // Optional: Add priority fee configuration
      // computeBudgetConfig: {
      //   units: 600000,
      //   microLamports: 100000,
      // },
    });

    // FUTURE: Instruction injection point
    // This is where we can add custom instructions to the transaction
    // Example:
    // if (additionalInstructions && Array.isArray(additionalInstructions)) {
    //   for (const instruction of additionalInstructions) {
    //     transaction.add(TransactionInstruction.from(instruction));
    //   }
    // }

    // Serialize transaction for client-side signing
    const serialized = Buffer.from(
      transaction.serialize({
        requireAllSignatures: false,
        verifySignatures: false,
      })
    ).toString('base64');

    return res.status(200).json({
      ok: true,
      serializedTransaction: serialized,
    });
  } catch (error) {
    console.error('Swap preparation error:', error);
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to prepare swap',
    });
  }
}
