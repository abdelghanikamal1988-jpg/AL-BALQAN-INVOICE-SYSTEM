import { Component } from 'react';
import { reportError } from '../../utils/errorLogger.js';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    /* Send it to the error_logs table so an admin can see what broke. */
    reportError(error, {
      component: info?.componentStack?.split('\n')[1]?.trim().slice(0, 120) || 'ErrorBoundary',
    });
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
