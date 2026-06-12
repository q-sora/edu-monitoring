// src/components/ErrorBoundary.tsx
import React, { Component, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props { children: ReactNode; }
interface State { error: Error | null; }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex items-start justify-center pt-16 px-4">
        <div className="card p-6 max-w-lg w-full">
          <div className="flex items-center gap-3 mb-3">
            <div className="p-2 rounded-lg shrink-0" style={{ background: "rgba(193,39,45,0.12)" }}>
              <AlertTriangle className="w-5 h-5 text-danger" />
            </div>
            <p className="font-display font-bold text-base" style={{ color: "var(--text-primary)" }}>
              Ошибка загрузки страницы
            </p>
          </div>
          <pre className="text-xs text-danger bg-danger/5 border border-danger/20 rounded-md p-3 overflow-auto max-h-40 mb-4 whitespace-pre-wrap break-all">
            {error.message}
          </pre>
          <button
            onClick={() => this.setState({ error: null })}
            className="btn-secondary flex items-center gap-1.5 text-xs"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Попробовать снова
          </button>
        </div>
      </div>
    );
  }
}
