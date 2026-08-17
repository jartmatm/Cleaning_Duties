import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import {
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  Clock3,
  ImageIcon,
  Loader2,
  MessageSquareText,
  Repeat2,
  Users,
  X,
} from "lucide-react";
import { getCompanyPalette } from "../../constants/company-palettes";
import { useSession } from "../../hooks/use-session";
import { listDutyAssignments } from "../../services/assignments-service";
import { listDutyComments, type DutyItem } from "../../services/duties-service";
import type { SiteItem } from "../../services/sites-service";
import { formatDateTime } from "../../utils/date-format";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { DutyStatusBadge } from "./duty-status-badge";

type DutyProgressModalProps = {
  duty: DutyItem;
  site: SiteItem | null;
  onClose: () => void;
};

type PhotoViewer = {
  title: string;
  photos: string[];
  index: number;
};

const workflowSteps = ["Scheduled", "Pending", "In progress", "Completed"];
const weekdayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function formatSiteShift(site: SiteItem | null) {
  return site?.shiftStartTime && site.shiftEndTime
    ? `${site.shiftStartTime} - ${site.shiftEndTime}`
    : "No shift hours set";
}

function formatRecurrence(duty: DutyItem) {
  if (!duty.recurring) {
    return "One-time duty";
  }
  if (!duty.recurringRule) {
    return "Recurring duty";
  }

  try {
    const rule = JSON.parse(duty.recurringRule) as {
      pattern?: string;
      interval?: number;
      weekday?: number;
      weekdays?: number[];
    };
    const pattern = rule.pattern ?? "daily";
    const interval = Math.max(Number(rule.interval) || 1, 1);
    const unit = pattern === "daily" ? "day" : pattern === "weekly" ? "week" : pattern === "monthly" ? "month" : "year";
    const cadence = interval === 1 ? `Every ${unit}` : `Every ${interval} ${unit}s`;

    if (pattern !== "weekly") {
      return cadence;
    }

    const weekdays = Array.isArray(rule.weekdays) && rule.weekdays.length > 0
      ? rule.weekdays
      : [Number.isInteger(rule.weekday) ? rule.weekday ?? 1 : 1];
    const labels = weekdays
      .map((weekday) => weekdayNames[weekday])
      .filter((weekday): weekday is string => Boolean(weekday));
    return labels.length > 0 ? `${cadence} · ${labels.join(", ")}` : cadence;
  } catch {
    return "Recurring duty";
  }
}

function getWorkflowIndex(status: DutyItem["status"]) {
  if (status === "Scheduled") return 0;
  if (status === "Pending" || status === "Missed") return 1;
  if (status === "In Progress" || status === "Incomplete") return 2;
  if (status === "Completed" || status === "Archived") return 3;
  return -1;
}

function getStatusDescription(status: DutyItem["status"]) {
  const descriptions: Record<DutyItem["status"], string> = {
    Draft: "This duty is saved as a draft and has not entered the shift workflow.",
    Scheduled: "The duty is assigned and waiting for its scheduled shift to begin.",
    Pending: "The shift is active and the duty is ready for the cleaner to start.",
    "In Progress": "The cleaner has opened this duty and work is underway.",
    Completed: "The cleaner completed this duty during the assigned shift.",
    Incomplete: "Work began, but the duty was not completed during the shift.",
    Missed: "The assigned shift ended before this duty was completed.",
    Archived: "This completed duty has been moved into the site history.",
  };
  return descriptions[status];
}

export function DutyProgressModal({ duty, site, onClose }: DutyProgressModalProps) {
  const { companyPalette } = useSession();
  const palette = getCompanyPalette(companyPalette);
  const scrollContainerRef = useRef<HTMLElement | null>(null);
  const [photoViewer, setPhotoViewer] = useState<PhotoViewer | null>(null);
  const modalThemeStyle = {
    "--company-primary": palette.primary,
    "--company-accent": palette.accent,
    "--company-surface": palette.surface,
    "--company-text": palette.text,
    "--company-border": `color-mix(in srgb, ${palette.accent} 28%, white)`,
  } as CSSProperties;
  const workflowIndex = getWorkflowIndex(duty.status);
  const photoGroups = useMemo(() => [
    { title: "Reference photos", photos: duty.referencePhotos },
    { title: "Before photos", photos: duty.beforePhotos },
    { title: "After photos", photos: duty.afterPhotos },
    { title: "Completion photos", photos: duty.completionPhotos },
  ].filter((group) => group.photos.length > 0), [duty.afterPhotos, duty.beforePhotos, duty.completionPhotos, duty.referencePhotos]);
  const photoCount = photoGroups.reduce((total, group) => total + group.photos.length, 0);

  const assignmentsQuery = useQuery({
    queryKey: ["duty-progress-assignments", duty.id],
    queryFn: () => listDutyAssignments(duty.id),
  });
  const commentsQuery = useQuery({
    queryKey: ["duty-progress-comments", duty.id],
    queryFn: () => listDutyComments(duty.id),
  });

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const frame = window.requestAnimationFrame(() => scrollContainerRef.current?.scrollTo({ top: 0, behavior: "auto" }));

    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = previousOverflow;
    };
  }, [duty.id]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      if (photoViewer) {
        setPhotoViewer(null);
        return;
      }
      onClose();
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose, photoViewer]);

  function showPreviousPhoto() {
    setPhotoViewer((current) => current
      ? { ...current, index: (current.index - 1 + current.photos.length) % current.photos.length }
      : current);
  }

  function showNextPhoto() {
    setPhotoViewer((current) => current
      ? { ...current, index: (current.index + 1) % current.photos.length }
      : current);
  }

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-3 backdrop-blur-sm sm:p-4"
      style={modalThemeStyle}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="presentation"
    >
      <Card
        ref={scrollContainerRef}
        className="max-h-[calc(100dvh-1.5rem)] w-full max-w-4xl overflow-y-auto p-0 sm:max-h-[90vh]"
        role="dialog"
        aria-modal="true"
        aria-labelledby="duty-progress-title"
      >
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-slate-200 bg-white/95 px-5 py-4 backdrop-blur sm:px-6">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase text-slate-500">Duty progress</p>
            <h2 id="duty-progress-title" className="mt-1 break-words text-xl font-semibold text-slate-950">{duty.title}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-sm text-slate-500">{site?.name ?? "Assigned site"}</span>
              <DutyStatusBadge status={duty.status} />
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">Read only</span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300"
            aria-label="Close duty progress"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-7 px-5 py-6 sm:px-6">
          <section aria-labelledby="workflow-title">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 id="workflow-title" className="text-sm font-semibold text-slate-950">Workflow</h3>
                <p className="mt-1 text-sm text-slate-500">{getStatusDescription(duty.status)}</p>
              </div>
              {duty.completedAt ? (
                <span className="inline-flex items-center gap-2 text-sm font-medium text-emerald-700">
                  <Clock3 className="h-4 w-4" />
                  Completed {formatDateTime(duty.completedAt)}
                </span>
              ) : null}
            </div>
            <div className="mt-4 grid grid-cols-4 gap-2">
              {workflowSteps.map((step, index) => {
                const reached = index <= workflowIndex;
                const current = index === workflowIndex;
                const exception = current && (duty.status === "Missed" || duty.status === "Incomplete");
                return (
                  <div key={step} className="min-w-0">
                    <div className={`h-1.5 rounded-full ${exception ? "bg-rose-500" : reached ? "bg-[var(--company-primary)]" : "bg-slate-200"}`} />
                    <p className={`mt-2 truncate text-xs font-semibold ${exception ? "text-rose-700" : current ? "text-slate-950" : "text-slate-500"}`}>{step}</p>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4" aria-label="Duty details">
            <InfoBlock icon={CalendarClock} label="Starts" value={formatDateTime(duty.startsAt) || "Not scheduled"} />
            <InfoBlock icon={Clock3} label="Shift ends" value={formatDateTime(duty.dueDate) || "Not scheduled"} />
            <InfoBlock icon={Repeat2} label="Frequency" value={formatRecurrence(duty)} />
            <InfoBlock icon={Users} label="Site shift" value={formatSiteShift(site)} />
            <InfoBlock label="Priority" value={duty.priority} />
            <InfoBlock label="Equipment" value={duty.equipment.length > 0 ? duty.equipment.join(", ") : "None listed"} />
            <InfoBlock label="Created" value={formatDateTime(duty.createdAt)} />
            <InfoBlock label="Last updated" value={formatDateTime(duty.updatedAt)} />
          </section>

          <section aria-labelledby="description-title">
            <h3 id="description-title" className="text-sm font-semibold text-slate-950">Description</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{duty.description || "No description provided."}</p>
          </section>

          <section className="border-t border-slate-200 pt-6" aria-labelledby="assignees-title">
            <div className="flex items-center gap-2">
              <Users className="h-4 w-4 text-slate-500" />
              <h3 id="assignees-title" className="text-sm font-semibold text-slate-950">Assigned cleaners</h3>
            </div>
            {assignmentsQuery.isLoading ? (
              <LoadingLine label="Loading assignments" />
            ) : assignmentsQuery.isError ? (
              <p className="mt-3 text-sm text-rose-600">Assignments could not be loaded.</p>
            ) : assignmentsQuery.data?.length ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {assignmentsQuery.data.map((assignment) => (
                  <div key={assignment.profileId} className="flex items-center justify-between gap-3 rounded-md bg-slate-50 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-950">{assignment.name}</p>
                      <p className="mt-1 text-xs text-slate-500">Assigned {formatDateTime(assignment.assignedAt)}</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${assignment.completedAt || duty.completedAt ? "bg-emerald-50 text-emerald-700" : "bg-white text-slate-600 ring-1 ring-slate-200"}`}>
                      {assignment.completedAt || duty.completedAt ? "Completed" : "Assigned"}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-500">No cleaner is assigned to this duty.</p>
            )}
          </section>

          <section className="border-t border-slate-200 pt-6" aria-labelledby="evidence-title">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <ImageIcon className="h-4 w-4 text-slate-500" />
                <h3 id="evidence-title" className="text-sm font-semibold text-slate-950">Photos and evidence</h3>
              </div>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{photoCount} photos</span>
            </div>
            {photoGroups.length > 0 ? (
              <div className="mt-4 space-y-5">
                {photoGroups.map((group) => (
                  <PhotoGroup
                    key={group.title}
                    title={group.title}
                    photos={group.photos}
                    onOpen={(index) => setPhotoViewer({ title: group.title, photos: group.photos, index })}
                  />
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-500">No photos have been uploaded for this duty yet.</p>
            )}
          </section>

          <section className="border-t border-slate-200 pt-6" aria-labelledby="comments-title">
            <div className="flex items-center gap-2">
              <MessageSquareText className="h-4 w-4 text-slate-500" />
              <h3 id="comments-title" className="text-sm font-semibold text-slate-950">Comments</h3>
            </div>
            {commentsQuery.isLoading ? (
              <LoadingLine label="Loading comments" />
            ) : commentsQuery.isError ? (
              <p className="mt-3 text-sm text-rose-600">Comments could not be loaded.</p>
            ) : commentsQuery.data?.length ? (
              <div className="mt-3 space-y-3">
                {commentsQuery.data.map((comment) => (
                  <div key={comment.id} className="rounded-md bg-slate-50 px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-950">{comment.authorName}</p>
                      <time className="text-xs text-slate-500">{formatDateTime(comment.createdAt)}</time>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-600">{comment.body}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-sm text-slate-500">No comments have been added.</p>
            )}
          </section>

          <div className="flex justify-end border-t border-slate-200 pt-5">
            <Button type="button" variant="secondary" onClick={onClose}>Close</Button>
          </div>
        </div>
      </Card>

      {photoViewer ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950 p-3 sm:p-4" role="dialog" aria-modal="true" aria-label={`${photoViewer.title} viewer`}>
          <button type="button" onClick={() => setPhotoViewer(null)} className="absolute right-4 top-4 z-10 rounded-full bg-white/15 p-3 text-white transition hover:bg-white/25" aria-label="Close photo viewer">
            <X className="h-6 w-6" />
          </button>
          {photoViewer.photos.length > 1 ? (
            <button type="button" onClick={showPreviousPhoto} className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/15 p-3 text-white transition hover:bg-white/25" aria-label="Previous photo">
              <ChevronLeft className="h-7 w-7" />
            </button>
          ) : null}
          <img src={photoViewer.photos[photoViewer.index]} alt={`${photoViewer.title} ${photoViewer.index + 1}`} className="max-h-[82dvh] max-w-full select-none rounded-md object-contain" draggable={false} />
          {photoViewer.photos.length > 1 ? (
            <button type="button" onClick={showNextPhoto} className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/15 p-3 text-white transition hover:bg-white/25" aria-label="Next photo">
              <ChevronRight className="h-7 w-7" />
            </button>
          ) : null}
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-white/15 px-4 py-2 text-sm font-semibold text-white">
            {photoViewer.title} · {photoViewer.index + 1} / {photoViewer.photos.length}
          </div>
        </div>
      ) : null}
    </div>,
    document.body,
  );
}

function InfoBlock({ icon: Icon, label, value }: { icon?: typeof Clock3; label: string; value: string }) {
  return (
    <div className="min-w-0 rounded-md bg-slate-50 p-4">
      <div className="flex items-center gap-2 text-slate-500">
        {Icon ? <Icon className="h-4 w-4" /> : null}
        <p className="text-xs font-semibold uppercase">{label}</p>
      </div>
      <p className="mt-2 break-words text-sm font-medium text-slate-950">{value}</p>
    </div>
  );
}

function LoadingLine({ label }: { label: string }) {
  return (
    <p className="mt-3 inline-flex items-center gap-2 text-sm text-slate-500">
      <Loader2 className="h-4 w-4 animate-spin" />
      {label}
    </p>
  );
}

function PhotoGroup({ title, photos, onOpen }: { title: string; photos: string[]; onOpen: (index: number) => void }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-semibold text-slate-700">{title}</p>
        <span className="text-xs font-medium text-slate-500">{photos.length}</span>
      </div>
      <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {photos.map((photoUrl, index) => (
          <button
            key={`${photoUrl}-${index}`}
            type="button"
            onClick={() => onOpen(index)}
            className="group relative aspect-[3/4] overflow-hidden rounded-md bg-slate-100 ring-1 ring-slate-200 transition hover:ring-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400"
            aria-label={`Open ${title.toLowerCase()} ${index + 1}`}
          >
            <img src={photoUrl} alt={`${title} ${index + 1}`} className="h-full w-full object-cover transition duration-200 group-hover:scale-[1.02]" loading="lazy" />
            <span className="absolute bottom-2 right-2 rounded-full bg-slate-950/75 px-2 py-1 text-xs font-semibold text-white">{index + 1}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
