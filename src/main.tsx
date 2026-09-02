import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { RealtimeProvider } from './context/RealtimeContext';
import { AuthProvider } from './context/AuthContext';
import { CartProvider } from './context/CartContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <RealtimeProvider>
        <CartProvider>
          <App />
        </CartProvider>
      </RealtimeProvider>
    </AuthProvider>
  </StrictMode>,
);
