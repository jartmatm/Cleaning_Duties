import { Download, FileText, Loader2, Plus, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { ConfirmationDialog } from "../../components/common/confirmation-dialog";
import { PageHeader } from "../../components/common/page-header";
import { SectionTitle } from "../../components/common/section-title";
import { notify } from "../../components/common/toast";
import { useSession } from "../../hooks/use-session";
import { getCompanySettings } from "../../services/company-service";
import { listDuties, type DutyItem } from "../../services/duties-service";
import { getCurrentProfile } from "../../services/profile-service";
import { createServiceReport, deleteServiceReport, listServiceReports, type ServiceReportItem, type ServiceReportSnapshot } from "../../services/reports-service";
import { listSites } from "../../services/sites-service";

type DateRange = {
  dateFrom: string;
  dateTo: string;
};

type MediaItem = {
  id: string;
  dutyTitle: string;
  type: "Before" | "After";
  url: string;
};

function todayValue() {
  return new Date().toISOString().slice(0, 10);
}

function isInRange(dateValue: string | null, range: DateRange) {
  if (!dateValue) {
    return false;
  }

  const date = new Date(dateValue);
  const from = new Date(`${range.dateFrom}T00:00:00`);
  const to = new Date(`${range.dateTo}T23:59:59`);
  return date >= from && date <= to;
}

function dutyMatchesRange(duty: DutyItem, range: DateRange) {
  return isInRange(duty.dueDate, range) || isInRange(duty.updatedAt, range) || isInRange(duty.createdAt, range);
}

function mediaFromDuties(duties: DutyItem[]) {
  return duties.flatMap((duty) => [
    ...duty.beforePhotos.map((url, index) => ({ id: `${duty.id}-before-${index}`, dutyTitle: duty.title, type: "Before" as const, url })),
    ...duty.afterPhotos.map((url, index) => ({ id: `${duty.id}-after-${index}`, dutyTitle: duty.title, type: "After" as const, url })),
  ]);
}

export function ReportsPage() {
  const queryClient = useQueryClient();
  const { companyId, userId, activeSiteId } = useSession();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isMediaOpen, setIsMediaOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<ServiceReportItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ServiceReportItem | null>(null);
  const [range, setRange] = useState<DateRange>({ dateFrom: todayValue(), dateTo: todayValue() });
  const [mediaRange, setMediaRange] = useState<DateRange>({ dateFrom: todayValue(), dateTo: todayValue() });
  const [selectedMediaIds, setSelectedMediaIds] = useState<string[]>([]);

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

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!companyId || !userId || !company || !profile) {
        throw new Error("Missing report context");
      }

      const reportDuties = duties.filter((duty) => dutyMatchesRange(duty, range));
      const snapshot: ServiceReportSnapshot = {
        companyName: company.name,
        companyLogoUrl: company.logoUrl,
        siteName: activeSite?.name ?? null,
        preparedBy: profile.full_name,
        dateFrom: range.dateFrom,
        dateTo: range.dateTo,
        generatedAt: new Date().toISOString(),
        completedCount: reportDuties.filter((duty) => duty.status === "Completed" || duty.status === "Archived").length,
        totalCount: reportDuties.length,
        duties: reportDuties.map((duty) => ({
          id: duty.id,
          title: duty.title,
          description: duty.description,
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

  function downloadSelectedMedia() {
    const selectedItems = mediaItems.filter((item) => selectedMediaIds.includes(item.id));
    selectedItems.forEach((item, index) => {
      window.setTimeout(() => {
        const link = document.createElement("a");
        link.href = item.url;
        link.download = `${item.type.toLowerCase()}-${item.dutyTitle.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${index + 1}`;
        link.target = "_blank";
        document.body.appendChild(link);
        link.click();
        link.remove();
      }, index * 150);
    });
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
                      {report.dateFrom} to {report.dateTo} · {new Date(report.createdAt).toLocaleString()}
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
  const reportDate = snapshot.dateFrom === snapshot.dateTo ? snapshot.dateFrom : `${snapshot.dateFrom} / ${snapshot.dateTo}`;
  const dutiesHtml = snapshot.duties.length === 0
    ? `<p class="muted">No duties found for this date range.</p>`
    : snapshot.duties.map((duty) => {
      const photoColumn = (title: string, photos: string[]) => `
        <div>
          <p class="photo-title">${title}</p>
          ${photos.length === 0
            ? `<div class="empty-photo">${title}: no photos uploaded.</div>`
            : `<div class="photos">${photos.map((photo) => `<img src="${escapeHtml(photo)}" alt="" />`).join("")}</div>`}
        </div>
      `;

      return `
        <section class="duty">
          <div class="duty-head">
            <h3>${escapeHtml(duty.title)}</h3>
            <p>${escapeHtml(duty.status)}</p>
          </div>
          ${duty.description ? `<p class="description">${escapeHtml(duty.description)}</p>` : ""}
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
          .duty-head { display: flex; justify-content: space-between; gap: 16px; align-items: center; }
          .duty h3 { margin: 0; font-size: 20px; }
          .duty-head p { margin: 0; color: #64748b; font-weight: 700; }
          .description { margin: 12px 0 0; color: #475569; }
          .photo-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 18px; }
          .photo-title { margin: 0 0 8px; color: #475569; font-size: 13px; font-weight: 800; }
          .photos { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
          .photos img { width: 100%; height: 110px; border-radius: 6px; object-fit: cover; }
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
          <SectionTitle title={props.title} description="Choose a date range. Use the same date for a single-day report." />
          <button type="button" onClick={props.onCancel} className="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <DateInput label="From" value={props.range.dateFrom} onChange={(dateFrom) => props.onRangeChange({ ...props.range, dateFrom })} />
          <DateInput label="To" value={props.range.dateTo} onChange={(dateTo) => props.onRangeChange({ ...props.range, dateTo })} />
        </div>
        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={props.onCancel} disabled={props.isPending}>Cancel</Button>
          <Button type="button" onClick={props.onConfirm} disabled={props.isPending || !props.range.dateFrom || !props.range.dateTo}>
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
            <p>{snapshot.dateFrom === snapshot.dateTo ? snapshot.dateFrom : `${snapshot.dateFrom} / ${snapshot.dateTo}`} / {snapshot.preparedBy}</p>
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
            {snapshot.duties.length === 0 ? (
              <p className="text-slate-500">No duties found for this date range.</p>
            ) : (
              snapshot.duties.map((duty) => (
                <div key={duty.id} className="rounded-md border border-slate-200 p-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="text-lg font-bold">{duty.title}</p>
                    <p className="text-sm font-semibold text-slate-500">{duty.status}</p>
                  </div>
                  {duty.beforePhotos.length || duty.afterPhotos.length ? (
                    <div className="mt-4 grid gap-4 md:grid-cols-2">
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
      <div className="grid grid-cols-3 gap-2">
        {photos.map((photo) => (
          <img key={photo} src={photo} alt="" className="h-24 w-full rounded-md object-cover" />
        ))}
      </div>
    </div>
  );
}

function MediaDialog(props: {
  range: DateRange;
  items: MediaItem[];
  selectedIds: string[];
  onRangeChange: (range: DateRange) => void;
  onToggle: (id: string) => void;
  onCancel: () => void;
  onDownload: () => void;
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
        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={props.onCancel}>Cancel</Button>
          <Button type="button" onClick={props.onDownload} disabled={props.selectedIds.length === 0}>
            <Download className="h-4 w-4" />
            Download
          </Button>
        </div>
      </Card>
    </div>
  );
}
