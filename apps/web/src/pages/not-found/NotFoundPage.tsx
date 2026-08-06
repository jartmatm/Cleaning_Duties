import Lottie from "lottie-react";
import { Home } from "lucide-react";
import { useNavigate } from "react-router-dom";
import notFoundLottie from "../../assets/not-found-lottie.json";
import { Button } from "../../components/ui/button";

export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <main className="flex min-h-screen items-center justify-center bg-white px-6 py-12 text-slate-950">
      <section className="flex w-full max-w-2xl flex-col items-center text-center">
        <Lottie animationData={notFoundLottie} loop autoplay className="h-72 w-72 sm:h-96 sm:w-96" />
        <div className="space-y-3">
          <p className="text-sm font-semibold uppercase tracking-[0.28em] text-slate-500">Page not found</p>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">This page is not available</h1>
          <p className="mx-auto max-w-md text-sm leading-6 text-slate-600">
            The link may be outdated or the page may have moved.
          </p>
        </div>
        <Button className="mt-8 !bg-slate-950 !text-white shadow-lg shadow-slate-950/20 hover:!bg-slate-800" onClick={() => navigate("/dashboard")}>
          <Home className="h-4 w-4" />
          Back to home
        </Button>
      </section>
    </main>
  );
}
