import './global.css';
import type { Metadata } from 'next';
import { ServiceWorkerProvider } from './components/service-worker-provider';
import { AuthGuard } from './components/AuthGuard';

export const metadata: Metadata = {
  title: 'BhojAI — Restaurant POS',
  description: 'AI-powered restaurant point-of-sale. Manage orders, tables, billing, and kitchen operations.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <ServiceWorkerProvider />
        <AuthGuard>
          {children}
        </AuthGuard>
      </body>
    </html>
  );
}
