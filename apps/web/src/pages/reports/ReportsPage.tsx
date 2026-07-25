import { Download, FileText, Loader2, Plus, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { zipSync } from "fflate";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { ConfirmationDialog } from "../../components/common/confirmation-dialog";
import { PageHeader } from "../../components/common/page-header";
import { SectionTitle } from "../../components/common/section-title";
import { notify } from "../../components/common/toast";
import { useSession } from "../../hooks/use-session";
import { getCompanySettings } from "../../services/company-service";
import { listAssignableMembers } from "../../services/assignments-service";
import { listDuties, type DutyItem } from "../../services/duties-service";
import { getCurrentProfile } from "../../services/profile-service";
import { createServiceReport, deleteServiceReport, listServiceReports, type ServiceReportItem, type ServiceReportSnapshot } from "../../services/reports-service";
import { listSites } from "../../services/sites-service";

type DateRange = {
  dateFrom: string;
  dateTo: string;
  timeFrom?: string;
  timeTo?: string;
};

type MediaItem = {
  id: string;
  dutyTitle: string;
  type: "Before" | "After";
  url: string;
};

type PreparedMediaFile = {
  id: string;
  file: File;
};

function todayValue() {
  return new Date().toISOString().slice(0, 10);
}

function isInRange(dateValue: string | null, range: DateRange) {
  if (!dateValue) {
    return false;
  }

  const date = new Date(dateValue);
  const from = new Date(`${range.dateFrom}T${range.timeFrom ?? "00:00"}:00`);
  const to = new Date(`${range.dateTo}T${range.timeTo ?? "23:59"}:59`);
  return date >= from && date <= to;
}

function isValidDateRange(range: DateRange) {
  if (!range.dateFrom || !range.dateTo || !range.timeFrom || !range.timeTo) {
    return false;
  }

  const from = new Date(`${range.dateFrom}T${range.timeFrom}:00`);
  const to = new Date(`${range.dateTo}T${range.timeTo}:59`);
  return !Number.isNaN(from.getTime()) && !Number.isNaN(to.getTime()) && from <= to;
}

function formatReportRange(snapshot: Pick<ServiceReportSnapshot, "dateFrom" | "dateTo" | "timeFrom" | "timeTo">) {
  const from = snapshot.timeFrom ? `${snapshot.dateFrom} ${snapshot.timeFrom}` : snapshot.dateFrom;
  const to = snapshot.timeTo ? `${snapshot.dateTo} ${snapshot.timeTo}` : snapshot.dateTo;
  return from === to ? from : `${from} / ${to}`;
}

function dutyMatchesRange(duty: DutyItem, range: DateRange) {
  return isInRange(duty.dueDate, range) || isInRange(duty.updatedAt, range) || isInRange(duty.createdAt, range);
}

function isCompletedReportDuty(duty: { status: string }) {
  return duty.status === "Completed" || duty.status === "Archived";
}

function cleanerAssignmentText(assignedCleanerNames: string[] | undefined) {
  if (!assignedCleanerNames) {
    return "Not recorded";
  }

  return assignedCleanerNames.length > 0 ? assignedCleanerNames.join(", ") : "Unassigned";
}

function reportDescriptionPreview(description: string) {
  const trimmedDescription = description.trim();
  const firstPeriodIndex = trimmedDescription.indexOf(".");

  return firstPeriodIndex === -1
    ? trimmedDescription
    : trimmedDescription.slice(0, firstPeriodIndex + 1);
}

function mediaFromDuties(duties: DutyItem[]) {
  return duties.flatMap((duty) => [
    ...duty.beforePhotos.map((url, index) => ({ id: `${duty.id}-before-${index}`, dutyTitle: duty.title, type: "Before" as const, url })),
    ...duty.afterPhotos.map((url, index) => ({ id: `${duty.id}-after-${index}`, dutyTitle: duty.title, type: "After" as const, url })),
  ]);
}

function safeFileName(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase()
    .slice(0, 80) || "duty";
}

function imageExtension(blob: Blob, url: string) {
  const extensionsByMimeType: Record<string, string> = {
    "image/gif": "gif",
    "image/heic": "heic",
    "image/heif": "heif",
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
  };

  if (extensionsByMimeType[blob.type]) {
    return extensionsByMimeType[blob.type];
  }

  const pathExtension = new URL(url).pathname.match(/\.([a-z0-9]{2,5})$/i)?.[1];
  return pathExtension?.toLowerCase() || "jpg";
}

async function prepareMediaFile(item: MediaItem, index: number, signal: AbortSignal) {
  const response = await fetch(item.url, { signal });

  if (!response.ok) {
    throw new Error(`Could not load ${item.type.toLowerCase()} photo for ${item.dutyTitle}.`);
  }

  const blob = await response.blob();
  const sequence = String(index + 1).padStart(3, "0");
  const fileName = `${sequence}-${item.type.toLowerCase()}-${safeFileName(item.dutyTitle)}.${imageExtension(blob, item.url)}`;
  return new File([blob], fileName, { type: blob.type || "image/jpeg" });
}

function isMobileDevice() {
  return window.matchMedia("(pointer: coarse)").matches || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export function ReportsPage() {
  const queryClient = useQueryClient();
  const { companyId, userId, activeSiteId } = useSession();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isMediaOpen, setIsMediaOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<ServiceReportItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ServiceReportItem | null>(null);
  const [range, setRange] = useState<DateRange>({ dateFrom: todayValue(), dateTo: todayValue(), timeFrom: "00:00", timeTo: "23:59" });
  const [mediaRange, setMediaRange] = useState<DateRange>({ dateFrom: todayValue(), dateTo: todayValue() });
  const [selectedMediaIds, setSelectedMediaIds] = useState<string[]>([]);
  const [preparedMediaFiles, setPreparedMediaFiles] = useState<PreparedMediaFile[]>([]);
  const [isPreparingMedia, setIsPreparingMedia] = useState(false);
  const [isDownloadingMedia, setIsDownloadingMedia] = useState(false);
  const [mediaPreparationError, setMediaPreparationError] = useState<string | null>(null);

  const { data: company } = useQuery({
    queryKey: ["company-settings", companyId],
    queryFn: () => getCompanySettings(companyId ?? ""),
    enabled: Boolean(companyId),
  });
  const { data: profile } = useQuery({
    queryKey: ["reports-profile", userId],
    queryFn: () => getCurrentProfile(userId ?? ""),
    enabled: Boolean(userId),
  });
  const { data: sites = [] } = useQuery({
    queryKey: ["reports-sites", companyId],
    queryFn: () => listSites(companyId ?? ""),
    enabled: Boolean(companyId),
  });
  const activeSite = sites.find((site) => site.id === activeSiteId) ?? sites[0] ?? null;
  const { data: reports = [] } = useQuery({
    queryKey: ["service-reports", companyId],
    queryFn: () => listServiceReports(companyId ?? ""),
    enabled: Boolean(companyId),
  });
  const { data: duties = [] } = useQuery({
    queryKey: ["reports-duties", activeSite?.id],
    queryFn: () => listDuties(activeSite?.id ?? ""),
    enabled: Boolean(activeSite?.id),
  });

  const mediaItems = useMemo(() => mediaFromDuties(duties.filter((duty) => dutyMatchesRange(duty, mediaRange))), [duties, mediaRange]);

  useEffect(() => {
    if (!isMediaOpen || mediaItems.length === 0) {
      setPreparedMediaFiles([]);
      setIsPreparingMedia(false);
      setMediaPreparationError(null);
      return;
    }

    const controller = new AbortController();
    setPreparedMediaFiles([]);
    setIsPreparingMedia(true);
    setMediaPreparationError(null);

    Promise.all(mediaItems.map(async (item, index) => ({
      id: item.id,
      file: await prepareMediaFile(item, index, controller.signal),
    })))
      .then((files) => setPreparedMediaFiles(files))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setMediaPreparationError(error instanceof Error ? error.message : "Could not prepare the selected photos.");
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsPreparingMedia(false);
        }
      });

    return () => controller.abort();
  }, [isMediaOpen, mediaItems]);

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!companyId || !userId || !company || !profile) {
        throw new Error("Missing report context");
      }

      if (!isValidDateRange(range)) {
        throw new Error("Choose a valid report start and end time.");
      }

      const rangedDuties = duties.filter((duty) => dutyMatchesRange(duty, range));
      const reportDuties = rangedDuties.filter(isCompletedReportDuty);
      const siteMembers = activeSite ? await listAssignableMembers(activeSite.id) : [];
      const cleanerNamesById = new Map(
        siteMembers
          .filter((member) => member.role === "Cleaner")
          .map((member) => [member.id, member.name]),
      );
      const snapshot: ServiceReportSnapshot = {
        companyName: company.name,
        companyLogoUrl: company.logoUrl,
        siteName: activeSite?.name ?? null,
        preparedBy: profile.full_name,
        dateFrom: range.dateFrom,
        dateTo: range.dateTo,
        timeFrom: range.timeFrom,
        timeTo: range.timeTo,
        generatedAt: new Date().toISOString(),
        completedCount: reportDuties.length,
        totalCount: rangedDuties.length,
        duties: reportDuties.map((duty) => ({
          id: duty.id,
          title: duty.title,
          description: duty.description,
          assignedCleanerNames: duty.assignedUserIds.flatMap((profileId) => {
            const cleanerName = cleanerNamesById.get(profileId);
            return cleanerName ? [cleanerName] : [];
          }),
          status: duty.status,
          dueDate: duty.dueDate,
          beforePhotos: duty.beforePhotos,
          afterPhotos: duty.afterPhotos,
        })),
      };

      const title = `${activeSite?.name ?? company.name} - Service Report`;
      return createServiceReport({
        companyId,
        siteId: activeSite?.id ?? null,
        createdBy: userId,
        title,
        dateFrom: range.dateFrom,
        dateTo: range.dateTo,
        snapshot,
      });
    },
    onSuccess: async (report) => {
      await queryClient.invalidateQueries({ queryKey: ["service-reports", companyId] });
      setSelectedReport(report);
      setIsCreateOpen(false);
      notify({ tone: "success", title: "Report created", message: "The service report is ready." });
    },
    onError: (error) => notify({ tone: "error", title: "Could not create report", message: error instanceof Error ? error.message : "Unknown error" }),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteServiceReport,
    onSuccess: async (_data, reportId) => {
      await queryClient.invalidateQueries({ queryKey: ["service-reports", companyId] });
      setDeleteTarget(null);
      setSelectedReport((current) => current?.id === reportId ? null : current);
      notify({ tone: "success", title: "Report deleted", message: "The report was removed successfully." });
    },
    onError: (error) => notify({ tone: "error", title: "Could not delete report", message: error instanceof Error ? error.message : "Unknown error" }),
  });

  function openMediaDialog() {
    setSelectedMediaIds(mediaItems.map((item) => item.id));
    setIsMediaOpen(true);
  }

  async function downloadSelectedMedia() {
    const selectedFiles = preparedMediaFiles
      .filter((item) => selectedMediaIds.includes(item.id))
      .map((item) => item.file);

    if (selectedFiles.length !== selectedMediaIds.length) {
      notify({ tone: "error", title: "Photos not ready", message: mediaPreparationError ?? "Wait for the selected photos to finish preparing." });
      return;
    }

    setIsDownloadingMedia(true);

    try {
      if (isMobileDevice() && navigator.share && navigator.canShare?.({ files: selectedFiles })) {
        await navigator.share({ files: selectedFiles, title: "Cleaning Duties photos" });
        setIsMediaOpen(false);
        notify({ tone: "success", title: "Photos ready", message: "The selected photos were sent to your device." });
        return;
      }

      const archiveEntries: Record<string, Uint8Array> = {};
      const fileContents = await Promise.all(selectedFiles.map((file) => file.arrayBuffer()));
      selectedFiles.forEach((file, index) => {
        archiveEntries[file.name] = new Uint8Array(fileContents[index]!);
      });

      const archive = zipSync(archiveEntries, { level: 0 });
      const archiveBlob = new Blob([archive], { type: "application/zip" });
      const archiveUrl = URL.createObjectURL(archiveBlob);
      const link = document.createElement("a");
      link.href = archiveUrl;
      link.download = `cleaning-duty-photos-${mediaRange.dateFrom}-to-${mediaRange.dateTo}.zip`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(archiveUrl), 1000);
      setIsMediaOpen(false);
      notify({ tone: "success", title: "Download ready", message: `${selectedFiles.length} photos were saved in one ZIP file.` });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }

      notify({ tone: "error", title: "Could not save photos", message: error instanceof Error ? error.message : "Unknown error" });
    } finally {
      setIsDownloadingMedia(false);
    }
  }

  function downloadReportPdf(report: ServiceReportItem) {
    const printWindow = window.open("about:blank", "_blank");

    if (!printWindow) {
      notify({ tone: "error", title: "Could not open PDF", message: "Allow pop-ups and try again." });
      return;
    }

    printWindow.document.open();
    printWindow.document.write(buildReportPrintHtml(report));
    printWindow.document.close();
    printWindow.focus();
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Reports"
        title="Service reports"
        description="Create site service reports and download cleaner media by date range."
        actions={(
          <>
            <Button variant="secondary" onClick={openMediaDialog}>
              <Download className="h-4 w-4" />
              Download media
            </Button>
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="h-4 w-4" />
              Create report
            </Button>
          </>
        )}
      />

      <div className="grid gap-4 xl:grid-cols-[0.8fr_1.2fr]">
        <Card className="space-y-4 p-5">
          <SectionTitle title="Created reports" description={`${reports.length} reports saved.`} />
          {reports.length === 0 ? (
            <p className="text-sm text-slate-500">No reports created yet.</p>
          ) : (
            <div className="space-y-3">
              {reports.map((report) => (
                <div
                  key={report.id}
                  className="flex items-start gap-3 rounded-md border border-slate-200 bg-slate-50 p-4 transition hover:bg-white"
                >
                  <button
                    type="button"
                    onClick={() => setSelectedReport(report)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="font-semibold text-slate-950">{report.title}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {formatReportRange(report.snapshot)} · {new Date(report.createdAt).toLocaleString()}
                    </p>
                  </button>
                  <div className="flex shrink-0 items-center gap-1">
                    <button
                      type="button"
                      onClick={() => downloadReportPdf(report)}
                      className="rounded-md p-2 text-slate-500 transition hover:bg-white hover:text-slate-950"
                      aria-label={`Download ${report.title} as PDF`}
                      title="Download PDF"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(report)}
                      className="rounded-md p-2 text-slate-500 transition hover:bg-red-50 hover:text-red-600"
                      aria-label={`Delete ${report.title}`}
                      title="Delete report"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <ReportPreview report={selectedReport ?? reports[0] ?? null} />
      </div>

      {isCreateOpen ? (
        <DateRangeDialog
          title="Create report"
          range={range}
          onRangeChange={setRange}
          confirmLabel={createMutation.isPending ? "Creating..." : "Create report"}
          onCancel={() => setIsCreateOpen(false)}
          onConfirm={() => createMutation.mutate()}
          isPending={createMutation.isPending}
        />
      ) : null}

      {isMediaOpen ? (
        <MediaDialog
          range={mediaRange}
          onRangeChange={(nextRange) => {
            setMediaRange(nextRange);
            const nextItems = mediaFromDuties(duties.filter((duty) => dutyMatchesRange(duty, nextRange)));
            setSelectedMediaIds(nextItems.map((item) => item.id));
          }}
          items={mediaItems}
          selectedIds={selectedMediaIds}
          isPreparing={isPreparingMedia}
          isDownloading={isDownloadingMedia}
          preparationError={mediaPreparationError}
          onToggle={(id) => setSelectedMediaIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])}
          onCancel={() => setIsMediaOpen(false)}
          onDownload={downloadSelectedMedia}
        />
      ) : null}

      {deleteTarget ? (
        <ConfirmationDialog
          title={`Delete ${deleteTarget.title}?`}
          description="This report will be permanently removed from the saved reports list."
          confirmLabel={deleteMutation.isPending ? "Deleting..." : "Delete report"}
          destructive
          onCancel={() => setDeleteTarget(null)}
          onConfirm={async () => {
            await deleteMutation.mutateAsync(deleteTarget.id);
          }}
        />
      ) : null}
    </div>
  );
}

function escapeHtml(value: string | null | undefined) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return entities[character] ?? character;
  });
}

function buildReportPrintHtml(report: ServiceReportItem) {
  const snapshot = report.snapshot;
  const score = snapshot.totalCount > 0 ? Math.round((snapshot.completedCount / snapshot.totalCount) * 100) : 0;
  const reportDate = formatReportRange(snapshot);
  const completedDuties = snapshot.duties.filter(isCompletedReportDuty);
  const dutiesHtml = completedDuties.length === 0
    ? `<p class="muted">No completed duties found for this date range.</p>`
    : completedDuties.map((duty) => {
      const photoColumn = (title: string, photos: string[]) => `
        <div class="photo-section">
          <p class="photo-title">${title}</p>
          ${photos.length === 0
            ? `<div class="empty-photo">${title}: no photos uploaded.</div>`
            : `<div class="photos">${photos.map((photo) => `<img src="${escapeHtml(photo)}" alt="" />`).join("")}</div>`}
        </div>
      `;

      return `
        <section class="duty">
          <h3>${escapeHtml(duty.title)}</h3>
          <p class="cleaners"><strong>Cleaners:</strong> ${escapeHtml(cleanerAssignmentText(duty.assignedCleanerNames))}</p>
          ${duty.description ? `<p class="description">${escapeHtml(reportDescriptionPreview(duty.description))}</p>` : ""}
          ${duty.beforePhotos.length || duty.afterPhotos.length ? `
            <div class="photo-grid">
              ${photoColumn("Before", duty.beforePhotos)}
              ${photoColumn("After", duty.afterPhotos)}
            </div>
          ` : ""}
        </section>
      `;
    }).join("");

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>${escapeHtml(report.title)}</title>
        <style>
          * { box-sizing: border-box; }
          body { margin: 0; background: #f1f5f9; color: #0f172a; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
          .page { width: min(100%, 920px); margin: 0 auto; background: #fff; padding: 48px; min-height: 100vh; }
          .top { display: flex; justify-content: space-between; gap: 24px; color: #475569; font-size: 13px; font-weight: 700; }
          .brand { margin-top: 56px; }
          .logo { max-height: 96px; max-width: 320px; object-fit: contain; }
          h1 { margin: 32px 0 0; max-width: 720px; font-size: 42px; line-height: 1.12; letter-spacing: 0; }
          .meta { margin-top: 28px; display: flex; justify-content: space-between; gap: 24px; color: #475569; font-size: 22px; }
          .complete { color: #047857; font-weight: 800; }
          .rows { margin-top: 40px; border-top: 1px solid #cbd5e1; border-bottom: 1px solid #cbd5e1; }
          .row { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; padding: 18px 0; border-bottom: 1px solid #e2e8f0; font-size: 18px; }
          .row:last-child { border-bottom: 0; }
          .row strong { font-weight: 800; }
          .row span { text-align: right; color: #475569; }
          .section-title { margin-top: 56px; font-size: 28px; }
          .duty { break-inside: avoid; margin-top: 24px; border: 1px solid #e2e8f0; border-radius: 6px; padding: 20px; }
          .duty h3 { margin: 0; font-size: 20px; }
          .cleaners { margin: 8px 0 0; color: #64748b; font-size: 14px; }
          .description { margin: 12px 0 0; color: #475569; }
          .photo-grid { display: grid; grid-template-columns: 1fr; gap: 24px; margin-top: 18px; }
          .photo-title { margin: 0 0 8px; color: #475569; font-size: 13px; font-weight: 800; }
          .photos { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; }
          .photos img { width: 100%; height: 220px; border-radius: 6px; object-fit: cover; }
          .empty-photo { border-radius: 6px; background: #f8fafc; padding: 12px; color: #64748b; font-size: 13px; }
          .muted { color: #64748b; }
          @media print {
            body { background: #fff; }
            .page { width: 100%; padding: 28px; }
          }
        </style>
      </head>
      <body>
        <main class="page">
          <div class="top">
            <p>${escapeHtml(snapshot.companyName)}${snapshot.siteName ? ` - ${escapeHtml(snapshot.siteName)}` : ""}</p>
            <p>${escapeHtml(new Date(snapshot.generatedAt).toLocaleString())}</p>
          </div>
          <section class="brand">
            ${snapshot.companyLogoUrl ? `<img class="logo" src="${escapeHtml(snapshot.companyLogoUrl)}" alt="${escapeHtml(snapshot.companyName)} logo" />` : `<h2>${escapeHtml(snapshot.companyName)}</h2>`}
            <h1>${escapeHtml(snapshot.siteName ?? snapshot.companyName)} - Cleaning Service Report</h1>
            <div class="meta">
              <p>${escapeHtml(reportDate)} / ${escapeHtml(snapshot.preparedBy)}</p>
              <p class="complete">Complete</p>
            </div>
          </section>
          <section class="rows">
            <div class="row"><strong>Score</strong><span>${snapshot.completedCount} / ${snapshot.totalCount} (${score}%)</span></div>
            <div class="row"><strong>Conducted on</strong><span>${escapeHtml(new Date(snapshot.generatedAt).toLocaleString())}</span></div>
            <div class="row"><strong>Prepared by</strong><span>${escapeHtml(snapshot.preparedBy)}</span></div>
          </section>
          <h2 class="section-title">Services performed</h2>
          ${dutiesHtml}
        </main>
        <script>
          function waitForImages() {
            var images = Array.prototype.slice.call(document.images || []);

            if (images.length === 0) {
              return Promise.resolve();
            }

            return Promise.all(images.map(function(image) {
              if (image.complete) {
                return Promise.resolve();
              }

              return new Promise(function(resolve) {
                var timeout = window.setTimeout(resolve, 4000);
                image.addEventListener("load", function() {
                  window.clearTimeout(timeout);
                  resolve();
                }, { once: true });
                image.addEventListener("error", function() {
                  window.clearTimeout(timeout);
                  resolve();
                }, { once: true });
              });
            }));
          }

          window.addEventListener("load", function() {
            waitForImages().then(function() {
              window.setTimeout(function() {
                window.focus();
                window.print();
              }, 250);
            });
          });
        </script>
      </body>
    </html>
  `;
}

function DateRangeDialog(props: {
  title: string;
  range: DateRange;
  confirmLabel: string;
  isPending?: boolean;
  onRangeChange: (range: DateRange) => void;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
      <Card className="w-full max-w-lg space-y-5 p-5">
        <div className="flex items-start justify-between gap-4">
          <SectionTitle title={props.title} description="Choose the start and end date and time for this report." />
          <button type="button" onClick={props.onCancel} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <DateInput label="From date" value={props.range.dateFrom} onChange={(dateFrom) => props.onRangeChange({ ...props.range, dateFrom })} />
          <TimeInput label="From time" value={props.range.timeFrom ?? ""} onChange={(timeFrom) => props.onRangeChange({ ...props.range, timeFrom })} />
          <DateInput label="To date" value={props.range.dateTo} onChange={(dateTo) => props.onRangeChange({ ...props.range, dateTo })} />
          <TimeInput label="To time" value={props.range.timeTo ?? ""} onChange={(timeTo) => props.onRangeChange({ ...props.range, timeTo })} />
        </div>
        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={props.onCancel} disabled={props.isPending}>Cancel</Button>
          <Button type="button" onClick={props.onConfirm} disabled={props.isPending || !isValidDateRange(props.range)}>
            {props.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            {props.confirmLabel}
          </Button>
        </div>
      </Card>
    </div>
  );
}

function DateInput(props: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-medium text-slate-700">{props.label}</span>
      <input type="date" value={props.value} onChange={(event) => props.onChange(event.target.value)} className="w-full rounded-md border border-slate-200 bg-white px-4 py-3 text-sm outline-none" />
    </label>
  );
}

function TimeInput(props: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="space-y-2">
      <span className="text-sm font-medium text-slate-700">{props.label}</span>
      <input type="time" value={props.value} onChange={(event) => props.onChange(event.target.value)} className="w-full rounded-md border border-slate-200 bg-white px-4 py-3 text-sm outline-none" />
    </label>
  );
}

function ReportPreview({ report }: { report: ServiceReportItem | null }) {
  if (!report) {
    return (
      <Card className="p-8 text-center">
        <p className="text-lg font-semibold text-slate-950">No report selected</p>
        <p className="mt-2 text-sm text-slate-500">Create or select a report to preview it here.</p>
      </Card>
    );
  }

  const snapshot = report.snapshot;
  const score = snapshot.totalCount > 0 ? Math.round((snapshot.completedCount / snapshot.totalCount) * 100) : 0;
  const completedDuties = snapshot.duties.filter(isCompletedReportDuty);

  return (
    <Card className="overflow-hidden p-0">
      <div className="bg-white p-8 text-slate-950">
        <div className="flex items-start justify-between gap-6 text-sm font-semibold text-slate-600">
          <p>{snapshot.companyName}{snapshot.siteName ? ` - ${snapshot.siteName}` : ""}</p>
          <p>{new Date(snapshot.generatedAt).toLocaleString()}</p>
        </div>
        <div className="mt-12">
          {snapshot.companyLogoUrl ? (
            <img src={snapshot.companyLogoUrl} alt={`${snapshot.companyName} logo`} className="max-h-24 max-w-xs object-contain" />
          ) : (
            <p className="text-4xl font-bold tracking-tight">{snapshot.companyName}</p>
          )}
          <h2 className="mt-8 max-w-2xl text-4xl font-bold tracking-tight">
            {snapshot.siteName ?? snapshot.companyName} - Cleaning Service Report
          </h2>
          <div className="mt-8 flex flex-wrap items-center justify-between gap-4 text-xl text-slate-600">
            <p>{formatReportRange(snapshot)} / {snapshot.preparedBy}</p>
            <p className="font-bold text-emerald-700">Complete</p>
          </div>
        </div>

        <div className="mt-10 divide-y divide-slate-200 border-y border-slate-200 text-lg">
          <ReportRow label="Score" value={`${snapshot.completedCount} / ${snapshot.totalCount} (${score}%)`} />
          <ReportRow label="Conducted on" value={new Date(snapshot.generatedAt).toLocaleString()} />
          <ReportRow label="Prepared by" value={snapshot.preparedBy} />
        </div>

        <div className="mt-12">
          <h3 className="text-2xl font-bold tracking-tight">Services performed</h3>
          <div className="mt-6 space-y-6">
            {completedDuties.length === 0 ? (
              <p className="text-slate-500">No completed duties found for this date range.</p>
            ) : (
              completedDuties.map((duty) => (
                <div key={duty.id} className="rounded-md border border-slate-200 p-5">
                  <p className="text-lg font-bold text-slate-950">{duty.title}</p>
                  <p className="mt-2 text-sm text-slate-500">
                    <span className="font-semibold text-slate-700">Cleaners:</span> {cleanerAssignmentText(duty.assignedCleanerNames)}
                  </p>
                  {duty.description ? <p className="mt-3 text-slate-600">{reportDescriptionPreview(duty.description)}</p> : null}
                  {duty.beforePhotos.length || duty.afterPhotos.length ? (
                    <div className="mt-4 space-y-6">
                      <PhotoStrip title="Before" photos={duty.beforePhotos} />
                      <PhotoStrip title="After" photos={duty.afterPhotos} />
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}

function ReportRow(props: { label: string; value: string }) {
  return (
    <div className="grid gap-3 py-5 md:grid-cols-2">
      <p className="font-bold">{props.label}</p>
      <p className="text-right text-slate-600">{props.value}</p>
    </div>
  );
}

function PhotoStrip({ title, photos }: { title: string; photos: string[] }) {
  if (photos.length === 0) {
    return <div className="rounded-md bg-slate-50 p-4 text-sm text-slate-500">{title}: no photos uploaded.</div>;
  }

  return (
    <div>
      <p className="mb-2 text-sm font-bold text-slate-600">{title}</p>
      <div className="grid grid-cols-2 gap-3">
        {photos.map((photo) => (
          <img key={photo} src={photo} alt="" className="h-48 w-full rounded-md object-cover" />
        ))}
      </div>
    </div>
  );
}

function MediaDialog(props: {
  range: DateRange;
  items: MediaItem[];
  selectedIds: string[];
  isPreparing: boolean;
  isDownloading: boolean;
  preparationError: string | null;
  onRangeChange: (range: DateRange) => void;
  onToggle: (id: string) => void;
  onCancel: () => void;
  onDownload: () => Promise<void>;
}) {
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
      <Card className="max-h-[90vh] w-full max-w-4xl space-y-5 overflow-y-auto p-5">
        <div className="flex items-start justify-between gap-4">
          <SectionTitle title="Download media" description="Choose a date range, then deselect any photos you do not want to download." />
          <button type="button" onClick={props.onCancel} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <DateInput label="From" value={props.range.dateFrom} onChange={(dateFrom) => props.onRangeChange({ ...props.range, dateFrom })} />
          <DateInput label="To" value={props.range.dateTo} onChange={(dateTo) => props.onRangeChange({ ...props.range, dateTo })} />
        </div>
        {props.items.length === 0 ? (
          <p className="rounded-md bg-slate-50 p-4 text-sm text-slate-500">No cleaner photos found for this range.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {props.items.map((item) => {
              const selected = props.selectedIds.includes(item.id);
              return (
                <label key={item.id} className={`cursor-pointer overflow-hidden rounded-md border ${selected ? "border-slate-900" : "border-slate-200"} bg-white`}>
                  <img src={item.url} alt="" className="h-36 w-full object-cover" />
                  <div className="flex items-start gap-3 p-3">
                    <input type="checkbox" checked={selected} onChange={() => props.onToggle(item.id)} />
                    <div>
                      <p className="text-sm font-semibold text-slate-950">{item.type}</p>
                      <p className="mt-1 text-xs text-slate-500">{item.dutyTitle}</p>
                    </div>
                  </div>
                </label>
              );
            })}
          </div>
        )}
        {props.preparationError ? <p className="text-sm font-medium text-red-600">{props.preparationError}</p> : null}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={props.onCancel} disabled={props.isDownloading}>Cancel</Button>
          <Button type="button" onClick={() => void props.onDownload()} disabled={props.selectedIds.length === 0 || props.isPreparing || props.isDownloading || Boolean(props.preparationError)}>
            {props.isPreparing || props.isDownloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
            {props.isPreparing ? "Preparing..." : props.isDownloading ? "Saving..." : "Download"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
