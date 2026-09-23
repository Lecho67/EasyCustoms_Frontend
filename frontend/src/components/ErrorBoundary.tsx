// src/components/ErrorBoundary.tsx
import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("ErrorBoundary capturó una excepción:", error, info.componentStack);
  }

  handleReload = () => window.location.reload();

  handleGoHome = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-dvh items-center justify-center bg-slate-50 px-4">
          <div className="w-full max-w-md text-center">
            <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-500">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h1 className="text-xl font-semibold text-slate-900">Algo salió mal</h1>
            <p className="mt-2 text-sm text-slate-600">
              Ocurrió un error inesperado y no pudimos mostrar esta pantalla. Podés
              recargar la página o volver al inicio.
            </p>
            {import.meta.env.DEV && this.state.error && (
              <pre className="mt-4 max-h-40 overflow-auto rounded-lg bg-slate-100 p-3 text-left text-xs text-slate-500">
                {this.state.error.message}
              </pre>
            )}
            <div className="mt-6 flex justify-center gap-3">
              <button
                onClick={this.handleGoHome}
                className="rounded-xl border border-slate-300 px-6 py-3 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                Volver al inicio
              </button>
              <button
                onClick={this.handleReload}
                className="rounded-xl bg-cobalt px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-cobalt-600"
              >
                Recargar página
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}