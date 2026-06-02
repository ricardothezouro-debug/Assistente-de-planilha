import { Component, type ErrorInfo, type ReactNode } from "react";

type Props = {
  children: ReactNode;
};

type State = {
  error: Error | null;
};

export class ErrorBoundary extends Component<Props, State> {
  state: State = {
    error: null
  };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Erro na interface:", error, info);
  }

  render() {
    if (!this.state.error) {
      return this.props.children;
    }

    return (
      <div className="fatal-screen">
        <section className="panel fatal-panel">
          <p className="eyebrow">Interface</p>
          <h1>Algo travou na tela</h1>
          <p>{this.state.error.message || "Erro inesperado."}</p>
          <button className="button primary" type="button" onClick={() => window.location.reload()}>
            Recarregar
          </button>
        </section>
      </div>
    );
  }
}
