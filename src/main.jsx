import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './SearchApp.jsx';
import './styles.css';
import './studio.css';
import './search.css';

class ErrorBoundary extends React.Component {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (this.state.failed) return <main className="fatal"><h1>Something interrupted this view.</h1><p>Your backend is still separate from this screen. Reload to start a new view; unsaved selections will be lost.</p><button onClick={() => location.reload()}>Reload APIFit</button></main>;
    return this.props.children;
  }
}
createRoot(document.getElementById('root')).render(<ErrorBoundary><App /></ErrorBoundary>);
