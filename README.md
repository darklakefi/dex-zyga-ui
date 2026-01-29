# DEX Zyga UI - Raydium Swap Interface

A Next.js-based DEX UI for Raydium CPMM pools with Solana wallet integration.

## Features

- **Raydium SDK Integration**: Uses `@raydium-io/raydium-sdk-v2` for accurate quotes
- **Multi-Wallet Support**: Phantom, Solflare, Trust Wallet via Solana Wallet Adapter
- **Network Support**: Mainnet and Devnet configurations
- **Token Balance Display**: Real-time balance fetching for connected wallets
- **Custom Dropdown UI**: Modern, dark-themed interface matching DeFi standards
- **TypeScript**: Full type safety throughout the codebase

## Getting Started

### 1. Install Dependencies

```bash
pnpm install
```

### 2. Configure Environment Variables

**REQUIRED: Get a Helius API Key (for Mainnet)**

1. Go to [https://www.helius.dev/](https://www.helius.dev/) and sign up for a free account
2. Get your API key from the dashboard
3. Create a `.env.local` file and add your key:

```bash
# For Mainnet
NEXT_PUBLIC_NETWORK=mainnet
NEXT_PUBLIC_HELIUS_API_KEY=your_helius_api_key_here
```

**For Devnet:**
```bash
# Copy the devnet config
cp .env.local.devnet .env.local

# Or manually create .env.local with:
NEXT_PUBLIC_NETWORK=devnet
# Note: Helius API key is not required for devnet
```

**Optional: Custom RPC Endpoint**
```bash
# Override the default RPC endpoint (optional)
NEXT_PUBLIC_RPC_ENDPOINT=your_custom_rpc_endpoint
```

### 3. Run Development Server

```bash
pnpm dev
```

### 4. Open the App

```
http://localhost:3000
```

## Network Configuration

### Mainnet
- **Tokens**: WSOL, Fartcoin, RAY, USDC, USDT
- **RPC**: Helius (requires API key - see setup instructions above)
- **CPMM Program**: `CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C`

### Devnet
- **Tokens**: WSOL, dUSDC
- **RPC**: Public Solana devnet endpoint (no API key required)
- **CPMM Program**: `DRaycpLY18LhpbydsBWbVJtxpNv9oXPgjRSfpF2bWpYb`

Switch networks by setting `NEXT_PUBLIC_NETWORK=devnet` in `.env.local`

## Architecture

- **Frontend**: Next.js 14 with TypeScript
- **Wallet**: Solana Wallet Adapter with Phantom, Solflare, Trust Wallet
- **Quotes**: Raydium SDK v2 with CPMM pool integration
- **Styling**: Custom CSS with dark theme

## API Endpoints

- `GET /api/quote` - Get swap quotes using Raydium CPMM pools
- `POST /api/swap` - Prepare swap transactions (future implementation)

See [API_DOCS.md](./API_DOCS.md) for detailed API documentation.

## Token Configuration

Tokens are configured based on network in `pages/index.tsx`:
- Mainnet: 6 tokens including meme tokens and stablecoins
- Devnet: 3 tokens (SOL, WSOL, dRAY) for testing

## Notes

- Native SOL uses address: `11111111111111111111111111111111`
- Wrapped SOL (WSOL) uses: `So11111111111111111111111111111111111111112`
- Balance fetching handles both wrapped and unwrapped SOL
- Swap execution is prepared for future instruction injection
