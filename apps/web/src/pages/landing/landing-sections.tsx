import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Building2,
  CalendarClock,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Clock3,
  FileImage,
  Files,
  History,
  Map,
  MapPin,
  MessageCircle,
  Phone,
  Repeat2,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { faqs, features, industries, outcomes, problemStatements, roles, shiftTimeline, workflowSteps } from "./landing-content";
import { useCases } from "./landing-mock-data";
import { DashboardMockup, MiniOperationsPanel, MobileCleanerMockup, WorkflowVisual } from "./product-mockups";
import { MarketingButton, SectionHeading } from "./landing-ui";

const problemIcons: Record<string, LucideIcon> = {
  message: MessageCircle,
  calendar: CalendarClock,
  camera: Camera,
  files: Files,
  sliders: SlidersHorizontal,
};

const featureIcons: Record<string, LucideIcon> = {
  repeat: Repeat2,
  map: Map,
  camera: Camera,
  clipboard: ClipboardCheck,
  activity: Activity,
  alert: AlertTriangle,
  phone: Phone,
  history: History,
};

export function IndustryStrip() {
  return (
    <section className="industry-strip" id="operational-trust" aria-label="Industries served">
      <div className="marketing-shell">
        <p>Designed for demanding cleaning environments</p>
        <div className="industry-strip__track">
          {industries.map((industry) => <span key={industry}><i />{industry}</span>)}
        </div>
      </div>
    </section>
  );
}

export function ProblemSection() {
  const scraps = [
    { label: "Paper checklist", icon: ClipboardCheck, className: "paper" },
    { label: "Chat message", icon: MessageCircle, className: "chat" },
    { label: "Photo gallery", icon: FileImage, className: "gallery" },
    { label: "Spreadsheet", icon: Files, className: "sheet" },
    { label: "Incident note", icon: AlertTriangle, className: "note" },
  ];

  return (
    <section className="marketing-section problem-section" id="solutions">
      <div className="marketing-shell">
        <SectionHeading
          eyebrow="The operational gap"
          title="Cleaning work becomes difficult to manage when instructions, evidence and accountability live in different places."
          copy="Paper checklists get lost. Group chats become noisy. Verbal instructions are forgotten. Supervisors spend too much time checking work manually, while cleaners start shifts without a complete picture of what is expected."
        />

        <div className="problem-consolidation" data-problem-consolidation>
          <div className="problem-consolidation__scraps" aria-label="Disconnected cleaning information">
            {scraps.map(({ label, icon: Icon, className }) => (
              <div className={`problem-scrap problem-scrap--${className}`} data-problem-scrap key={label}>
                <Icon aria-hidden="true" /><span>{label}</span><i />
              </div>
            ))}
          </div>
          <div className="problem-consolidation__line" aria-hidden="true"><span /><ArrowRight /></div>
          <div className="problem-consolidation__system">
            <div className="problem-system__header"><span><Sparkles />Cleaning Duties</span><small>One shift record</small></div>
            <div className="problem-system__grid">
              <div><ClipboardCheck /><strong>8</strong><span>Shift duties</span></div>
              <div><Camera /><strong>12</strong><span>Evidence photos</span></div>
              <div><Users /><strong>6</strong><span>Active cleaners</span></div>
              <div><AlertTriangle /><strong>1</strong><span>Issue to review</span></div>
            </div>
            <div className="problem-system__status"><CheckCircle2 /><span><strong>Everything connected</strong><small>Instructions, progress and proof in context</small></span></div>
          </div>
        </div>

        <div className="problem-list">
          {problemStatements.map((problem, index) => {
            const Icon = problemIcons[problem.icon] ?? ClipboardCheck;
            return (
              <article className={index === 0 ? "is-featured" : ""} key={problem.title} data-reveal>
                <span className="problem-list__number">0{index + 1}</span>
                <Icon aria-hidden="true" />
                <h3>{problem.title}</h3>
                <p>{problem.copy}</p>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function WorkflowStory() {
  const [activeStep, setActiveStep] = useState(0);
  const stepsRef = useRef<Array<HTMLElement | null>>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;
        const index = Number((visible.target as HTMLElement).dataset.workflowIndex ?? 0);
        setActiveStep(index);
      },
      { rootMargin: "-28% 0px -40%", threshold: [0.15, 0.35, 0.65] },
    );
    stepsRef.current.forEach((step) => step && observer.observe(step));
    return () => observer.disconnect();
  }, []);

  return (
    <section className="marketing-section workflow-section" id="how-it-works">
      <div className="marketing-shell">
        <SectionHeading
          eyebrow="One operational system"
          title="Turn every cleaning requirement into a clear, trackable workflow."
          copy="From daily bathroom checks to monthly pressure washing, Cleaning Duties turns expectations into structured work your entire team can understand and complete."
        />
        <div className="workflow-story" data-workflow-story>
          <WorkflowVisual activeStep={activeStep} />
          <div className="workflow-story__steps">
            {workflowSteps.map((step, index) => (
              <article
                className={`workflow-step ${activeStep === index ? "is-active" : ""}`}
                data-workflow-step
                data-workflow-index={index}
                key={step.number}
                ref={(element) => { stepsRef.current[index] = element; }}
              >
                <span>{step.number}</span>
                <p>{step.label}</p>
                <h3>{step.title}</h3>
                <p>{step.copy}</p>
                <button type="button" onClick={() => setActiveStep(index)} aria-label={`Show ${step.label} workflow`}>
                  View step <ArrowRight />
                </button>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export function ProductShowcase() {
  return (
    <section className="marketing-section showcase-section" id="product-showcase">
      <div className="marketing-shell">
        <SectionHeading
          eyebrow="Built around real shifts"
          title="A platform your office team and cleaning staff can both use."
          copy="Move from a whole-site view to the detail of an individual duty without losing the shift context around it."
        />
        <DashboardMockup />
      </div>
    </section>
  );
}

export function CleanerExperience() {
  return (
    <section className="marketing-section cleaner-section" id="cleaner-experience">
      <div className="marketing-shell">
        <div className="cleaner-section__heading">
          <SectionHeading
            eyebrow="Simple in the field"
            title="Everything cleaners need, without unnecessary complexity."
            copy="Cleaning staff can open their shift, understand the duty, complete the work and upload evidence from one clear mobile experience."
          />
          <a className="marketing-inline-link" href="#features">View the cleaner experience <ArrowRight /></a>
        </div>
        <div className="cleaner-section__stage">
          <figure className="cleaner-section__photo" data-reveal>
            <img
              src="/landing/cleaner-mobile.jpg"
              alt="Commercial cleaner checking assigned duties beside a cleaning trolley"
              width={1122}
              height={1402}
              loading="lazy"
              decoding="async"
            />
          </figure>
          <MobileCleanerMockup />
        </div>
      </div>
    </section>
  );
}

function FeatureVisual({ icon }: { icon: string }) {
  if (icon === "repeat") {
    return <div className="feature-mini feature-mini--schedule"><span>M</span><span>T</span><span className="is-active">W</span><span>T</span><span className="is-active">F</span><i>Next · 11:00 PM</i></div>;
  }
  if (icon === "activity") {
    return <div className="feature-mini feature-mini--progress"><span style={{ width: "72%" }} /><div><i>Assigned</i><i>Active</i><i>Verified</i></div></div>;
  }
  if (icon === "history") {
    return <div className="feature-mini feature-mini--history"><span><Check />11:42 PM</span><span><Camera />12:08 AM</span><span><ShieldCheck />1:18 AM</span></div>;
  }
  return null;
}

export function FeatureGrid() {
  return (
    <section className="marketing-section feature-section" id="features">
      <div className="marketing-shell">
        <SectionHeading
          eyebrow="Operational visibility without micromanagement"
          title="The tools required to run consistent cleaning operations."
        />
        <div className="feature-grid">
          {features.map((feature, index) => {
            const Icon = featureIcons[feature.icon] ?? ClipboardCheck;
            return (
              <article
                className={`feature-card feature-card--${feature.size} feature-card--${index + 1}`}
                id={feature.icon === "map" ? "multi-site" : undefined}
                key={feature.title}
                data-reveal
              >
                <span className="feature-card__icon"><Icon aria-hidden="true" /></span>
                <div><h3>{feature.title}</h3><p>{feature.copy}</p></div>
                <FeatureVisual icon={feature.icon} />
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function RoleSection() {
  const [activeRole, setActiveRole] = useState<(typeof roles)[number]["id"]>("managers");
  const role = roles.find((item) => item.id === activeRole) ?? roles[0];

  return (
    <section className="marketing-section role-section" id="teams">
      <div className="marketing-shell">
        <SectionHeading title="One platform. Clearer work for everyone." align="centre" />
        <div className="role-tabs" role="tablist" aria-label="Benefits by role">
          {roles.map((item) => (
            <button type="button" role="tab" aria-selected={item.id === activeRole} className={item.id === activeRole ? "is-active" : ""} onClick={() => setActiveRole(item.id)} key={item.id}>{item.eyebrow}</button>
          ))}
        </div>
        <div className="role-panel" role="tabpanel" data-reveal>
          <div className="role-panel__copy">
            <p className="marketing-eyebrow">{role.eyebrow}</p>
            <h3>{role.title}</h3><p>{role.copy}</p>
            <ul>{role.points.map((point) => <li key={point}><Check />{point}</li>)}</ul>
          </div>
          <MiniOperationsPanel role={role.id} />
        </div>
      </div>
    </section>
  );
}

export function OutcomesSection() {
  return (
    <section className="marketing-section outcomes-section">
      <div className="marketing-shell">
        <div className="outcomes-section__intro">
          <SectionHeading eyebrow="What better visibility changes" title="Less time chasing updates. More confidence in every shift." />
          <div className="outcomes-list">
            {outcomes.map((outcome) => <span key={outcome}><CheckCircle2 />{outcome}</span>)}
          </div>
        </div>
        <div className="shift-timeline" aria-label="Example shift timeline">
          <div className="shift-timeline__header"><span>Night shift</span><strong>Preparation to verified completion</strong><small>Example workflow</small></div>
          {shiftTimeline.map((step, index) => (
            <div className="shift-timeline__step" data-timeline-step key={step}>
              <span>0{index + 1}</span><i /><strong>{step}</strong><small>{index < 2 ? "Before shift" : index < 6 ? "During shift" : "Close-out"}</small>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function UseCaseSelector() {
  const [activeId, setActiveId] = useState<(typeof useCases)[number]["id"]>("transport");
  const useCase = useCases.find((item) => item.id === activeId) ?? useCases[0];

  return (
    <section className="marketing-section use-case-section" id="use-cases">
      <div className="marketing-shell">
        <SectionHeading title="Flexible enough for every commercial cleaning environment." />
        <div className="use-case-layout">
          <div className="use-case-list" role="tablist" aria-label="Cleaning environments">
            {useCases.map((item) => (
              <button type="button" role="tab" aria-selected={item.id === activeId} className={item.id === activeId ? "is-active" : ""} onClick={() => setActiveId(item.id)} key={item.id}>
                <span>{item.label}</span><ArrowRight />
              </button>
            ))}
          </div>
          <div className="use-case-panel" role="tabpanel">
            <div className="use-case-panel__image">
              <img
                key={useCase.id}
                src={useCase.image}
                alt={useCase.imageAlt}
                width={1672}
                height={941}
                loading="lazy"
                decoding="async"
              />
            </div>
            <div className="use-case-panel__content">
              <p className="marketing-eyebrow">Sample operation</p>
              <h3>{useCase.site}</h3><p>{useCase.challenge}</p>
              <div className="use-case-panel__meta"><span><Building2 />{useCase.structure}</span><span><Clock3 />{useCase.shift}</span></div>
              <div className="use-case-panel__duties"><small>Example duties</small>{useCase.duties.map((duty) => <span key={duty}><Check />{duty}</span>)}</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function CredibilitySection() {
  const generic = ["Task title", "Due date", "Assignee"];
  const specialised = ["Site", "Area", "Shift", "Frequency", "Detailed process", "Equipment", "Chemicals", "Safety requirements", "Evidence", "Incident reporting", "Supervisor review"];

  return (
    <section className="marketing-section credibility-section" id="about">
      <div className="marketing-shell">
        <SectionHeading
          eyebrow="Purpose-built"
          title="Designed from real cleaning operations, not generic project management."
          copy="Cleaning Duties is built around the way commercial cleaning teams actually work: changing shifts, recurring duties, detailed site requirements, mobile staff, completion evidence and issues that need immediate attention."
        />
        <div className="credibility-comparison" data-reveal>
          <div className="credibility-comparison__generic"><span>Generic task management</span><ul>{generic.map((item) => <li key={item}><i />{item}</li>)}</ul></div>
          <div className="credibility-comparison__divider"><ArrowRight /></div>
          <div className="credibility-comparison__specialised"><span><Sparkles />Cleaning Duties</span><ul>{specialised.map((item) => <li key={item}><Check />{item}</li>)}</ul></div>
        </div>
        <p className="credibility-section__statement">The platform focuses on practical execution, helping teams turn cleaning standards into work that is clear, visible and repeatable.</p>
      </div>
    </section>
  );
}

export function DemoCTA({ onDemo }: { onDemo: () => void }) {
  return (
    <section className="demo-cta" id="demo">
      <div className="demo-cta__map" aria-hidden="true"><span /><span /><span /><span /><i /><i /><i /><i /></div>
      <div className="marketing-shell demo-cta__inner" id="pricing">
        <div data-reveal>
          <p className="marketing-eyebrow">Bring clarity to every shift</p>
          <h2>See how Cleaning Duties could work across your sites.</h2>
          <p>Book a personalised demonstration and explore how your cleaning schedules, teams and quality requirements can be managed from one platform.</p>
          <div className="demo-cta__actions"><MarketingButton variant="light" arrow onClick={onDemo}>Book a demo</MarketingButton><button type="button" onClick={onDemo}>Contact our team</button></div>
          <small>No generic sales presentation. We will focus on your sites, shifts and operational requirements.</small>
        </div>
        <div className="demo-cta__visual" data-reveal>
          <img
            src="/landing/shift-handover.jpg"
            alt="Cleaning supervisor reviewing the shift plan with two cleaners"
            width={1536}
            height={1024}
            loading="lazy"
            decoding="async"
          />
          <div className="demo-cta__operations" aria-label="Animated site status overview">
            {["Central Square", "North Campus", "Harbour Centre", "Metro Fitness"].map((site, index) => <div key={site}><span><i className={index === 2 ? "is-warning" : ""} />{site}</span><strong>{index === 0 ? "Shift active" : index === 2 ? "Review due" : "On track"}</strong></div>)}
            <div className="demo-cta__completion"><span /><strong>Operations visible</strong><CheckCircle2 /></div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function FAQSection() {
  const [openIndex, setOpenIndex] = useState(0);
  return (
    <section className="marketing-section faq-section">
      <div className="marketing-shell faq-section__layout">
        <div><SectionHeading eyebrow="Frequently asked questions" title="Practical answers before your demonstration." /><p className="faq-section__aside">Need to discuss a specific site or operating model? The demo request includes space to describe it.</p></div>
        <div className="faq-list">
          {faqs.map((faq, index) => {
            const open = index === openIndex;
            return (
              <div className={`faq-item ${open ? "is-open" : ""}`} key={faq.question}>
                <h3><button type="button" aria-expanded={open} aria-controls={`faq-answer-${index}`} onClick={() => setOpenIndex(open ? -1 : index)}><span>{faq.question}</span><ChevronDown /></button></h3>
                <div id={`faq-answer-${index}`} className="faq-item__answer" aria-hidden={!open}><div><p>{faq.answer}</p></div></div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
