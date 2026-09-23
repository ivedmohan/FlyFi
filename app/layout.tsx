import type { Metadata } from 'next';
import { Press_Start_2P } from 'next/font/google';
import './globals.css';

export const dynamic = 'force-dynamic';

const pixelFont = Press_Start_2P({ weight: '400', subsets: ['latin'], variable: '--font-pixel' });

const title = 'FlyFi — Autonomous Trading Fly';
const description =
  'A wallet-holding fruit fly that trades AVAX/USDC on Avalanche mainnet. A real 166,700-neuron ' +
  'Drosophila connectome proposes trades; a small Q-learning agent can veto them. Gas sponsored by SmoothSend.';

export const metadata: Metadata = {
  title,
  description,
  openGraph: { title, description, images: ['/og-image.png'] },
  twitter: { card: 'summary', title, description, images: ['/og-image.png'] },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`dark ${pixelFont.variable}`}>
      <body>{children}</body>
    </html>
  );
}
