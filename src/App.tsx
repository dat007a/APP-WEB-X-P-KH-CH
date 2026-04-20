import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import BarberView from './pages/BarberView';
import Admin from './pages/Admin';
import Reports from './pages/Reports';
import Settings from './pages/Settings';
import Logs from './pages/Logs';
import Layout from './components/Layout';

function PrivateRoute({ children, roles }: { children: React.ReactNode, roles?: string[] }) {
  const { user, profile, loading } = useAuth();

  if (loading) return <div className="flex items-center justify-center h-screen bg-neutral-900 text-white">Loading...</div>;
  if (!user) return <Navigate to="/login" />;
  if (roles && profile && !roles.includes(profile.role)) return <Navigate to="/" />;

  return <>{children}</>;
}

function AppRoutes() {
  const { profile } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={
        <PrivateRoute>
          <Layout>
            {profile?.role === 'barber' ? <BarberView /> : <Dashboard />}
          </Layout>
        </PrivateRoute>
      } />
      <Route path="/admin" element={
        <PrivateRoute roles={['admin']}>
          <Layout><Admin /></Layout>
        </PrivateRoute>
      } />
      <Route path="/reports" element={
        <PrivateRoute roles={['admin', 'cashier']}>
          <Layout><Reports /></Layout>
        </PrivateRoute>
      } />
      <Route path="/settings" element={
        <PrivateRoute roles={['admin']}>
          <Layout><Settings /></Layout>
        </PrivateRoute>
      } />
      <Route path="/logs" element={
        <PrivateRoute roles={['admin', 'cashier']}>
          <Layout><Logs /></Layout>
        </PrivateRoute>
      } />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <Router>
        <AppRoutes />
      </Router>
    </AuthProvider>
  );
}
