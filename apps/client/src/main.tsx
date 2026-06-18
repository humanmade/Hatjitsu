import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from './theme/ThemeProvider';
import { Toaster } from 'sonner';
import App from './App';
import './globals.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <BrowserRouter>
        <App />
        {/* offset clears the fixed ConnectionStatus banner (top-0, ~36px) so the maintenance
            toast — which shows at the same time — sits below it rather than overlapping. */}
        <Toaster richColors position="top-center" offset={56} />
      </BrowserRouter>
    </ThemeProvider>
  </StrictMode>,
);
