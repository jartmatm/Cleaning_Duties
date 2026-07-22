import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useSession } from "../hooks/use-session";
import { AppLoader } from "../components/common/app-loader";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { userId, isSessionLoading } = useSession();

  if (isSessionLoading) {
    return <AppLoader fullScreen message="Loading workspace..." />;
  }

  if (!userId) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
