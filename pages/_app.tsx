import '@/styles/globals.css';
import { useEffect, useState } from 'react';
import type { AppProps } from 'next/app';
import { WalletProvider } from '@/components/WalletProvider';

export default function App({ Component, pageProps }: AppProps) {
  // Ensure consistent dark mode background across SSR/CSR
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return (
    <WalletProvider>
      <div className="app-root dark-theme">
        {/* Avoid hydration mismatch by delaying theme-dependent rendering */}
        {mounted ? <Component {...pageProps} /> : null}
      </div>
    </WalletProvider>
  );
}
