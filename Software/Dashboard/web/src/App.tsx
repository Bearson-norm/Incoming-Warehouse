import { BrowserRouter, HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { AuthProvider } from './contexts/AuthContext';
import { I18nProvider } from './contexts/I18nContext';
import { Toaster } from './components/ui/sonner';
import Login from './pages/Login';
import Layout from './components/Layout';
import Home from './pages/Home';
import RecordingAction from './pages/RecordingAction';
import IntransRecordingAction from './pages/IntransRecordingAction';
import LpnBreakdown from './pages/LpnBreakdown';
import RecordDocuments from './pages/RecordDocuments';
import Databases from './pages/Databases';
import Setting from './pages/Setting';
import CloudServer from './pages/CloudServer';
import { useEffect, useState } from 'react';

const isElectron = typeof window !== 'undefined' && (window as any).electron?.isElectron === true;

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsHydrated(true), 100);
    return () => clearTimeout(timer);
  }, []);

  if (!isHydrated) {
    return <div style={{ padding: '20px', textAlign: 'center' }}>Loading...</div>;
  }

  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/setting"
        element={
          isElectron ? (
            <Setting />
          ) : (
            <PrivateRoute>
              <Layout />
            </PrivateRoute>
          )
        }
      >
        {!isElectron ? <Route index element={<Setting />} /> : null}
      </Route>
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<Home />} />
        <Route path="recording-action" element={<RecordingAction />} />
        <Route path="intrans-recording-action" element={<IntransRecordingAction />} />
        <Route path="lpn-breakdown" element={<LpnBreakdown />} />
        <Route path="record-documents" element={<RecordDocuments />} />
        <Route path="cloud-server" element={<CloudServer />} />
        <Route path="database" element={<Databases />} />
        <Route path="setting" element={<Setting />} />
      </Route>
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <I18nProvider>
        {window.location.protocol === 'file:' ? (
          <HashRouter>
            <AppRoutes />
          </HashRouter>
        ) : (
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        )}
        <Toaster />
      </I18nProvider>
    </AuthProvider>
  );
}

export default App;
