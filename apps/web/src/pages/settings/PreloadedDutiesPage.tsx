import { Check, Loader2, Pencil, Plus, Trash2, Upload, X } from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Navigate, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { dutyFormSchema, type DutyFormInput, DUTY_PRIORITIES, DUTY_STATUSES } from "@cleaning-duties/shared";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { ConfirmationDialog } from "../../components/common/confirmation-dialog";
import { Input } from "../../components/ui/input";
import { PageHeader } from "../../components/common/page-header";
import { SectionTitle } from "../../components/common/section-title";
import { notify } from "../../components/common/toast";
import { useSession } from "../../hooks/use-session";
import { listSites } from "../../services/sites-service";
import { uploadDutyReferencePhoto } from "../../services/duty-photo-service";
import {
  createPreloadedDuty,
  deletePreloadedDuty,
  listPreloadedDuties,
  type PreloadedDutyItem,
  updatePreloadedDuty,
} from "../../services/preloaded-duties-service";

type ReferencePhotoItem = {
  id: string;
  previewUrl: string;
  remoteUrl: string | null;
  status: "uploading" | "done" | "error";
  fileName: string;
};
const EDITABLE_DUTY_STATUSES = DUTY_STATUSES.filter((status) => status !== "Archived" && status !== "Missed");

export function PreloadedDutiesPage() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const { companyId, userId, role } = useSession();
  const [showForm, setShowForm] = useState(searchParams.get("create") === "1");
  const [editingTemplate, setEditingTemplate] = useState<PreloadedDutyItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PreloadedDutyItem | null>(null);
  const [referencePhotoItems, setReferencePhotoItems] = useState<ReferencePhotoItem[]>([]);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ["preloaded-duties", companyId],
    queryFn: () => listPreloadedDuties(companyId ?? ""),
    enabled: Boolean(companyId) && role !== "Cleaner",
  });

  const { data: sites = [] } = useQuery({
    queryKey: ["sites", companyId],
    queryFn: () => listSites(companyId ?? ""),
    enabled: Boolean(companyId) && role !== "Cleaner",
  });

  const uploadSite = sites[0] ?? null;
  const uploadBucketName = uploadSite?.storageBucket || (uploadSite ? `site-${uploadSite.id}` : "");

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

  useEffect(() => {
    if (searchParams.get("create") !== "1") {
      return;
    }

    startCreate();
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("create");
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);

  const createMutation = useMutation({
    mutationFn: (values: DutyFormInput) => {
      if (!companyId || !userId) {
        throw new Error("Missing preloaded duty context");
      }

      return createPreloadedDuty(companyId, userId, values);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["preloaded-duties", companyId] });
      closeForm();
      notify({ tone: "success", title: "Preloaded duty created", message: "The duty template is ready to reuse." });
    },
    onError: (error) => notify({ tone: "error", title: "Could not create preloaded duty", message: error instanceof Error ? error.message : "Unknown error" }),
  });

  const updateMutation = useMutation({
    mutationFn: ({ templateId, values }: { templateId: string; values: DutyFormInput }) => updatePreloadedDuty(templateId, values),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["preloaded-duties", companyId] });
      closeForm();
      notify({ tone: "success", title: "Preloaded duty updated", message: "The saved template was updated." });
    },
    onError: (error) => notify({ tone: "error", title: "Could not update preloaded duty", message: error instanceof Error ? error.message : "Unknown error" }),
  });

  const deleteMutation = useMutation({
    mutationFn: deletePreloadedDuty,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["preloaded-duties", companyId] });
      setDeleteTarget(null);
      notify({ tone: "success", title: "Preloaded duty deleted", message: "The template was removed." });
    },
    onError: (error) => notify({ tone: "error", title: "Could not delete preloaded duty", message: error instanceof Error ? error.message : "Unknown error" }),
  });

  if (role === "Cleaner") {
    return <Navigate to="/settings" replace />;
  }

  function startCreate() {
    setShowForm(true);
    setEditingTemplate(null);
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

  function startEdit(template: PreloadedDutyItem) {
    setShowForm(true);
    setEditingTemplate(template);
    setReferencePhotoItems(
      template.referencePhotos.map((url) => ({
        id: crypto.randomUUID(),
        previewUrl: url,
        remoteUrl: url,
        status: "done",
        fileName: url,
      })),
    );
    form.reset({
      title: template.title,
      description: template.description,
      priority: template.priority,
      status: template.status,
      dueDate: "",
      equipment: template.equipment.join(", "),
      referencePhotos: template.referencePhotos.join(", "),
      assignedUserIds: [],
    });
  }

  function closeForm() {
    setShowForm(false);
    setEditingTemplate(null);
    setReferencePhotoItems([]);
    form.reset();
  }

  async function handlePhotoSelection(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";

    if (files.length === 0) {
      return;
    }

    if (!uploadSite || !uploadBucketName) {
      notify({ tone: "error", title: "No upload site available", message: "Create a site before uploading template reference photos." });
      return;
    }

    const dutyTitle = form.getValues("title") || "preloaded-duty";
    const pendingPhotos = files.map((file) => ({
      id: crypto.randomUUID(),
      previewUrl: URL.createObjectURL(file),
      remoteUrl: null,
      status: "uploading" as const,
      fileName: file.name,
    }));

    setReferencePhotoItems((current) => [...current, ...pendingPhotos]);

    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      const pendingPhoto = pendingPhotos[index];

      if (!file || !pendingPhoto) {
        continue;
      }

      try {
        const remoteUrl = await uploadDutyReferencePhoto({
          bucketName: uploadBucketName,
          siteId: uploadSite.id,
          dutyTitle,
          file,
        });

        setReferencePhotoItems((current) => current.map((photo) => (photo.id === pendingPhoto.id ? { ...photo, remoteUrl, status: "done" } : photo)));
      } catch (error) {
        setReferencePhotoItems((current) => current.map((photo) => (photo.id === pendingPhoto.id ? { ...photo, status: "error" } : photo)));
        notify({ tone: "error", title: "Photo upload failed", message: error instanceof Error ? error.message : "Unknown error" });
      }
    }
  }

  function removeReferencePhoto(photoId: string) {
    setReferencePhotoItems((current) => {
      const target = current.find((photo) => photo.id === photoId);
      if (target?.previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return current.filter((photo) => photo.id !== photoId);
    });
  }

  async function onSubmit(values: DutyFormInput) {
    if (referencePhotoItems.some((photo) => photo.status === "uploading")) {
      notify({ tone: "error", title: "Photos still uploading", message: "Wait for uploads to finish before saving this template." });
      return;
    }

    if (editingTemplate) {
      await updateMutation.mutateAsync({ templateId: editingTemplate.id, values });
      return;
    }

    await createMutation.mutateAsync(values);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Settings"
        title="Preloaded Duties"
        description="Create reusable duty templates for managers and owners to preload into new duties."
        actions={(
          <Button onClick={startCreate} disabled={createMutation.isPending || updateMutation.isPending}>
            <Plus className="h-4 w-4" />
            Create New
          </Button>
        )}
      />

      {showForm ? (
        <Card className="space-y-4 p-5">
          <div className="flex items-center justify-between gap-4">
            <SectionTitle
              title={editingTemplate ? `Edit ${editingTemplate.title}` : "Create preloaded duty"}
              description="Save reusable task details and reference photos."
            />
            <Button variant="secondary" onClick={closeForm} disabled={createMutation.isPending || updateMutation.isPending}>
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
                className="w-full rounded-md border border-slate-200 bg-white px-4 py-3 text-sm outline-none"
                placeholder="Write the reusable duty scope and any special instructions."
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Priority</label>
              <select {...form.register("priority")} className="w-full rounded-md border border-slate-200 bg-white px-4 py-3 text-sm">
                {DUTY_PRIORITIES.map((priority) => <option key={priority} value={priority}>{priority}</option>)}
              </select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Default status</label>
              <select {...form.register("status")} className="w-full rounded-md border border-slate-200 bg-white px-4 py-3 text-sm">
                {EDITABLE_DUTY_STATUSES.map((status) => <option key={status} value={status}>{status}</option>)}
              </select>
            </div>
            <div className="space-y-2 lg:col-span-2">
              <label className="text-sm font-medium">Equipment required</label>
              <Input {...form.register("equipment")} placeholder="Vacuum, Mop, Gloves" />
            </div>
            <div className="space-y-3 lg:col-span-2">
              <div className="flex items-center justify-between gap-4">
                <label className="text-sm font-medium">Reference photos</label>
                <Button type="button" variant="secondary" onClick={() => fileInputRef.current?.click()} disabled={!uploadSite}>
                  <Upload className="h-4 w-4" />
                  Upload photos
                </Button>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={handlePhotoSelection} />
              <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {referencePhotoItems.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500 sm:col-span-3 lg:col-span-4">
                    No reference photos uploaded yet.
                  </div>
                ) : (
                  referencePhotoItems.map((photo) => (
                    <div key={photo.id} className="relative overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                      <img src={photo.previewUrl} alt={photo.fileName} className="h-24 w-full object-cover" />
                      <div className="absolute left-2 top-2">
                        {photo.status === "uploading" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 text-[11px] font-medium text-slate-700">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Uploading
                          </span>
                        ) : photo.status === "done" ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-medium text-emerald-700">
                            <Check className="h-3 w-3" />
                            Uploaded
                          </span>
                        ) : (
                          <span className="rounded-full bg-rose-50 px-2 py-1 text-[11px] font-medium text-rose-700">Failed</span>
                        )}
                      </div>
                      <button type="button" className="absolute right-2 top-2 rounded-full bg-white/90 p-1.5 text-slate-700" onClick={() => removeReferencePhoto(photo.id)} aria-label={`Remove ${photo.fileName}`}>
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="flex gap-3 lg:col-span-2">
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {createMutation.isPending || updateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {editingTemplate ? "Save changes" : "Create template"}
              </Button>
              <Button type="button" variant="secondary" onClick={closeForm} disabled={createMutation.isPending || updateMutation.isPending}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        {isLoading ? (
          <Card className="p-5">Loading preloaded duties...</Card>
        ) : templates.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-lg font-semibold text-slate-950">No preloaded duties yet</p>
            <p className="mt-2 text-sm text-slate-500">Create the first reusable duty to speed up future scheduling.</p>
          </Card>
        ) : (
          templates.map((template) => (
            <Card key={template.id} className="space-y-4 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-lg font-semibold text-slate-950">{template.title}</p>
                  <p className="mt-1 text-sm text-slate-500">{template.description || "No description"}</p>
                </div>
                <span className="rounded-full bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">{template.priority}</span>
              </div>
              {template.referencePhotos.length > 0 ? (
                <div className="grid grid-cols-4 gap-2">
                  {template.referencePhotos.slice(0, 4).map((photoUrl) => (
                    <img key={photoUrl} src={photoUrl} alt="" className="h-16 w-full rounded-md object-cover" />
                  ))}
                </div>
              ) : null}
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => startEdit(template)}>
                  <Pencil className="h-4 w-4" />
                  Edit
                </Button>
                <Button variant="ghost" onClick={() => setDeleteTarget(template)}>
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>

      {deleteTarget ? (
        <ConfirmationDialog
          title={`Delete ${deleteTarget.title}?`}
          description="This will remove the reusable duty template. Existing duties will not be changed."
          confirmLabel={deleteMutation.isPending ? "Deleting..." : "Delete template"}
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
