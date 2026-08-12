import { useEffect, useLayoutEffect, useState, type RefObject } from "react";

export function useReducedMotion() {
  const [reducedMotion, setReducedMotion] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(prefers-reduced-motion: reduce)").matches : false,
  );

  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handleChange = () => setReducedMotion(query.matches);
    handleChange();
    query.addEventListener("change", handleChange);
    return () => query.removeEventListener("change", handleChange);
  }, []);

  return reducedMotion;
}

export function useLandingMotion(rootRef: RefObject<HTMLElement | null>, reducedMotion: boolean) {
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!root || reducedMotion) return;

    let cancelled = false;
    let cleanup = () => undefined;

    void Promise.all([import("gsap"), import("gsap/ScrollTrigger")]).then(([gsapModule, scrollTriggerModule]) => {
      if (cancelled) return;

      const { gsap } = gsapModule;
      const { ScrollTrigger } = scrollTriggerModule;
      gsap.registerPlugin(ScrollTrigger);

      const context = gsap.context(() => {
        gsap.timeline({ defaults: { ease: "power3.out" } })
          .from("[data-hero-media] img", { scale: 1.06, duration: 1.25 }, 0)
          .from("[data-hero-copy] > *", { y: 24, duration: 0.72, stagger: 0.09 })
          .from("[data-hero-copy] .marketing-button", { scale: 0.96, duration: 0.45 }, "-=0.3");

        gsap.to("[data-hero-media] img", {
          yPercent: 7,
          scale: 1.04,
          ease: "none",
          scrollTrigger: { trigger: "[data-hero]", start: "top top", end: "bottom top", scrub: 0.8 },
        });

        root.querySelectorAll<HTMLElement>("[data-reveal]").forEach((element) => {
          gsap.from(element, {
            y: 28,
            duration: 0.72,
            ease: "power2.out",
            scrollTrigger: { trigger: element, start: "top 88%", once: true },
          });
        });

        root.querySelectorAll<HTMLElement>("[data-problem-scrap]").forEach((element, index) => {
          const offset = (index - 2) * 12;
          gsap.to(element, {
            x: offset,
            y: index % 2 === 0 ? 16 : -12,
            rotate: 0,
            scale: 0.88,
            ease: "power1.inOut",
            scrollTrigger: {
              trigger: "[data-problem-consolidation]",
              start: "top 78%",
              end: "bottom 48%",
              scrub: 0.7,
            },
          });
        });

        root.querySelectorAll<HTMLElement>("[data-timeline-step]").forEach((element, index) => {
          gsap.from(element, {
            x: -16,
            duration: 0.5,
            scrollTrigger: {
              trigger: element,
              start: "top 82%",
              end: "top 62%",
              scrub: true,
              onEnter: () => element.style.setProperty("--timeline-progress", "100%"),
              onLeaveBack: () => element.style.setProperty("--timeline-progress", "0%"),
            },
          });
        });

        const media = gsap.matchMedia();
        media.add("(min-width: 1024px)", () => {
          const story = root.querySelector<HTMLElement>("[data-workflow-story]");
          const visual = root.querySelector<HTMLElement>("[data-workflow-visual-shell]");
          if (!story || !visual) return;

          ScrollTrigger.create({
            trigger: story,
            start: "top 104px",
            end: "bottom bottom-=80",
            pin: visual,
            pinSpacing: false,
          });
        });

        cleanup = () => {
          media.revert();
          context.revert();
        };
      }, root);
    });

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [reducedMotion, rootRef]);
}
