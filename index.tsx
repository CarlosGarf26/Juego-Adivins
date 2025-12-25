import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

console.log("Iniciando aplicación...");

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(registration => {
        console.log('SW registered: ', registration);
      })
      .catch(registrationError => {
        console.log('SW registration failed: ', registrationError);
      });
  });
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

try {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
  console.log("React montado correctamente.");
} catch (e) {
  console.error("Error al montar React:", e);
  document.getElementById('root')!.innerHTML = `<div style="color:red; padding:20px;">Error crítico: ${e}</div>`;
}