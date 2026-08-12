import {
  AlertTriangle,
  ArrowUpRight,
  Camera,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  Droplets,
  ImagePlus,
  MapPin,
  Menu,
  MessageSquareText,
  MoreHorizontal,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import { useMemo, useRef, useState, type CSSProperties, type PointerEvent } from "react";
import { cleanerScreens, dashboardTabs, sampleDuties, sampleSite, type MockDutyStatus } from "./landing-mock-data";
import { BrowserFrame, CompletionMark, PhoneFrame } from "./landing-ui";

function statusClass(status: MockDutyStatus) {
  return status.toLowerCase().replaceAll(" ", "-");
}

function EvidencePhoto({ type, className = "" }: { type: "before" | "after"; className?: string }) {
  const isBefore = type === "before";
  return (
    <div className={`mock-photo ${isBefore ? "mock-photo--one" : "mock-photo--two"} ${className}`}>
      <img
        src={`/landing/evidence-${type}.jpg`}
        alt=""
        width={1086}
        height={1448}
        loading="lazy"
        decoding="async"
      />
    </div>
  );
}

export function StatusPill({ status }: { status: MockDutyStatus }) {
  return <span className={`mock-status mock-status--${statusClass(status)}`}>{status}</span>;
}

function ProgressRing({ value = 62, compact = false }: { value?: number; compact?: boolean }) {
  const style = { "--ring-value": `${value * 3.6}deg` } as CSSProperties;

  return (
    <div className={`mock-progress-ring ${compact ? "mock-progress-ring--compact" : ""}`} style={style}>
      <div>
        <strong>{value}%</strong>
        {!compact ? <span>complete</span> : null}
      </div>
    </div>
  );
}

function MiniNavigation() {
  return (
    <aside className="mock-sidebar" aria-hidden="true">
      <div className="mock-sidebar__logo"><Sparkles /></div>
      {["Overview", "Duties", "Sites", "Team"].map((label, index) => (
        <span key={label} className={index === 0 ? "is-active" : ""}>
          <i />{label}
        </span>
      ))}
      <div className="mock-sidebar__profile"><span>AC</span><i /></div>
    </aside>
  );
}

function DashboardSurface({ condensed = false }: { condensed?: boolean }) {
  const visibleDuties = condensed ? sampleDuties.slice(0, 4) : sampleDuties.slice(0, 5);

  return (
    <div className={`mock-dashboard ${condensed ? "mock-dashboard--condensed" : ""}`}>
      <MiniNavigation />
      <div className="mock-dashboard__main">
        <header className="mock-dashboard__header">
          <div>
            <span>{sampleSite.date}</span>
            <strong>{sampleSite.name}</strong>
          </div>
          <div className="mock-avatar-stack" aria-label="Six active cleaners">
            <span>AM</span><span>KL</span><span>RT</span><b>+3</b>
          </div>
        </header>

        <div className="mock-shift-banner">
          <div><Clock3 /><span><small>Current shift</small><strong>{sampleSite.shift}</strong></span></div>
          <span className="mock-live"><i /> Live</span>
        </div>

        <div className="mock-dashboard__grid">
          <div className="mock-dashboard__duties">
            <div className="mock-panel-heading"><span>Shift duties</span><small>8 total</small></div>
            {visibleDuties.map((duty) => (
              <div className="mock-duty-row" key={duty.id}>
                <span className={`mock-duty-row__check ${duty.status === "Completed" ? "is-complete" : ""}`}>
                  {duty.status === "Completed" ? <Check /> : null}
                </span>
                <div><strong>{duty.title}</strong><small>{duty.zone}</small></div>
                <span className="mock-duty-row__time">{duty.time}</span>
                <StatusPill status={duty.status} />
              </div>
            ))}
          </div>
          <div className="mock-dashboard__progress">
            <div className="mock-panel-heading"><span>Shift progress</span><MoreHorizontal /></div>
            <ProgressRing value={sampleSite.progress} />
            <div className="mock-progress-legend">
              <span><i className="is-blue" />5 completed</span>
              <span><i className="is-green" />2 active</span>
              <span><i />1 scheduled</span>
            </div>
            <div className="mock-evidence-strip">
              <EvidencePhoto type="before" /><EvidencePhoto type="after" />
              <span><Camera />Evidence</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CleanerTaskScreen({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`cleaner-screen ${compact ? "cleaner-screen--compact" : ""}`}>
      <div className="cleaner-screen__top"><Menu /><span>11:42 PM</span><span className="cleaner-screen__avatar">AM</span></div>
      <div className="cleaner-screen__intro">
        <small>Tonight's shift</small>
        <h3>Good evening, Alex</h3>
        <p>Central Square Complex</p>
      </div>
      <div className="cleaner-screen__progress">
        <ProgressRing value={62} compact />
        <div><strong>5 of 8 duties</strong><span>Shift ends at 6:30 AM</span></div>
      </div>
      <div className="cleaner-screen__list">
        <p>Up next</p>
        {sampleDuties.slice(1, compact ? 3 : 4).map((duty, index) => (
          <div className={index === 0 ? "is-current" : ""} key={duty.id}>
            <span>{index === 0 ? <Droplets /> : <ClipboardCheck />}</span>
            <div><strong>{duty.title}</strong><small>{duty.zone}</small></div>
            <ChevronRight />
          </div>
        ))}
      </div>
    </div>
  );
}

export function HeroProductScene({ reducedMotion }: { reducedMotion: boolean }) {
  const sceneRef = useRef<HTMLDivElement>(null);

  function handlePointerMove(event: PointerEvent<HTMLDivElement>) {
    if (reducedMotion || !window.matchMedia("(pointer: fine)").matches) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width - 0.5;
    const y = (event.clientY - rect.top) / rect.height - 0.5;
    sceneRef.current?.style.setProperty("--scene-rotate-x", `${y * -2.5}deg`);
    sceneRef.current?.style.setProperty("--scene-rotate-y", `${x * 3}deg`);
  }

  function resetPointer() {
    sceneRef.current?.style.setProperty("--scene-rotate-x", "0deg");
    sceneRef.current?.style.setProperty("--scene-rotate-y", "0deg");
  }

  return (
    <div
      ref={sceneRef}
      className="hero-product-scene"
      data-hero-scene
      onPointerMove={handlePointerMove}
      onPointerLeave={resetPointer}
      aria-label="Cleaning Duties dashboard and cleaner mobile app example"
    >
      <div className="hero-product-scene__grid" aria-hidden="true" />
      <div className="hero-browser" data-hero-desktop>
        <BrowserFrame label="Sample operations dashboard">
          <DashboardSurface condensed />
        </BrowserFrame>
      </div>
      <div className="hero-phone" data-hero-phone>
        <PhoneFrame label="Sample cleaner shift view">
          <CleanerTaskScreen compact />
        </PhoneFrame>
      </div>
      <div className="hero-duty-card hero-duty-card--status" data-hero-card>
        <small>Lobby floor scrubbing</small>
        <div className="hero-status-flow">
          <span>Assigned</span><i /><span>In progress</span><i /><CompletionMark />
        </div>
      </div>
      <div className="hero-duty-card hero-duty-card--incident" data-hero-card>
        <span className="hero-duty-card__icon"><AlertTriangle /></span>
        <div><small>Incident reported</small><strong>Waste room access</strong></div>
        <ArrowUpRight />
      </div>
      <div className="hero-duty-card hero-duty-card--evidence" data-hero-card>
        <EvidencePhoto type="after" className="mock-photo--three" />
        <span><Camera /><small>Photo verified</small></span>
      </div>
    </div>
  );
}

export function WorkflowVisual({ activeStep }: { activeStep: number }) {
  return (
    <div className="workflow-visual" data-workflow-visual-shell aria-live="polite">
      <div className="workflow-visual__topbar">
        <span>Duty workflow</span>
        <span className="workflow-visual__step">0{activeStep + 1} / 05</span>
      </div>

      <div className={`workflow-scene workflow-scene--plan ${activeStep === 0 ? "is-active" : ""}`}>
        <div className="workflow-form">
          <span className="workflow-label">Duty name</span><strong>Main bathrooms deep clean</strong>
          <div className="workflow-form__row"><span><MapPin />Level 1 · Amenities</span><span><Clock3 />Weekly</span></div>
          <span className="workflow-label">Instructions</span>
          <div className="workflow-lines"><i /><i /><i /></div>
          <div className="workflow-tags"><span>Floor scrubber</span><span>Neutral cleaner</span><span>PPE</span></div>
          <button type="button" tabIndex={-1}>Save duty</button>
        </div>
      </div>

      <div className={`workflow-scene workflow-scene--assign ${activeStep === 1 ? "is-active" : ""}`}>
        {([
          ["Alex M.", "2 duties"], ["Kai L.", "3 duties"], ["Riley T.", "3 duties"],
        ] as const).map(([name, count], index) => (
          <div className="workflow-assignee" key={name}>
            <div><span>{name.slice(0, 2).toUpperCase()}</span><strong>{name}</strong><small>{count}</small></div>
            <div className="workflow-assignee__cards">
              {sampleDuties.slice(index * 2, index * 2 + 2).map((duty) => <span key={duty.id}>{duty.title}</span>)}
            </div>
          </div>
        ))}
      </div>

      <div className={`workflow-scene workflow-scene--guide ${activeStep === 2 ? "is-active" : ""}`}>
        <PhoneFrame label="Cleaner duty instructions">
          <div className="workflow-phone-screen">
            <span className="workflow-phone-screen__back">‹ Tonight's duties</span>
            <small>GROUND FLOOR · LOBBY</small>
            <h3>Lobby floor scrubbing</h3>
            <p>Machine scrub the full lobby floor, including edges and the entry mat recess.</p>
            {["Equipment required", "Chemicals required", "Safety notes"].map((item, index) => (
              <div key={item}><span>{index === 0 ? <Droplets /> : index === 1 ? <Sparkles /> : <ShieldCheck />}</span>{item}<ChevronRight /></div>
            ))}
            <button type="button" tabIndex={-1}>Start duty</button>
          </div>
        </PhoneFrame>
      </div>

      <div className={`workflow-scene workflow-scene--verify ${activeStep === 3 ? "is-active" : ""}`}>
        <div className="workflow-photos">
          <EvidencePhoto type="before" className="workflow-photo--before" />
          <EvidencePhoto type="after" className="workflow-photo--after" />
          <span className="workflow-photo-label workflow-photo-label--before">Before</span>
          <span className="workflow-photo-label workflow-photo-label--after">After</span>
        </div>
        <div className="workflow-verify-panel"><CheckCircle2 /><div><small>Duty completed</small><strong>Lobby floor scrubbing</strong><span>2 photos · Note added · 1:18 AM</span></div></div>
      </div>

      <div className={`workflow-scene workflow-scene--improve ${activeStep === 4 ? "is-active" : ""}`}>
        <div className="workflow-site-map" aria-hidden="true"><span /><span /><span /><span /><i className="is-alert" /><i className="is-success" /></div>
        <div className="workflow-incident">
          <span><AlertTriangle /></span><div><small>Issue reported</small><strong>Waste room access blocked</strong><p>Assigned to site supervisor · Follow-up required</p></div>
        </div>
      </div>
    </div>
  );
}

export function DashboardMockup() {
  const [activeTab, setActiveTab] = useState<(typeof dashboardTabs)[number]>("Operations");
  const tabContent = useMemo(() => {
    if (activeTab === "Duties") return "8 duties across 6 operational zones";
    if (activeTab === "Team") return "6 cleaners active on the current shift";
    if (activeTab === "Sites") return "Central Square Complex · Night operations";
    if (activeTab === "Incidents") return "1 open incident requires supervisor review";
    return "Live shift control across duties, people and evidence";
  }, [activeTab]);

  return (
    <div className="showcase-dashboard" data-reveal>
      <div className="showcase-dashboard__tabs" role="tablist" aria-label="Sample product views">
        {dashboardTabs.map((tab) => (
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === tab}
            className={activeTab === tab ? "is-active" : ""}
            key={tab}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>
      <div className="showcase-dashboard__context"><span>Sample workspace</span><strong>{tabContent}</strong></div>
      <BrowserFrame label="Interactive sample operations dashboard">
        <DashboardSurface />
      </BrowserFrame>
    </div>
  );
}

function CleanerPhoneScreen({ screenIndex }: { screenIndex: number }) {
  const screen = cleanerScreens[screenIndex];
  if (!screen) return null;

  if (screen.id === "shift") return <CleanerTaskScreen />;

  if (screen.id === "instructions") {
    return (
      <div className="cleaner-detail-screen">
        <div className="cleaner-detail-screen__nav">‹ Duties <MoreHorizontal /></div>
        <small>{screen.eyebrow}</small><h3>{screen.title}</h3>
        <StatusPill status="In progress" />
        <p>Machine scrub the lobby floor, including edges and the entry mat recess. Place safety signs before starting.</p>
        {screen.items.map((item, index) => <div className="cleaner-detail-screen__item" key={item}><span>{index === 0 ? <Droplets /> : index === 1 ? <Sparkles /> : <ShieldCheck />}</span><strong>{item}</strong><ChevronRight /></div>)}
        <button type="button" tabIndex={-1}>Start duty</button>
      </div>
    );
  }

  return (
    <div className="cleaner-complete-screen">
      <div className="cleaner-detail-screen__nav">‹ Duty <MoreHorizontal /></div>
      <small>{screen.eyebrow}</small><h3>{screen.title}</h3>
      <div className="cleaner-upload"><ImagePlus /><strong>Add completion photos</strong><span>Up to 6 photos</span></div>
      <button className="cleaner-secondary-action" type="button" tabIndex={-1}><MessageSquareText />Add a note</button>
      <button className="cleaner-secondary-action" type="button" tabIndex={-1}><AlertTriangle />Report an issue</button>
      <button className="cleaner-complete-action" type="button" tabIndex={-1}><Check />Mark as completed</button>
    </div>
  );
}

export function MobileCleanerMockup() {
  return (
    <div className="cleaner-phones" aria-label="Three sample cleaner mobile screens">
      {cleanerScreens.map((screen, index) => (
        <div className={`cleaner-phones__item cleaner-phones__item--${index + 1}`} key={screen.id} data-reveal>
          <span className="cleaner-phones__number">0{index + 1}</span>
          <PhoneFrame label={`${screen.title} screen`}><CleanerPhoneScreen screenIndex={index} /></PhoneFrame>
        </div>
      ))}
    </div>
  );
}

export function MiniOperationsPanel({ role }: { role: "managers" | "supervisors" | "cleaners" }) {
  if (role === "cleaners") {
    return <div className="role-visual role-visual--phone"><CleanerTaskScreen compact /></div>;
  }

  if (role === "supervisors") {
    return (
      <div className="role-visual role-visual--supervisor">
        <div className="role-visual__heading"><span>Current shift</span><span className="mock-live"><i /> Live</span></div>
        {sampleDuties.slice(0, 4).map((duty) => <div key={duty.id}><span>{duty.assignee}</span><strong>{duty.title}</strong><StatusPill status={duty.status} /></div>)}
      </div>
    );
  }

  return (
    <div className="role-visual role-visual--manager">
      <div><span>Sites on track</span><strong>4 / 5</strong><small>One review required</small></div>
      <div><Users /><strong>18</strong><span>Cleaners on shift</span></div>
      <div><ClipboardCheck /><strong>42</strong><span>Duties visible</span></div>
      <div><AlertTriangle /><strong>2</strong><span>Open incidents</span></div>
    </div>
  );
}
