import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import CapacityPreview from './routes/CapacityPreview.jsx';
import './index.css';

// Minimal pathname-based preview route (no router library). Vercel Preview
// builds run in production mode, so import.meta.env.DEV is false there —
// the explicit VITE_ENABLE_PREVIEW_ROUTES flag is what gates this.
function pickRoot() {
  const isPreviewRoute =
    typeof window !== 'undefined' &&
    window.location.pathname === '/capacity-preview' &&
    import.meta.env.VITE_ENABLE_PREVIEW_ROUTES === 'true';
  return isPreviewRoute ? <CapacityPreview /> : <App />;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>{pickRoot()}</React.StrictMode>
);
