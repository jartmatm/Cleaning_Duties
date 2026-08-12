import { lazy, Suspense } from "react";
import { BrowserRouter, useLocation } from "react-router-dom";

const LandingPage = lazy(() => import("../pages/landing/LandingPage").then((module) => ({ default: module.LandingPage })));
const ProductApp = lazy(() => import("./ProductApp").then((module) => ({ default: module.ProductApp })));

export function App() {
  return (
    <BrowserRouter>
      <AppEntry />
    </BrowserRouter>
  );
}

function AppEntry() {
  const location = useLocation();

  return (
    <Suspense fallback={<RouteFallback />}>
      {location.pathname === "/" ? <LandingPage /> : <ProductApp />}
    </Suspense>
  );
}

function RouteFallback() {
  return (
    <div className="grid min-h-screen place-items-center bg-white text-slate-950" role="status" aria-live="polite">
      <div className="grid justify-items-center gap-3 text-sm font-medium">
        <span className="h-7 w-7 animate-spin rounded-full border-2 border-slate-200 border-t-slate-950" aria-hidden="true" />
        Loading page...
      </div>
    </div>
  );
}
