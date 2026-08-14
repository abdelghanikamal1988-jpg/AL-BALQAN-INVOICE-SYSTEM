import { Component } from 'react';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch() {
    // Prevents full page crash; the boundary UI is shown instead.
  }

  handleReload = () => {
    this.setState({ hasError: false });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <div className="card">
            <h1>Something went wrong</h1>
            <p>Please try again.</p>
            <button type="button" className="btn btn--primary" onClick={this.handleReload}>
              Reload Application
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
