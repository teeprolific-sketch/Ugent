import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Ugent by Me AI',
  description: 'Your personal AI agent for real African life. Plans around traffic, power cuts and family, works offline and speaks your language.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
