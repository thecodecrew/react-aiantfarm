import React from 'react';
import { createRoot } from 'react-dom/client';
import AntFarm from './components/AntFarm';

function App() {
  return (
    <div style={{ backgroundColor: '#1a1a1a', minHeight: '100vh' }}>
      <AntFarm />
    </div>
  );
}

const root = document.getElementById('root');

if (root) {
  createRoot(root).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}