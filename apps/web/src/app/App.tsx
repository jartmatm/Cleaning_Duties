import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { useSession } from "../hooks/use-session";
import { AppLayout } from "../layouts/AppLayout";
import { AuthLayout } from "../layouts/AuthLayout";
import { DashboardPage } from "../pages/dashboard/DashboardPage";
import { LoginPage } from "../pages/auth/LoginPage";
import { DutiesPage } from "../pages/duties/DutiesPage";
import { SitesPage } from "../pages/sites/SitesPage";
import { UsersPage } from "../pages/users/UsersPage";
import { ProtectedRoute } from "../routes/protected-route";
import { PublicRoute } from "../routes/public-route";
import { getCurrentProfile } from "../services/profile-service";
import { supabase } from "../services/supabase-client";

const queryClient = new QueryClient();

export function App() {
  const { setSession, setEmail, clearSession } = useSession();

  useEffect(() => {
    let mounted = true;

    async function syncSession() {
      const { data } = await supabase.auth.getSession();
      const session = data.session;

      if (!mounted) {
        return;
      }

      if (!session?.user) {
        clearSession();
        return;
      }

      const profile = await getCurrentProfile(session.user.id);

      if (!mounted) {
        return;
      }

      setSession({
        userId: session.user.id,
        companyId: profile.company_id,
        role: profile.role,
      });
      setEmail(session.user.email ?? session.user.phone ?? null);
    }

    syncSession().catch(() => {
      if (mounted) {
        clearSession();
      }
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) {
        return;
      }

      if (!session?.user) {
        clearSession();
        return;
      }

      void (async () => {
        const profile = await getCurrentProfile(session.user.id);
        if (!mounted) {
          return;
        }

        setSession({
          userId: session.user.id,
          companyId: profile.company_id,
          role: profile.role,
        });
        setEmail(session.user.email ?? session.user.phone ?? null);
      })();
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, [clearSession, setEmail, setSession]);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <Routes>
          <Route
            path="/login"
            element={
              <PublicRoute>
                <AuthLayout>
                  <LoginPage />
                </AuthLayout>
              </PublicRoute>
            }
          />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <DashboardPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/sites"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <SitesPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/duties"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <DutiesPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/users"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <UsersPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
