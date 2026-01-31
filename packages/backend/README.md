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
  "proof": "base64_encoded_proof_instruction_data",
  "size": 576
}
```

**Error Response:**
```json
{
  "error": "Error message",
  "message": "Detailed error description"
}
```

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

- `PORT` - Server port (default: 4000)

## Architecture

- **Express.js** - Web framework
- **TypeScript** - Type safety
- **Zyga Binary** - ZK proof generation
- **CORS** - Enabled for frontend access
