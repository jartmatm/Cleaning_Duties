import { Navigate } from "react-router-dom";
import type { ReactNode } from "react";
import { useSession } from "../hooks/use-session";

export function PublicRoute({ children }: { children: ReactNode }) {
  const { userId } = useSession();

  if (userId) {
    return <Navigate to="/" replace />;
  }

  return children;
}
