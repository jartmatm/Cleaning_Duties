import { Check, Filter, Loader2, Plus, Search, Pencil, Upload, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ChangeEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { CleanerDutyDetailModal } from "../../components/common/cleaner-duty-detail-modal";
import { CompletionCelebration } from "../../components/common/completion-celebration";
import { DutyStatusBadge } from "../../components/common/duty-status-badge";
import { Input } from "../../components/ui/input";
import { PageHeader } from "../../components/common/page-header";
import { SectionTitle } from "../../components/common/section-title";
import { ConfirmationDialog } from "../../components/common/confirmation-dialog";
import { listMySites, listSites, type SiteItem } from "../../services/sites-service";
import { createDuty, deleteDuty, listAssignedDuties, listDuties, type DutyItem, updateDuty, updateDutyStatus } from "../../services/duties-service";
import { listAssignableMembers, type AssigneeOption } from "../../services/assignments-service";
import { useSession } from "../../hooks/use-session";
import { dutyFormSchema, type DutyFormInput, DUTY_PRIORITIES, DUTY_STATUSES } from "@cleaning-duties/shared";
import { notify } from "../../components/common/toast";
import { uploadDutyReferencePhoto } from "../../services/duty-photo-service";
import {
  createPreloadedDuty,
  deletePreloadedDuty,
  listPreloadedDuties,
  updatePreloadedDuty,
  type PreloadedDutyItem,
} from "../../services/preloaded-duties-service";

type ReferencePhotoItem = {
  id: string;
  previewUrl: string;
  remoteUrl: string | null;
  status: "uploading" | "done" | "error";
  fileName: string;
};

type CleanerDutyFilter = "Pending" | DutyItem["status"] | "All";
type ManagerPriorityFilter = DutyItem["priority"] | "All";
type ManagerStatusFilter = DutyItem["status"] | "All";

const CLEANER_DUTY_FILTERS: CleanerDutyFilter[] = ["Pending", "In Progress", "Completed", "Incomplete", "All"];
const MANAGER_PRIORITY_FILTERS: ManagerPriorityFilter[] = ["All", ...DUTY_PRIORITIES];
const MANAGER_STATUS_FILTERS: ManagerStatusFilter[] = ["All", ...DUTY_STATUSES];
const EDITABLE_DUTY_STATUSES = DUTY_STATUSES.filter((status) => status !== "Archived" && status !== "Missed");
const RECURRENCE_OPTIONS = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
] as const;
const WEEKDAY_OPTIONS = [
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
  { value: 0, label: "Sunday" },
] as const;
const DUTY_DESCRIPTION_PREVIEW_LENGTH = 100;

function getDutyDescriptionPreview(description: string) {
  const normalizedDescription = description.trim().replace(/\s+/g, " ");

  if (!normalizedDescription) {
    return "No description";
  }

  if (normalizedDescription.length <= DUTY_DESCRIPTION_PREVIEW_LENGTH) {
    return normalizedDescription;
  }

  return `${normalizedDescription.slice(0, DUTY_DESCRIPTION_PREVIEW_LENGTH).trimEnd()}...`;
}

function findMatchingPreloadedDuty(preloadedDuties: PreloadedDutyItem[], title: string) {
  const normalizedTitle = title.trim().toLowerCase();

  if (!normalizedTitle) {
    return null;
  }

  return preloadedDuties.find((template) => template.title.trim().toLowerCase() === normalizedTitle) ?? null;
}

function parseRecurringRule(rule: string | null): { pattern: string; interval: number; weekday: number; weekdays: number[] } {
  if (!rule) {
    return { pattern: "daily", interval: 1, weekday: 1, weekdays: [1] };
  }

  try {
    const parsed = JSON.parse(rule) as { pattern?: string; interval?: number; weekday?: number; weekdays?: number[] };
    const weekdays = Array.isArray(parsed.weekdays) && parsed.weekdays.length > 0 ? parsed.weekdays : [Number.isInteger(parsed.weekday) ? parsed.weekday ?? 1 : 1];
    return {
      pattern: parsed.pattern || "daily",
      interval: Math.max(Number(parsed.interval) || 1, 1),
      weekday: Number.isInteger(parsed.weekday) ? Number(parsed.weekday) : 1,
      weekdays,
    };
  } catch {
    return { pattern: "daily", interval: 1, weekday: 1, weekdays: [1] };
  }
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  const originalDate = next.getDate();
  next.setMonth(next.getMonth() + months);

  if (next.getDate() !== originalDate) {
    next.setDate(0);
  }

  return next;
}

function getRecurrenceStep(pattern: string, interval: number) {
  if (pattern === "daily") {
    return { unit: "days", value: 1 };
  }
  if (pattern === "weekly") {
    return { unit: "days", value: 7 };
  }
  if (pattern === "monthly") {
    return { unit: "months", value: 1 };
  }
  return { unit: "months", value: 12 };
}

function getNextWeekday(date: Date, weekday: number, includeCurrent = true) {
  const next = new Date(date);
  const daysUntilWeekday = (weekday - next.getDay() + 7) % 7;
  next.setDate(next.getDate() + (daysUntilWeekday === 0 && !includeCurrent ? 7 : daysUntilWeekday));
  return next;
}

function getUpcomingOccurrences(dateValue: string, pattern: string, interval: number, weekdays: number[] = [1]) {
  if (!dateValue) {
    return [];
  }

  const startDate = new Date(dateValue);
  if (Number.isNaN(startDate.getTime())) {
    return [];
  }

  if (pattern === "weekly") {
    const selectedWeekdays = [...new Set(weekdays)].sort((a, b) => a - b);
    const occurrences: Date[] = [];
    let cursor = new Date(startDate);

    while (occurrences.length < 6) {
      const nextDates = selectedWeekdays
        .map((weekday) => getNextWeekday(cursor, weekday, occurrences.length === 0))
        .sort((a, b) => a.getTime() - b.getTime());
      const next = nextDates.find((date) => date >= cursor);

      if (!next) {
        cursor.setDate(cursor.getDate() + 1);
        continue;
      }

      occurrences.push(next);
      cursor = new Date(next);
      cursor.setDate(cursor.getDate() + 1);
    }

    return occurrences;
  }

  const step = getRecurrenceStep(pattern, interval);
  const occurrences = [startDate];

  for (let index = 1; index < 6; index += 1) {
    const previous = occurrences[index - 1];
    if (!previous) {
      break;
    }

    if (step.unit === "months") {
      occurrences.push(addMonths(previous, step.value));
    } else {
      const next = new Date(previous);
      next.setDate(previous.getDate() + step.value);
      occurrences.push(next);
    }
  }

  return occurrences;
}

function normalizeWeekdays(value: unknown) {
  if (Array.isArray(value)) {
    return value.map(Number).filter((weekday) => Number.isInteger(weekday) && weekday >= 0 && weekday <= 6);
  }
  if (value === undefined || value === null || value === false) {
    return [];
  }
  const weekday = Number(value);
  return Number.isInteger(weekday) && weekday >= 0 && weekday <= 6 ? [weekday] : [];
}

function toWeekdayFormValues(weekdays: number[]) {
  return weekdays.map((weekday) => String(weekday));
}

function toDateTimeLocalValue(dateValue: string | null) {
  if (!dateValue) {
    return "";
  }

  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const timezoneOffsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - timezoneOffsetMs).toISOString().slice(0, 16);
}

function isCleanerActiveDuty(duty: DutyItem) {
  return duty.status === "Pending" || duty.status === "Draft" || duty.status === "Overdue" || duty.status === "In Progress";
}

function getInitials(name: string) {
  return name
    .split(" ")
    .map((part) => part.trim()[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function DutiesPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { companyId, userId, role, activeSiteId: sessionActiveSiteId, setActiveSiteId: setSessionActiveSiteId } = useSession();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dutyListRef = useRef<HTMLDivElement | null>(null);
  const dutyFormRef = useRef<HTMLElement | null>(null);
  const [search, setSearch] = useState("");
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [editingDuty, setEditingDuty] = useState<DutyItem | null>(null);
  const [selectedCleanerDuty, setSelectedCleanerDuty] = useState<DutyItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DutyItem | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [referencePhotoItems, setReferencePhotoItems] = useState<ReferencePhotoItem[]>([]);
  const [hasSelectedPreloadedDuty, setHasSelectedPreloadedDuty] = useState(false);
  const [showCompletionCelebration, setShowCompletionCelebration] = useState(false);
  const [cleanerDutyFilter, setCleanerDutyFilter] = useState<CleanerDutyFilter>("Pending");
  const [managerPriorityFilter, setManagerPriorityFilter] = useState<ManagerPriorityFilter>("All");
  const [managerStatusFilter, setManagerStatusFilter] = useState<ManagerStatusFilter>("All");
  const [saveAsPreloadedDuty, setSaveAsPreloadedDuty] = useState(false);
  const [linkedPreloadedDutyId, setLinkedPreloadedDutyId] = useState<string | null>(null);

  const { data: sites = [] } = useQuery({
    queryKey: role === "Cleaner" ? ["sites", "cleaner", userId] : ["sites", companyId],
    queryFn: () => role === "Cleaner" ? listMySites(userId ?? "") : listSites(companyId ?? ""),
    enabled: role === "Cleaner" ? Boolean(userId) : Boolean(companyId),
  });

  const activeSiteId = selectedSiteId ?? sessionActiveSiteId ?? sites[0]?.id ?? null;
  const activeSite = sites.find((site) => site.id === activeSiteId) ?? null;
  const activeBucketName = activeSite?.storageBucket || (activeSiteId ? `site-${activeSiteId}` : "");

  const { data: assignees = [] } = useQuery({
    queryKey: ["assignees", activeSiteId],
    queryFn: () => listAssignableMembers(activeSiteId ?? ""),
    enabled: Boolean(activeSiteId),
  });

  const { data: duties = [], isLoading } = useQuery({
    queryKey: role === "Cleaner" ? ["cleaner-assigned-duties", userId] : ["duties", activeSiteId, search],
    queryFn: () => {
      if (role === "Cleaner") {
        return listAssignedDuties(userId ?? "");
      }

      return listDuties(activeSiteId ?? "", search);
    },
    enabled: role === "Cleaner" ? Boolean(userId) : Boolean(activeSiteId),
  });

  const { data: preloadedDuties = [] } = useQuery({
    queryKey: ["preloaded-duties", companyId],
    queryFn: () => listPreloadedDuties(companyId ?? ""),
    enabled: Boolean(companyId) && role !== "Cleaner",
  });

  const form = useForm<DutyFormInput>({
    resolver: zodResolver(dutyFormSchema),
    defaultValues: {
      title: "",
      description: "",
      priority: "Medium",
      status: "Draft",
      dueDate: "",
      recurringPattern: "daily",
      recurringInterval: 1,
      recurringWeekday: 1,
      recurringWeekdays: ["1"],
      equipment: "",
      referencePhotos: "",
      assignedUserIds: [],
    },
  });
  const watchedTitle = form.watch("title");
  const watchedPriority = form.watch("priority");
  const watchedDueDate = form.watch("dueDate");
  const watchedRecurringPattern = form.watch("recurringPattern");
  const watchedRecurringInterval = form.watch("recurringInterval");
  const watchedRecurringWeekdays = form.watch("recurringWeekdays");

  useEffect(() => {
    form.setValue(
      "referencePhotos",
      referencePhotoItems.flatMap((photo) => (photo.remoteUrl ? [photo.remoteUrl] : [])).join(", "),
      { shouldDirty: true, shouldValidate: true },
    );
  }, [form, referencePhotoItems]);

  useEffect(() => {
    if (watchedPriority === "Periodical" && !watchedRecurringPattern) {
      form.setValue("recurringPattern", "daily", { shouldDirty: true });
      form.setValue("recurringInterval", 1, { shouldDirty: true });
      form.setValue("recurringWeekday", 1, { shouldDirty: true });
      form.setValue("recurringWeekdays", ["1"], { shouldDirty: true });
    }
  }, [form, watchedPriority, watchedRecurringPattern]);

  const createMutation = useMutation({
    mutationFn: (values: DutyFormInput) => {
      if (!activeSiteId || !userId) {
        throw new Error("Missing duty context");
      }

      return createDuty(activeSiteId, userId, values);
    },
    onSuccess: async (_createdDuty, values) => {
      let preloadedDutyCreated = false;

      if (saveAsPreloadedDuty && companyId && userId) {
        try {
          await createPreloadedDuty(companyId, userId, values);
          preloadedDutyCreated = true;
        } catch (error) {
          notify({
            tone: "error",
            title: "Duty created, template failed",
            message: error instanceof Error ? error.message : "Could not add this duty to preloaded duties.",
          });
        }
      }

      await queryClient.invalidateQueries({ queryKey: ["duties"] });
      await queryClient.invalidateQueries({ queryKey: ["cleaner-assigned-duties"] });
      await queryClient.invalidateQueries({ queryKey: ["preloaded-duties", companyId] });
      await queryClient.refetchQueries({ queryKey: ["duties", activeSiteId, search] });
      setShowCreate(false);
      setHasSelectedPreloadedDuty(false);
      setSaveAsPreloadedDuty(false);
      setReferencePhotoItems([]);
      form.reset();
      notify({
        tone: "success",
        title: "Duty created",
        message: preloadedDutyCreated ? "The duty was saved and added to preloaded duties." : "The duty was saved successfully.",
      });
    },
    onError: (error) => {
      notify({ tone: "error", title: "Could not create duty", message: error instanceof Error ? error.message : "Unknown error" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ dutyId, values }: { dutyId: string; values: DutyFormInput }) => updateDuty(dutyId, values),
    onSuccess: async (_updatedDuty, { values }) => {
      let preloadedDutyAction: "created" | "updated" | "removed" | null = null;
      const matchingTemplate = linkedPreloadedDutyId
        ? preloadedDuties.find((template) => template.id === linkedPreloadedDutyId) ?? null
        : findMatchingPreloadedDuty(preloadedDuties, editingDuty?.title ?? values.title);

      if (companyId && userId) {
        try {
          if (saveAsPreloadedDuty && matchingTemplate) {
            await updatePreloadedDuty(matchingTemplate.id, values);
            preloadedDutyAction = "updated";
          } else if (saveAsPreloadedDuty) {
            await createPreloadedDuty(companyId, userId, values);
            preloadedDutyAction = "created";
          } else if (matchingTemplate) {
            await deletePreloadedDuty(matchingTemplate.id);
            preloadedDutyAction = "removed";
          }
        } catch (error) {
          notify({
            tone: "error",
            title: "Duty updated, template sync failed",
            message: error instanceof Error ? error.message : "Could not update the preloaded duty.",
          });
        }
      }

      await queryClient.invalidateQueries({ queryKey: ["duties"] });
      await queryClient.invalidateQueries({ queryKey: ["cleaner-assigned-duties"] });
      await queryClient.invalidateQueries({ queryKey: ["preloaded-duties", companyId] });
      await queryClient.refetchQueries({ queryKey: ["duties", activeSiteId, search] });
      setEditingDuty(null);
      setHasSelectedPreloadedDuty(false);
      setSaveAsPreloadedDuty(false);
      setLinkedPreloadedDutyId(null);
      setReferencePhotoItems([]);
      form.reset();
      const successMessage = preloadedDutyAction === "created"
        ? "The duty was updated and added to preloaded duties."
        : preloadedDutyAction === "updated"
          ? "The duty and its preloaded version were updated."
          : preloadedDutyAction === "removed"
            ? "The duty was updated and removed from preloaded duties."
            : "The duty changes were saved successfully.";
      notify({ tone: "success", title: "Duty updated", message: successMessage });
    },
    onError: (error) => {
      notify({ tone: "error", title: "Could not update duty", message: error instanceof Error ? error.message : "Unknown error" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteDuty,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["duties"] });
      await queryClient.invalidateQueries({ queryKey: ["cleaner-assigned-duties"] });
      await queryClient.refetchQueries({ queryKey: ["duties", activeSiteId, search] });
      setDeleteTarget(null);
      notify({ tone: "success", title: "Duty deleted", message: "The duty was removed successfully." });
    },
    onError: (error) => {
      notify({ tone: "error", title: "Could not delete duty", message: error instanceof Error ? error.message : "Unknown error" });
    },
  });

  const openCleanerDutyMutation = useMutation({
    mutationFn: async (duty: DutyItem) => {
      if (duty.status === "Completed" || duty.status === "In Progress") {
        return duty;
      }

      return updateDutyStatus(duty.id, "In Progress");
    },
    onSuccess: async (duty) => {
      await queryClient.invalidateQueries({ queryKey: ["cleaner-assigned-duties", userId] });
      setSelectedCleanerDuty(duty);
    },
    onError: (error) => {
      notify({ tone: "error", title: "Could not open duty", message: error instanceof Error ? error.message : "Unknown error" });
    },
  });

  const dutyCount = useMemo(() => duties.length, [duties]);
  const siteDuties = useMemo(
    () => role === "Cleaner" ? duties.filter((duty) => duty.siteId === activeSiteId) : duties,
    [activeSiteId, duties, role],
  );
  const visibleDuties = useMemo(() => {
    if (role !== "Cleaner") {
      return siteDuties.filter((duty) => {
        const matchesPriority = managerPriorityFilter === "All" || duty.priority === managerPriorityFilter;
        const matchesStatus = managerStatusFilter === "All" || duty.status === managerStatusFilter;

        return matchesPriority && matchesStatus;
      });
    }

    if (cleanerDutyFilter === "All") {
      return siteDuties;
    }

    if (cleanerDutyFilter === "Pending") {
      return siteDuties.filter((duty) => duty.status === "Pending" || duty.status === "Draft" || duty.status === "Overdue");
    }

    return siteDuties.filter((duty) => duty.status === cleanerDutyFilter);
  }, [cleanerDutyFilter, managerPriorityFilter, managerStatusFilter, role, siteDuties]);
  const assigneesById = useMemo(
    () => new Map(assignees.map((assignee) => [assignee.id, assignee])),
    [assignees],
  );
  const matchingPreloadedDuties = useMemo(() => {
    const query = watchedTitle.trim().toLowerCase();

    if (role === "Cleaner" || editingDuty || hasSelectedPreloadedDuty || query.length < 2) {
      return [];
    }

    return preloadedDuties
      .filter((template) => {
        const title = template.title.toLowerCase();
        return title.includes(query) || query.split(/\s+/).some((part) => part.length > 2 && title.includes(part));
      })
      .slice(0, 5);
  }, [editingDuty, hasSelectedPreloadedDuty, preloadedDuties, role, watchedTitle]);
  const recurrencePreviewDates = useMemo(
    () => watchedPriority === "Periodical"
      ? getUpcomingOccurrences(watchedDueDate || "", watchedRecurringPattern || "daily", Number(watchedRecurringInterval) || 1, normalizeWeekdays(watchedRecurringWeekdays).length ? normalizeWeekdays(watchedRecurringWeekdays) : [1])
      : [],
    [watchedDueDate, watchedPriority, watchedRecurringInterval, watchedRecurringPattern, watchedRecurringWeekdays],
  );

  useEffect(() => {
    if (sessionActiveSiteId) {
      setSelectedSiteId(sessionActiveSiteId);
    }
  }, [sessionActiveSiteId]);

  function startCreate() {
    setEditingDuty(null);
    setShowCreate(true);
    setShowPhotoModal(false);
    setHasSelectedPreloadedDuty(false);
    setSaveAsPreloadedDuty(false);
    setLinkedPreloadedDutyId(null);
    setReferencePhotoItems([]);
    form.reset({
      title: "",
      description: "",
      priority: "Medium",
      status: "Draft",
      dueDate: "",
      recurringPattern: "daily",
      recurringInterval: 1,
      recurringWeekday: 1,
      recurringWeekdays: ["1"],
      equipment: "",
      referencePhotos: "",
      assignedUserIds: [],
    });
  }

  useEffect(() => {
    if (role === "Cleaner" || searchParams.get("create") !== "1") {
      return;
    }

    startCreate();

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("create");
    setSearchParams(nextParams, { replace: true });
  }, [role, searchParams, setSearchParams]);

  function startEdit(duty: DutyItem) {
    const recurringRule = parseRecurringRule(duty.recurringRule);
    const matchingTemplate = findMatchingPreloadedDuty(preloadedDuties, duty.title);
    setShowCreate(false);
    setShowPhotoModal(false);
    setHasSelectedPreloadedDuty(false);
    setSaveAsPreloadedDuty(Boolean(matchingTemplate));
    setLinkedPreloadedDutyId(matchingTemplate?.id ?? null);
    setEditingDuty(duty);
    setReferencePhotoItems(
      duty.referencePhotos.map((url) => ({
        id: crypto.randomUUID(),
        previewUrl: url,
        remoteUrl: url,
        status: "done",
        fileName: url,
      })),
    );
    form.reset({
      title: duty.title,
      description: duty.description,
      priority: duty.priority,
      status: duty.status,
      dueDate: toDateTimeLocalValue(duty.dueDate),
      recurringPattern: recurringRule.pattern,
      recurringInterval: recurringRule.interval,
      recurringWeekday: recurringRule.weekday,
      recurringWeekdays: toWeekdayFormValues(recurringRule.weekdays),
      equipment: duty.equipment.join(", "),
      referencePhotos: duty.referencePhotos.join(", "),
      assignedUserIds: duty.assignedUserIds,
    });

    window.requestAnimationFrame(() => {
      dutyFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function applyPreloadedDuty(template: PreloadedDutyItem) {
    const photoItems = template.referencePhotos.map((url) => ({
      id: crypto.randomUUID(),
      previewUrl: url,
      remoteUrl: url,
      status: "done" as const,
      fileName: url,
    }));

    setHasSelectedPreloadedDuty(true);
    setSaveAsPreloadedDuty(false);
    setLinkedPreloadedDutyId(template.id);
    setReferencePhotoItems(photoItems);
    form.reset({
      title: template.title,
      description: template.description,
      priority: template.priority,
      status: template.status,
      dueDate: "",
      recurringPattern: "daily",
      recurringInterval: 1,
      recurringWeekday: 1,
      recurringWeekdays: ["1"],
      equipment: template.equipment.join(", "),
      referencePhotos: template.referencePhotos.join(", "),
      assignedUserIds: form.getValues("assignedUserIds") ?? [],
    });
  }

  async function handlePhotoSelection(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";

    if (files.length === 0) {
      return;
    }

    if (!activeSite || !activeBucketName) {
      notify({ tone: "error", title: "No site selected", message: "Select a site before uploading photos." });
      return;
    }

    const dutyTitle = form.getValues("title") || "duty";
    const pendingPhotos = files.map((file) => ({
      id: crypto.randomUUID(),
      previewUrl: URL.createObjectURL(file),
      remoteUrl: null,
      status: "uploading" as const,
      fileName: file.name,
    }));

    setReferencePhotoItems((current) => [...current, ...pendingPhotos]);
    setShowPhotoModal(true);

    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      const pendingPhoto = pendingPhotos[index];

      if (!file || !pendingPhoto) {
        continue;
      }

      try {
        const remoteUrl = await uploadDutyReferencePhoto({
          bucketName: activeBucketName,
          siteId: activeSite.id,
          dutyTitle,
          file,
        });

        setReferencePhotoItems((current) =>
          current.map((photo) =>
            photo.id === pendingPhoto.id
              ? { ...photo, remoteUrl, status: "done" }
              : photo,
          ),
        );
      } catch (error) {
        setReferencePhotoItems((current) =>
          current.map((photo) =>
            photo.id === pendingPhoto.id
              ? { ...photo, status: "error" }
              : photo,
          ),
        );
        notify({
          tone: "error",
          title: "Photo upload failed",
          message: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }
  }

  function removeReferencePhoto(photoId: string) {
    setReferencePhotoItems((current) => {
      const target = current.find((photo) => photo.id === photoId);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return current.filter((photo) => photo.id !== photoId);
    });
  }

  async function onSubmit(values: DutyFormInput) {
    if (referencePhotoItems.some((photo) => photo.status === "uploading")) {
      notify({ tone: "error", title: "Photos still uploading", message: "Wait for uploads to finish before saving the duty." });
      return;
    }

    if (values.priority === "Periodical" && values.recurringPattern === "weekly" && normalizeWeekdays(values.recurringWeekdays).length === 0) {
      notify({ tone: "error", title: "Select weekdays", message: "Choose at least one weekday for weekly duties." });
      return;
    }

    if (editingDuty) {
      await updateMutation.mutateAsync({ dutyId: editingDuty.id, values });
      return;
    }

    await createMutation.mutateAsync(values);
  }

  function scrollToDutyList() {
    window.requestAnimationFrame(() => {
      dutyListRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  function handleManagerPriorityFilter(priority: ManagerPriorityFilter) {
    setManagerPriorityFilter(priority);
    scrollToDutyList();
  }

  function handleManagerStatusFilter(status: ManagerStatusFilter) {
    setManagerStatusFilter(status);
    scrollToDutyList();
  }

  function handleCleanerDutyCompleted() {
    if (siteDuties.filter(isCleanerActiveDuty).length <= 1) {
      setShowCompletionCelebration(true);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Cleaning Duties"
        title="Duty board"
        description={role === "Cleaner" ? "Review and complete your assigned duties for the selected site." : "Review the current duty load, filter by priority or status, and open any duty to manage assignments and evidence."}
        actions={role === "Cleaner" ? null : (
          <>
            <Button variant="secondary">
              <Filter className="h-4 w-4" />
              Filters
            </Button>
            <Button onClick={startCreate} disabled={createMutation.isPending || updateMutation.isPending || deleteMutation.isPending}>
              {createMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating...
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4" />
                  Create Duty
                </>
              )}
            </Button>
          </>
        )}
      />

      <Card className="space-y-4 p-5">
        <div className="grid gap-4 lg:grid-cols-[1fr_0.4fr]">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Site</label>
            <select
              value={activeSiteId ?? ""}
              onChange={(event) => {
                const nextSiteId = event.target.value || null;
                setSelectedSiteId(nextSiteId);
                setSessionActiveSiteId(nextSiteId);
              }}
              className="w-full rounded-md border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
            >
              <option value="">Select a site</option>
              {sites.map((site: SiteItem) => (
                <option key={site.id} value={site.id}>
                  {site.name}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Search</label>
            <div className="flex items-center gap-3 rounded-md bg-slate-50 px-4 py-3 ring-1 ring-slate-200">
              <Search className="h-4 w-4 text-slate-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="w-full bg-transparent text-sm outline-none"
                placeholder="Search duties..."
              />
            </div>
          </div>
        </div>
        {role !== "Cleaner" ? (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            {MANAGER_PRIORITY_FILTERS.map((priority) => {
              const isActive = managerPriorityFilter === priority;

              return (
                <Button
                  key={priority}
                  type="button"
                  variant={isActive ? "primary" : "secondary"}
                  onClick={() => handleManagerPriorityFilter(priority)}
                >
                  {priority === "All" ? "All priorities" : priority}
                </Button>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-2">
            {MANAGER_STATUS_FILTERS.map((status) => {
              const isActive = managerStatusFilter === status;

              return status === "All" ? (
                <Button
                  key={status}
                  type="button"
                  variant={isActive ? "primary" : "ghost"}
                  onClick={() => handleManagerStatusFilter(status)}
                >
                  All statuses
                </Button>
              ) : (
                <button
                  key={status}
                  type="button"
                  onClick={() => handleManagerStatusFilter(status)}
                  className={`rounded-full border px-3 py-2 text-xs font-semibold transition ${
                    isActive
                      ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                      : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <DutyStatusBadge status={status} />
                </button>
              );
            })}
          </div>
        </div>
        ) : (
        <div className="flex flex-wrap gap-2">
          {CLEANER_DUTY_FILTERS.map((filter) => {
            const count = filter === "All"
              ? siteDuties.length
              : filter === "Pending"
                ? siteDuties.filter((duty) => duty.status === "Pending" || duty.status === "Draft" || duty.status === "Overdue").length
                : siteDuties.filter((duty) => duty.status === filter).length;
            const isActive = cleanerDutyFilter === filter;

            return (
              <button
                key={filter}
                type="button"
                onClick={() => setCleanerDutyFilter(filter)}
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-semibold transition ${
                  isActive
                    ? "border-slate-900 bg-slate-900 text-white shadow-sm"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                {filter === "All" ? <span>All</span> : <DutyStatusBadge status={filter === "Pending" ? "Pending" : filter} />}
                <span className={isActive ? "text-white" : "text-slate-500"}>{count}</span>
              </button>
            );
          })}
        </div>
        )}
      </Card>

      {role !== "Cleaner" && (showCreate || editingDuty) ? (
        <Card ref={dutyFormRef} className="scroll-mt-6 space-y-4 p-5">
          <div className="flex items-center justify-between gap-4">
            <SectionTitle
              title={editingDuty ? `Edit ${editingDuty.title}` : "Create duty"}
              description="Capture the work details, deadline, and equipment required."
            />
            <div className="flex flex-wrap items-center justify-end gap-3">
              <label className="flex cursor-pointer items-center gap-2 rounded-md border border-[var(--company-border)] bg-white px-3 py-2 text-sm font-medium text-[var(--company-text)]">
                <input
                  type="checkbox"
                  role="switch"
                  checked={saveAsPreloadedDuty}
                  onChange={(event) => setSaveAsPreloadedDuty(event.target.checked)}
                  className="sr-only"
                  disabled={createMutation.isPending || updateMutation.isPending}
                />
                <span
                  aria-hidden="true"
                  className="relative inline-flex h-5 w-9 shrink-0 rounded-full transition-colors"
                  style={{ backgroundColor: saveAsPreloadedDuty ? "var(--company-primary)" : "#cbd5e1" } as CSSProperties}
                >
                  <span
                    className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-transform ${
                      saveAsPreloadedDuty ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </span>
                <span>{editingDuty ? "Preloaded duty" : "Save as preloaded"}</span>
              </label>
              <Button
                variant="secondary"
                disabled={createMutation.isPending || updateMutation.isPending}
                onClick={() => {
                  setShowCreate(false);
                  setEditingDuty(null);
                  setShowPhotoModal(false);
                  setHasSelectedPreloadedDuty(false);
                  setSaveAsPreloadedDuty(false);
                  setLinkedPreloadedDutyId(null);
                  setReferencePhotoItems([]);
                  form.reset();
                }}
              >
                Close
              </Button>
            </div>
          </div>

          <form className="grid gap-4 lg:grid-cols-2" onSubmit={form.handleSubmit(onSubmit)}>
            <div className="space-y-2 lg:col-span-2">
              <label className="text-sm font-medium">Title</label>
              <div className="relative">
                <Input
                  {...form.register("title", {
                    onChange: () => setHasSelectedPreloadedDuty(false),
                  })}
                  placeholder="Lobby deep clean"
                />
                {matchingPreloadedDuties.length > 0 ? (
                  <div className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-20 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
                    {matchingPreloadedDuties.map((template) => (
                      <button
                        key={template.id}
                        type="button"
                        className="flex w-full items-start justify-between gap-4 border-b border-slate-100 px-4 py-3 text-left transition last:border-b-0 hover:bg-slate-50"
                        onClick={() => applyPreloadedDuty(template)}
                      >
                        <span>
                          <span className="block text-sm font-semibold text-slate-950">{template.title}</span>
                          <span className="mt-1 line-clamp-1 block text-xs text-slate-500">{template.description || "No description"}</span>
                        </span>
                        <span className="shrink-0 rounded-full bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200">
                          {template.referencePhotos.length} photos
                        </span>
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
            <div className="space-y-2 lg:col-span-2">
              <label className="text-sm font-medium">Description</label>
              <textarea
                {...form.register("description")}
                rows={4}
                className="w-full rounded-md border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
                placeholder="Write the duty scope and any special instructions."
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Priority</label>
              <select {...form.register("priority")} className="w-full rounded-md border border-slate-200 bg-white px-4 py-3 text-sm">
                {DUTY_PRIORITIES.map((priority) => (
                  <option key={priority} value={priority}>
                    {priority}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <select {...form.register("status")} className="w-full rounded-md border border-slate-200 bg-white px-4 py-3 text-sm">
                {EDITABLE_DUTY_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Due date</label>
              <Input type="datetime-local" {...form.register("dueDate")} />
            </div>
            {watchedPriority === "Periodical" ? (
              <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50 p-4 lg:col-span-2">
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Recurrence</label>
                    <select
                      {...form.register("recurringPattern")}
                      className="w-full rounded-md border border-slate-200 bg-white px-4 py-3 text-sm"
                    >
                      {RECURRENCE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  {watchedRecurringPattern === "weekly" ? (
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Repeat on</label>
                      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                        {WEEKDAY_OPTIONS.map((weekday) => (
                          <label key={weekday.value} className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm">
                            <input type="checkbox" value={weekday.value} {...form.register("recurringWeekdays")} />
                            <span>{weekday.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
                {recurrencePreviewDates.length > 0 ? (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Upcoming dates</p>
                    <div className="flex flex-wrap gap-2">
                      {recurrencePreviewDates.map((date) => (
                        <span key={date.toISOString()} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                          {date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                        </span>
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">Select a due date to preview the upcoming dates.</p>
                )}
              </div>
            ) : null}
            <div className="space-y-2">
              <label className="text-sm font-medium">Equipment required</label>
              <Input {...form.register("equipment")} placeholder="Vacuum, Mop, Gloves" />
            </div>
            <div className="space-y-3 lg:col-span-2">
              <div className="flex items-center justify-between gap-4">
                <label className="text-sm font-medium">Reference photos</label>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setShowPhotoModal(true);
                    fileInputRef.current?.click();
                  }}
                  disabled={createMutation.isPending || updateMutation.isPending || !activeSite}
                >
                  <Upload className="h-4 w-4" />
                  Upload photos
                </Button>
              </div>
              <p className="text-sm text-slate-500">
                Upload photos or use your device camera. Files are stored in the site bucket for dashboard reports and evidence.
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                multiple
                className="hidden"
                onChange={handlePhotoSelection}
              />
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {referencePhotoItems.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500 sm:col-span-2 xl:col-span-3">
                    No reference photos uploaded yet.
                  </div>
                ) : (
                  referencePhotoItems.map((photo) => (
                    <div key={photo.id} className="relative overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                      <img src={photo.previewUrl} alt={photo.fileName} className="h-40 w-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-transparent" />
                      <div className="absolute left-3 top-3">
                        {photo.status === "uploading" ? (
                          <span className="inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-1 text-xs font-medium text-slate-700">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Uploading
                          </span>
                        ) : photo.status === "done" ? (
                          <span className="inline-flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700">
                            <Check className="h-3.5 w-3.5" />
                            Uploaded
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-2 rounded-full bg-rose-50 px-3 py-1 text-xs font-medium text-rose-700">
                            Failed
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        className="absolute right-3 top-3 rounded-full bg-white/90 p-2 text-slate-700 transition hover:bg-white"
                        onClick={() => removeReferencePhoto(photo.id)}
                        aria-label={`Remove ${photo.fileName}`}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="space-y-3 lg:col-span-2">
              <label className="text-sm font-medium">Assign cleaners</label>
              <div className="grid gap-3 md:grid-cols-2">
                {assignees.map((assignee: AssigneeOption) => (
                  <label key={assignee.id} className="flex items-center gap-3 rounded-md border border-slate-200 bg-slate-50 px-4 py-3">
                    <input type="checkbox" value={assignee.id} {...form.register("assignedUserIds")} />
                    <div>
                      <p className="text-sm font-medium text-slate-950">{assignee.name}</p>
                      <p className="text-xs text-slate-500">{assignee.role}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex gap-3 lg:col-span-2">
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {createMutation.isPending && !editingDuty ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : updateMutation.isPending && editingDuty ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : editingDuty ? (
                  "Save changes"
                ) : (
                  "Create duty"
                )}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={createMutation.isPending || updateMutation.isPending}
                onClick={() => {
                  setShowCreate(false);
                  setEditingDuty(null);
                  setShowPhotoModal(false);
                  setReferencePhotoItems([]);
                  form.reset();
                  setHasSelectedPreloadedDuty(false);
                  setSaveAsPreloadedDuty(false);
                  setLinkedPreloadedDutyId(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      {showPhotoModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-xl space-y-5 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-lg font-semibold text-slate-950">Upload reference photos</p>
                <p className="mt-1 text-sm text-slate-500">
                  Use your camera or gallery. Photos are stored in the bucket for {activeSite?.name ?? "the selected site"}.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPhotoModal(false)}
                className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close photo dialog"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm text-slate-700">Native capture is enabled on supported mobile browsers.</p>
              <p className="mt-1 text-xs text-slate-500">You can upload unlimited images. Each one will show a preview and upload status below.</p>
            </div>

            <div className="flex flex-wrap justify-end gap-3">
              <Button variant="secondary" type="button" onClick={() => setShowPhotoModal(false)}>
                Close
              </Button>
              <Button type="button" onClick={() => fileInputRef.current?.click()} disabled={!activeSite}>
                <Upload className="h-4 w-4" />
                Choose files
              </Button>
            </div>
          </Card>
        </div>
      ) : null}

      <div ref={dutyListRef} className="grid scroll-mt-6 gap-4 xl:grid-cols-2">
        {isLoading ? (
          <Card className="p-5">Loading duties...</Card>
        ) : visibleDuties.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-lg font-semibold text-slate-950">{role === "Cleaner" || siteDuties.length > 0 ? "No duties match this filter" : "No duties for this site"}</p>
            <p className="mt-2 text-sm text-slate-500">{role === "Cleaner" || siteDuties.length > 0 ? "Try another filter for the selected site." : "Create the first duty to start assigning cleaners and due dates."}</p>
            {role !== "Cleaner" ? (
              <div className="mt-4">
              <Button onClick={startCreate} disabled={createMutation.isPending || updateMutation.isPending || deleteMutation.isPending}>
                {createMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Duty"
                )}
              </Button>
            </div>
            ) : null}
          </Card>
        ) : (
          visibleDuties.map((duty) => {
            const assignedCleaners = duty.assignedUserIds
              .map((assigneeId) => assigneesById.get(assigneeId))
              .filter((assignee): assignee is AssigneeOption => Boolean(assignee));
            const visibleAssignedCleaners = assignedCleaners.slice(0, 3);
            const extraAssignedCleanersCount = Math.max(assignedCleaners.length - visibleAssignedCleaners.length, 0);

            return (
              <Card
                key={duty.id}
                role={role === "Cleaner" ? "button" : undefined}
                tabIndex={role === "Cleaner" ? 0 : undefined}
                className={`space-y-4 p-5 ${role === "Cleaner" ? "cursor-pointer transition hover:-translate-y-0.5 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-slate-300" : ""}`}
                onClick={role === "Cleaner" ? () => openCleanerDutyMutation.mutate(duty) : undefined}
                onKeyDown={role === "Cleaner" ? (event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openCleanerDutyMutation.mutate(duty);
                  }
                } : undefined}
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-lg font-semibold text-slate-950">{duty.title}</p>
                    <p className="mt-1 text-sm text-slate-500">{getDutyDescriptionPreview(duty.description)}</p>
                  </div>
                  <DutyStatusBadge status={duty.status} />
                </div>
                <div className="flex flex-wrap gap-2 text-xs font-medium text-slate-600">
                  <span className="rounded-full bg-slate-50 px-3 py-1 ring-1 ring-slate-200">{duty.priority}</span>
                  <span className="rounded-full bg-slate-50 px-3 py-1 ring-1 ring-slate-200">{duty.dueDate ? new Date(duty.dueDate).toLocaleString() : "No due date"}</span>
                </div>
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div className="flex flex-wrap gap-2">
                    {role === "Cleaner" ? (
                      <Button
                        variant="secondary"
                        onClick={(event) => {
                          event.stopPropagation();
                          openCleanerDutyMutation.mutate(duty);
                        }}
                        disabled={openCleanerDutyMutation.isPending}
                      >
                        {openCleanerDutyMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                        Open
                      </Button>
                    ) : (
                      <>
                        <Button variant="secondary" onClick={() => startEdit(duty)}>
                          <Pencil className="h-4 w-4" />
                          Edit
                        </Button>
                        <Button variant="ghost" onClick={() => setDeleteTarget(duty)}>
                          <Trash2 className="h-4 w-4" />
                          Delete
                        </Button>
                      </>
                    )}
                  </div>
                  {role !== "Cleaner" && assignedCleaners.length > 0 ? (
                    <div
                      className="ml-auto flex items-center justify-end -space-x-2"
                      aria-label={`${assignedCleaners.length} assigned cleaner${assignedCleaners.length === 1 ? "" : "s"}`}
                    >
                      {visibleAssignedCleaners.map((cleaner) => (
                        <div
                          key={cleaner.id}
                          title={cleaner.name}
                          className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-emerald-100 text-xs font-bold text-emerald-800 shadow-sm"
                        >
                          {getInitials(cleaner.name) || "?"}
                        </div>
                      ))}
                      {extraAssignedCleanersCount > 0 ? (
                        <div
                          title={`${extraAssignedCleanersCount} more assigned`}
                          className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-slate-900 text-xs font-bold text-white shadow-sm"
                        >
                          +{extraAssignedCleanersCount}
                        </div>
                      ) : null}
                    </div>
                  ) : role !== "Cleaner" ? (
                    <p className="ml-auto text-right text-xs font-medium text-amber-600">No cleaner assigned</p>
                  ) : (
                    <p className="ml-auto text-right text-xs font-medium text-slate-500">{activeSite?.name ?? "Selected site"}</p>
                  )}
                </div>
              </Card>
            );
          })
        )}
      </div>

      {role !== "Cleaner" ? (
      <Card className="space-y-4 p-5">
        <SectionTitle title="Status distribution" description={`The current mix of work across the active site. ${dutyCount} duties loaded.`} />
        <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-6">
          {DUTY_STATUSES.map((status) => (
            <div key={status} className="rounded-md bg-slate-50 p-4">
              <DutyStatusBadge status={status} />
              <p className="mt-2 text-2xl font-semibold text-slate-950">{duties.filter((duty) => duty.status === status).length}</p>
            </div>
          ))}
        </div>
      </Card>
      ) : null}

      {deleteTarget ? (
        <ConfirmationDialog
          title={`Delete ${deleteTarget.title}?`}
          description="This will permanently remove the duty and its references."
          confirmLabel={deleteMutation.isPending ? "Deleting..." : "Delete duty"}
          destructive
          onCancel={() => setDeleteTarget(null)}
          onConfirm={async () => {
            await deleteMutation.mutateAsync(deleteTarget.id);
          }}
        />
      ) : null}

      {selectedCleanerDuty ? (
        <CleanerDutyDetailModal
          duty={selectedCleanerDuty}
          site={activeSite}
          userId={userId}
          onCompleted={handleCleanerDutyCompleted}
          onClose={() => setSelectedCleanerDuty(null)}
        />
      ) : null}

      {showCompletionCelebration ? (
        <CompletionCelebration onComplete={() => setShowCompletionCelebration(false)} />
      ) : null}
    </div>
  );
}
