import { Clock3, Loader2, MapPin, UserRound, X } from "lucide-react";
import { useEffect, useRef } from "react";
import type { UnplannedDutyRequest } from "../../services/unplanned-duty-service";
import { formatDateTime } from "../../utils/date-format";
import { Button } from "../ui/button";

type UnplannedDutyReviewModalProps = {
  request: UnplannedDutyRequest;
  isReviewing: boolean;
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
};

function EvidenceGroup({ title, photos }: { title: string; photos: string[] }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-950">{title}</p>
        <span className="text-xs text-slate-500">{photos.length} photo{photos.length === 1 ? "" : "s"}</span>
      </div>
      {photos.length > 0 ? (
        <div className="mt-3 grid grid-cols-3 gap-3">
          {photos.map((photoUrl) => (
            <a
              key={photoUrl}
              href={photoUrl}
              target="_blank"
              rel="noreferrer"
              className="aspect-[3/4] overflow-hidden rounded-md bg-slate-100 ring-1 ring-slate-200"
            >
              <img src={photoUrl} alt={`${title} evidence`} className="h-full w-full object-cover" />
            </a>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-500">No photo provided.</p>
      )}
    </div>
  );
}

export function UnplannedDutyReviewModal({ request, isReviewing, onClose, onApprove, onReject }: UnplannedDutyReviewModalProps) {
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => scrollRef.current?.scrollTo({ top: 0, behavior: "auto" }));
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !isReviewing) {
        onClose();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isReviewing, onClose]);

  return (
    <div className="fixed inset-0 z-[70] overflow-y-auto bg-slate-950/45 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="unplanned-review-title">
      <div className="flex min-h-full items-center justify-center">
        <section ref={scrollRef} className="max-h-[calc(100dvh-2rem)] w-full max-w-3xl overflow-y-auto rounded-lg bg-white shadow-xl ring-1 ring-slate-200">
          <header className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white px-5 py-4 sm:px-6">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-500">Unplanned duty request</p>
              <h2 id="unplanned-review-title" className="mt-1 break-words text-xl font-semibold text-slate-950">{request.title}</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              disabled={isReviewing}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-slate-500 transition hover:bg-slate-100 hover:text-slate-950 disabled:opacity-40"
              aria-label="Close review"
              title="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </header>

          <div className="space-y-7 px-5 py-6 sm:px-6">
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="flex items-start gap-3">
                <UserRound className="mt-0.5 h-5 w-5 text-slate-400" />
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-500">Cleaner</p>
                  <p className="mt-1 text-sm font-medium text-slate-950">{request.cleanerName}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <MapPin className="mt-0.5 h-5 w-5 text-slate-400" />
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-500">Location</p>
                  <p className="mt-1 text-sm font-medium text-slate-950">{request.location}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Clock3 className="mt-0.5 h-5 w-5 text-slate-400" />
                <div>
                  <p className="text-xs font-semibold uppercase text-slate-500">Reported</p>
                  <p className="mt-1 text-sm font-medium text-slate-950">{formatDateTime(request.reportedCompletedAt)}</p>
                </div>
              </div>
            </div>

            <div className="border-y border-slate-200 py-6">
              <p className="text-xs font-semibold uppercase text-slate-500">Description</p>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-700">{request.description}</p>
              <p className="mt-4 text-sm text-slate-500">
                {request.siteName} · {formatDateTime(request.shiftStartedAt)} - {formatDateTime(request.shiftEndsAt)}
              </p>
            </div>

            <div className="grid gap-7 sm:grid-cols-2">
              <EvidenceGroup title="Before" photos={request.beforePhotos} />
              <EvidenceGroup title="After" photos={request.afterPhotos} />
            </div>
          </div>

          <footer className="sticky bottom-0 flex flex-wrap justify-end gap-3 border-t border-slate-200 bg-white px-5 py-4 sm:px-6">
            <button
              type="button"
              onClick={onReject}
              disabled={isReviewing}
              className="inline-flex min-w-28 items-center justify-center rounded-md bg-rose-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-rose-700 disabled:opacity-50"
            >
              {isReviewing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reject"}
            </button>
            <Button type="button" onClick={onApprove} disabled={isReviewing} className="min-w-28">
              {isReviewing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Approve"}
            </Button>
          </footer>
        </section>
      </div>
    </div>
  );
}
