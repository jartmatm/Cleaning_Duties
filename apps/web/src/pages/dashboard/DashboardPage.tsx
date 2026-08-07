import { INCIDENT_TYPES, type IncidentType } from "@cleaning-duties/shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { arc, pie, type PieArcDatum } from "d3";
import { Bell, CheckCircle2, CircleAlert, ClipboardList, ClipboardPlus, ListTodo, Loader2, Send, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { CleanerDutyDetailModal } from "../../components/common/cleaner-duty-detail-modal";
import { DutyStatusBadge } from "../../components/common/duty-status-badge";
import { PageHeader } from "../../components/common/page-header";
import { QuickActions } from "../../components/common/quick-actions";
import { SectionTitle } from "../../components/common/section-title";
import { StatCard } from "../../components/common/stat-card";
import { notify } from "../../components/common/toast";
import { UnplannedDutyFlow } from "../../components/unplanned-duty/UnplannedDutyFlow";
import { UnplannedDutyReviewModal } from "../../components/unplanned-duty/UnplannedDutyReviewModal";
import { useSession } from "../../hooks/use-session";
import { listAssignedDuties, listDuties, updateDutyStatus, type DutyItem } from "../../services/duties-service";
import { createIncident, listIncidentsForReporter, listIncidentsForSite } from "../../services/incidents-service";
import { getCurrentProfile } from "../../services/profile-service";
import { listMySites, listSites, type SiteItem } from "../../services/sites-service";
import { getActiveDutyShift, listUnplannedDutyRequests, reviewUnplannedDutyRequest, type UnplannedDutyRequest } from "../../services/unplanned-duty-service";
import { formatDate, formatDateTime } from "../../utils/date-format";

type CleanerFilter = "scheduled" | "pending" | "in-progress" | "completed";
type ManagerDashboardFilter = "pending" | "completed" | "missed" | "incidents";

const filterTitles: Record<CleanerFilter, string> = {
  scheduled: "Scheduled duties",
  pending: "Pending duties",
  "in-progress": "In progress duties",
  completed: "Completed duties",
};

const managerFilterTitles: Record<ManagerDashboardFilter, string> = {
  pending: "Pending duties",
  completed: "Completed duties",
  missed: "Missed duties",
  incidents: "Open incidents",
};

const managerFilterDescriptions: Record<ManagerDashboardFilter, string> = {
  pending: "Open work across the active site.",
  completed: "Work completed today across the active site.",
  missed: "Duties that were not completed in their shift.",
  incidents: "Open incidents reported this week.",
};

function isPendingDuty(duty: DutyItem) {
  return duty.status === "Pending";
}

function isActiveDuty(duty: DutyItem) {
  return !["Completed", "Archived", "Missed", "Incomplete"].includes(duty.status);
}

function isThisWeek(dateValue: string | null) {
  if (!dateValue) {
    return false;
  }

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) {
    return false;
  }

  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setHours(0, 0, 0, 0);
  weekStart.setDate(now.getDate() - now.getDay());

  return date >= weekStart && date <= now;
}

function isToday(dateValue: string | null) {
  if (!dateValue) {
    return false;
  }

  const date = new Date(dateValue);
  const now = new Date();
  return !Number.isNaN(date.getTime())
    && date.getFullYear() === now.getFullYear()
    && date.getMonth() === now.getMonth()
    && date.getDate() === now.getDate();
}

function isInTodaysShiftWindow(duty: DutyItem) {
  return isToday(duty.startsAt) || isToday(duty.dueDate);
}

function isTodayDuty(duty: DutyItem) {
  return isInTodaysShiftWindow(duty) || (duty.status === "Completed" && isToday(duty.completedAt));
}

function getTime(dateValue: string | null) {
  if (!dateValue) {
    return null;
  }

  const time = new Date(dateValue).getTime();
  return Number.isNaN(time) ? null : time;
}

function formatDutyExecutionDate(duty: Pick<DutyItem, "startsAt" | "dueDate">) {
  const executionDate = duty.startsAt ?? duty.dueDate;
  return formatDate(executionDate) || "No execution date";
}

function padDatePart(value: number) {
  return String(value).padStart(2, "0");
}

function getLocalDateKey(date: Date) {
  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`;
}

function getShiftDateTimeKey(startsAt: string | null, dueDate: string | null) {
  if (!startsAt || !dueDate) {
    return null;
  }

  const start = new Date(startsAt);
  const end = new Date(dueDate);

  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return null;
  }

  const startDate = getLocalDateKey(start);
  const endDate = getLocalDateKey(end);
  const startTime = start.toTimeString().slice(0, 5);
  const endTime = end.toTimeString().slice(0, 5);

  return `${startDate}|${startTime}|${endDate}|${endTime}`;
}

function getDutyShiftDateTimeKey(duty: DutyItem) {
  return getShiftDateTimeKey(duty.startsAt, duty.dueDate);
}

function getCleanerProgressDuties(siteDuties: DutyItem[]) {
  const now = Date.now();
  const activeShiftDuty = siteDuties
    .filter((duty) => {
      const startsAt = getTime(duty.startsAt);
      const dueDate = getTime(duty.dueDate);
      return startsAt !== null
        && startsAt <= now
        && (dueDate === null || dueDate > now)
        && ["Pending", "In Progress", "Completed"].includes(duty.status);
    })
    .sort((a, b) => (getTime(b.startsAt) ?? 0) - (getTime(a.startsAt) ?? 0))[0];

  if (activeShiftDuty) {
    const activeShiftKey = getDutyShiftDateTimeKey(activeShiftDuty);

    return siteDuties.filter((duty) =>
      activeShiftKey !== null
      && getDutyShiftDateTimeKey(duty) === activeShiftKey
      && ["Pending", "In Progress", "Completed"].includes(duty.status),
    );
  }

  const nextScheduledDuty = siteDuties
    .filter((duty) => duty.status === "Scheduled")
    .filter((duty) => {
      const startsAt = getTime(duty.startsAt);
      return startsAt !== null && startsAt > now;
    })
    .sort((a, b) => (getTime(a.startsAt) ?? 0) - (getTime(b.startsAt) ?? 0))[0];

  if (!nextScheduledDuty) {
    return [];
  }

  const nextShiftKey = getDutyShiftDateTimeKey(nextScheduledDuty);
  return siteDuties.filter((duty) =>
    nextShiftKey !== null
    && duty.status === "Scheduled"
    && getDutyShiftDateTimeKey(duty) === nextShiftKey,
  );
}

function getPreferredCleanerFilter(counts: Record<CleanerFilter, number>) {
  if (counts["in-progress"] > 0) {
    return "in-progress";
  }
  if (counts.pending > 0) {
    return "pending";
  }
  if (counts.completed > 0) {
    return "completed";
  }
  if (counts.scheduled > 0) {
    return "scheduled";
  }
  return "pending";
}

function formatSiteShift(site: SiteItem | null | undefined) {
  return site?.shiftStartTime && site.shiftEndTime ? `${site.shiftStartTime} - ${site.shiftEndTime}` : "No site shift";
}

function percent(value: number, total: number) {
  if (total === 0) {
    return 0;
  }

  return Number(((value / total) * 100).toFixed(1));
}

function UnplannedDutyRequestDeck({
  requests,
  onSelect,
}: {
  requests: UnplannedDutyRequest[];
  onSelect: (request: UnplannedDutyRequest) => void;
}) {
  const [raisedRequestId, setRaisedRequestId] = useState<string | null>(null);
  const stackedRequests = useMemo(() => [...requests].reverse(), [requests]);

  return (
    <div className="relative isolate pt-1" style={{ perspective: "1100px" }}>
      {stackedRequests.map((request, index) => {
        const depth = Math.min(stackedRequests.length - 1 - index, 4);
        const isRaised = raisedRequestId === request.id;
        const horizontalInset = depth * 6;

        return (
          <button
            key={request.id}
            type="button"
            onClick={() => onSelect(request)}
            onMouseEnter={() => setRaisedRequestId(request.id)}
            onMouseLeave={() => setRaisedRequestId(null)}
            onFocus={() => setRaisedRequestId(request.id)}
            onBlur={() => setRaisedRequestId(null)}
            className="relative block h-36 rounded-lg bg-slate-950 p-4 text-left text-white shadow-lg ring-1 ring-white/10 transition-[transform,box-shadow,background-color] duration-300 ease-out hover:bg-slate-900 hover:shadow-2xl focus:outline-none focus:ring-2 focus:ring-slate-400 motion-reduce:transform-none motion-reduce:transition-none"
            style={{
              zIndex: isRaised ? stackedRequests.length + 1 : index + 1,
              marginTop: index === 0 ? 0 : -76,
              marginLeft: horizontalInset,
              marginRight: horizontalInset,
              transform: isRaised
                ? "translate3d(0, -8px, 56px) rotateX(0deg)"
                : `translate3d(0, ${depth * 3}px, ${depth * -32}px) rotateX(${depth * 1.25}deg)`,
              transformOrigin: "center top",
              transformStyle: "preserve-3d",
            }}
            aria-label={`Review ${request.title} submitted by ${request.cleanerName}`}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="truncate font-semibold">{request.title}</p>
                <p className="mt-1 truncate text-sm text-slate-300">{request.cleanerName}</p>
              </div>
              <span className="shrink-0 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white">Review</span>
            </div>
            <p className="mt-4 line-clamp-2 text-xs leading-5 text-slate-300">
              {formatDateTime(request.shiftStartedAt)} - {formatDateTime(request.shiftEndsAt)}
            </p>
          </button>
        );
      })}
    </div>
  );
}

function ManagerDashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { userId, companyId, role, activeSiteId } = useSession();
  const usesAssignedSites = role === "Supervisor";
  const [activeFilter, setActiveFilter] = useState<ManagerDashboardFilter | null>(null);
  const [selectedUnplannedRequest, setSelectedUnplannedRequest] = useState<UnplannedDutyRequest | null>(null);
  const { data: profile } = useQuery({
    queryKey: ["dashboard-profile", userId],
    queryFn: () => getCurrentProfile(userId ?? ""),
    enabled: Boolean(userId),
  });
  const { data: sites = [] } = useQuery({
    queryKey: usesAssignedSites ? ["dashboard-sites", companyId, userId] : ["dashboard-sites", companyId],
    queryFn: () => usesAssignedSites ? listMySites(userId ?? "") : listSites(companyId ?? ""),
    enabled: usesAssignedSites ? Boolean(userId) : Boolean(companyId),
  });
  const activeSite = sites.find((site) => site.id === activeSiteId) ?? sites[0] ?? null;
  const { data: duties = [] } = useQuery({
    queryKey: ["dashboard-duties", activeSite?.id],
    queryFn: () => listDuties(activeSite?.id ?? ""),
    enabled: Boolean(activeSite?.id),
  });
  const { data: incidents = [] } = useQuery({
    queryKey: ["dashboard-incidents", activeSite?.id],
    queryFn: () => listIncidentsForSite(activeSite?.id ?? ""),
    enabled: Boolean(activeSite?.id),
  });
  const { data: unplannedRequests = [], isLoading: isLoadingUnplannedRequests } = useQuery({
    queryKey: ["unplanned-duty-requests", activeSite?.id],
    queryFn: () => listUnplannedDutyRequests(activeSite?.id ?? ""),
    enabled: Boolean(activeSite?.id),
    refetchInterval: 15_000,
  });

  const reviewUnplannedMutation = useMutation({
    mutationFn: ({ requestId, approve }: { requestId: string; approve: boolean }) => reviewUnplannedDutyRequest(requestId, approve),
    onSuccess: async (_result, variables) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["unplanned-duty-requests", activeSite?.id] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard-duties", activeSite?.id] }),
      ]);
      setSelectedUnplannedRequest(null);
      notify({
        tone: "success",
        title: variables.approve ? "Duty approved" : "Request rejected",
        message: variables.approve ? "The completed duty is now part of the cleaner's shift history." : "The request and its evidence were removed.",
      });
    },
    onError: async (error) => {
      await queryClient.invalidateQueries({ queryKey: ["unplanned-duty-requests", activeSite?.id] });
      setSelectedUnplannedRequest(null);
      notify({
        tone: "error",
        title: "Request already closed",
        message: error instanceof Error ? error.message : "Another reviewer may have handled this request.",
      });
    },
  });

  const weeklyReportData = useMemo(() => {
    const weeklyDuties = duties.filter((duty) => isThisWeek(duty.startsAt) || isThisWeek(duty.dueDate) || isThisWeek(duty.completedAt));
    const reportDuties = weeklyDuties.length > 0 ? weeklyDuties : duties;
    const completedDuties = reportDuties.filter((duty) => duty.status === "Completed" || duty.status === "Archived");
    const onTimeDuties = completedDuties.filter((duty) => !duty.dueDate || (duty.completedAt && new Date(duty.completedAt) <= new Date(duty.dueDate)));
    const activeDuties = reportDuties.filter(isActiveDuty);
    const weeklyIncidents = incidents.filter((incident) => isThisWeek(incident.createdAt));
    const openIncidents = weeklyIncidents.filter((incident) => !incident.resolvedAt);

    return [
      { key: "Completion rate", value: percent(completedDuties.length, reportDuties.length) },
      { key: "On-time completion", value: percent(onTimeDuties.length, completedDuties.length) },
      { key: "Active workload", value: percent(activeDuties.length, reportDuties.length) },
      { key: "Open incidents", value: openIncidents.length },
    ];
  }, [duties, incidents]);
  const todayDuties = duties.filter(isTodayDuty);
  const pendingDuties = todayDuties.filter((duty) => isPendingDuty(duty) || duty.status === "In Progress");
  const completedDuties = duties.filter((duty) => (duty.status === "Completed" || duty.status === "Archived") && isToday(duty.completedAt));
  const missedDuties = duties.filter((duty) => duty.status === "Missed");
  const openWeeklyIncidents = incidents.filter((incident) => isThisWeek(incident.createdAt) && !incident.resolvedAt);
  const displayedDuties = useMemo(() => {
    if (activeFilter === "pending") {
      return pendingDuties;
    }
    if (activeFilter === "completed") {
      return completedDuties;
    }
    if (activeFilter === "missed") {
      return missedDuties;
    }

    return todayDuties.slice(0, 3);
  }, [activeFilter, completedDuties, missedDuties, pendingDuties, todayDuties]);
  const panelTitle = activeFilter ? managerFilterTitles[activeFilter] : "Today's duties";
  const panelDescription = activeFilter ? managerFilterDescriptions[activeFilter] : "The highest priority work across the active site.";

  function handleKpiClick(filter: ManagerDashboardFilter) {
    setActiveFilter((current) => (current === filter ? null : filter));
  }

  return (
    <div className="space-y-8 fade-in">
      <PageHeader
        eyebrow="Dashboard"
        title={profile?.full_name ? `Good morning, ${profile.full_name}` : "Good morning"}
        description={
          activeSite
            ? `Track today's workload for ${activeSite.name}, monitor missed duties, and move quickly from assignment to completion.`
            : "Select a site to see workload, missed duties, and live activity."
        }
        actions={
          <>
            <Button variant="secondary" onClick={() => navigate("/reports")}>View Reports</Button>
            <Button onClick={() => navigate("/duties?create=1")}>Create Duty</Button>
          </>
        }
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard active={activeFilter === "pending"} onClick={() => handleKpiClick("pending")} label="Pending Duties" value={String(pendingDuties.length)} detail="Across the selected site" accent={<ListTodo className="h-5 w-5" />} />
        <StatCard active={activeFilter === "completed"} onClick={() => handleKpiClick("completed")} label="Completed Today" value={String(completedDuties.length)} detail="For the active site" accent={<Sparkles className="h-5 w-5" />} />
        <StatCard active={activeFilter === "missed"} onClick={() => handleKpiClick("missed")} label="Missed" value={String(missedDuties.length)} detail="Needs manager review" accent={<CircleAlert className="h-5 w-5" />} />
        <StatCard active={activeFilter === "incidents"} onClick={() => handleKpiClick("incidents")} label="Incidents" value={String(openWeeklyIncidents.length)} detail="Open this week" accent={<Bell className="h-5 w-5" />} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card className="space-y-6 p-5">
          <SectionTitle title={panelTitle} description={panelDescription} />
          <div className="space-y-3">
            {activeFilter === "incidents" ? (
              openWeeklyIncidents.length === 0 ? (
                <p className="text-sm text-slate-500">No open incidents this week.</p>
              ) : (
                openWeeklyIncidents.map((incident) => (
                  <div key={incident.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <p className="font-medium text-slate-950">{incident.incidentType}</p>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                        {formatDateTime(incident.createdAt)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-500">{incident.details}</p>
                  </div>
                ))
              )
            ) : displayedDuties.length === 0 ? (
              <p className="text-sm text-slate-500">{activeFilter ? "No duties match this KPI." : "No duties for this site yet."}</p>
            ) : (
              displayedDuties.map((item) => (
                <div key={item.id} className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 p-4 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="font-medium text-slate-950">{item.title}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                      <span>{item.priority}</span>
                      <span aria-hidden="true">·</span>
                      <span>{formatSiteShift(activeSite)}</span>
                      <span aria-hidden="true">·</span>
                      <span>{formatDutyExecutionDate(item)}</span>
                      <DutyStatusBadge status={item.status} />
                    </div>
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
            <SectionTitle title="Unplanned duty requests" description="Extra work waiting for review at the active site." />
            <div className="space-y-3">
              {isLoadingUnplannedRequests ? (
                <p className="text-sm text-slate-500">Loading requests...</p>
              ) : unplannedRequests.length === 0 ? (
                <p className="text-sm text-slate-500">No unplanned duties waiting for review.</p>
              ) : (
                <UnplannedDutyRequestDeck requests={unplannedRequests} onSelect={setSelectedUnplannedRequest} />
              )}
            </div>
          </Card>
        </div>
      </div>

      <Card className="space-y-4 p-5">
        <SectionTitle title="Weekly reports" description="A quick operating view for managers and supervisors." />
        <BarChartBenchmark data={weeklyReportData} />
      </Card>

      {selectedUnplannedRequest ? (
        <UnplannedDutyReviewModal
          request={selectedUnplannedRequest}
          isReviewing={reviewUnplannedMutation.isPending}
          onClose={() => setSelectedUnplannedRequest(null)}
          onApprove={() => reviewUnplannedMutation.mutate({ requestId: selectedUnplannedRequest.id, approve: true })}
          onReject={() => reviewUnplannedMutation.mutate({ requestId: selectedUnplannedRequest.id, approve: false })}
        />
      ) : null}
    </div>
  );
}

function BarChartBenchmark({ data }: { data: Array<{ key: string; value: number }> }) {
  const maxValue = Math.max(...data.map((item) => item.value), 1);

  return (
    <div className="grid w-full gap-4 py-4">
      {data.map((item, index) => (
        <div key={item.key} className="grid gap-2 md:grid-cols-[10rem_1fr] md:items-center">
          <div className={`text-sm whitespace-nowrap ${index === 0 ? "bg-lime-500 text-transparent bg-clip-text" : "text-gray-500"}`}>
            {item.key}
          </div>
          <div className="flex items-center gap-2.5">
            <div className="relative h-3 w-full overflow-hidden rounded-sm bg-gray-200">
              <div
                className={`absolute inset-y-0 left-0 rounded-r-sm bg-gradient-to-r ${index === 0 ? "from-lime-300 to-teal-300" : "from-zinc-400 to-gray-400"}`}
                style={{ width: `${(item.value / maxValue) * 100}%` }}
              />
            </div>
            <div className={`text-sm whitespace-nowrap tabular-nums ${index === 0 ? "bg-teal-400 text-transparent bg-clip-text" : "text-gray-500"}`}>
              {item.value}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

function CleanerDashboard() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { userId, companyName, activeSiteId } = useSession();
  const cleanerWorkSectionRef = useRef<HTMLDivElement | null>(null);
  const previousRemainingDutiesCountRef = useRef<number | null>(null);
  const [activeFilter, setActiveFilter] = useState<CleanerFilter>("in-progress");
  const [selectedDuty, setSelectedDuty] = useState<DutyItem | null>(null);
  const [isIncidentOpen, setIsIncidentOpen] = useState(false);
  const [isUnplannedDutyOpen, setIsUnplannedDutyOpen] = useState(false);
  const [shiftClock, setShiftClock] = useState(() => Date.now());

  const { data: sites = [] } = useQuery({
    queryKey: ["cleaner-sites", userId],
    queryFn: () => listMySites(userId ?? ""),
    enabled: Boolean(userId),
  });
  const siteById = useMemo(() => new Map(sites.map((site) => [site.id, site])), [sites]);
  const activeSite = sites.find((site) => site.id === activeSiteId) ?? sites[0] ?? null;

  const { data: duties = [], isLoading: isLoadingDuties } = useQuery({
    queryKey: ["cleaner-assigned-duties", userId],
    queryFn: () => listAssignedDuties(userId ?? ""),
    enabled: Boolean(userId),
    refetchInterval: 60_000,
  });

  useEffect(() => {
    const timer = window.setInterval(() => setShiftClock(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  const openDutyMutation = useMutation({
    mutationFn: async (duty: DutyItem) => {
      if (duty.status === "Completed" || duty.status === "In Progress") {
        return duty;
      }
      if (duty.status === "Scheduled") {
        throw new Error("This duty is scheduled and will become pending when the site shift starts.");
      }
      return updateDutyStatus(duty.id, "In Progress");
    },
    onSuccess: async (duty) => {
      await queryClient.invalidateQueries({ queryKey: ["cleaner-assigned-duties", userId] });
      setSelectedDuty(duty);
    },
    onError: (error) => notify({ tone: "error", title: "Could not open duty", message: error instanceof Error ? error.message : "Unknown error" }),
  });

  const siteDuties = useMemo(
    () => (activeSite ? duties.filter((duty) => duty.siteId === activeSite.id) : duties),
    [activeSite, duties],
  );
  const activeShift = useMemo(
    () => getActiveDutyShift(siteDuties, activeSite?.id, shiftClock),
    [activeSite?.id, shiftClock, siteDuties],
  );
  const progressDuties = useMemo(() => getCleanerProgressDuties(siteDuties), [siteDuties]);
  const cleanerKpiCounts = useMemo<Record<CleanerFilter, number>>(() => ({
    "in-progress": progressDuties.filter((duty) => duty.status === "In Progress").length,
    pending: progressDuties.filter(isPendingDuty).length,
    completed: progressDuties.filter((duty) => duty.status === "Completed").length,
    scheduled: progressDuties.filter((duty) => duty.status === "Scheduled").length,
  }), [progressDuties]);

  useEffect(() => {
    if (cleanerKpiCounts[activeFilter] === 0) {
      setActiveFilter(getPreferredCleanerFilter(cleanerKpiCounts));
    }
  }, [activeFilter, cleanerKpiCounts]);

  const displayedDuties = useMemo(() => {
    if (activeFilter === "scheduled") {
      return progressDuties.filter((duty) => duty.status === "Scheduled");
    }
    if (activeFilter === "pending") {
      return progressDuties.filter(isPendingDuty);
    }
    if (activeFilter === "in-progress") {
      return progressDuties.filter((duty) => duty.status === "In Progress");
    }
    if (activeFilter === "completed") {
      return progressDuties.filter((duty) => duty.status === "Completed");
    }
    return [];
  }, [activeFilter, progressDuties]);
  const completedDutiesCount = cleanerKpiCounts.completed;
  const remainingDutiesCount = Math.max(progressDuties.length - completedDutiesCount, 0);

  useEffect(() => {
    const previousRemainingDutiesCount = previousRemainingDutiesCountRef.current;
    previousRemainingDutiesCountRef.current = remainingDutiesCount;

    if (
      previousRemainingDutiesCount !== null
      && previousRemainingDutiesCount > 0
      && remainingDutiesCount === 0
      && progressDuties.length > 0
    ) {
      navigate("/celebration");
    }
  }, [navigate, progressDuties.length, remainingDutiesCount]);

  function handleKpiClick(filter: CleanerFilter) {
    setActiveFilter(filter);
    window.requestAnimationFrame(() => {
      cleanerWorkSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  return (
    <div className="space-y-8 fade-in">
      <PageHeader
        eyebrow="Cleaner dashboard"
        title={companyName ? `${companyName} duties` : "My duties"}
        description={activeSite ? `Review assigned work for ${activeSite.name}, report incidents, and complete duties with optional evidence photos.` : "Review assigned work, report incidents, and complete duties with optional evidence photos."}
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KpiButton active={activeFilter === "in-progress"} label="In Progress" value={String(cleanerKpiCounts["in-progress"])} detail="Currently open" icon={<Loader2 className="h-5 w-5" />} onClick={() => handleKpiClick("in-progress")} />
        <KpiButton active={activeFilter === "pending"} label="Pending Duties" value={String(cleanerKpiCounts.pending)} detail="Ready to start" icon={<ListTodo className="h-5 w-5" />} onClick={() => handleKpiClick("pending")} />
        <KpiButton active={activeFilter === "completed"} label="Completed" value={String(completedDutiesCount)} detail="Finished today" icon={<CheckCircle2 className="h-5 w-5" />} onClick={() => handleKpiClick("completed")} />
        <KpiButton active={activeFilter === "scheduled"} label="Scheduled" value={String(cleanerKpiCounts.scheduled)} detail="Coming up" icon={<ClipboardList className="h-5 w-5" />} onClick={() => handleKpiClick("scheduled")} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
        <div ref={cleanerWorkSectionRef} className="scroll-mt-6">
          <Card className="space-y-6 p-5">
            <SectionTitle title={filterTitles[activeFilter]} description={activeFilter === "scheduled" ? "Work assigned to the next scheduled shift." : "Open a duty to start work, upload evidence, or complete it."} />
            <DutyList duties={displayedDuties} sites={siteById} isLoading={isLoadingDuties} onOpen={(duty) => openDutyMutation.mutate(duty)} isOpening={openDutyMutation.isPending} />
          </Card>
        </div>

        <div className="order-first space-y-6 xl:order-none">
          <Card className="space-y-4 p-5">
            <SectionTitle title="Duty progress" description="Completed duties compared with today's scheduled workload." />
            <DonutChartFillable completed={completedDutiesCount} remaining={remainingDutiesCount} />
          </Card>
          <Card className="space-y-4 p-5">
            <div>
              <p className="text-sm font-medium text-slate-950">Quick actions</p>
              <p className="mt-1 text-sm text-slate-500">Report an issue or submit extra work from this shift.</p>
            </div>
            <div className="grid gap-3">
              <Button onClick={() => setIsUnplannedDutyOpen(true)} disabled={!activeShift || !activeSite || !userId} title={activeShift ? "Submit unplanned duty" : "Available during an active assigned shift"}>
                <ClipboardPlus className="mr-2 h-4 w-4" />
                Submit unplanned duty
              </Button>
              <Button variant="secondary" onClick={() => setIsIncidentOpen(true)}>
                <CircleAlert className="mr-2 h-4 w-4" />
                Report incident
              </Button>
            </div>
          </Card>
        </div>
      </div>

      {selectedDuty ? (
        <CleanerDutyDetailModal
          duty={selectedDuty}
          site={siteById.get(selectedDuty.siteId) ?? null}
          userId={userId}
          onClose={() => setSelectedDuty(null)}
        />
      ) : null}

      {isIncidentOpen ? (
        <IncidentReportModal
          sites={activeSite ? [activeSite] : sites}
          userId={userId}
          duties={siteDuties}
          activeSiteId={activeSite?.id ?? ""}
          onClose={() => setIsIncidentOpen(false)}
        />
      ) : null}

      {isUnplannedDutyOpen && activeShift && activeSite && userId ? (
        <UnplannedDutyFlow
          cleanerId={userId}
          site={activeSite}
          shift={activeShift}
          onClose={() => {
            setIsUnplannedDutyOpen(false);
            navigate("/dashboard", { replace: true });
          }}
          onSubmitted={async () => {
            await queryClient.invalidateQueries({ queryKey: ["cleaner-assigned-duties", userId] });
          }}
        />
      ) : null}
    </div>
  );
}

type DonutItem = { name: string; value: number };

function DonutChartFillable({ completed, remaining }: { completed: number; remaining: number }) {
  const radius = 420;
  const lightStrokeEffect = 10;
  const total = completed + remaining;
  const progress = percent(completed, total);
  const data: DonutItem[] = total > 0
    ? [
        { name: "Completed", value: completed },
        { name: "Remaining", value: remaining },
      ]
    : [
        { name: "Completed", value: 0 },
        { name: "Remaining", value: 1 },
      ];

  const pieLayout = pie<DonutItem>()
    .value((item) => item.value)
    .startAngle(0)
    .endAngle(2 * Math.PI)
    .sort(null)
    .padAngle(0);
  const innerRadius = radius / 1.625;
  const arcGenerator = arc<PieArcDatum<DonutItem>>().innerRadius(innerRadius).outerRadius(radius);
  const arcClip = arc<PieArcDatum<DonutItem>>()
    .innerRadius(innerRadius + lightStrokeEffect / 2)
    .outerRadius(radius)
    .cornerRadius(lightStrokeEffect + 2);
  const arcs = pieLayout(data);

  return (
    <div className="space-y-4">
      <div className="relative">
        <svg viewBox={`-${radius} -${radius} ${radius * 2} ${radius * 2}`} className="mx-auto max-w-[16rem] overflow-visible">
          <defs>
            {arcs.map((slice) => (
              <clipPath key={`cleaner-duty-donut-clip-${slice.data.name}`} id={`cleaner-duty-donut-clip-${slice.data.name}`}>
                <path d={arcClip(slice) || undefined} />
              </clipPath>
            ))}
          </defs>
          <g>
            {arcs.map((slice, index) => (
              <g key={slice.data.name} clipPath={`url(#cleaner-duty-donut-clip-${slice.data.name})`}>
                <path
                  className={`stroke-white/30 ${index === 0 ? "fill-emerald-600" : "fill-zinc-200"}`}
                  strokeWidth={lightStrokeEffect}
                  d={arcGenerator(slice) || undefined}
                />
              </g>
            ))}
          </g>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-lg font-semibold leading-5 text-slate-950">Completed</span>
          <div className="text-xl font-bold">
            <span className="text-emerald-600">{completed}</span>
            <span className="text-zinc-400"> / {total}</span>
          </div>
          <span className="mt-1 text-xs font-semibold text-slate-500">{progress}%</span>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div className="rounded-md bg-emerald-50 px-3 py-2 text-emerald-800">
          <p className="text-xs font-semibold uppercase">Completed</p>
          <p className="mt-1 text-lg font-bold">{completed}</p>
        </div>
        <div className="rounded-md bg-slate-50 px-3 py-2 text-slate-700">
          <p className="text-xs font-semibold uppercase">Remaining</p>
          <p className="mt-1 text-lg font-bold">{remaining}</p>
        </div>
      </div>
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
      className={`rounded-lg border p-5 text-left transition ${
        props.active ? "border-slate-900 bg-white shadow-sm" : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm text-slate-500">{props.label}</p>
          <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">{props.value}</p>
          <p className="mt-2 text-sm text-slate-500">{props.detail}</p>
        </div>
        <div className={`rounded-md p-3 ${props.active ? "bg-slate-900 text-white" : "bg-slate-50 text-slate-700"}`}>{props.icon}</div>
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
        <div key={duty.id} className="flex flex-col gap-3 rounded-lg border border-slate-200 bg-slate-50 p-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="font-medium text-slate-950">{duty.title}</p>
            <p className="mt-1 text-sm text-slate-500">
              {props.sites.get(duty.siteId)?.name ?? "Assigned site"} · {duty.priority} · {formatSiteShift(props.sites.get(duty.siteId))} · {formatDutyExecutionDate(duty)}
            </p>
            <DutyStatusBadge status={duty.status} className="mt-2" />
          </div>
          <Button variant="secondary" onClick={() => props.onOpen(duty)} disabled={props.isOpening || duty.status === "Scheduled"}>
            {duty.status === "Scheduled" ? "Scheduled" : "Open"}
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
        <div key={incident.id} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="font-medium text-slate-950">{incident.incidentType}</p>
            <span className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
              {incident.resolvedAt ? "Resolved" : "Open"}
            </span>
          </div>
          <p className="mt-1 text-sm text-slate-500">
            {props.sites.get(incident.siteId)?.name ?? "Site"} · {formatDateTime(incident.createdAt)}
          </p>
          <pre className="mt-3 whitespace-pre-wrap rounded-md bg-white p-3 text-sm text-slate-600 ring-1 ring-slate-200">{incident.details}</pre>
        </div>
      ))}
    </div>
  );
}

function IncidentReportModal(props: {
  sites: SiteItem[];
  duties: DutyItem[];
  userId: string | null;
  activeSiteId: string;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const defaultSiteId = props.activeSiteId || props.sites[0]?.id || "";
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
      <Card className="max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-lg p-6">
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
      <select value={props.value} onChange={(event) => props.onChange(event.target.value)} className="w-full rounded-md border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-400">
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
      <input type={props.type ?? "text"} value={props.value} onChange={(event) => props.onChange(event.target.value)} placeholder={props.placeholder} className="w-full rounded-md border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400" />
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
      <textarea value={props.value} onChange={(event) => props.onChange(event.target.value)} rows={3} className="w-full resize-none rounded-md border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-400" />
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
