import type { Metadata } from 'next';
import { Press_Start_2P } from 'next/font/google';
import './globals.css';

export const dynamic = 'force-dynamic';

const pixelFont = Press_Start_2P({ weight: '400', subsets: ['latin'], variable: '--font-pixel' });

export const metadata: Metadata = {
  title: 'FlyFi — Autonomous Trading Fly',
  description:
    'A wallet-holding fruit fly that trades AVAX/USDC on Avalanche via a tabular Q-learning loop, sweeping profits gaslessly through SmoothSend.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${pixelFont.variable}`}>
      <body>{children}</body>
    </html>
  );
}
