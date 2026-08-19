import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { registerServiceWorker } from './lib/registerServiceWorker';
import './index.css';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('No #root element found');

ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Last, and after render: an installed home-screen app needs a worker, and a
// worker that fails to register must never be able to stop the app rendering.
registerServiceWorker();
