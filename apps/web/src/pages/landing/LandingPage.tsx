import Lottie from "lottie-react";
import { ArrowRight, LogIn } from "lucide-react";
import { useNavigate } from "react-router-dom";
import underConstructionLottie from "../../assets/under-construction-lottie.json";
import { Button } from "../../components/ui/button";

export function LandingPage() {
  const navigate = useNavigate();

  return (
    <main className="min-h-screen overflow-hidden bg-white text-slate-950">
      <section className="relative isolate min-h-screen px-6 py-6 sm:px-8 lg:px-12">
        <div className="pointer-events-none absolute inset-0 -z-10 landing-stage" data-gsap-stage>
          <div className="absolute inset-x-0 top-0 h-px bg-slate-200" />
          <div className="absolute left-1/2 top-1/2 h-[36rem] w-[36rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-slate-200/70" data-gsap-orbit />
          <div className="absolute right-[8%] top-[18%] h-32 w-32 rounded-lg border border-slate-200 bg-white shadow-sm" data-gsap-card />
          <div className="absolute bottom-[18%] left-[10%] h-24 w-44 rounded-lg border border-slate-200 bg-slate-50" data-gsap-panel />
        </div>

        <nav className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <button type="button" className="text-left" onClick={() => navigate("/")}>
            <span className="block text-sm font-semibold tracking-tight text-slate-950">Cleaning Duties</span>
            <span className="block text-xs text-slate-500">Commercial cleaning operations</span>
          </button>
          <Button type="button" variant="secondary" onClick={() => navigate("/login")}>
            <LogIn className="h-4 w-4" />
            Sign in
          </Button>
        </nav>

        <div className="mx-auto flex min-h-[calc(100vh-5.5rem)] max-w-7xl items-center">
          <div className="grid w-full gap-10 py-16 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
            <div className="max-w-2xl space-y-8" data-gsap-hero-copy>
              <div className="inline-flex rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                SaaS for cleaning teams
              </div>
              <div className="space-y-5">
                <h1 className="text-5xl font-semibold leading-[0.96] tracking-tight text-slate-950 sm:text-6xl lg:text-7xl">
                  Cleaning Duties
                </h1>
                <p className="max-w-xl text-base leading-7 text-slate-600 sm:text-lg">
                  A prepared landing canvas for subscriptions, demos, product storytelling, and Stripe checkout entry points.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button type="button" className="!bg-slate-950 !text-white shadow-lg shadow-slate-950/20 hover:!bg-slate-800" onClick={() => navigate("/login")}>
                  Start now
                  <ArrowRight className="h-4 w-4" />
                </Button>
                <Button type="button" variant="secondary" onClick={() => navigate("/login")}>
                  Log in
                </Button>
              </div>
            </div>

            <div className="relative min-h-[28rem] lg:min-h-[34rem]" data-gsap-hero-scene>
              <div className="absolute inset-0 rounded-lg border border-slate-200 bg-slate-50 shadow-sm" data-landing-3d-root>
                <div className="flex h-full items-center justify-center p-6 sm:p-8">
                  <Lottie
                    animationData={underConstructionLottie}
                    loop
                    autoplay
                    className="h-full max-h-[28rem] w-full max-w-[34rem]"
                    data-gsap-lottie
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
