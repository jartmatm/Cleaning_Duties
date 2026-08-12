import { CheckCircle2, Copy, Loader2, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { MarketingButton } from "./landing-ui";

type DemoRequest = {
  fullName: string;
  workEmail: string;
  companyName: string;
  siteCount: string;
  teamSize: string;
  challenge: string;
  message: string;
};

const initialRequest: DemoRequest = {
  fullName: "",
  workEmail: "",
  companyName: "",
  siteCount: "",
  teamSize: "",
  challenge: "",
  message: "",
};

export function DemoRequestModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstInputRef = useRef<HTMLInputElement>(null);
  const [values, setValues] = useState<DemoRequest>(initialRequest);
  const [state, setState] = useState<"idle" | "submitting" | "success" | "unavailable" | "error">("idle");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!open) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const timeout = window.setTimeout(() => firstInputRef.current?.focus(), 80);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }

      if (event.key !== "Tab") return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href]',
      );
      if (!focusable?.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.clearTimeout(timeout);
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", handleKeyDown);
      previousFocus?.focus();
    };
  }, [onClose, open]);

  if (!open) return null;

  function updateValue(field: keyof DemoRequest, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    if (state !== "idle") setState("idle");
  }

  async function submitRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const endpoint = import.meta.env.VITE_DEMO_REQUEST_ENDPOINT;

    if (!endpoint) {
      sessionStorage.setItem("cleaning-duties-demo-request-draft", JSON.stringify(values));
      setState("unavailable");
      return;
    }

    setState("submitting");
    try {
      // Integration point: configure VITE_DEMO_REQUEST_ENDPOINT with a server-side form handler.
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!response.ok) throw new Error("Demo request failed");
      setState("success");
      setValues(initialRequest);
    } catch {
      setState("error");
    }
  }

  async function copyRequest() {
    const requestText = [
      `Name: ${values.fullName}`,
      `Work email: ${values.workEmail}`,
      `Company: ${values.companyName}`,
      `Number of sites: ${values.siteCount}`,
      `Team size: ${values.teamSize}`,
      `Primary challenge: ${values.challenge}`,
      `Message: ${values.message || "Not provided"}`,
    ].join("\n");
    await navigator.clipboard.writeText(requestText);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="demo-modal" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <div ref={dialogRef} className="demo-modal__dialog" role="dialog" aria-modal="true" aria-labelledby="demo-modal-title">
        <button className="demo-modal__close" type="button" onClick={onClose} aria-label="Close demo request"><X /></button>
        <div className="demo-modal__intro">
          <p className="marketing-eyebrow">Personalised demonstration</p>
          <h2 id="demo-modal-title">Tell us how your cleaning operation works.</h2>
          <p>We will shape the conversation around your sites, shifts, team and quality requirements.</p>
          <div className="demo-modal__expectations">
            <span><CheckCircle2 />Your current operating model</span>
            <span><CheckCircle2 />The workflows that need more visibility</span>
            <span><CheckCircle2 />A practical product walkthrough</span>
          </div>
        </div>

        <form className="demo-form" onSubmit={submitRequest}>
          <div className="demo-form__grid">
            <label>Full name<input ref={firstInputRef} required autoComplete="name" value={values.fullName} onChange={(event) => updateValue("fullName", event.target.value)} /></label>
            <label>Work email<input required type="email" autoComplete="email" value={values.workEmail} onChange={(event) => updateValue("workEmail", event.target.value)} /></label>
            <label className="demo-form__full">Company name<input required autoComplete="organization" value={values.companyName} onChange={(event) => updateValue("companyName", event.target.value)} /></label>
            <label>Number of sites<select required value={values.siteCount} onChange={(event) => updateValue("siteCount", event.target.value)}><option value="">Select</option><option>1</option><option>2–5</option><option>6–15</option><option>16–50</option><option>More than 50</option></select></label>
            <label>Approximate team size<select required value={values.teamSize} onChange={(event) => updateValue("teamSize", event.target.value)}><option value="">Select</option><option>1–10</option><option>11–30</option><option>31–100</option><option>101–250</option><option>More than 250</option></select></label>
            <label className="demo-form__full">Primary operational challenge<select required value={values.challenge} onChange={(event) => updateValue("challenge", event.target.value)}><option value="">Select the closest match</option><option>Recurring work is being missed</option><option>Limited proof of completion</option><option>Instructions are inconsistent</option><option>Managing multiple sites</option><option>Incident follow-up</option><option>Replacing paper and group chats</option><option>Another challenge</option></select></label>
            <label className="demo-form__full">Message <span>Optional</span><textarea rows={3} value={values.message} onChange={(event) => updateValue("message", event.target.value)} placeholder="Anything useful about your sites, shifts or current process" /></label>
          </div>

          {state === "success" ? <p className="demo-form__message is-success">Thanks—your request has been received. Our team will be in touch to learn more about your cleaning operations.</p> : null}
          {state === "unavailable" ? (
            <div className="demo-form__message is-warning">
              <p>Online demo requests are not connected yet, so this has not been submitted. Your draft is saved in this browser.</p>
              <button type="button" onClick={copyRequest}><Copy />{copied ? "Request copied" : "Copy request details"}</button>
            </div>
          ) : null}
          {state === "error" ? <p className="demo-form__message is-error">We could not send the request. Your form is still here so you can try again.</p> : null}

          <MarketingButton type="submit" arrow disabled={state === "submitting"}>
            {state === "submitting" ? <><Loader2 className="demo-form__spinner" />Sending request</> : "Request my demo"}
          </MarketingButton>
          <small>We will only use these details to respond to your request.</small>
        </form>
      </div>
    </div>
  );
}
