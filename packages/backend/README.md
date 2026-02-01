# Zyga Proof Generator Backend

Express.js backend service for generating zero-knowledge proofs for slippage protection using Darklake Zyga.

This package is self-contained and includes:
- Express.js API server (`src/`)
- Proof generation logic (`src/proof.ts`)
- Zyga binary and circuit files (`proof-generation/`)
- TypeScript configuration
- Docker support

## Endpoints

### `GET /health`
Health check endpoint.

**Response:**
```json
{
  "status": "ok",
  "service": "zyga-proof-generator"
}
```

### `POST /generate-proof-ix`
Generate a zero-knowledge proof instruction that actualAmount > minAmount.

**Request Body:**
```json
{
  "actualAmount": "1000000",
  "minAmount": "999999"
}
```

**Response:**
```json
{
  "success": true,
  "proofIx": "base64_encoded_proof_instruction_data",
  "size": 584
}
```

**Error Response:**
```json
{
  "error": "Error message",
  "message": "Detailed error description"
}
```

### `POST /faucet`
Transfer devnet tokens to a wallet address (devnet only).

**Request Body:**
```json
{
  "walletAddress": "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU",
  "tokenType": "DLink"
}
```

**Token Types:**
- `DLink` - Transfers 10 DLink tokens
- `dUSDC` - Transfers 0.01 dUSDC tokens

**Response:**
```json
{
  "success": true,
  "signature": "transaction_signature"
}
```

**Error Response:**
```json
{
  "error": "Error message",
  "retryAfter": 3
}
```

**Rate Limiting:** 5 second cooldown per wallet address

## Package Structure

```
packages/backend/
├── src/
│   ├── index.ts          # Express server
│   └── proof.ts          # Proof generation logic
├── proof-generation/
│   ├── zyga              # ZK proof binary
│   ├── slippage_gt.zyga  # Circuit setup file
│   └── example.ts        # Reference implementation
├── .proof-tmp/           # Temporary proof files (generated)
├── Dockerfile            # Container image
├── package.json
└── tsconfig.json
```

## Development

```bash
# Install dependencies
pnpm install

# Run in development mode (with hot reload)
pnpm run dev

# Build
pnpm run build

# Run production
pnpm run start
```

## Docker

The backend is automatically started with docker-compose:

```bash
# Start all services (from root)
docker-compose -f docker-compose-demo.yml up -d

# View backend logs
docker logs zyga-ui-backend -f

# Access backend directly
curl http://localhost:4000/health

# Generate proof instruction
curl -X POST http://localhost:4000/generate-proof-ix \
  -H "Content-Type: application/json" \
  -d '{"actualAmount":"1000000","minAmount":"999999"}'
```

## Environment Variables

Create a `.env.local` file in the `packages/backend/` directory (see `.env.example`):

```bash
# Server Port
PORT=4000

# Network Configuration
NETWORK=devnet

# Helius API Key (REQUIRED for RPC connections)
HELIUS_API_KEY=your_helius_api_key_here

# Faucet Private Key (Devnet Only)
FAUCET_PRIVATE_KEY=[1,2,3,4,5,...]
```

### Variable Details:

- **`PORT`** - Server port (default: 4000)
- **`NETWORK`** - Network configuration: `mainnet` or `devnet`
- **`HELIUS_API_KEY`** - Helius RPC API key for blockchain connections
- **`FAUCET_PRIVATE_KEY`** - Private key for devnet faucet wallet (JSON array format)

## Architecture

- **Express.js** - Web framework
- **TypeScript** - Type safety
- **Zyga Binary** - ZK proof generation
- **CORS** - Enabled for frontend access
