import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import type { ReactNode } from "react";
import { AuthProvider, useAuth } from "@/context/auth";
import { ToastProvider } from "@/components/ui/toast";
import { PageLoader } from "@/components/ui/misc";
import { AppLayout } from "@/components/layout/AppLayout";
import { LoginPage } from "@/pages/LoginPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { PersonasPage } from "@/pages/PersonasPage";
import { PersonaEditarPage, PersonaNuevaPage } from "@/pages/PersonaFormPage";
import { PersonaDetailPage } from "@/pages/PersonaDetailPage";
import { CasasPage } from "@/pages/CasasPage";
import { UsuariosPage } from "@/pages/UsuariosPage";

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <PageLoader />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return children;
}

function RequireAdmin({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  return user?.rol === "admin" ? children : <Navigate to="/" replace />;
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              element={
                <RequireAuth>
                  <AppLayout />
                </RequireAuth>
              }
            >
              <Route index element={<DashboardPage />} />
              <Route path="personas" element={<PersonasPage />} />
              <Route path="personas/nueva" element={<PersonaNuevaPage />} />
              <Route path="personas/:id" element={<PersonaDetailPage />} />
              <Route path="personas/:id/editar" element={<PersonaEditarPage />} />
              <Route path="casas" element={<CasasPage />} />
              <Route
                path="usuarios"
                element={
                  <RequireAdmin>
                    <UsuariosPage />
                  </RequireAdmin>
                }
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Routes>
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
