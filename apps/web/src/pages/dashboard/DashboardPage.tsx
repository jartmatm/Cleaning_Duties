import { INCIDENT_TYPES, type IncidentType } from "@cleaning-duties/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Camera, CheckCircle2, CircleAlert, ClipboardList, ListTodo, Loader2, Send, Sparkles, X } from "lucide-react";
import { useMemo, useState, type ChangeEvent } from "react";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { PageHeader } from "../../components/common/page-header";
import { QuickActions } from "../../components/common/quick-actions";
import { SectionTitle } from "../../components/common/section-title";
import { StatCard } from "../../components/common/stat-card";
import { notify } from "../../components/common/toast";
import { useSession } from "../../hooks/use-session";
import { uploadDutyEvidencePhotos } from "../../services/duty-photo-service";
import { appendDutyEvidencePhotos, listAssignedDuties, listDuties, updateDutyStatus, type DutyItem } from "../../services/duties-service";
import { createIncident, listIncidentsForReporter } from "../../services/incidents-service";
import { listNotifications } from "../../services/notifications-service";
import { listSites, type SiteItem } from "../../services/sites-service";

type CleanerFilter = "pending" | "in-progress" | "completed" | "incidents";

const filterTitles: Record<CleanerFilter, string> = {
  pending: "Pending duties",
  "in-progress": "In progress duties",
  completed: "Completed duties",
  incidents: "Reported incidents",
};

function isPendingDuty(duty: DutyItem) {
  return duty.status === "Pending" || duty.status === "Draft" || duty.status === "Overdue";
}

function ManagerDashboard() {
  const { userId, companyId, companyName, activeSiteId } = useSession();
  const { data: sites = [] } = useQuery({
    queryKey: ["dashboard-sites", companyId],
    queryFn: () => listSites(companyId ?? ""),
    enabled: Boolean(companyId),
  });
  const activeSite = sites.find((site) => site.id === activeSiteId) ?? sites[0] ?? null;
  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications", userId],
    queryFn: () => listNotifications(userId ?? ""),
    enabled: Boolean(userId),
  });
  const { data: duties = [] } = useQuery({
    queryKey: ["dashboard-duties", activeSite?.id],
    queryFn: () => listDuties(activeSite?.id ?? ""),
    enabled: Boolean(activeSite?.id),
  });

  const reportRows = useMemo(
    () => [
      { label: "Completion rate", value: 92, color: "bg-emerald-500" },
      { label: "On-time duties", value: 87, color: "bg-sky-500" },
      { label: "Open incidents", value: 14, color: "bg-amber-500" },
      { label: "Cleaner coverage", value: 76, color: "bg-slate-900" },
    ],
    [],
  );

  return (
    <div className="space-y-8 fade-in">
      <PageHeader
        eyebrow="Dashboard"
        title={companyName ? `Good morning, ${companyName}` : "Good morning"}
        description={
          activeSite
            ? `Track today's workload for ${activeSite.name}, monitor overdue duties, and move quickly from assignment to completion.`
            : "Select a site to see workload, overdue duties, and live activity."
        }
        actions={
          <>
            <Button variant="secondary">View Reports</Button>
            <Button>Create Duty</Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Pending Duties" value={String(duties.filter((duty) => duty.status !== "Completed").length)} detail="Across the selected site" accent={<ListTodo className="h-5 w-5" />} />
        <StatCard label="Completed Today" value={String(duties.filter((duty) => duty.status === "Completed").length)} detail="For the active site" accent={<Sparkles className="h-5 w-5" />} />
        <StatCard label="Overdue" value={String(duties.filter((duty) => duty.status === "Overdue").length)} detail="Needs manager review" accent={<CircleAlert className="h-5 w-5" />} />
        <StatCard label="Incidents" value="2" detail="Open this week" accent={<Bell className="h-5 w-5" />} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="space-y-6 p-5">
          <SectionTitle title="Today's duties" description="The highest priority work across the active site." />
          <div className="space-y-3">
            {duties.length === 0 ? (
              <p className="text-sm text-slate-500">No duties for this site yet.</p>
            ) : (
              duties.slice(0, 3).map((item) => (
                <div key={item.id} className="flex flex-col gap-2 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-medium text-slate-950">{item.title}</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {item.priority} · {item.dueDate ? new Date(item.dueDate).toLocaleString() : "No due date"} · {item.status}
                    </p>
                  </div>
                  <Button variant="secondary">Open</Button>
                </div>
              ))
            )}
          </div>
        </Card>

        <div className="space-y-6">
          <QuickActions />
          <Card className="space-y-4 p-5">
            <SectionTitle title="Notifications" description="Unread alerts and duty updates." />
            <div className="space-y-3">
              {notifications.length === 0 ? (
                <p className="text-sm text-slate-500">No notifications yet.</p>
              ) : (
                notifications.map((notification) => (
                  <div key={notification.id} className="rounded-2xl bg-slate-50 p-4">
                    <p className="text-sm font-medium text-slate-950">{notification.type}</p>
                    <p className="mt-1 text-sm text-slate-500">{new Date(notification.createdAt).toLocaleString()}</p>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>

      <Card className="space-y-4 p-5">
        <SectionTitle title="Weekly reports" description="A quick operating view for managers and owners." />
        <div className="space-y-4">
          {reportRows.map((row) => (
            <div key={row.label} className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-slate-700">{row.label}</span>
                <span className="text-slate-500">{row.value}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                <div className={`h-full rounded-full ${row.color}`} style={{ width: `${row.value}%` }} />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function CleanerDashboard() {
  const queryClient = useQueryClient();
  const { userId, companyId, companyName } = useSession();
  const [activeFilter, setActiveFilter] = useState<CleanerFilter>("pending");
  const [selectedDuty, setSelectedDuty] = useState<DutyItem | null>(null);
  const [isIncidentOpen, setIsIncidentOpen] = useState(false);

  const { data: sites = [] } = useQuery({
    queryKey: ["cleaner-sites", companyId],
    queryFn: () => listSites(companyId ?? ""),
    enabled: Boolean(companyId),
  });
  const siteById = useMemo(() => new Map(sites.map((site) => [site.id, site])), [sites]);

  const { data: duties = [], isLoading: isLoadingDuties } = useQuery({
    queryKey: ["cleaner-assigned-duties", userId],
    queryFn: () => listAssignedDuties(userId ?? ""),
    enabled: Boolean(userId),
  });

  const { data: incidents = [] } = useQuery({
    queryKey: ["cleaner-incidents", userId],
    queryFn: () => listIncidentsForReporter(userId ?? ""),
    enabled: Boolean(userId),
  });

  const openDutyMutation = useMutation({
    mutationFn: async (duty: DutyItem) => {
      if (duty.status === "Completed" || duty.status === "In Progress") {
        return duty;
      }
      return updateDutyStatus(duty.id, "In Progress");
    },
    onSuccess: async (duty) => {
      await queryClient.invalidateQueries({ queryKey: ["cleaner-assigned-duties", userId] });
      setSelectedDuty(duty);
    },
    onError: (error) => notify({ tone: "error", title: "Could not open duty", message: error instanceof Error ? error.message : "Unknown error" }),
  });

  const displayedDuties = useMemo(() => {
    if (activeFilter === "pending") {
      return duties.filter(isPendingDuty);
    }
    if (activeFilter === "in-progress") {
      return duties.filter((duty) => duty.status === "In Progress");
    }
    if (activeFilter === "completed") {
      return duties.filter((duty) => duty.status === "Completed");
    }
    return [];
  }, [activeFilter, duties]);

  return (
    <div className="space-y-8 fade-in">
      <PageHeader
        eyebrow="Cleaner dashboard"
        title={companyName ? `${companyName} duties` : "My duties"}
        description="Review assigned work, report incidents, and complete duties with optional evidence photos."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiButton active={activeFilter === "pending"} label="Pending Duties" value={String(duties.filter(isPendingDuty).length)} detail="Ready to start" icon={<ListTodo className="h-5 w-5" />} onClick={() => setActiveFilter("pending")} />
        <KpiButton active={activeFilter === "in-progress"} label="In Progress" value={String(duties.filter((duty) => duty.status === "In Progress").length)} detail="Currently open" icon={<Loader2 className="h-5 w-5" />} onClick={() => setActiveFilter("in-progress")} />
        <KpiButton active={activeFilter === "completed"} label="Completed" value={String(duties.filter((duty) => duty.status === "Completed").length)} detail="Finished duties" icon={<CheckCircle2 className="h-5 w-5" />} onClick={() => setActiveFilter("completed")} />
        <KpiButton active={activeFilter === "incidents"} label="Incidents" value={String(incidents.length)} detail="Reported by you" icon={<CircleAlert className="h-5 w-5" />} onClick={() => setActiveFilter("incidents")} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <Card className="space-y-6 p-5">
          <SectionTitle title={filterTitles[activeFilter]} description={activeFilter === "incidents" ? "Incident reports submitted from your cleaner profile." : "Open a duty to start work, upload evidence, or complete it."} />
          {activeFilter === "incidents" ? (
            <IncidentList incidents={incidents} sites={siteById} />
          ) : (
            <DutyList duties={displayedDuties} sites={siteById} isLoading={isLoadingDuties} onOpen={(duty) => openDutyMutation.mutate(duty)} isOpening={openDutyMutation.isPending} />
          )}
        </Card>

        <div className="space-y-6">
          <Card className="space-y-4 p-5">
            <div>
              <p className="text-sm font-medium text-slate-950">Quick actions</p>
              <p className="mt-1 text-sm text-slate-500">Submit a workplace incident report.</p>
            </div>
            <Button onClick={() => setIsIncidentOpen(true)}>
              <CircleAlert className="h-4 w-4" />
              Report incident
            </Button>
          </Card>
        </div>
      </div>

      {selectedDuty ? (
        <DutyDetailModal
          duty={selectedDuty}
          site={siteById.get(selectedDuty.siteId) ?? null}
          userId={userId}
          onClose={() => setSelectedDuty(null)}
        />
      ) : null}

      {isIncidentOpen ? (
        <IncidentReportModal
          sites={sites}
          userId={userId}
          duties={duties}
          onClose={() => setIsIncidentOpen(false)}
        />
      ) : null}
    </div>
  );
}

function KpiButton(props: {
  active: boolean;
  label: string;
  value: string;
  detail: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className={`rounded-[1.5rem] border p-5 text-left transition ${
        props.active ? "border-slate-900 bg-white shadow-sm" : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">{props.label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{props.value}</p>
          <p className="mt-2 text-sm text-slate-500">{props.detail}</p>
        </div>
        <div className={`rounded-2xl p-3 ${props.active ? "bg-slate-900 text-white" : "bg-slate-50 text-slate-700"}`}>{props.icon}</div>
      </div>
    </button>
  );
}

function DutyList(props: {
  duties: DutyItem[];
  sites: Map<string, SiteItem>;
  isLoading: boolean;
  isOpening: boolean;
  onOpen: (duty: DutyItem) => void;
}) {
  if (props.isLoading) {
    return <p className="text-sm text-slate-500">Loading assigned duties...</p>;
  }

  if (props.duties.length === 0) {
    return <p className="text-sm text-slate-500">No duties match this filter.</p>;
  }

  return (
    <div className="space-y-3">
      {props.duties.map((duty) => (
        <div key={duty.id} className="flex flex-col gap-3 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-medium text-slate-950">{duty.title}</p>
            <p className="mt-1 text-sm text-slate-500">
              {props.sites.get(duty.siteId)?.name ?? "Assigned site"} · {duty.priority} · {duty.dueDate ? new Date(duty.dueDate).toLocaleString() : "No due date"}
            </p>
            <p className="mt-2 inline-flex rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">{duty.status}</p>
          </div>
          <Button variant="secondary" onClick={() => props.onOpen(duty)} disabled={props.isOpening}>
            Open
          </Button>
        </div>
      ))}
    </div>
  );
}

function IncidentList(props: { incidents: Awaited<ReturnType<typeof listIncidentsForReporter>>; sites: Map<string, SiteItem> }) {
  if (props.incidents.length === 0) {
    return <p className="text-sm text-slate-500">No incidents reported yet.</p>;
  }

  return (
    <div className="space-y-3">
      {props.incidents.map((incident) => (
        <div key={incident.id} className="rounded-[1.5rem] border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-medium text-slate-950">{incident.incidentType}</p>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
              {incident.resolvedAt ? "Resolved" : "Open"}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {props.sites.get(incident.siteId)?.name ?? "Site"} · {new Date(incident.createdAt).toLocaleString()}
          </p>
          <pre className="mt-3 whitespace-pre-wrap rounded-2xl bg-white p-3 text-sm text-slate-600 ring-1 ring-slate-200">{incident.details}</pre>
        </div>
      ))}
    </div>
  );
}

function DutyDetailModal(props: {
  duty: DutyItem;
  site: SiteItem | null;
  userId: string | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const [beforeFiles, setBeforeFiles] = useState<File[]>([]);
  const [afterFiles, setAfterFiles] = useState<File[]>([]);

  const completeMutation = useMutation({
    mutationFn: async () => {
      if (!props.userId) {
        throw new Error("Missing cleaner profile");
      }
      if (!props.site) {
        throw new Error("Missing site context");
      }
      const beforeUrls = beforeFiles.length
        ? await uploadDutyEvidencePhotos({ bucketName: props.site.storageBucket, siteId: props.site.id, dutyTitle: props.duty.title, files: beforeFiles, type: "before" })
        : [];
      const afterUrls = afterFiles.length
        ? await uploadDutyEvidencePhotos({ bucketName: props.site.storageBucket, siteId: props.site.id, dutyTitle: props.duty.title, files: afterFiles, type: "after" })
        : [];
      if (beforeUrls.length > 0 || afterUrls.length > 0) {
        await appendDutyEvidencePhotos({ dutyId: props.duty.id, beforePhotos: beforeUrls, afterPhotos: afterUrls });
      }
      return updateDutyStatus(props.duty.id, "Completed");
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["cleaner-assigned-duties", props.userId] });
      notify({ tone: "success", title: "Duty completed", message: "The duty was marked as completed." });
      props.onClose();
    },
    onError: (error) => notify({ tone: "error", title: "Could not complete duty", message: error instanceof Error ? error.message : "Unknown error" }),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
      <Card className="max-h-[90vh] w-full max-w-3xl overflow-y-auto p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xl font-semibold text-slate-950">{props.duty.title}</p>
            <p className="mt-1 text-sm text-slate-500">{props.site?.name ?? "Assigned site"} · {props.duty.status}</p>
          </div>
          <button type="button" onClick={props.onClose} className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700" aria-label="Close duty detail">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <InfoBlock label="Priority" value={props.duty.priority} />
          <InfoBlock label="Due date" value={props.duty.dueDate ? new Date(props.duty.dueDate).toLocaleString() : "No due date"} />
          <InfoBlock label="Equipment" value={props.duty.equipment.length ? props.duty.equipment.join(", ") : "None listed"} />
        </div>

        <div className="mt-5 rounded-2xl bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-950">Description</p>
          <p className="mt-2 text-sm text-slate-600">{props.duty.description || "No description provided."}</p>
        </div>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <PhotoPicker label="Before photos" files={beforeFiles} onChange={setBeforeFiles} />
          <PhotoPicker label="After photos" files={afterFiles} onChange={setAfterFiles} />
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <Button type="button" variant="secondary" onClick={props.onClose} disabled={completeMutation.isPending}>Cancel</Button>
          <Button type="button" onClick={() => completeMutation.mutate()} disabled={completeMutation.isPending || props.duty.status === "Completed"}>
            {completeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Completed
          </Button>
        </div>
      </Card>
    </div>
  );
}

function InfoBlock(props: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase text-slate-500">{props.label}</p>
      <p className="mt-2 text-sm font-medium text-slate-950">{props.value}</p>
    </div>
  );
}

function PhotoPicker(props: { label: string; files: File[]; onChange: (files: File[]) => void }) {
  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    props.onChange(Array.from(event.target.files ?? []));
  }

  return (
    <label className="block cursor-pointer rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 transition hover:bg-slate-100">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
        <Camera className="h-4 w-4" />
        {props.label}
      </div>
      <p className="mt-2 text-sm text-slate-500">{props.files.length ? `${props.files.length} file${props.files.length === 1 ? "" : "s"} selected` : "Optional evidence upload"}</p>
      <input type="file" accept="image/*" multiple className="hidden" onChange={handleChange} />
    </label>
  );
}

function IncidentReportModal(props: {
  sites: SiteItem[];
  duties: DutyItem[];
  userId: string | null;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const defaultSiteId = props.sites[0]?.id ?? "";
  const [siteId, setSiteId] = useState(defaultSiteId);
  const [dutyId, setDutyId] = useState("");
  const [incidentType, setIncidentType] = useState<IncidentType>("Other");
  const [occurredAt, setOccurredAt] = useState(() => new Date().toISOString().slice(0, 16));
  const [location, setLocation] = useState("");
  const [summary, setSummary] = useState("");
  const [immediateAction, setImmediateAction] = useState("");
  const [injuryOrDamage, setInjuryOrDamage] = useState("No injury or damage reported.");

  const mutation = useMutation({
    mutationFn: () => {
      if (!props.userId) {
        throw new Error("Missing cleaner profile");
      }
      if (!siteId) {
        throw new Error("Select a site");
      }
      if (!location.trim() || !summary.trim() || !immediateAction.trim()) {
        throw new Error("Complete the incident report fields");
      }
      return createIncident({
        siteId,
        reportedBy: props.userId,
        dutyId: dutyId || null,
        incidentType,
        occurredAt,
        location: location.trim(),
        summary: summary.trim(),
        immediateAction: immediateAction.trim(),
        injuryOrDamage: injuryOrDamage.trim() || "No injury or damage reported.",
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["cleaner-incidents", props.userId] });
      notify({ tone: "success", title: "Incident reported", message: "The incident report was submitted." });
      props.onClose();
    },
    onError: (error) => notify({ tone: "error", title: "Could not report incident", message: error instanceof Error ? error.message : "Unknown error" }),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
      <Card className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-[2rem] p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xl font-semibold text-slate-950">Incident report</p>
            <p className="mt-1 text-sm text-slate-500">Australian workplace incident template.</p>
          </div>
          <button type="button" onClick={props.onClose} className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700" aria-label="Close incident report">
            <X className="h-5 w-5" />
          </button>
        </div>

        <form
          className="mt-6 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            mutation.mutate();
          }}
        >
          <SelectField label="Site" value={siteId} onChange={setSiteId} options={props.sites.map((site) => ({ value: site.id, label: site.name }))} />
          <SelectField label="Related duty" value={dutyId} onChange={setDutyId} options={[{ value: "", label: "No related duty" }, ...props.duties.map((duty) => ({ value: duty.id, label: duty.title }))]} />
          <SelectField label="Incident type" value={incidentType} onChange={(value) => setIncidentType(value as IncidentType)} options={INCIDENT_TYPES.map((type) => ({ value: type, label: type }))} />
          <TextField label="Date and time" type="datetime-local" value={occurredAt} onChange={setOccurredAt} />
          <TextField label="Location/area" value={location} onChange={setLocation} placeholder="e.g. Lobby, amenities, loading dock" />
          <TextAreaField label="What happened" value={summary} onChange={setSummary} />
          <TextAreaField label="Immediate action taken" value={immediateAction} onChange={setImmediateAction} />
          <TextAreaField label="Injury or damage" value={injuryOrDamage} onChange={setInjuryOrDamage} />

          <div className="flex flex-wrap justify-end gap-3 pt-2">
            <Button type="button" variant="secondary" onClick={props.onClose} disabled={mutation.isPending}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Submit
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

function SelectField(props: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-slate-700">{props.label}</span>
      <select value={props.value} onChange={(event) => props.onChange(event.target.value)} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-400">
        {props.options.map((option) => (
          <option key={`${props.label}-${option.value}`} value={option.value}>{option.label}</option>
        ))}
      </select>
    </label>
  );
}

function TextField(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-slate-700">{props.label}</span>
      <input type={props.type ?? "text"} value={props.value} onChange={(event) => props.onChange(event.target.value)} placeholder={props.placeholder} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400" />
    </label>
  );
}

function TextAreaField(props: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-slate-700">{props.label}</span>
      <textarea value={props.value} onChange={(event) => props.onChange(event.target.value)} rows={3} className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-400" />
    </label>
  );
}

export function DashboardPage() {
  const { role } = useSession();

  if (role === "Cleaner") {
    return <CleanerDashboard />;
  }

  return <ManagerDashboard />;
}
