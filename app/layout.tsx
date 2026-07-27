import type { Metadata, Viewport } from 'next';
import { Poppins, Inter } from 'next/font/google';
import { Toaster } from 'sonner';
import { Header } from '@/components/layout/Header';
import { BottomNav } from '@/components/layout/BottomNav';
import { AuthGuard } from '@/components/auth/AuthGuard';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ThemeProvider } from '@/components/ThemeProvider';
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
    <html lang="pt-BR" className={`${poppins.variable} ${inter.variable}`} suppressHydrationWarning>
      <body>
        <ThemeProvider>
          <ErrorBoundary>
            <AuthGuard>
              <div className="mx-auto flex min-h-screen max-w-md flex-col bg-background text-foreground transition-colors duration-300">
                <Header />
                <main className="flex-1 px-4 pb-28 pt-4">{children}</main>
                <BottomNav />
              </div>
              <Toaster
                theme="system"
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
        </ThemeProvider>
      </body>
    </html>
  );
}
