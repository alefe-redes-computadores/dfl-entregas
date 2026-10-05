import type { Metadata, Viewport } from 'next';
import { Toaster } from 'sonner';
import { AlertTriangle, CheckCircle2, Info, LoaderCircle, XCircle } from 'lucide-react';
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

export const metadata: Metadata = {
  title: {
    default: 'DFL Entregas',
    template: '%s · DFL Entregas',
  },
  description: 'Logística de entregas da Da Família Lanches',
  applicationName: 'DFL Entregas',
  manifest: '/manifest.json?v=2',
  icons: {
    icon: [
      {
        url: '/favicon.ico?v=2',
        sizes: '64x64',
      },
      {
        url: '/icon-192.png?v=2',
        type: 'image/png',
        sizes: '192x192',
      },
      {
        url: '/icon-512.png?v=2',
        type: 'image/png',
        sizes: '512x512',
      },
    ],
    apple: [
      {
        url: '/apple-touch-icon.png?v=2',
        type: 'image/png',
        sizes: '180x180',
      },
    ],
    shortcut: ['/favicon.ico?v=2'],
  },
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
    <html lang="pt-BR" className="dark" suppressHydrationWarning>
      <body>
        <ErrorBoundary>
          <ClientInit />
          <NativeRuntime />
          <PwaRuntime />
          <StoreAutomation />
          <RouteOperations />
          <AuthGuard>
            <div className="dfl-shell relative mx-auto flex w-full flex-col overflow-x-hidden bg-zinc-950/95 text-zinc-100">
              <Header />
              <main className="dfl-main relative flex-1 px-3.5 pt-3.5 sm:px-4">{children}</main>
              <BottomNav />
            </div>
            <Toaster
              className="dfl-toaster"
              theme="dark"
              position="top-center"
              closeButton
              visibleToasts={2}
              gap={10}
              offset="calc(max(env(safe-area-inset-top, 0px), var(--dfl-native-statusbar-fallback, 0px)) + 12px)"
              icons={{
                success: <CheckCircle2 size={18} strokeWidth={2.2} />,
                error: <XCircle size={18} strokeWidth={2.2} />,
                warning: <AlertTriangle size={18} strokeWidth={2.2} />,
                info: <Info size={18} strokeWidth={2.2} />,
                loading: <LoaderCircle size={18} strokeWidth={2.2} className="animate-spin" />,
              }}
              toastOptions={{
                classNames: {
                  toast: 'dfl-toast',
                  title: 'dfl-toast-title',
                  description: 'dfl-toast-description',
                  closeButton: 'dfl-toast-close',
                },
                style: {
                  background: 'rgba(20, 20, 23, .96)',
                  border: '1px solid rgba(63, 63, 70, .78)',
                  color: '#fafafa',
                  borderRadius: '18px',
                  padding: '12px 14px',
                  fontSize: '12px',
                  boxShadow: '0 16px 44px rgba(0, 0, 0, .48)',
                  backdropFilter: 'blur(18px)',
                },
              }}
            />
          </AuthGuard>
        </ErrorBoundary>
      </body>
    </html>
  );
}
