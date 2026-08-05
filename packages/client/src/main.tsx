import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { App } from './App.js';
import { SocketProvider } from './SocketContext.js';
import { createSocket } from './socket.js';
import './index.css';

const socket = createSocket();
const container = document.getElementById('root');
if (!container) {
  throw new Error('Root container is missing.');
}

createRoot(container).render(
  <StrictMode>
    <BrowserRouter>
      <SocketProvider socket={socket}>
        <App />
      </SocketProvider>
    </BrowserRouter>
  </StrictMode>,
);
