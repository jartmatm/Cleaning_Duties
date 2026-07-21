import { Check, Filter, Loader2, Plus, Search, Pencil, Upload, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { CleanerDutyDetailModal } from "../../components/common/cleaner-duty-detail-modal";
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

type ReferencePhotoItem = {
  id: string;
  previewUrl: string;
  remoteUrl: string | null;
  status: "uploading" | "done" | "error";
  fileName: string;
};

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
  const [search, setSearch] = useState("");
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [editingDuty, setEditingDuty] = useState<DutyItem | null>(null);
  const [selectedCleanerDuty, setSelectedCleanerDuty] = useState<DutyItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DutyItem | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [referencePhotoItems, setReferencePhotoItems] = useState<ReferencePhotoItem[]>([]);

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

  const form = useForm<DutyFormInput>({
    resolver: zodResolver(dutyFormSchema),
    defaultValues: {
      title: "",
      description: "",
      priority: "Medium",
      status: "Draft",
      dueDate: "",
      equipment: "",
      referencePhotos: "",
      assignedUserIds: [],
    },
  });

  useEffect(() => {
    form.setValue(
      "referencePhotos",
      referencePhotoItems.flatMap((photo) => (photo.remoteUrl ? [photo.remoteUrl] : [])).join(", "),
      { shouldDirty: true, shouldValidate: true },
    );
  }, [form, referencePhotoItems]);

  const createMutation = useMutation({
    mutationFn: (values: DutyFormInput) => {
      if (!activeSiteId || !userId) {
        throw new Error("Missing duty context");
      }

      return createDuty(activeSiteId, userId, values);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["duties"] });
      await queryClient.invalidateQueries({ queryKey: ["cleaner-assigned-duties"] });
      await queryClient.refetchQueries({ queryKey: ["duties", activeSiteId, search] });
      setShowCreate(false);
      setReferencePhotoItems([]);
      form.reset();
      notify({ tone: "success", title: "Duty created", message: "The duty was saved successfully." });
    },
    onError: (error) => {
      notify({ tone: "error", title: "Could not create duty", message: error instanceof Error ? error.message : "Unknown error" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ dutyId, values }: { dutyId: string; values: DutyFormInput }) => updateDuty(dutyId, values),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["duties"] });
      await queryClient.invalidateQueries({ queryKey: ["cleaner-assigned-duties"] });
      await queryClient.refetchQueries({ queryKey: ["duties", activeSiteId, search] });
      setEditingDuty(null);
      setReferencePhotoItems([]);
      form.reset();
      notify({ tone: "success", title: "Duty updated", message: "The duty changes were saved successfully." });
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
  const visibleDuties = useMemo(
    () => role === "Cleaner" ? duties.filter((duty) => duty.siteId === activeSiteId) : duties,
    [activeSiteId, duties, role],
  );
  const assigneesById = useMemo(
    () => new Map(assignees.map((assignee) => [assignee.id, assignee])),
    [assignees],
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
    setReferencePhotoItems([]);
    form.reset({
      title: "",
      description: "",
      priority: "Medium",
      status: "Draft",
      dueDate: "",
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
    setShowCreate(false);
    setShowPhotoModal(false);
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
      dueDate: duty.dueDate ? duty.dueDate.slice(0, 16) : "",
      equipment: duty.equipment.join(", "),
      referencePhotos: duty.referencePhotos.join(", "),
      assignedUserIds: duty.assignedUserIds,
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

    if (editingDuty) {
      await updateMutation.mutateAsync({ dutyId: editingDuty.id, values });
      return;
    }

    await createMutation.mutateAsync(values);
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
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
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
            <div className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200">
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
        <div className="flex flex-wrap gap-2">
          {DUTY_PRIORITIES.map((priority) => (
            <Button key={priority} variant="secondary">
              {priority}
            </Button>
          ))}
          {DUTY_STATUSES.slice(0, 4).map((status) => (
            <Button key={status} variant="ghost">
              {status}
            </Button>
          ))}
        </div>
        ) : null}
      </Card>

      {role !== "Cleaner" && (showCreate || editingDuty) ? (
        <Card className="space-y-4 p-5">
          <div className="flex items-center justify-between gap-4">
            <SectionTitle
              title={editingDuty ? `Edit ${editingDuty.title}` : "Create duty"}
              description="Capture the work details, deadline, and equipment required."
            />
            <Button
              variant="secondary"
              disabled={createMutation.isPending || updateMutation.isPending}
              onClick={() => {
                setShowCreate(false);
                setEditingDuty(null);
                setShowPhotoModal(false);
                setReferencePhotoItems([]);
                form.reset();
              }}
            >
              Close
            </Button>
          </div>

          <form className="grid gap-4 lg:grid-cols-2" onSubmit={form.handleSubmit(onSubmit)}>
            <div className="space-y-2 lg:col-span-2">
              <label className="text-sm font-medium">Title</label>
              <Input {...form.register("title")} placeholder="Lobby deep clean" />
            </div>
            <div className="space-y-2 lg:col-span-2">
              <label className="text-sm font-medium">Description</label>
              <textarea
                {...form.register("description")}
                rows={4}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
                placeholder="Write the duty scope and any special instructions."
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Priority</label>
              <select {...form.register("priority")} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">
                {DUTY_PRIORITIES.map((priority) => (
                  <option key={priority} value={priority}>
                    {priority}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Status</label>
              <select {...form.register("status")} className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">
                {DUTY_STATUSES.map((status) => (
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
                  <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500 sm:col-span-2 xl:col-span-3">
                    No reference photos uploaded yet.
                  </div>
                ) : (
                  referencePhotoItems.map((photo) => (
                    <div key={photo.id} className="relative overflow-hidden rounded-3xl border border-slate-200 bg-slate-50">
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
                  <label key={assignee.id} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
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

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
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

      <div className="grid gap-4 xl:grid-cols-2">
        {isLoading ? (
          <Card className="p-5">Loading duties...</Card>
        ) : visibleDuties.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-lg font-semibold text-slate-950">No duties for this site</p>
            <p className="mt-2 text-sm text-slate-500">{role === "Cleaner" ? "No assigned duties for the selected site." : "Create the first duty to start assigning cleaners and due dates."}</p>
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
                    <p className="mt-1 text-sm text-slate-500">{duty.description || "No description"}</p>
                  </div>
                  <div className="shrink-0 rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{duty.status}</div>
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
            <div key={status} className="rounded-2xl bg-slate-50 p-4">
              <p className="text-sm text-slate-500">{status}</p>
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
          onClose={() => setSelectedCleanerDuty(null)}
        />
      ) : null}
    </div>
  );
}
