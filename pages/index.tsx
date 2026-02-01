import { useEffect, useMemo, useRef, useState } from 'react';
import { useWallet, useConnection, type Wallet } from '@solana/wallet-adapter-react';
import { PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';
import { VersionedTransaction, MessageV0, TransactionInstruction, ComputeBudgetProgram } from '@solana/web3.js';
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
    symbol: 'dUSDC',
    mint: 'USDCoctVLVnvTXBEuP9s8hntucdJokbo17RwHuNXemT',
    decimals: 6,
  },
  {
    symbol: 'DLink',
    mint: 'G3nB3rDsYEKKt1zGoYHr8mbrGeB1hViVzdzTZhzDM9J1',
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
    // dUSDC uses USDC icon from mainnet
    if (mint === 'USDCoctVLVnvTXBEuP9s8hntucdJokbo17RwHuNXemT') {
      return 'https://img-v1.raydium.io/icon/EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v.png';
    }
    
    // DLink uses devnet icon URL
    if (mint === 'G3nB3rDsYEKKt1zGoYHr8mbrGeB1hViVzdzTZhzDM9J1') {
      return `https://img-v1-devnet.raydium.io/icon/${mint}.png`;
    }
    
    // Default to mainnet icon URL
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
  // Set default tokens based on network: DLink for devnet, WSOL for mainnet
  const [from, setFrom] = useState<Token>(NETWORK === 'devnet' ? TOKENS[1] : TOKENS[0]); // DLink on devnet, WSOL on mainnet
  const [to, setTo] = useState<Token>(TOKENS[0]);
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
  const [protectWithZyga, setProtectWithZyga] = useState<boolean>(false);
  const [slippage, setSlippage] = useState<number>(0.5); // Default 0.5%
  const [customSlippage, setCustomSlippage] = useState<string>('');
  const [faucetLoading, setFaucetLoading] = useState<{ DLink: boolean; dUSDC: boolean }>({ DLink: false, dUSDC: false });
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
  }, [amountIn, from.mint, to.mint, canSwapPair, slippage]);

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
      // Convert slippage percentage to basis points (1% = 100 bps)
      const slippageBps = Math.round(slippage * 100);
      const url = `/api/quote?inputMint=${encodeURIComponent(from.mint)}&outputMint=${encodeURIComponent(to.mint)}&amount=${encodeURIComponent(inBase)}&slippageBps=${slippageBps}&userPublicKey=${encodeURIComponent(publicKey.toString())}`;
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

      // Convert slippage percentage to decimal (e.g., 0.5% -> 0.005)
      const slippageDecimal = slippage / 100;

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
          slippage: slippageDecimal,
          poolId,
          userPublicKey: publicKey.toString(),
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.serializedTransaction) {
        throw new Error(data.error || 'Failed to prepare swap transaction');
      }

      // Deserialize transaction
      
      const txBuffer = Buffer.from(data.serializedTransaction, 'base64');
      
      // Deserialize as VersionedTransaction (V0)
      let transaction = VersionedTransaction.deserialize(txBuffer);

      // Get recent blockhash and set it
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');

      console.log('Original transaction:', transaction);

      // Generate Zyga proof if protection is enabled
      if (protectWithZyga) {
        console.log('Generating Zyga slippage protection proof...');
        
        try {
          // Get current balance of output token
          const outputTokenAccount = await connection.getTokenAccountsByOwner(
            publicKey,
            { mint: new PublicKey(to.mint) }
          );

          if (outputTokenAccount.value.length === 0) {
            throw new Error('Output token account not found. You need to have the output token account created first.');
          }

          const outputTokenAccountPubkey = outputTokenAccount.value[0].pubkey;
          
          let currentOutputBalance = '0';
          const accountInfo = await connection.getTokenAccountBalance(outputTokenAccountPubkey);
          currentOutputBalance = accountInfo.value.amount;

          // Calculate minimum output amount with slippage tolerance
          // minOutput = expectedOutput * (1 - slippage)
          const expectedOutputBase = BigInt(toBaseUnits(amountOut, to.decimals));
          const slippageDecimal = slippage / 100;
          const minOutputAmount = (expectedOutputBase * BigInt(Math.floor((1 - slippageDecimal) * 1000000)) / BigInt(1000000)).toString();
          
          console.log('Expected output base:', expectedOutputBase);
          console.log('Slippage decimal:', slippageDecimal);
          console.log('Min output amount:', minOutputAmount);

          // Calculate actual amount (current balance + expected output)
          const actualAmount = (BigInt(currentOutputBalance) + BigInt(expectedOutputBase)).toString();

          console.log('Proof params:', {
            outputTokenAccount: outputTokenAccountPubkey.toString(),
            currentBalance: currentOutputBalance,
            expectedOutput: minOutputAmount,
            actualAmount,
            minAmount: minOutputAmount
          });

          const body = JSON.stringify({
            actualAmount,
            minAmount: minOutputAmount,
          });

          console.log('Body:', body);

          // Call backend to generate proof instruction
          const proofApiUrl = process.env.NEXT_PUBLIC_PROOF_API_URL || 'http://localhost:4000';
          const proofInstructionResponse = await fetch(`${proofApiUrl}/generate-proof-ix`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body,
          });

          const proofInstructionData = await proofInstructionResponse.json() as { success: boolean; proofIx: string; size: number; error: string };

          console.log('Proof instruction data:', proofInstructionData);

          if (!proofInstructionData.success || !proofInstructionData.proofIx) {
            throw new Error(proofInstructionData.error || 'Failed to generate proof');
          }

          console.log('Proof generated successfully:', {
            size: proofInstructionData.size,
            proofIx: proofInstructionData.proofIx.substring(0, 50) + '...'
          });

          // Decode the proof instruction data from base64
          const proofIxData = Buffer.from(proofInstructionData.proofIx, 'base64');

          // Zyga program ID
          const zygaProgramId = new PublicKey('6g8bkmVfVHTrm4PgpfYBEbwumj7HKG2H9ZQ2ULitYk7t');

          // // Create the Zyga proof instruction with the output token account
          // const proofInstruction = new TransactionInstruction({
          //   keys: [{ pubkey: outputTokenAccountPubkey, isSigner: false, isWritable: false }],
          //   programId: zygaProgramId,
          //   data: proofIxData,
          // });

          // Set maximum compute units (1.4M units)
          const setComputeUnitLimitIx = ComputeBudgetProgram.setComputeUnitLimit({
            units: 1_400_000,
          });

          console.log('Adding Zyga proof instruction to swap transaction');
          
          // Get original account keys and header info
          const originalAccountKeys = [...transaction.message.staticAccountKeys];
          const originalHeader = transaction.message.header;
          
          console.log('Original header:', originalHeader);
          console.log('Original account keys count:', originalAccountKeys.length);
          
          // Add lookup table accounts if they exist
          if (transaction.message.addressTableLookups && transaction.message.addressTableLookups.length > 0) {
            console.warn('Transaction uses address lookup tables - Zyga protection enabled');
            console.warn('Address lookup tables:', transaction.message.addressTableLookups);
          }
          
          // Simply append new accounts to the end (don't reorder)
          const allAccountKeys = [...originalAccountKeys];
          
          // Add compute budget program if not present
          const computeBudgetProgramId = ComputeBudgetProgram.programId;
          let computeBudgetProgramIndex = allAccountKeys.findIndex(key => key.equals(computeBudgetProgramId));
          if (computeBudgetProgramIndex === -1) {
            computeBudgetProgramIndex = allAccountKeys.length;
            allAccountKeys.push(computeBudgetProgramId);
          }
          
          // Add zyga program if not present
          let zygaProgramIndex = allAccountKeys.findIndex(key => key.equals(zygaProgramId));
          if (zygaProgramIndex === -1) {
            zygaProgramIndex = allAccountKeys.length;
            allAccountKeys.push(zygaProgramId);
          }
          
          // Add output token account if not present
          let outputTokenAccountIndex = allAccountKeys.findIndex(key => key.equals(outputTokenAccountPubkey));
          if (outputTokenAccountIndex === -1) {
            outputTokenAccountIndex = allAccountKeys.length;
            allAccountKeys.push(outputTokenAccountPubkey);
          }
          
          console.log('New account keys count:', allAccountKeys.length);
          console.log('New accounts added:', allAccountKeys.length - originalAccountKeys.length);
          
          // Compile compute budget instruction
          const computeBudgetCompiledIx = {
            programIdIndex: computeBudgetProgramIndex,
            accountKeyIndexes: [],
            data: Uint8Array.from(setComputeUnitLimitIx.data),
          };
          
          // Compile proof instruction
          const proofCompiledIx = {
            programIdIndex: zygaProgramIndex,
            accountKeyIndexes: [outputTokenAccountIndex],
            data: proofIxData,
          };
          
          // Shift account indexes in existing instructions
          // Account indexes >= 9 need to be shifted by +2 because we added 2 new accounts
          const shiftedInstructions = transaction.message.compiledInstructions.map(ix => ({
            programIdIndex: ix.programIdIndex >= 9 ? ix.programIdIndex + 2 : ix.programIdIndex,
            accountKeyIndexes: ix.accountKeyIndexes.map(idx => idx >= 9 ? idx + 2 : idx),
            data: ix.data,
          }));
          
          // Create new compiled instructions array - add compute budget and proof at the END
          const newCompiledInstructions = [
            computeBudgetCompiledIx,
            ...shiftedInstructions,
            proofCompiledIx,
          ];
          
          console.log('Total instructions:', newCompiledInstructions.length);
          
          // Calculate new header - count how many new readonly accounts were added
          const newAccountsAdded = allAccountKeys.length - originalAccountKeys.length;
          const newHeader = {
            numRequiredSignatures: originalHeader.numRequiredSignatures,
            numReadonlySignedAccounts: originalHeader.numReadonlySignedAccounts,
            numReadonlyUnsignedAccounts: originalHeader.numReadonlyUnsignedAccounts + newAccountsAdded,
          };
          
          console.log('New header:', newHeader);
          
          // Create new MessageV0 with updated instructions
          const newMessage = new MessageV0({
            header: newHeader,
            staticAccountKeys: allAccountKeys,
            recentBlockhash: blockhash,
            compiledInstructions: newCompiledInstructions,
            addressTableLookups: transaction.message.addressTableLookups || [],
          });
          
          transaction = new VersionedTransaction(newMessage);
          console.log('Swap transaction rebuilt with Zyga protection');
          
        } catch (proofError) {
          console.error('Proof generation failed:', proofError);
          throw new Error(`Zyga protection failed: ${(proofError as Error).message}`);
        }
      } else {
        // No Zyga protection, just update blockhash
        transaction.message.recentBlockhash = blockhash;
      }

      // Update swap transaction blockhash
      transaction.message.recentBlockhash = blockhash;

      console.log('Swap transaction:', transaction);

      // ADD TX SIZE MEASUREMENT
      // Temporarily empty the last instruction data to test if size is the issue
      const lastIxIndex = transaction.message.compiledInstructions.length - 1;
      const originalLastIxData = transaction.message.compiledInstructions[lastIxIndex].data;
      console.log('Original last instruction data size:', originalLastIxData.length, 'bytes');
      
      // Set to empty array for testing
      transaction.message.compiledInstructions[lastIxIndex].data = new Uint8Array(0);
      
      try {
        const serializedTx = transaction.serialize();
        const txSize = serializedTx.length;
        console.log('Transaction size (with empty proof):', txSize, 'bytes');
        console.log('Solana limit: 1232 bytes');
        console.log('Remaining:', 1232 - txSize, 'bytes');
        if (txSize > 1232) {
          console.error('⚠️ WARNING: Transaction exceeds Solana size limit even without proof data!');
        } else {
          console.log('✓ Transaction size is within limits without proof data');
        }
      } catch (error) {
        console.error('Serialization failed even with empty proof data:', error);
      }
      
      // Restore original data
      transaction.message.compiledInstructions[lastIxIndex].data = originalLastIxData;
      
      // Now try with full proof data
      try {
        const serializedTxFull = transaction.serialize();
        const txSizeFull = serializedTxFull.length;
        console.log('Transaction size (with full proof):', txSizeFull, 'bytes');
        console.log('Proof data adds:', txSizeFull - 0, 'bytes');
        if (txSizeFull > 1232) {
          console.error('⚠️ WARNING: Transaction exceeds Solana size limit with proof!');
        } else {
          console.log('✓ Transaction size is within limits with proof');
        }
      } catch (error) {
        console.error('Serialization failed with full proof data:', error);
      }

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

  const handleFaucet = async (tokenType: 'DLink' | 'dUSDC') => {
    if (!connected || !publicKey) {
      setError('Please connect your wallet to use the faucet');
      return;
    }

    if (NETWORK !== 'devnet') {
      setError('Faucet is only available on devnet');
      return;
    }

    try {
      setFaucetLoading(prev => ({ ...prev, [tokenType]: true }));
      setError('');

      // Call backend faucet endpoint
      const faucetApiUrl = process.env.NEXT_PUBLIC_PROOF_API_URL || 'http://localhost:4000';
      const response = await fetch(`${faucetApiUrl}/faucet`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          walletAddress: publicKey.toString(),
          tokenType,
        }),
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Failed to request tokens from faucet');
      }

      const amount = tokenType === 'DLink' ? '10' : '0.01';
      const explorerUrl = `https://solscan.io/tx/${data.signature}?cluster=devnet`;
      
      alert(`Success! ${amount} ${tokenType} sent to your wallet.\n\nTransaction: ${data.signature}\n\nView on Solscan: ${explorerUrl}`);
      
      // Refresh balances
      await fetchBalances();
    } catch (e) {
      console.error('Faucet error:', e);
      const errorMsg = (e as Error).message || 'Failed to request tokens';
      setError(errorMsg);
    } finally {
      setFaucetLoading(prev => ({ ...prev, [tokenType]: false }));
    }
  };

  return (
    <>
      <WalletModal 
        isOpen={walletModalOpen} 
        onClose={() => setWalletModalOpen(false)} 
        wallets={wallets}
        onSelectWallet={handleSelectWallet}
      />
      
      <div className="app-header">
        <div className="header-content">
          <div className="header-left">
            <img src="/Rz_logo.png" alt="Raydium Zyga" className="header-logo" />
            <span className="header-title">Raydium Zyga</span>
          </div>
          <div className="header-right">
            <div className="network-indicator">
              <span className={`network-badge ${NETWORK}`}>
                {NETWORK === 'devnet' ? '🔧 Devnet' : '🌐 Mainnet'}
              </span>
            </div>
            {!connected ? (
              <button className="connect-btn" onClick={() => setWalletModalOpen(true)}>Connect Wallet</button>
            ) : (
              <button className="connect-btn" onClick={disconnect} title={publicKey?.toBase58() || undefined}>
                {publicKey?.toBase58().slice(0, 4)}...{publicKey?.toBase58().slice(-4)}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="container">

      <div className="card" style={{ position: 'relative' }}>
        <div className="card-head">
          <div className="card-title"></div>
          <div>
            <button className="icon-btn" onClick={() => setSettingsOpen((s) => !s)} title="Settings">⚙️</button>
          </div>
        </div>

        {settingsOpen && (
          <div className="settings-panel" onMouseLeave={() => setSettingsOpen(false)}>
            <div className="settings-section">
              <div style={{ fontWeight: 600, marginBottom: 8 }}>Slippage Tolerance</div>
              <div className="slippage-presets">
                <button 
                  className={`slippage-preset ${slippage === 0.1 && !customSlippage ? 'active' : ''}`}
                  onClick={() => { setSlippage(0.1); setCustomSlippage(''); }}
                >
                  0.1%
                </button>
                <button 
                  className={`slippage-preset ${slippage === 0.5 && !customSlippage ? 'active' : ''}`}
                  onClick={() => { setSlippage(0.5); setCustomSlippage(''); }}
                >
                  0.5%
                </button>
                <button 
                  className={`slippage-preset ${slippage === 1 && !customSlippage ? 'active' : ''}`}
                  onClick={() => { setSlippage(1); setCustomSlippage(''); }}
                >
                  1%
                </button>
              </div>
              <div className="custom-slippage">
                <input
                  inputMode="decimal"
                  placeholder="Custom %"
                  value={customSlippage}
                  onChange={(e) => {
                    const val = e.target.value;
                    // Only allow numbers and one decimal point
                    if (val === '' || /^\d*\.?\d{0,2}$/.test(val)) {
                      setCustomSlippage(val);
                      const num = parseFloat(val);
                      if (!isNaN(num) && num >= 0 && num <= 100) {
                        setSlippage(num);
                      }
                    }
                  }}
                  className="custom-slippage-input"
                />
                <span className="custom-slippage-label">%</span>
              </div>
              <div className="hint" style={{ marginTop: 4 }}>
                Current: {customSlippage || slippage}%
              </div>
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

        <div className="zyga-protection">
          <label className="toggle-container">
            <input
              type="checkbox"
              checked={protectWithZyga}
              onChange={(e) => setProtectWithZyga(e.target.checked)}
              className="toggle-input"
            />
            <span className="toggle-slider"></span>
            <span className="toggle-label">
              🛡️ Protect using Zyga
            </span>
          </label>
        </div>

        <button 
          className="action" 
          disabled={!connected || !canSwapPair || !amountIn || Number(amountIn) <= 0 || swapping || fetching || !poolId}
          onClick={connected ? handleSwap : () => setWalletModalOpen(true)}
        >
          {!connected ? 'Connect Wallet' : swapping ? 'Swapping...' : fetching ? 'Getting Quote...' : 'Swap'}
        </button>
      </div>

      {/* Faucet Buttons - Only show on devnet */}
      {NETWORK === 'devnet' && (
        <div className="faucet-section">
          <div className="faucet-title">Devnet Faucet</div>
          <div className="faucet-buttons">
            <button
              className="faucet-btn"
              disabled={!connected || faucetLoading.DLink}
              onClick={() => handleFaucet('DLink')}
            >
              {faucetLoading.DLink ? 'Requesting...' : 'Get 10 DLink'}
            </button>
            <button
              className="faucet-btn"
              disabled={!connected || faucetLoading.dUSDC}
              onClick={() => handleFaucet('dUSDC')}
            >
              {faucetLoading.dUSDC ? 'Requesting...' : 'Get 0.01 dUSDC'}
            </button>
          </div>
        </div>
      )}

      </div>

      <div className="app-footer">
        <div className="footer-content">
          <img src="/Rz_logo.png" alt="Raydium Zyga" className="footer-logo" />
          <span className="footer-text">Raydium Zyga</span>
        </div>
      </div>
    </>
  );
}
