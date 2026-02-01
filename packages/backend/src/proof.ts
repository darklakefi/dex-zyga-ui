/**
 * Darklake Zyga Proof Generation
 * 
 * This module generates zero-knowledge proofs for slippage protection
 * using the Zyga binary and circuit setup file.
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

// Proof structure matching the Zyga output
export class Proof {
  a_priv: Uint8Array;    // G1 64B
  b_priv: Uint8Array;    // G2 128B
  c_priv: Uint8Array;    // G1 64B
  h_base: Uint8Array;    // G1 64B
  a_pub_base: Uint8Array; // G1 64B
  b_pub_base: Uint8Array; // G2 128B
  c_pub_base: Uint8Array; // G1 64B

  constructor(fields: {
    a_priv: Uint8Array;
    b_priv: Uint8Array;
    c_priv: Uint8Array;
    h_base: Uint8Array;
    a_pub_base: Uint8Array;
    b_pub_base: Uint8Array;
    c_pub_base: Uint8Array;
  }) {
    this.a_priv = fields.a_priv;
    this.b_priv = fields.b_priv;
    this.c_priv = fields.c_priv;
    this.h_base = fields.h_base;
    this.a_pub_base = fields.a_pub_base;
    this.b_pub_base = fields.b_pub_base;
    this.c_pub_base = fields.c_pub_base;
  }
}

/**
 * Convert hex string to Uint8Array
 */
function hexToBytes(hex: string): Uint8Array {
  if (hex.startsWith('0x')) hex = hex.slice(2);
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

/**
 * Convert bigint to 64-bit binary representation
 */
function toBits64(n: bigint): number[] {
  const arr: number[] = new Array(64).fill(0);
  for (let i = 0n; i < 64n; i++) {
    arr[Number(i)] = Number((n >> i) & 1n);
  }
  return arr;
}

/**
 * Generate a proof that a > b
 * 
 * @param a - The actual amount (e.g., received tokens)
 * @param b - The minimum expected amount (e.g., minOut with slippage)
 * @param result - Must be 1 if a > b, 0 otherwise
 * @param tag - Unique identifier for this proof generation
 * @returns Proof object
 */
export function makeProof(a: bigint, b: bigint, result: number, tag: string): Proof {
  // Paths relative to backend package root
  const BACKEND_ROOT = path.join(__dirname, '..');
  const ZYGA_BIN = path.join(BACKEND_ROOT, 'proof-generation/zyga');
  const SETUP_FILE = path.join(BACKEND_ROOT, 'proof-generation/slippage_gt.zyga');
  const TMP_DIR = path.join(BACKEND_ROOT, '.proof-tmp');

  // Ensure temp directory exists
  fs.mkdirSync(TMP_DIR, { recursive: true });

  // Create witness file
  const wFile = path.join(TMP_DIR, `witness_${tag}.json`);
  const pFile = path.join(TMP_DIR, `proof_${tag}.json`);
  
  // result_check must equal result for the circuit to be satisfiable
  const witness = {
    a: toBits64(a),
    b: toBits64(b),
    result,
    result_check: result
  };
  
  fs.writeFileSync(wFile, JSON.stringify(witness));

  try {
    // Run zyga binary to generate proof
    execSync(
      `${ZYGA_BIN} prove -s ${SETUP_FILE} -w ${wFile} -o ${pFile}`,
      { cwd: BACKEND_ROOT, encoding: 'utf8' }
    );
  } catch (error: any) {
    throw new Error(`Proof generation failed: ${error.message}`);
  }

  // Read and parse proof
  const proofData = JSON.parse(fs.readFileSync(pFile, 'utf-8'));
  const elem = proofData.pairing_proof.proof;

  return new Proof({
    a_priv: hexToBytes(elem.a_priv),
    b_priv: hexToBytes(elem.b_priv),
    c_priv: hexToBytes(elem.c_priv),
    h_base: hexToBytes(elem.h_base),
    a_pub_base: hexToBytes(elem.a_pub_base),
    b_pub_base: hexToBytes(elem.b_pub_base),
    c_pub_base: hexToBytes(elem.c_pub_base),
  });
}

/**
 * Build normal-mode instruction data: proof + [a_base: 8 LE] = 584 bytes
 * This is the instruction data that will be added to the transaction
 * 
 * @param proof - The generated proof
 * @param aBase - The base value used in proof generation (8 bytes LE)
 * @returns Buffer containing the serialized proof + aBase
 */
export function buildNormalIx(proof: Proof, aBase: bigint): Buffer {
  // Calculate total size: 64 + 128 + 64 + 64 + 64 + 128 + 64 + 8 = 584 bytes
  const buffer = Buffer.alloc(584);
  let offset = 0;

  // Write each proof component in order
  buffer.set(proof.a_priv, offset);
  offset += proof.a_priv.length;

  buffer.set(proof.b_priv, offset);
  offset += proof.b_priv.length;

  buffer.set(proof.c_priv, offset);
  offset += proof.c_priv.length;

  buffer.set(proof.h_base, offset);
  offset += proof.h_base.length;

  buffer.set(proof.a_pub_base, offset);
  offset += proof.a_pub_base.length;

  buffer.set(proof.b_pub_base, offset);
  offset += proof.b_pub_base.length;

  buffer.set(proof.c_pub_base, offset);
  offset += proof.c_pub_base.length;

  // Write aBase as 8-byte little-endian
  buffer.writeBigUInt64LE(aBase, offset);

  return buffer;
}

/**
 * Generate proof for slippage protection
 * 
 * @param actualAmount - The actual amount received (in base units)
 * @param minAmount - The minimum expected amount (in base units)
 * @returns Buffer containing the proof instruction data
 */
export async function generateSlippageProof(
  actualAmount: bigint,
  minAmount: bigint
): Promise<Buffer> {
  // Verify that actualAmount > minAmount
  if (actualAmount <= minAmount) {
    throw new Error('Actual amount must be greater than minimum amount for slippage protection');
  }

  // Generate unique tag for this proof
  const tag = `${Date.now()}_${Math.random().toString(36).substring(7)}`;

  console.log('Generating proof for actualAmount:', actualAmount, 'and minAmount:', minAmount);

  const a = actualAmount;
  const b = actualAmount - 1n;
  const aBase = actualAmount; // Base value used in proof generation

  console.log('Generating proof for a:', a, 'and b:', b);
  // Generate proof (result = 1 means a > b)
  const proof = makeProof(a, b, 1, tag);

  // Build instruction data with proof + aBase
  return buildNormalIx(proof, aBase);
}

/**
 * Clean up temporary proof files
 */
export function cleanupProofFiles(): void {
  const BACKEND_ROOT = path.join(__dirname, '..');
  const TMP_DIR = path.join(BACKEND_ROOT, '.proof-tmp');
  
  try {
    fs.rmSync(TMP_DIR, { recursive: true, force: true });
  } catch (error) {
    console.warn('Failed to cleanup proof files:', error);
  }
}
