import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Suspense, useEffect, useRef, useState } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useSession } from "../hooks/use-session";
import { AppLayout } from "../layouts/AppLayout";
import { AuthLayout } from "../layouts/AuthLayout";
import { DashboardPage } from "../pages/dashboard/DashboardPage";
import { LoginPage } from "../pages/auth/LoginPage";
import { ResetPasswordPage } from "../pages/auth/ResetPasswordPage";
import { DutiesPage } from "../pages/duties/DutiesPage";
import { ReportsPage } from "../pages/reports/ReportsPage";
import { SiteInfoPage } from "../pages/sites/SiteInfoPage";
import { SitesPage } from "../pages/sites/SitesPage";
import { UsersPage } from "../pages/users/UsersPage";
import { ProtectedRoute } from "../routes/protected-route";
import { PublicRoute } from "../routes/public-route";
import { getCurrentProfile } from "../services/profile-service";
import { getCompanySettings } from "../services/company-service";
import { supabase } from "../services/supabase-client";
import { ToastViewport } from "../components/common/toast";
import { SettingsPage } from "../pages/settings/SettingsPage";
import { PreloadedDutiesPage } from "../pages/settings/PreloadedDutiesPage";
import { AppLoader } from "../components/common/app-loader";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchInterval: 20_000,
      refetchIntervalInBackground: false,
      refetchOnWindowFocus: true,
      staleTime: 10_000,
    },
  },
});

export function App() {
  const { setSession, setEmail, clearSession, setSessionLoading } = useSession();

  useEffect(() => {
    let mounted = true;

    async function syncSession(showLoader = false) {
      if (showLoader) {
        setSessionLoading(true);
      }

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
      const company = await getCompanySettings(profile.company_id);

      if (!mounted) {
        return;
      }

      setSession({
        userId: session.user.id,
        companyId: profile.company_id,
        companyName: company.name,
        companyLogoUrl: company.logoUrl,
        companyPalette: company.colorPalette,
        role: profile.role,
      });
      setEmail(session.user.email ?? session.user.phone ?? null);
    }

    syncSession(true).catch(() => {
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
        const company = await getCompanySettings(profile.company_id);
        if (!mounted) {
          return;
        }

        setSession({
          userId: session.user.id,
          companyId: profile.company_id,
          companyName: company.name,
          companyLogoUrl: company.logoUrl,
          companyPalette: company.colorPalette,
          role: profile.role,
        });
        setEmail(session.user.email ?? session.user.phone ?? null);
      })();
    });

    function handleAppResume() {
      void syncSession(false).catch(() => {
        if (mounted) {
          clearSession();
        }
      });
    }

    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        handleAppResume();
      }
    }

    window.addEventListener("focus", handleAppResume);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      mounted = false;
      window.removeEventListener("focus", handleAppResume);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      data.subscription.unsubscribe();
    };
  }, [clearSession, setEmail, setSession, setSessionLoading]);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ToastViewport />
        <AppRoutes />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

function AppRoutes() {
  return (
    <>
      <RouteChangeLoader />
      <Suspense fallback={<AppLoader fullScreen message="Loading page..." />}>
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
            path="/reset-password"
            element={
              <AuthLayout>
                <ResetPasswordPage />
              </AuthLayout>
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
            path="/sites/:siteId/info"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <SiteInfoPage />
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
            path="/reports"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <ReportsPage />
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
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <SettingsPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings/preloaded-duties"
            element={
              <ProtectedRoute>
                <AppLayout>
                  <PreloadedDutiesPage />
                </AppLayout>
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </>
  );
}

function RouteChangeLoader() {
  const location = useLocation();
  const mounted = useRef(false);
  const [isChangingRoute, setIsChangingRoute] = useState(false);

  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }

    setIsChangingRoute(true);
    const timeout = window.setTimeout(() => setIsChangingRoute(false), 350);

    return () => window.clearTimeout(timeout);
  }, [location.pathname]);

  if (!isChangingRoute) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[70] bg-white">
      <AppLoader fullScreen message="Loading page..." />
    </div>
  );
}
