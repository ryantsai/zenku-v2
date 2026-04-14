import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppShell } from './components/layout/AppShell';
import { AppArea } from './components/AppArea';
import { ThemeProvider } from './components/layout/ThemeProvider';
import { Toaster } from './components/ui/sonner';
import { ViewsProvider } from './contexts/ViewsContext';
import { AuthProvider } from './contexts/AuthContext';
import { LoginPage } from './components/auth/LoginPage';

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider
        fallback={(hasUsers, onAuth) => <LoginPage hasUsers={hasUsers} onAuth={onAuth} />}
      >
        {() => (
          <ViewsProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<AppShell />}>
                  <Route index element={<Navigate to="." replace />} />
                  <Route path="view/:viewId" element={<AppArea />} />
                  <Route path="view/:viewId/:recordId" element={<AppArea />} />
                </Route>
              </Routes>
            </BrowserRouter>
          </ViewsProvider>
        )}
      </AuthProvider>
      <Toaster position="top-right" />
    </ThemeProvider>
  );
}
