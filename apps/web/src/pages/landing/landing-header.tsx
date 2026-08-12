import { ArrowRight, Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { navigationItems } from "./landing-content";
import { Brand, MarketingButton } from "./landing-ui";

export function AnnouncementBar() {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;

  return (
    <div className="announcement-bar" role="status">
      <div>
        <span>Built for the realities of commercial cleaning operations.</span>
        <a href="#how-it-works">See how it works <ArrowRight aria-hidden="true" /></a>
      </div>
      <button type="button" onClick={() => setVisible(false)} aria-label="Dismiss announcement">
        <X aria-hidden="true" />
      </button>
    </div>
  );
}

export function Navbar({ onDemo, onSignIn }: { onDemo: () => void; onSignIn: () => void }) {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeSection, setActiveSection] = useState("platform");

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 28);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    const sections = navigationItems
      .map((item) => document.getElementById(item.href.slice(1)))
      .filter((section): section is HTMLElement => Boolean(section));
    const observer = new IntersectionObserver(
      (entries) => {
        const active = entries.filter((entry) => entry.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (active?.target.id) setActiveSection(active.target.id);
      },
      { rootMargin: "-20% 0px -65%", threshold: [0, 0.2, 0.5] },
    );
    sections.forEach((section) => observer.observe(section));
    return () => observer.disconnect();
  }, []);

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <header className={`marketing-nav ${scrolled ? "is-scrolled" : ""}`}>
      <div className="marketing-shell marketing-nav__inner">
        <a className="marketing-nav__brand" href="#top" aria-label="Cleaning Duties home" onClick={closeMenu}>
          <Brand compact />
        </a>
        <nav className="marketing-nav__links" aria-label="Main navigation">
          {navigationItems.map((item) => (
            <a className={activeSection === item.href.slice(1) ? "is-active" : ""} href={item.href} key={item.href}>{item.label}</a>
          ))}
        </nav>
        <div className="marketing-nav__actions">
          <button className="marketing-sign-in" type="button" onClick={onSignIn}>Sign in</button>
          <MarketingButton onClick={onDemo}>Book a demo</MarketingButton>
        </div>
        <button
          className="marketing-nav__menu-button"
          type="button"
          aria-expanded={menuOpen}
          aria-controls="marketing-mobile-menu"
          aria-label={menuOpen ? "Close navigation" : "Open navigation"}
          onClick={() => setMenuOpen((current) => !current)}
        >
          {menuOpen ? <X /> : <Menu />}
        </button>
      </div>
      <div id="marketing-mobile-menu" className={`marketing-mobile-menu ${menuOpen ? "is-open" : ""}`}>
        <nav aria-label="Mobile navigation">
          {navigationItems.map((item) => <a href={item.href} key={item.href} onClick={closeMenu}>{item.label}</a>)}
        </nav>
        <div>
          <button type="button" onClick={() => { closeMenu(); onSignIn(); }}>Sign in</button>
          <MarketingButton onClick={() => { closeMenu(); onDemo(); }}>Book a demo</MarketingButton>
        </div>
      </div>
    </header>
  );
}
