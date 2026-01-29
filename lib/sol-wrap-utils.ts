import {
  createAssociatedTokenAccountInstruction,
  createSyncNativeInstruction,
  getAssociatedTokenAddressSync,
  NATIVE_MINT,
} from '@solana/spl-token';
import {
  Connection,
  PublicKey,
  SystemProgram,
  TransactionInstruction,
} from '@solana/web3.js';

/**
 * Creates instructions to wrap native SOL to WSOL
 * This is required before swapping native SOL since pools only work with WSOL
 * 
 * @param connection - Solana connection
 * @param owner - Wallet public key
 * @param amount - Amount of lamports to wrap
 * @returns Array of instructions to add to transaction
 */
export async function createWrapSOLInstructions(
  connection: Connection,
  owner: PublicKey,
  amount: bigint
): Promise<TransactionInstruction[]> {
  const instructions: TransactionInstruction[] = [];

  // Get the associated token account for WSOL
  const associatedTokenAccount = getAssociatedTokenAddressSync(
    NATIVE_MINT,
    owner
  );

  // Check if ATA exists
  const accountInfo = await connection.getAccountInfo(associatedTokenAccount);

  // If ATA doesn't exist, create it
  if (!accountInfo) {
    instructions.push(
      createAssociatedTokenAccountInstruction(
        owner, // payer
        associatedTokenAccount, // ata
        owner, // owner
        NATIVE_MINT // mint
      )
    );
  }

  // Transfer SOL to the ATA
  instructions.push(
    SystemProgram.transfer({
      fromPubkey: owner,
      toPubkey: associatedTokenAccount,
      lamports: amount,
    })
  );

  // Sync the native balance to the token account
  instructions.push(
    createSyncNativeInstruction(associatedTokenAccount)
  );

  return instructions;
}

/**
 * Creates instructions to unwrap WSOL back to native SOL
 * This closes the WSOL account and returns SOL to the wallet
 * 
 * @param owner - Wallet public key
 * @returns Instruction to close the WSOL account
 */
export function createUnwrapSOLInstruction(
  owner: PublicKey
): TransactionInstruction {
  const associatedTokenAccount = getAssociatedTokenAddressSync(
    NATIVE_MINT,
    owner
  );

  // Note: closeAccount instruction should be imported from @solana/spl-token
  // For now, return a placeholder - this will be implemented when needed
  // closeAccount will transfer remaining lamports back and close the account
  
  // This is a simplified version - full implementation would use:
  // import { createCloseAccountInstruction } from '@solana/spl-token';
  // return createCloseAccountInstruction(associatedTokenAccount, owner, owner);
  
  throw new Error('Unwrap SOL not yet implemented - add closeAccount instruction');
}

/**
 * Checks if a given mint address is native SOL
 */
export function isNativeSOL(mint: string): boolean {
  return mint === '11111111111111111111111111111111';
}

/**
 * Checks if a given mint address is WSOL
 */
export function isWSOL(mint: string): boolean {
  return mint === NATIVE_MINT.toBase58();
}

/**
 * Determines if we need to wrap SOL for a swap
 * Returns true if inputMint is native SOL
 */
export function needsSOLWrap(inputMint: string): boolean {
  return isNativeSOL(inputMint);
}
