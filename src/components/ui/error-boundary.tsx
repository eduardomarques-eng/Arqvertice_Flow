"use client";

import React from "react";
import Link from "next/link";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallbackTitle?: string;
  backHref?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  message: string | null;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, message: null };
  }

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return {
      hasError: true,
      message: error instanceof Error ? error.message : "Erro inesperado ao renderizar este módulo.",
    };
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-2xl border border-rose-200 bg-white p-6 shadow-xs text-center space-y-3">
          <p className="text-sm font-bold text-rose-700">
            {this.props.fallbackTitle || "Não foi possível carregar este módulo"}
          </p>
          {this.state.message && (
            <p className="text-xs text-slate-500 max-w-md mx-auto">{this.state.message}</p>
          )}
          <div className="pt-2 flex items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => this.setState({ hasError: false, message: null })}
              className="rounded-xl bg-slate-900 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 transition"
            >
              Tentar novamente
            </button>
            {this.props.backHref && (
              <Link
                href={this.props.backHref}
                className="rounded-xl border border-slate-200 px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                Voltar
              </Link>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
