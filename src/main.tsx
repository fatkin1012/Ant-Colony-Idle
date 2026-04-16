import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles.css';

console.log('[Ant Colony Idle] main.tsx loaded');

const bootMarker = document.createElement('div');
bootMarker.textContent = 'main.tsx 已載入 - 這是臨時檢查標記';
bootMarker.style.position = 'fixed';
bootMarker.style.left = '12px';
bootMarker.style.bottom = '12px';
bootMarker.style.zIndex = '99999';
bootMarker.style.padding = '0.5rem 0.75rem';
bootMarker.style.borderRadius = '10px';
bootMarker.style.background = 'rgba(25, 20, 16, 0.92)';
bootMarker.style.color = '#f4eddc';
bootMarker.style.fontSize = '12px';
bootMarker.style.letterSpacing = '0.04em';
bootMarker.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.35)';
document.body.appendChild(bootMarker);

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);