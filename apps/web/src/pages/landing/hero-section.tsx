import { ArrowDown, CheckCircle2 } from "lucide-react";
import { MarketingButton } from "./landing-ui";

export function HeroSection({
  onDemo,
}: {
  onDemo: () => void;
}) {
  return (
    <section className="marketing-hero" id="platform" data-hero aria-labelledby="hero-title">
      <div className="marketing-hero__media" data-hero-media>
        <img
          src="/landing/hero-operations.jpg"
          alt="Commercial cleaning supervisor reviewing the active night shift in a modern office lobby"
          width={1672}
          height={941}
          fetchPriority="high"
          decoding="async"
        />
      </div>
      <div className="marketing-shell marketing-hero__inner">
        <div className="marketing-hero__copy" data-hero-copy>
          <p className="marketing-eyebrow"><span />Cleaning operations, under control.</p>
          <h1 id="hero-title">
            Every duty.<br className="marketing-hero__mobile-break" /> Every shift.<br />
            <span>Every site.<br className="marketing-hero__mobile-break" /> Clearly managed.</span>
          </h1>
          <p className="marketing-hero__lead">
            Cleaning Duties gives commercial cleaning teams one place to assign work, guide cleaners, verify completion and manage operations across every location.
          </p>
          <div className="marketing-hero__actions">
            <MarketingButton variant="light" arrow onClick={onDemo}>Book a demo</MarketingButton>
            <a className="marketing-text-link" href="#how-it-works">Explore the platform <ArrowDown aria-hidden="true" /></a>
          </div>
          <p className="marketing-hero__microcopy"><CheckCircle2 aria-hidden="true" />Built for supervisors, cleaners and multi-site operations.</p>
        </div>
      </div>
      <a className="marketing-hero__scroll" href="#operational-trust" aria-label="Scroll to learn more"><span>Scroll to see the shift unfold</span><ArrowDown /></a>
    </section>
  );
}
