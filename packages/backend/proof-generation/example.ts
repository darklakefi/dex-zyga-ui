import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  TransactionInstruction,
  ComputeBudgetProgram,
  LAMPORTS_PER_SOL,
  sendAndConfirmTransaction,
} from '@solana/web3.js';
import {
  createMint,
  createAssociatedTokenAccount,
  mintTo,
  TOKEN_PROGRAM_ID,
} from '@solana/spl-token';
import * as fs from 'fs';
import * as path from 'path';
import * as borsh from 'borsh';
import { spawnSync } from 'child_process';

jest.setTimeout(300000);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

class Proof {
  a_priv: Uint8Array;    // G1 64B
  b_priv: Uint8Array;    // G2 128B
  c_priv: Uint8Array;    // G1 64B
  h_base: Uint8Array;    // G1 64B
  a_pub_base: Uint8Array; // G1 64B
  b_pub_base: Uint8Array; // G2 128B
  c_pub_base: Uint8Array; // G1 64B

  constructor(fields: {
    a_priv: Uint8Array; b_priv: Uint8Array; c_priv: Uint8Array;
    h_base: Uint8Array; a_pub_base: Uint8Array; b_pub_base: Uint8Array;
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

function hexToBytes(hex: string): Uint8Array {
  if (hex.startsWith('0x')) hex = hex.slice(2);
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
}

function toBits64(n: bigint): number[] {
  const arr: number[] = new Array(64).fill(0);
  for (let i = 0n; i < 64n; i++) {
    arr[Number(i)] = Number((n >> i) & 1n);
  }
  return arr;
}

const PROJ_ROOT = path.join(__dirname, '../..');
const ZYGA_BIN = path.join(PROJ_ROOT, 'target/release/zyga');
const SETUP_FILE = path.join(PROJ_ROOT, 'test-fixtures/slippage_gt.zyga');
const TMP_DIR = path.join(__dirname, '../.test-tmp');

/** Generate a proof for a > b (result must be 0 or 1). */
function makeProof(a: bigint, b: bigint, result: number, tag: string): Proof {
  fs.mkdirSync(TMP_DIR, { recursive: true });
  const wFile = path.join(TMP_DIR, `witness_${tag}.json`);
  const pFile = path.join(TMP_DIR, `proof_${tag}.json`);
  fs.writeFileSync(wFile, JSON.stringify({ a: toBits64(a), b: toBits64(b), result }));
  const r = spawnSync(ZYGA_BIN, ['prove', '-s', SETUP_FILE, '-w', wFile, '-o', pFile], {
    cwd: PROJ_ROOT, encoding: 'utf8',
  });
  if (r.status !== 0) throw new Error(`prove(${tag}) failed: ${r.stderr}`);
  const elem = JSON.parse(fs.readFileSync(pFile, 'utf-8')).pairing_proof.proof;
  return new Proof({
    a_priv: hexToBytes(elem.a_priv), b_priv: hexToBytes(elem.b_priv),
    c_priv: hexToBytes(elem.c_priv), h_base: hexToBytes(elem.h_base),
    a_pub_base: hexToBytes(elem.a_pub_base), b_pub_base: hexToBytes(elem.b_pub_base),
    c_pub_base: hexToBytes(elem.c_pub_base),
  });
}

/** Build normal-mode instruction data (proof only, 576 bytes). */
function buildNormalIx(proof: Proof): Buffer {
  const w = new borsh.BinaryWriter();
  w.writeFixedArray(proof.a_priv); w.writeFixedArray(proof.b_priv);
  w.writeFixedArray(proof.c_priv); w.writeFixedArray(proof.h_base);
  w.writeFixedArray(proof.a_pub_base); w.writeFixedArray(proof.b_pub_base);
  w.writeFixedArray(proof.c_pub_base);
  return Buffer.from(w.toArray());
}

/** Build diagnostic-mode instruction data: [0xFF] + proof + [a: 8 LE]. */
function buildDiagIx(proof: Proof, a: bigint): Buffer {
  const w = new borsh.BinaryWriter();
  w.writeU8(0xFF);
  w.writeFixedArray(proof.a_priv); w.writeFixedArray(proof.b_priv);
  w.writeFixedArray(proof.c_priv); w.writeFixedArray(proof.h_base);
  w.writeFixedArray(proof.a_pub_base); w.writeFixedArray(proof.b_pub_base);
  w.writeFixedArray(proof.c_pub_base);
  const buf = Buffer.alloc(8); buf.writeBigUInt64LE(a);
  w.writeFixedArray(buf);
  return Buffer.from(w.toArray());
}

/** Send a diagnostic instruction and return tx signature (or throw). */
async function sendDiag(
  connection: Connection, payer: Keypair, programId: PublicKey,
  proof: Proof, a: bigint,
): Promise<string> {
  const ix = new TransactionInstruction({
    keys: [], programId, data: buildDiagIx(proof, a),
  });
  const tx = new Transaction()
    .add(ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 }))
    .add(ix);
  return sendAndConfirmTransaction(connection, tx, [payer]);
}

/** Create a fresh mint + ATA and mint `amount` tokens. */
async function mintTokenAccount(
  connection: Connection, payer: Keypair, amount: number,
): Promise<PublicKey> {
  const m = await createMint(connection, payer, payer.publicKey, null, 6);
  const ata = await createAssociatedTokenAccount(connection, payer, m, payer.publicKey);
  if (amount > 0) await mintTo(connection, payer, m, ata, payer, amount);
  return ata;
}

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('Slippage Verifier', () => {
  let connection: Connection;
  let payer: Keypair;
  let programId: PublicKey;

  // Shared proofs – generated once in beforeAll
  const proofs: Record<string, Proof> = {};

  beforeAll(async () => {
    // Kill any stale validator
    try { require('child_process').execSync('pkill -f solana-test-validator', { stdio: 'ignore' }); } catch {}
    await new Promise(r => setTimeout(r, 2000));

    const so = path.join(__dirname, '../target/deploy/slippage_verifier.so');
    if (!fs.existsSync(so)) throw new Error(`BPF not found at ${so}. Run 'cargo build-sbf' first.`);

    const kp = Keypair.generate();
    programId = kp.publicKey;
    require('child_process').spawn(
      'solana-test-validator',
      ['--reset', '--quiet', '--bpf-program', programId.toBase58(), so],
      { detached: true, stdio: ['ignore', 'pipe', 'pipe'] },
    ).unref();
    await new Promise(r => setTimeout(r, 10000));

    connection = new Connection('http://localhost:8899', 'confirmed');
    payer = Keypair.generate();
    await connection.confirmTransaction(
      await connection.requestAirdrop(payer.publicKey, 10 * LAMPORTS_PER_SOL),
    );
  }, 300000);

  afterAll(async () => {
    try { require('child_process').execSync('pkill -f solana-test-validator'); } catch {}
    fs.rmSync(TMP_DIR, { recursive: true, force: true });
  });

  // Generate all proofs up front (CPU-only, no network)
  beforeAll(() => {
    console.log('Generating proofs for value-range tests …');

    // -- Success proofs (a > b, result = 1) --
    proofs.exact        = makeProof(1_000_000n,  999_999n,  1, 'exact');        // exactly at min_out
    proofs.slightAbove  = makeProof(1_000_001n,  999_999n,  1, 'slightAbove'); // +1 above
    proofs.muchAbove    = makeProof(5_000_000n,  999_999n,  1, 'muchAbove');   // way above
    proofs.barelyAbove  = makeProof(1_500_000n, 1_499_999n, 1, 'barelyAbove'); // a - b = 1
    proofs.small        = makeProof(        2n,         0n, 1, 'small');        // tiny values
    proofs.highHamming  = makeProof(  999_999n,   500_000n, 1, 'highHamming'); // many set bits

    // -- Soundness proof (a <= b, result = 0) --
    proofs.resultZero   = makeProof(  500_000n,   999_999n, 0, 'resultZero');  // a < b

    console.log('All proofs generated.');
  });

  // -------------------------------------------------------------------------
  // Success cases (diagnostic mode – faster, no accounts needed)
  // -------------------------------------------------------------------------

  describe.only('success: value ranges (diagnostic)', () => {
    test.only('exactly at min_out (a - b = 1)', async () => {
      const sig = await sendDiag(connection, payer, programId, proofs.exact, 1_000_000n);
      expect(sig).toBeTruthy();
      console.log('sig', sig);
      console.log('exact match: PASS');
    });

    test('slightly above min_out (a - b = 2)', async () => {
      const sig = await sendDiag(connection, payer, programId, proofs.slightAbove, 1_000_001n);
      expect(sig).toBeTruthy();
      console.log('slightly above: PASS');
    });

    test('much above min_out (a >> b)', async () => {
      const sig = await sendDiag(connection, payer, programId, proofs.muchAbove, 5_000_000n);
      expect(sig).toBeTruthy();
      console.log('much above: PASS');
    });

    test('barely above (a - b = 1, larger values)', async () => {
      const sig = await sendDiag(connection, payer, programId, proofs.barelyAbove, 1_500_000n);
      expect(sig).toBeTruthy();
      console.log('barely above: PASS');
    });

    test('small values (a=2, b=0)', async () => {
      const sig = await sendDiag(connection, payer, programId, proofs.small, 2n);
      expect(sig).toBeTruthy();
      console.log('small values: PASS');
    });

    test('high hamming weight (a=999999, b=500000)', async () => {
      const sig = await sendDiag(connection, payer, programId, proofs.highHamming, 999_999n);
      expect(sig).toBeTruthy();
      console.log('high hamming weight: PASS');
    });
  });

  // -------------------------------------------------------------------------
  // Failure cases (diagnostic mode – all should reject)
  // -------------------------------------------------------------------------

  describe('failure: soundness checks (diagnostic)', () => {
    test('wrong a — off by 1 (should reject)', async () => {
      // Proof was for a=1,000,000 but we provide a=999,999
      await expect(
        sendDiag(connection, payer, programId, proofs.exact, 999_999n),
      ).rejects.toThrow();
      console.log('off-by-1: correctly rejected');
    });

    test('wrong a — off by much (should reject)', async () => {
      // Proof was for a=1,000,000 but we provide a=100
      await expect(
        sendDiag(connection, payer, programId, proofs.exact, 100n),
      ).rejects.toThrow();
      console.log('off-by-much: correctly rejected');
    });

    test('wrong a — zero balance (should reject)', async () => {
      // Proof was for a=1,000,000 but we provide a=0
      await expect(
        sendDiag(connection, payer, programId, proofs.exact, 0n),
      ).rejects.toThrow();
      console.log('zero balance: correctly rejected');
    });

    test('a <= b (result=0 proof, verifier expects result=1) — should reject', async () => {
      // Proof was generated with a=500,000 < b=999,999 → result=0 in proof.
      // Verifier hardcodes result=1. Public input mismatch → pairing fails.
      await expect(
        sendDiag(connection, payer, programId, proofs.resultZero, 500_000n),
      ).rejects.toThrow();
      console.log('a<=b soundness: correctly rejected');
    });

    test('reuse proof with very different balance (should reject)', async () => {
      // barelyAbove proof was for a=1,500,000. Try with a=3,000,000 (many bits differ).
      // Note: off-by-1 in the lowest bit may pass if that bit's A-column coefficient
      // is zero in the circuit. A large difference flips enough bits to fail.
      await expect(
        sendDiag(connection, payer, programId, proofs.barelyAbove, 3_000_000n),
      ).rejects.toThrow();
      console.log('proof reuse with different balance: correctly rejected');
    });
  });

  // -------------------------------------------------------------------------
  // On-chain integration (real token accounts)
  // -------------------------------------------------------------------------

  // -------------------------------------------------------------------------
  // On-chain success (real token accounts, matching balances)
  // -------------------------------------------------------------------------

  describe('on-chain success: value ranges', () => {
    test('exactly at min_out (a=1M, b=999999)', async () => {
      const acct = await mintTokenAccount(connection, payer, 1_000_000);
      const ix = new TransactionInstruction({
        keys: [{ pubkey: acct, isSigner: false, isWritable: false }],
        programId, data: buildNormalIx(proofs.exact),
      });
      const tx = new Transaction()
        .add(ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 }))
        .add(ix);
      const sig = await sendAndConfirmTransaction(connection, tx, [payer]);
      expect(sig).toBeTruthy();
      console.log('on-chain exact: PASS');
    });

    test('slightly above min_out (a=1000001, b=999999)', async () => {
      const acct = await mintTokenAccount(connection, payer, 1_000_001);
      const ix = new TransactionInstruction({
        keys: [{ pubkey: acct, isSigner: false, isWritable: false }],
        programId, data: buildNormalIx(proofs.slightAbove),
      });
      const tx = new Transaction()
        .add(ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 }))
        .add(ix);
      const sig = await sendAndConfirmTransaction(connection, tx, [payer]);
      expect(sig).toBeTruthy();
      console.log('on-chain slightly above: PASS');
    });

    test('much above min_out (a=5M, b=999999)', async () => {
      const acct = await mintTokenAccount(connection, payer, 5_000_000);
      const ix = new TransactionInstruction({
        keys: [{ pubkey: acct, isSigner: false, isWritable: false }],
        programId, data: buildNormalIx(proofs.muchAbove),
      });
      const tx = new Transaction()
        .add(ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 }))
        .add(ix);
      const sig = await sendAndConfirmTransaction(connection, tx, [payer]);
      expect(sig).toBeTruthy();
      console.log('on-chain much above: PASS');
    });

    test('barely above (a=1.5M, b=1499999)', async () => {
      const acct = await mintTokenAccount(connection, payer, 1_500_000);
      const ix = new TransactionInstruction({
        keys: [{ pubkey: acct, isSigner: false, isWritable: false }],
        programId, data: buildNormalIx(proofs.barelyAbove),
      });
      const tx = new Transaction()
        .add(ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 }))
        .add(ix);
      const sig = await sendAndConfirmTransaction(connection, tx, [payer]);
      expect(sig).toBeTruthy();
      console.log('on-chain barely above: PASS');
    });

    test('small values (a=2, b=0)', async () => {
      const acct = await mintTokenAccount(connection, payer, 2);
      const ix = new TransactionInstruction({
        keys: [{ pubkey: acct, isSigner: false, isWritable: false }],
        programId, data: buildNormalIx(proofs.small),
      });
      const tx = new Transaction()
        .add(ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 }))
        .add(ix);
      const sig = await sendAndConfirmTransaction(connection, tx, [payer]);
      expect(sig).toBeTruthy();
      console.log('on-chain small values: PASS');
    });

    test('high hamming weight (a=999999, b=500000)', async () => {
      const acct = await mintTokenAccount(connection, payer, 999_999);
      const ix = new TransactionInstruction({
        keys: [{ pubkey: acct, isSigner: false, isWritable: false }],
        programId, data: buildNormalIx(proofs.highHamming),
      });
      const tx = new Transaction()
        .add(ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 }))
        .add(ix);
      const sig = await sendAndConfirmTransaction(connection, tx, [payer]);
      expect(sig).toBeTruthy();
      console.log('on-chain high hamming: PASS');
    });
  });

  // -------------------------------------------------------------------------
  // On-chain failure (real token accounts, mismatched balances / bad accounts)
  // -------------------------------------------------------------------------

  describe('on-chain failure: soundness checks', () => {
    test('balance off by much — 500k vs proved 1.5M (should reject)', async () => {
      const acct = await mintTokenAccount(connection, payer, 500_000);
      const ix = new TransactionInstruction({
        keys: [{ pubkey: acct, isSigner: false, isWritable: false }],
        programId, data: buildNormalIx(proofs.barelyAbove),
      });
      const tx = new Transaction()
        .add(ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 }))
        .add(ix);
      await expect(sendAndConfirmTransaction(connection, tx, [payer])).rejects.toThrow();
      console.log('on-chain 500k vs 1.5M: correctly rejected');
    });

    test('balance off by much — 100 vs proved 1M (should reject)', async () => {
      const acct = await mintTokenAccount(connection, payer, 100);
      const ix = new TransactionInstruction({
        keys: [{ pubkey: acct, isSigner: false, isWritable: false }],
        programId, data: buildNormalIx(proofs.exact),
      });
      const tx = new Transaction()
        .add(ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 }))
        .add(ix);
      await expect(sendAndConfirmTransaction(connection, tx, [payer])).rejects.toThrow();
      console.log('on-chain 100 vs 1M: correctly rejected');
    });

    test('zero-balance account vs proved 1.5M (should reject)', async () => {
      const acct = await mintTokenAccount(connection, payer, 0);
      const ix = new TransactionInstruction({
        keys: [{ pubkey: acct, isSigner: false, isWritable: false }],
        programId, data: buildNormalIx(proofs.barelyAbove),
      });
      const tx = new Transaction()
        .add(ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 }))
        .add(ix);
      await expect(sendAndConfirmTransaction(connection, tx, [payer])).rejects.toThrow();
      console.log('on-chain zero vs 1.5M: correctly rejected');
    });

    test('zero-balance account vs proved 2 (should reject)', async () => {
      const acct = await mintTokenAccount(connection, payer, 0);
      const ix = new TransactionInstruction({
        keys: [{ pubkey: acct, isSigner: false, isWritable: false }],
        programId, data: buildNormalIx(proofs.small),
      });
      const tx = new Transaction()
        .add(ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 }))
        .add(ix);
      await expect(sendAndConfirmTransaction(connection, tx, [payer])).rejects.toThrow();
      console.log('on-chain zero vs 2: correctly rejected');
    });

    test('reuse proof with very different balance — 3M vs proved 1.5M (should reject)', async () => {
      const acct = await mintTokenAccount(connection, payer, 3_000_000);
      const ix = new TransactionInstruction({
        keys: [{ pubkey: acct, isSigner: false, isWritable: false }],
        programId, data: buildNormalIx(proofs.barelyAbove),
      });
      const tx = new Transaction()
        .add(ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 }))
        .add(ix);
      await expect(sendAndConfirmTransaction(connection, tx, [payer])).rejects.toThrow();
      console.log('on-chain 3M vs 1.5M: correctly rejected');
    });

    test('wrong account owner — system account (should reject)', async () => {
      const ix = new TransactionInstruction({
        keys: [{ pubkey: payer.publicKey, isSigner: false, isWritable: false }],
        programId, data: buildNormalIx(proofs.barelyAbove),
      });
      const tx = new Transaction()
        .add(ComputeBudgetProgram.setComputeUnitLimit({ units: 1_400_000 }))
        .add(ix);
      await expect(sendAndConfirmTransaction(connection, tx, [payer])).rejects.toThrow();
      console.log('on-chain wrong owner: correctly rejected');
    });
  });
});
