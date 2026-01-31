import express, { Request, Response } from 'express';
import cors from 'cors';
import { generateSlippageProof } from './proof';

const app = express();
const PORT = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(express.json());

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

// Start server
app.listen(PORT, () => {
  console.log(`🛡️  Zyga Proof Generator running on port ${PORT}`);
  console.log(`   Health check: http://localhost:${PORT}/health`);
  console.log(`   Proof instruction endpoint: http://localhost:${PORT}/generate-proof-ix`);
});
