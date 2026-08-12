import { ArrowUpRight, Check } from "lucide-react";
import { footerGroups } from "./landing-content";
import { Brand } from "./landing-ui";

export function LandingFooter({ onSignIn, onDemo }: { onSignIn: () => void; onDemo: () => void }) {
  return (
    <footer className="marketing-footer">
      <div className="marketing-shell">
        <div className="marketing-footer__top">
          <div className="marketing-footer__brand">
            <a href="#top" aria-label="Cleaning Duties home"><Brand /></a>
            <p>Cleaning Duties helps commercial cleaning teams plan, complete and verify work across every site.</p>
          </div>
          {footerGroups.map((group) => (
            <div className="marketing-footer__group" key={group.title}>
              <strong>{group.title}</strong>
              {group.links.map((link) => {
                if (link.label === "Privacy" || link.label === "Terms") return <span className="is-pending" key={link.label}>{link.label}<small>In preparation</small></span>;
                if (link.label === "Book a demo") return <button type="button" onClick={onDemo} key={link.label}>{link.label}</button>;
                return <a href={link.href} key={link.label}>{link.label}</a>;
              })}
            </div>
          ))}
          <div className="marketing-footer__group">
            <strong>Account</strong>
            <button type="button" onClick={onSignIn}>Sign in <ArrowUpRight /></button>
          </div>
        </div>
        <div className="marketing-footer__completion" aria-hidden="true">
          <span><i /><i /><i /><i /><i /></span><div><Check /></div>
        </div>
        <div className="marketing-footer__bottom"><span>© {new Date().getFullYear()} Cleaning Duties</span><span>Commercial cleaning operations, clearly managed.</span></div>
      </div>
    </footer>
  );
}
