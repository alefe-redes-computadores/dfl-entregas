import type { Metadata, Viewport } from 'next';
import { Poppins, Inter } from 'next/font/google';
import { Toaster } from 'sonner';
import { Header } from '@/components/layout/Header';
import { BottomNav } from '@/components/layout/BottomNav';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import ClientInit from '@/components/ClientInit';
import { StoreAutomation } from '@/components/StoreAutomation';
import { RouteOperations } from '@/components/RouteOperations';
import { NativeRuntime } from '@/components/NativeRuntime';
import { PwaRuntime } from '@/components/pwa/PwaRuntime';
import './globals.css';

const poppins = Poppins({
  subsets: ['latin'],
  weight: ['600', '700', '800'],
  variable: '--font-poppins',
  display: 'swap',
});

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'DFL Entregas',
  description: 'Logística de entregas da Da Família Lanches',
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  themeColor: '#09090b',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className={`${poppins.variable} ${inter.variable} dark`} suppressHydrationWarning>
      <body>
        <ClientInit />
        <NativeRuntime />
        <PwaRuntime />
        <StoreAutomation />
        <RouteOperations />
        <ErrorBoundary>
          <AuthGuard>
            <div className="relative mx-auto flex min-h-screen w-full max-w-md flex-col overflow-x-hidden bg-zinc-950/95 text-zinc-100 shadow-[0_0_80px_rgba(0,0,0,0.38)]">
              <Header />
              <main className="relative flex-1 px-3.5 pb-28 pt-3.5 sm:px-4">{children}</main>
              <BottomNav />
            </div>
            <Toaster
              theme="dark"
              position="top-center"
              toastOptions={{
                style: {
                  background: '#18181b',
                  border: '1px solid #27272a',
                  color: '#fafafa',
                },
              }}
            />
          </AuthGuard>
        </ErrorBoundary>
      </body>
    </html>
  );
}
