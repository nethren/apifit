import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './SearchApp.jsx';
import './signal.css';

class ErrorBoundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <main className="fatal"><h1>Something interrupted this view.</h1><p>Reload APIFit to try again. This will clear your current search and shortlist.</p><button onClick={() => location.reload()}>Reload APIFit</button></main>;
    return this.props.children;
  }
}
createRoot(document.getElementById('root')).render(<ErrorBoundary><App /></ErrorBoundary>);
