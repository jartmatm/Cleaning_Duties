import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useSession } from "../hooks/use-session";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { userId } = useSession();

  if (!userId) {
    return <Navigate to="/login" replace />;
  }

  return children;
}
