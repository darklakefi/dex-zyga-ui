import { useEffect, useMemo, useRef, useState } from 'react';
import { useWallet, useConnection, type Wallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';

// Token type
interface Token {
  symbol: string;
  mint: string;
  decimals: number;
}

// Get network from environment
const NETWORK = process.env.NEXT_PUBLIC_NETWORK || 'mainnet';

// Network-specific token configurations
const MAINNET_TOKENS: Token[] = [
  {
    symbol: 'WSOL',
    mint: 'So11111111111111111111111111111111111111112',
    decimals: 9,
  },
  {
    symbol: 'Fartcoin',
    mint: '9BB6NFEcjBCtnNLFko2FqVQBq8HHM13kCyYcdQbgpump',
    decimals: 6,
  },
  {
    symbol: 'RAY',
    mint: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
    decimals: 6,
  },
  {
    symbol: 'USDC',
    mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    decimals: 6,
  },
  {
    symbol: 'USDT',
    mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    decimals: 6,
  },
];

const DEVNET_TOKENS: Token[] = [
  {
    symbol: 'WSOL',
    mint: 'So11111111111111111111111111111111111111112',
    decimals: 9,
  },
  {
    symbol: 'dUSDC',
    mint: 'USDCoctVLVnvTXBEuP9s8hntucdJokbo17RwHuNXemT',
    decimals: 6,
  },
];

// Select tokens based on network
const TOKENS = NETWORK === 'devnet' ? DEVNET_TOKENS : MAINNET_TOKENS;


// Wallet selection modal using wallet adapter
interface WalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  wallets: Wallet[];
  onSelectWallet: (wallet: Wallet) => void;
}

function WalletModal({ isOpen, onClose, wallets, onSelectWallet }: WalletModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Connect Wallet</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="wallet-list">
          {wallets.map((wallet) => (
            <button
              key={wallet.adapter.name}
              className="wallet-option"
              onClick={() => {
                onSelectWallet(wallet);
                onClose();
              }}
            >
              <img src={wallet.adapter.icon} alt={wallet.adapter.name} className="wallet-icon" />
              <span className="wallet-name">{wallet.adapter.name}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// Custom dropdown component
interface TokenDropdownProps {
  selectedToken: Token;
  onSelect: (token: Token) => void;
}

function TokenDropdown({ selectedToken, onSelect }: TokenDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleSelect = (token: Token) => {
    onSelect(token);
    setIsOpen(false);
  };

  const getTokenIconUrl = (mint: string) => {
    // dUSDC uses USDC icon
    if (mint === 'USDCoctVLVnvTXBEuP9s8hntucdJokbo17RwHuNXemT') {
      return 'https://img-v1.raydium.io/icon/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v.png';
    }
    
    return `https://img-v1.raydium.io/icon/${mint}.png`;
  };

  return (
    <div className="custom-dropdown" ref={dropdownRef}>
      <div className="dropdown-trigger" onClick={() => setIsOpen(!isOpen)}>
        <img 
          src={getTokenIconUrl(selectedToken.mint)} 
          alt={selectedToken.symbol}
          className="token-icon"
          onError={(e) => {
            // Fallback to a default icon if image fails to load
            (e.target as HTMLImageElement).style.display = 'none';
          }}
        />
        <span className="token-symbol">{selectedToken.symbol}</span>
        <span className="dropdown-arrow">{isOpen ? '▲' : '▼'}</span>
      </div>
      {isOpen && (
        <div className="dropdown-menu">
          {TOKENS.map((token) => (
            <div
              key={token.mint}
              className={`dropdown-item ${token.mint === selectedToken.mint ? 'selected' : ''}`}
              onClick={() => handleSelect(token)}
            >
              <div className="token-info">
                <img 
                  src={getTokenIconUrl(token.mint)} 
                  alt={token.symbol}
                  className="token-icon"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
                <span className="token-symbol">{token.symbol}</span>
              </div>
              {token.mint === selectedToken.mint && <span className="checkmark">✓</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


function fmtNumber(v: string | number | null | undefined, dp: number = 6): string {
  if (v === '' || v === null || v === undefined || isNaN(Number(v))) return '';
  const n = Number(v);
  return n.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: dp });
}

function toBaseUnits(amountUi: string | number, decimals: number): string {
  if (!amountUi || isNaN(Number(amountUi))) return '0';
  const [whole, frac = ''] = String(amountUi).split('.');
  const cleanWhole = whole.replace(/\D/g, '') || '0';
  const cleanFrac = frac.replace(/\D/g, '').slice(0, decimals);
  const paddedFrac = cleanFrac.padEnd(decimals, '0');
  return BigInt(cleanWhole + paddedFrac || '0').toString();
}

function fromBaseUnits(amountBase: string | number, decimals: number): number {
  if (!amountBase) return 0;
  const s = String(amountBase);
  const negative = s.startsWith('-');
  const raw = negative ? s.slice(1) : s;
  const pad = raw.padStart(decimals + 1, '0');
  const int = pad.slice(0, -decimals);
  const frac = pad.slice(-decimals).replace(/0+$/, '');
  const res = (negative ? '-' : '') + int + (frac ? '.' + frac : '');
  return Number(res);
}

export default function Home() {
  const { wallets, select, connect, disconnect, connected, publicKey, wallet, signTransaction, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const [from, setFrom] = useState<Token>(TOKENS[0]);
  const [to, setTo] = useState<Token>(TOKENS[1]);
  const [amountIn, setAmountIn] = useState<string>('');
  const [amountOut, setAmountOut] = useState<string>('');
  const [minOut, setMinOut] = useState<string>('');
  const [fetching, setFetching] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false);
  const [walletModalOpen, setWalletModalOpen] = useState<boolean>(false);
  const [fromBalance, setFromBalance] = useState<string>('');
  const [toBalance, setToBalance] = useState<string>('');
  const [loadingBalance, setLoadingBalance] = useState<boolean>(false);
  const [swapping, setSwapping] = useState<boolean>(false);
  const [poolId, setPoolId] = useState<string>('');
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  const handleSelectWallet = async (selectedWallet: Wallet) => {
    select(selectedWallet.adapter.name);
    try {
      await connect();
    } catch (err) {
      console.error('Wallet connection error:', err);
    }
  };

  // Helper function to check if two tokens can be swapped
  const canSwapTokens = (token1: Token, token2: Token): boolean => {
    if (!token1 || !token2) return false;
    
    // Same token cannot be swapped
    if (token1.mint === token2.mint) return false;
    
    return true;
  };

  // Handle "from" token selection with validation
  const handleFromTokenSelect = (token: Token) => {
    if (!canSwapTokens(token, to)) {
      // If invalid pair, swap the "to" token with current "from"
      setTo(from);
      setError('These tokens cannot be swapped');
      setTimeout(() => setError(''), 3000); // Clear error after 3 seconds
    }
    setFrom(token);
  };

  // Handle "to" token selection with validation
  const handleToTokenSelect = (token: Token) => {
    if (!canSwapTokens(from, token)) {
      // If invalid pair, swap the "from" token with current "to"
      setFrom(to);
      setError('These tokens cannot be swapped');
      setTimeout(() => setError(''), 3000); // Clear error after 3 seconds
    }
    setTo(token);
  };

  // Fetch token balance
  const fetchTokenBalance = async (tokenMint: string): Promise<string> => {
    if (!publicKey || !connection) return '0';

    try {
      // For SPL tokens (including WSOL), get token accounts
      const mintPubkey = new PublicKey(tokenMint);
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, {
        mint: mintPubkey,
      });

      if (tokenAccounts.value.length === 0) {
        // If no token account exists for WSOL, check native SOL balance as fallback
        if (tokenMint === 'So11111111111111111111111111111111111111112') {
          const balance = await connection.getBalance(publicKey);
          return (balance / 1e9).toFixed(4);
        }
        return '0';
      }

      const balance = tokenAccounts.value[0].account.data.parsed.info.tokenAmount.uiAmount;
      return balance ? balance.toFixed(4) : '0';
    } catch (err) {
      console.error('Error fetching balance:', err);
      return '0';
    }
  };

  // Fetch balances function
  const fetchBalances = async () => {
    if (!connected || !publicKey) {
      setFromBalance('');
      setToBalance('');
      return;
    }

    setLoadingBalance(true);
    try {
      const [fromBal, toBal] = await Promise.all([
        fetchTokenBalance(from.mint),
        fetchTokenBalance(to.mint),
      ]);
      setFromBalance(fromBal);
      setToBalance(toBal);
    } catch (err) {
      console.error('Error fetching balances:', err);
    } finally {
      setLoadingBalance(false);
    }
  };

  // Fetch balances when wallet connects or tokens change
  useEffect(() => {
    fetchBalances();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connected, publicKey, from.mint, to.mint, connection]);

  const canSwapPair = useMemo(() => canSwapTokens(from, to), [from, to]);

  const belowMin = useMemo(() => {
    if (!minOut || !amountOut) return false;
    return Number(amountOut) < Number(minOut);
  }, [minOut, amountOut]);

  // auto-quote when inputs change
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setError('');
    
    if (!amountIn || Number(amountIn) <= 0) { 
      setAmountOut(''); 
      return; 
    }
    
    // Check if trying to swap invalid token pair
    if (!canSwapPair) {
      setAmountOut('');
      setError('These tokens cannot be swapped');
      return;
    }
    
    debounceRef.current = setTimeout(() => {
      quote();
    }, 350);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [amountIn, from.mint, to.mint, canSwapPair]);

  async function quote() {
    if (!connected || !publicKey) {
      setError('Please connect your wallet to get quotes');
      setAmountOut('');
      setPoolId('');
      return;
    }

    try {
      setFetching(true);
      const inBase = toBaseUnits(amountIn, from.decimals);
      const url = `/api/quote?inputMint=${encodeURIComponent(from.mint)}&outputMint=${encodeURIComponent(to.mint)}&amount=${encodeURIComponent(inBase)}&slippageBps=50&userPublicKey=${encodeURIComponent(publicKey.toString())}`;
      const r = await fetch(url);
      const j = await r.json();
      
      if (!r.ok) {
        if (r.status === 502) {
          throw new Error('No route found for this swap. Try a different token pair.');
        }
        throw new Error(j?.error || `Quote failed (${r.status})`);
      }
      
      if (!j?.outAmount) {
        throw new Error('No quote available for this swap');
      }
      
      const outUi = fromBaseUnits(j.outAmount, to.decimals);
      setAmountOut(String(outUi));
      setPoolId(j.poolId || '');
      setError('');
    } catch (e) {
      const errorMsg = (e as Error).message || 'Failed to get quote';
      setError(errorMsg);
      setAmountOut('');
      setPoolId('');
    } finally {
      setFetching(false);
    }
  }

  const switchPair = () => {
    setFrom(to);
    setTo(from);
    // Re-quote after switch if amount present
    if (amountIn) setTimeout(() => quote(), 0);
  };

  const handleSwap = async () => {
    if (!connected || !publicKey || !signTransaction || !sendTransaction) {
      setError('Please connect your wallet');
      return;
    }

    if (!poolId || !amountIn || !amountOut) {
      setError('Please get a quote first');
      return;
    }

    try {
      setSwapping(true);
      setError('');

      const inBase = toBaseUnits(amountIn, from.decimals);

      // Call swap API to get serialized transaction
      const response = await fetch('/api/swap', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          inputMint: from.mint,
          outputMint: to.mint,
          amount: inBase,
          slippage: 0.005, // 0.5% slippage
          poolId,
          userPublicKey: publicKey.toString(),
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.serializedTransaction) {
        throw new Error(data.error || 'Failed to prepare swap transaction');
      }

      // Deserialize transaction
      const { VersionedTransaction } = await import('@solana/web3.js');
      const txBuffer = Buffer.from(data.serializedTransaction, 'base64');
      
      // Deserialize as VersionedTransaction (V0)
      const transaction = VersionedTransaction.deserialize(txBuffer);

      // Get recent blockhash and set it
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
      transaction.message.recentBlockhash = blockhash;

      // Sign transaction with wallet
      const signedTransaction = await signTransaction(transaction);

      // Send transaction using the raw connection method for VersionedTransaction
      const signature = await connection.sendRawTransaction(signedTransaction.serialize(), {
        skipPreflight: false,
        preflightCommitment: 'confirmed',
        maxRetries: 3,
      });

      setError('');
      
      // Wait for confirmation
      const confirmation = await connection.confirmTransaction({
        signature,
        blockhash,
        lastValidBlockHeight,
      }, 'confirmed');

      if (confirmation.value.err) {
        throw new Error('Transaction failed: ' + JSON.stringify(confirmation.value.err));
      }

      // Success!
      const explorerUrl = NETWORK === 'devnet' 
        ? `https://solscan.io/tx/${signature}?cluster=devnet`
        : `https://solscan.io/tx/${signature}`;
      
      alert(`Swap successful!\n\nSwapped ${amountIn} ${from.symbol} for ${amountOut} ${to.symbol}\n\nView on Solscan: ${explorerUrl}`);
      
      // Refresh balances
      await fetchBalances();
      
      // Clear form
      setAmountIn('');
      setAmountOut('');
      setPoolId('');

    } catch (e) {
      console.error('Swap error:', e);
      const errorMsg = (e as Error).message || 'Swap failed';
      setError(errorMsg);
    } finally {
      setSwapping(false);
    }
  };

  return (
    <div className="container">
      <WalletModal 
        isOpen={walletModalOpen} 
        onClose={() => setWalletModalOpen(false)} 
        wallets={wallets}
        onSelectWallet={handleSelectWallet}
      />
      
      <div className="header">
        <div className="brand"></div>
        <div>
          {!connected ? (
            <button className="connect-btn" onClick={() => setWalletModalOpen(true)}>Connect Wallet</button>
          ) : (
            <button className="connect-btn" onClick={disconnect} title={publicKey?.toBase58() || undefined}>
              {publicKey?.toBase58().slice(0, 4)}...{publicKey?.toBase58().slice(-4)}
            </button>
          )}
        </div>
      </div>

      <div className="card" style={{ position: 'relative' }}>
        <div className="card-head">
          <div className="card-title"></div>
          <div>
            <button className="icon-btn" onClick={() => setSettingsOpen((s) => !s)} title="Settings">⚙️</button>
          </div>
        </div>

        {settingsOpen && (
          <div className="settings-panel" onMouseLeave={() => setSettingsOpen(false)}>
            <div className="settings-item">
              <div>
                <div style={{ fontWeight: 600 }}>Minimum Output</div>
                <div className="hint">Sets a minimum received amount (To)</div>
              </div>
              <input
                inputMode="decimal"
                placeholder="0.0"
                value={minOut}
                onChange={(e) => setMinOut(e.target.value)}
              />
            </div>
          </div>
        )}

        {/* From Row */}
        <div className="row">
          <div className="row-top">
            <div className="label">From</div>
            <div className="bal">
              Balance: {loadingBalance ? '...' : fromBalance ? fmtNumber(fromBalance, 4) : '—'}
              {fromBalance && Number(fromBalance) > 0 && (
                <button 
                  className="max-btn" 
                  onClick={() => setAmountIn(fromBalance)}
                  title="Use maximum balance"
                >
                  MAX
                </button>
              )}
            </div>
          </div>
          <div className="row-main">
            <TokenDropdown selectedToken={from} onSelect={handleFromTokenSelect} />
            <input
              className="amount-input"
              inputMode="decimal"
              placeholder="0.0"
              value={amountIn}
              onChange={(e) => setAmountIn(e.target.value)}
            />
          </div>
        </div>

        {/* Switch */}
        <div className="switch">
          <button onClick={switchPair} title="Switch">
            ⇅
          </button>
        </div>

        {/* To Row */}
        <div className="row">
          <div className="row-top">
            <div className="label">To</div>
            <div className="bal">
              Balance: {loadingBalance ? '...' : toBalance ? fmtNumber(toBalance, 4) : '—'}
            </div>
          </div>
          <div className="row-main">
            <TokenDropdown selectedToken={to} onSelect={handleToTokenSelect} />
            <input
              className="amount-input"
              placeholder="0.0"
              readOnly
              value={amountOut ? fmtNumber(amountOut, 6) : ''}
            />
          </div>
        </div>

        <div className="meta">
          <div>{fetching ? 'Fetching quote…' : amountOut ? `Expected Output` : '—'}</div>
          <div>
            {amountOut && (
              <span className={belowMin ? 'error' : 'success'}>
                {fmtNumber(amountOut, 6)} {to.symbol}
              </span>
            )}
          </div>
        </div>

        {minOut && (
          <div className="meta">
            <div>Minimum Output</div>
            <div>{fmtNumber(minOut, 6)} {to.symbol}</div>
          </div>
        )}

        {error && <div className="error" style={{ margin: '6px 2px 10px' }}>{error}</div>}

        <button 
          className="action" 
          disabled={!connected || !canSwapPair || !amountIn || Number(amountIn) <= 0 || swapping || fetching || !poolId}
          onClick={connected ? handleSwap : () => setWalletModalOpen(true)}
        >
          {!connected ? 'Connect Wallet' : swapping ? 'Swapping...' : fetching ? 'Getting Quote...' : 'Swap'}
        </button>
      </div>

      <div className="footer-note">This is a minimal Raydium-like quote demo.</div>
    </div>
  );
}
