import { useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DemoRequestModal } from "./demo-request-modal";
import { HeroSection } from "./hero-section";
import { AnnouncementBar, Navbar } from "./landing-header";
import { LandingFooter } from "./landing-footer";
import {
  CleanerExperience,
  CredibilitySection,
  DemoCTA,
  FAQSection,
  FeatureGrid,
  IndustryStrip,
  OutcomesSection,
  ProblemSection,
  ProductShowcase,
  RoleSection,
  UseCaseSelector,
  WorkflowStory,
} from "./landing-sections";
import { useLandingMotion, useReducedMotion } from "./use-landing-motion";
import "./landing.css";

export function LandingPage() {
  const navigate = useNavigate();
  const rootRef = useRef<HTMLElement>(null);
  const [demoOpen, setDemoOpen] = useState(false);
  const reducedMotion = useReducedMotion();
  const openDemo = useCallback(() => setDemoOpen(true), []);
  const closeDemo = useCallback(() => setDemoOpen(false), []);
  const openSignIn = useCallback(() => navigate("/login"), [navigate]);

  useLandingMotion(rootRef, reducedMotion);

  return (
    <main ref={rootRef} className={`marketing-page ${reducedMotion ? "has-reduced-motion" : ""}`} id="top">
      <AnnouncementBar />
      <Navbar onDemo={openDemo} onSignIn={openSignIn} />
      <HeroSection onDemo={openDemo} />
      <IndustryStrip />
      <ProblemSection />
      <WorkflowStory />
      <ProductShowcase />
      <CleanerExperience />
      <FeatureGrid />
      <RoleSection />
      <OutcomesSection />
      <UseCaseSelector />
      <CredibilitySection />
      <DemoCTA onDemo={openDemo} />
      <FAQSection />
      <LandingFooter onDemo={openDemo} onSignIn={openSignIn} />
      <DemoRequestModal open={demoOpen} onClose={closeDemo} />
    </main>
  );
}
