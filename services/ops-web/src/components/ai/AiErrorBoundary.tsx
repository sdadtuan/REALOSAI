'use client';

import React, { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  onRetry?: () => void;
}

interface State {
  error: Error | null;
}

/** RNOS-06 — isolate Copilot failures from CRM page crash. */
export class AiErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="ai-copilot-error" role="alert">
          <p className="ai-copilot-error__title">Copilot tạm lỗi</p>
          <p className="muted ai-copilot-error__msg">{this.state.error.message}</p>
          <button
            type="button"
            className="btn btn-sm btn-secondary"
            onClick={() => {
              this.setState({ error: null });
              this.props.onRetry?.();
            }}
          >
            Thử lại
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
