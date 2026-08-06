import { Route, Routes } from 'react-router-dom';
import { HomePage } from './pages/HomePage.js';
import { HostPage } from './pages/HostPage.js';
import { PlayerPage } from './pages/PlayerPage.js';

export function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/host" element={<HostPage />} />
      <Route path="/play" element={<PlayerPage />} />
      <Route path="*" element={<HomePage />} />
    </Routes>
  );
}
