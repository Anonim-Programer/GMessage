import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AnimatePresence } from 'framer-motion';
import { useAuthStore } from './store/authStore';
import { useSocketStore } from './store/socketStore';

// Pages
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ChatPage from './pages/ChatPage';
import ProfilePage from './pages/ProfilePage';
import ContactsPage from './pages/ContactsPage';
import SettingsPage from './pages/SettingsPage';
import VerifyEmailPage from './pages/VerifyEmailPage';
import ResetPasswordPage from './pages/ResetPasswordPage';

// Components
import ProtectedRoute from './components/ProtectedRoute';
import CallOverlay from './components/calls/CallOverlay';

function App() {
  const { user, token, hydrate } = useAuthStore();
  const { connect, disconnect } = useSocketStore();

  useEffect(() => {
    hydrate();
  }, []);

  useEffect(() => {
    if (token && user) {
      connect(token);
    } else {
      disconnect();
    }
    return () => disconnect();
  }, [token, user]);

  return (
    <BrowserRouter>
      <div className="app-root" data-theme={user?.theme || 'dark'}>
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border)'
            }
          }}
        />
        <CallOverlay />
        <AnimatePresence mode="wait">
          <Routes>
            <Route path="/login" element={!user ? <LoginPage /> : <Navigate to="/" />} />
            <Route path="/register" element={!user ? <RegisterPage /> : <Navigate to="/" />} />
            <Route path="/verify-email/:token" element={<VerifyEmailPage />} />
            <Route path="/reset-password/:token" element={<ResetPasswordPage />} />
            <Route path="/" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
            <Route path="/chat/:chatId" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
            <Route path="/profile/:userId?" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
            <Route path="/contacts" element={<ProtectedRoute><ContactsPage /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
          </Routes>
        </AnimatePresence>
      </div>
    </BrowserRouter>
  );
}

export default App;
