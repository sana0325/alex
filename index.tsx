import React from 'react';
import ReactDOM from 'react-dom/client';
import './src/index.css';
import AppRoot from './AppRoot';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Could not find root element');

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <AppRoot />
  </React.StrictMode>
);