import { ArrowLeft, Check, Loader2, MapPin, Plus, Sparkles, X } from "lucide-react";
import { useEffect, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useMutation } from "@tanstack/react-query";
import { AppLoader } from "../common/app-loader";
import { CompletionCelebration } from "../common/completion-celebration";
import { notify } from "../common/toast";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import type { SiteItem } from "../../services/sites-service";
import { submitUnplannedDutyRequest, type ActiveDutyShift } from "../../services/unplanned-duty-service";
import { formatDateTime } from "../../utils/date-format";
import { getCompanyPalette } from "../../constants/company-palettes";
import { useSession } from "../../hooks/use-session";

type UnplannedDutyFlowProps = {
  cleanerId: string;
  site: SiteItem;
  shift: ActiveDutyShift;
  onClose: () => void;
  onSubmitted: () => void | Promise<void>;
};

type PreviewItem = {
  key: string;
  url: string;
};

const TOTAL_STEPS = 5;

function wait(milliseconds: number) {
  return new Promise((resolve) => window.setTimeout(resolve, milliseconds));
}

function useFilePreviews(files: File[]) {
  const [previews, setPreviews] = useState<PreviewItem[]>([]);

  useEffect(() => {
    const nextPreviews = files.map((file, index) => ({
      key: `${file.name}-${file.lastModified}-${index}`,
      url: URL.createObjectURL(file),
    }));
    setPreviews(nextPreviews);

    return () => {
      nextPreviews.forEach((preview) => URL.revokeObjectURL(preview.url));
    };
  }, [files]);

  return previews;
}

function StepArtwork() {
  return (
    <div
      className="mx-auto flex h-52 w-full max-w-md items-center justify-center rounded-md border border-dashed border-slate-200 bg-slate-50 sm:h-60"
      aria-label="Step illustration placeholder"
    >
      <Sparkles className="h-10 w-10 text-slate-300" aria-hidden="true" />
    </div>
  );
}

function PhotoGrid(props: { previews: PreviewItem[]; onRemove?: (index: number) => void }) {
  if (props.previews.length === 0) {
    return null;
  }

  return (
    <div className="mx-auto mt-6 grid w-full max-w-xl grid-cols-3 gap-3">
      {props.previews.map((preview, index) => (
        <div key={preview.key} className="relative aspect-[3/4] overflow-hidden rounded-md bg-slate-100 ring-1 ring-slate-200">
          <img src={preview.url} alt="Selected evidence" className="h-full w-full object-cover" />
          {props.onRemove ? (
            <button
              type="button"
              onClick={() => props.onRemove?.(index)}
              className="absolute right-2 top-2 rounded-full bg-white p-1.5 text-slate-700 shadow-sm ring-1 ring-slate-200"
              aria-label="Remove photo"
              title="Remove photo"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function PhotoStep(props: {
  title: string;
  description: string;
  files: File[];
  multiple?: boolean;
  maxFiles: number;
  onChange: (files: File[]) => void;
}) {
  const previews = useFilePreviews(props.files);

  function addFiles(fileList: FileList | null) {
    if (!fileList) {
      return;
    }

    const nextFiles = [...props.files, ...Array.from(fileList)].slice(0, props.maxFiles);
    props.onChange(nextFiles);
  }

  return (
    <>
      <StepArtwork />
      <div className="mx-auto mt-8 max-w-xl text-center">
        <p className="text-sm font-semibold text-slate-500">Optional evidence</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-950">{props.title}</h1>
        <p className="mt-3 text-base leading-7 text-slate-600">{props.description}</p>
      </div>
      <label
        className="mx-auto mt-6 flex h-14 w-14 cursor-pointer items-center justify-center rounded-full bg-slate-950 text-white transition hover:bg-slate-800"
        aria-label={props.title}
        title={props.title}
      >
        <Plus className="h-6 w-6" />
        <input
          type="file"
          accept="image/*"
          multiple={props.multiple}
          className="sr-only"
          onChange={(event) => {
            addFiles(event.target.files);
            event.target.value = "";
          }}
        />
      </label>
      <PhotoGrid
        previews={previews}
        onRemove={(index) => props.onChange(props.files.filter((_, fileIndex) => fileIndex !== index))}
      />
    </>
  );
}

export function UnplannedDutyFlow({ cleanerId, site, shift, onClose, onSubmitted }: UnplannedDutyFlowProps) {
  const { companyPalette } = useSession();
  const palette = getCompanyPalette(companyPalette);
  const portalThemeStyle = {
    "--company-primary": palette.primary,
    "--company-accent": palette.accent,
    "--company-surface": palette.surface,
    "--company-text": palette.text,
    "--company-border": `color-mix(in srgb, ${palette.accent} 28%, white)`,
  } as CSSProperties;
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [beforeFiles, setBeforeFiles] = useState<File[]>([]);
  const [afterFiles, setAfterFiles] = useState<File[]>([]);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [isButtonBusy, setIsButtonBusy] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const beforePreviews = useFilePreviews(beforeFiles);
  const afterPreviews = useFilePreviews(afterFiles);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const submitMutation = useMutation({
    mutationFn: () => submitUnplannedDutyRequest({
      companyId: site.companyId,
      siteId: site.id,
      storageBucket: site.storageBucket,
      cleanerId,
      shift,
      title,
      description,
      location,
      beforeFiles,
      afterFiles,
    }),
    onSuccess: async () => {
      await onSubmitted();
      setShowCelebration(true);
    },
    onError: (error) => notify({
      tone: "error",
      title: "Could not submit unplanned duty",
      message: error instanceof Error ? error.message : "Please try again.",
    }),
  });

  function validateCurrentStep() {
    if (step === 0 && title.trim().length < 2) {
      return "Enter a short title for the extra work.";
    }
    if (step === 1 && description.trim().length < 2) {
      return "Describe the work you completed.";
    }
    if (step === 1 && location.trim().length < 2) {
      return "Enter where the work happened.";
    }
    return null;
  }

  async function transitionTo(nextStep: number, showButtonSpinner: boolean) {
    setValidationMessage(null);
    if (showButtonSpinner) {
      setIsButtonBusy(true);
      await wait(180);
      setIsButtonBusy(false);
    }
    setIsTransitioning(true);
    await wait(420);
    setStep(nextStep);
    setIsTransitioning(false);
  }

  async function goNext() {
    const message = validateCurrentStep();
    if (message) {
      setValidationMessage(message);
      return;
    }
    await transitionTo(Math.min(step + 1, TOTAL_STEPS - 1), true);
  }

  async function goBack() {
    if (step === 0) {
      return;
    }
    await transitionTo(step - 1, false);
  }

  if (showCelebration) {
    return createPortal(
      <div className="fixed inset-0 z-[90] h-[100dvh] overflow-hidden bg-white" style={portalThemeStyle}>
        <CompletionCelebration onComplete={onClose} />
      </div>,
      document.body,
    );
  }

  if (isTransitioning) {
    return createPortal(
      <div className="fixed inset-0 z-[90] h-[100dvh] overflow-hidden bg-white" style={portalThemeStyle}>
        <AppLoader fullScreen message="Loading next step..." />
      </div>,
      document.body,
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-[80] h-[100dvh] overflow-y-auto overscroll-contain bg-white" style={portalThemeStyle}>
      <div className="flex min-h-[100dvh] flex-col">
        <header className="sticky top-0 z-10 flex items-center justify-between bg-white px-5 py-5 sm:px-8">
          <button
            type="button"
            onClick={onClose}
            disabled={submitMutation.isPending || isButtonBusy}
            className="flex h-10 w-10 items-center justify-center text-slate-950 disabled:opacity-40"
            aria-label="Close unplanned duty flow"
            title="Close"
          >
            <X className="h-6 w-6" />
          </button>
          <span className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700">
            Step {step + 1} of {TOTAL_STEPS}
          </span>
        </header>

        <main className="flex-1 px-5 pb-10 pt-4 sm:px-8 sm:pt-8">
          {step === 0 ? (
            <>
              <StepArtwork />
              <div className="mx-auto mt-8 max-w-xl">
                <p className="text-sm font-semibold text-slate-500">Unplanned duty</p>
                <h1 className="mt-2 text-3xl font-semibold text-slate-950">What did you take care of?</h1>
                <p className="mt-3 text-base leading-7 text-slate-600">Give the extra work a short, clear title for your supervisor.</p>
                <Input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  maxLength={120}
                  placeholder="e.g. Spill cleanup"
                  className="mt-6"
                  autoFocus
                />
              </div>
            </>
          ) : null}

          {step === 1 ? (
            <>
              <StepArtwork />
              <div className="mx-auto mt-8 max-w-xl">
                <p className="text-sm font-semibold text-slate-500">Work details</p>
                <h1 className="mt-2 text-3xl font-semibold text-slate-950">Where did it happen?</h1>
                <p className="mt-3 text-base leading-7 text-slate-600">Add enough detail for a quick and fair review.</p>
                <div className="mt-6 space-y-4">
                  <div>
                    <label className="text-sm font-semibold text-slate-700" htmlFor="unplanned-location">Location</label>
                    <div className="relative mt-2">
                      <MapPin className="pointer-events-none absolute left-4 top-3.5 h-4 w-4 text-slate-400" />
                      <Input
                        id="unplanned-location"
                        value={location}
                        onChange={(event) => setLocation(event.target.value)}
                        maxLength={240}
                        placeholder="e.g. Level 2, main lobby"
                        className="pl-11"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-slate-700" htmlFor="unplanned-description">Description</label>
                    <textarea
                      id="unplanned-description"
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      maxLength={2000}
                      rows={5}
                      placeholder="What happened and what did you do?"
                      className="mt-2 w-full resize-none rounded-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-slate-400"
                    />
                  </div>
                </div>
              </div>
            </>
          ) : null}

          {step === 2 ? (
            <PhotoStep
              title="Add a before photo"
              description="Add one photo if you captured the area before starting. You can continue without it."
              files={beforeFiles}
              maxFiles={1}
              onChange={setBeforeFiles}
            />
          ) : null}

          {step === 3 ? (
            <PhotoStep
              title="Show the result"
              description="Add up to five after photos if you have them. Evidence is helpful, but optional."
              files={afterFiles}
              multiple
              maxFiles={5}
              onChange={setAfterFiles}
            />
          ) : null}

          {step === 4 ? (
            <>
              <StepArtwork />
              <div className="mx-auto mt-8 max-w-2xl">
                <p className="text-sm font-semibold text-slate-500">Final review</p>
                <h1 className="mt-2 text-3xl font-semibold text-slate-950">Review your extra work</h1>
                <p className="mt-3 text-base leading-7 text-slate-600">This will be sent to a supervisor or manager for review and approval.</p>
                <div className="mt-7 grid gap-6 border-y border-slate-200 py-6 sm:grid-cols-2">
                  <div>
                    <p className="text-xs font-semibold uppercase text-slate-500">Duty</p>
                    <p className="mt-2 font-semibold text-slate-950">{title}</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{description}</p>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs font-semibold uppercase text-slate-500">Location</p>
                      <p className="mt-2 text-sm font-medium text-slate-950">{location}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase text-slate-500">Shift</p>
                      <p className="mt-2 text-sm text-slate-700">{formatDateTime(shift.startsAt)} - {formatDateTime(shift.endsAt)}</p>
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase text-slate-500">Site</p>
                      <p className="mt-2 text-sm text-slate-700">{site.name}</p>
                    </div>
                  </div>
                </div>
                {(beforePreviews.length > 0 || afterPreviews.length > 0) ? (
                  <div className="mt-6 grid gap-6 sm:grid-cols-2">
                    <div>
                      <p className="text-xs font-semibold uppercase text-slate-500">Before</p>
                      <PhotoGrid previews={beforePreviews} />
                    </div>
                    <div>
                      <p className="text-xs font-semibold uppercase text-slate-500">After</p>
                      <PhotoGrid previews={afterPreviews} />
                    </div>
                  </div>
                ) : null}
              </div>
            </>
          ) : null}

          {validationMessage ? <p className="mx-auto mt-6 max-w-xl text-sm font-medium text-rose-600">{validationMessage}</p> : null}
        </main>

        <footer className="sticky bottom-0 border-t border-slate-200 bg-white px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-4 sm:px-8">
          <div className="mx-auto flex max-w-5xl gap-1.5" aria-label="Progress">
            {Array.from({ length: TOTAL_STEPS }, (_, index) => (
              <div key={index} className={`h-1.5 flex-1 rounded-sm ${index <= step ? "bg-slate-950" : "bg-slate-200"}`} />
            ))}
          </div>
          <div className="mx-auto mt-5 flex max-w-5xl items-center justify-between">
            <Button
              type="button"
              variant="ghost"
              onClick={goBack}
              disabled={step === 0 || submitMutation.isPending || isButtonBusy}
              className={step === 0 ? "invisible" : ""}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
            {step < TOTAL_STEPS - 1 ? (
              <Button type="button" onClick={goNext} disabled={isButtonBusy} className="min-w-28">
                {isButtonBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Next"}
              </Button>
            ) : (
              <Button
                type="button"
                onClick={() => submitMutation.mutate()}
                disabled={submitMutation.isPending}
                className="min-w-28"
              >
                {submitMutation.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                {submitMutation.isPending ? "Submitting..." : "Submit"}
              </Button>
            )}
          </div>
        </footer>
      </div>
    </div>,
    document.body,
  );
}
