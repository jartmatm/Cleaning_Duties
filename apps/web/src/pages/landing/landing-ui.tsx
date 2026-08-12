import { ArrowRight, Check, Layers3 } from "lucide-react";
import type { ButtonHTMLAttributes, ReactNode } from "react";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className="marketing-brand">
      <span className="marketing-brand__mark" aria-hidden="true">
        <Layers3 />
      </span>
      <span>
        <strong>Cleaning Duties</strong>
        {!compact ? <small>Commercial cleaning operations</small> : null}
      </span>
    </span>
  );
}

type MarketingButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "light";
  arrow?: boolean;
};

export function MarketingButton({
  children,
  className = "",
  variant = "primary",
  arrow = false,
  ...props
}: MarketingButtonProps) {
  return (
    <button className={`marketing-button marketing-button--${variant} ${className}`} {...props}>
      <span>{children}</span>
      {arrow ? <ArrowRight className="marketing-button__arrow" aria-hidden="true" /> : null}
    </button>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  copy,
  align = "left",
}: {
  eyebrow?: string;
  title: string;
  copy?: string;
  align?: "left" | "centre";
}) {
  return (
    <div className={`marketing-section-heading marketing-section-heading--${align}`} data-reveal>
      {eyebrow ? <p className="marketing-eyebrow">{eyebrow}</p> : null}
      <h2>{title}</h2>
      {copy ? <p className="marketing-section-copy">{copy}</p> : null}
    </div>
  );
}

export function BrowserFrame({ children, label }: { children: ReactNode; label: string }) {
  return (
    <div className="browser-frame" aria-label={label}>
      <div className="browser-frame__bar" aria-hidden="true">
        <span />
        <span />
        <span />
        <div className="browser-frame__address">app.cleaningduties.com.au</div>
      </div>
      {children}
    </div>
  );
}

export function PhoneFrame({ children, label, className = "" }: { children: ReactNode; label: string; className?: string }) {
  return (
    <div className={`phone-frame ${className}`} aria-label={label}>
      <div className="phone-frame__speaker" aria-hidden="true" />
      <div className="phone-frame__screen">{children}</div>
    </div>
  );
}

export function CompletionMark({ label = "Completed" }: { label?: string }) {
  return (
    <span className="completion-mark">
      <span className="completion-mark__icon" aria-hidden="true">
        <Check />
      </span>
      {label}
    </span>
  );
}
