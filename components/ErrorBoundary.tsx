'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    // Atualiza o state para que a próxima renderização mostre a UI de fallback
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Erro capturado pelo ErrorBoundary:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen max-w-md mx-auto flex-col items-center justify-center bg-zinc-950 p-6 text-center">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10 text-red-500">
            <AlertTriangle size={32} />
          </div>
          <h1 className="mb-2 text-2xl font-bold text-zinc-100">Ops! O app quebrou.</h1>
          <p className="mb-6 text-sm text-zinc-400">
            Como você está no celular, aqui está o erro exato para facilitar:
          </p>
          
          <div className="mb-8 w-full rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-left overflow-auto max-h-64">
            <p className="font-mono text-sm text-red-400 break-words">
              {this.state.error?.message || 'Erro desconhecido'}
            </p>
          </div>

          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="flex items-center gap-2 rounded-xl bg-emerald-500 px-6 py-3 font-semibold text-zinc-950 transition-colors active:scale-95"
          >
            <RefreshCcw size={20} />
            Tentar novamente
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
