import { Filter, Plus, Search, Pencil, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { PageHeader } from "../../components/common/page-header";
import { SectionTitle } from "../../components/common/section-title";
import { ConfirmationDialog } from "../../components/common/confirmation-dialog";
import { listSites, type SiteItem } from "../../services/sites-service";
import { createDuty, deleteDuty, listDuties, type DutyItem, updateDuty } from "../../services/duties-service";
import { useSession } from "../../hooks/use-session";
import { dutyFormSchema, type DutyFormInput, DUTY_PRIORITIES, DUTY_STATUSES } from "@cleaning-duties/shared";

export function DutiesPage() {
  const queryClient = useQueryClient();
  const { companyId, userId } = useSession();
  const [search, setSearch] = useState("");
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);
  const [editingDuty, setEditingDuty] = useState<DutyItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DutyItem | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const { data: sites = [] } = useQuery({
    queryKey: ["sites", companyId],
    queryFn: () => listSites(companyId ?? ""),
    enabled: Boolean(companyId),
  });

  const activeSiteId = selectedSiteId ?? sites[0]?.id ?? null;

  const { data: duties = [], isLoading } = useQuery({
    queryKey: ["duties", activeSiteId, search],
    queryFn: () => listDuties(activeSiteId ?? "", search),
    enabled: Boolean(activeSiteId),
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
    },
  });

  const createMutation = useMutation({
    mutationFn: (values: DutyFormInput) => {
      if (!activeSiteId || !userId) {
        throw new Error("Missing duty context");
      }

      return createDuty(activeSiteId, userId, values);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["duties"] });
      setShowCreate(false);
      form.reset();
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ dutyId, values }: { dutyId: string; values: DutyFormInput }) => updateDuty(dutyId, values),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["duties"] });
      setEditingDuty(null);
      form.reset();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteDuty,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["duties"] });
      setDeleteTarget(null);
    },
  });

  const dutyCount = useMemo(() => duties.length, [duties]);

  function startCreate() {
    setEditingDuty(null);
    setShowCreate(true);
    form.reset({
      title: "",
      description: "",
      priority: "Medium",
      status: "Draft",
      dueDate: "",
      equipment: "",
      referencePhotos: "",
    });
  }

  function startEdit(duty: DutyItem) {
    setShowCreate(false);
    setEditingDuty(duty);
    form.reset({
      title: duty.title,
      description: duty.description,
      priority: duty.priority,
      status: duty.status,
      dueDate: duty.dueDate ? duty.dueDate.slice(0, 16) : "",
      equipment: duty.equipment.join(", "),
      referencePhotos: duty.referencePhotos.join(", "),
    });
  }

  async function onSubmit(values: DutyFormInput) {
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
        description="Review the current duty load, filter by priority or status, and open any duty to manage assignments and evidence."
        actions={
          <>
            <Button variant="secondary">
              <Filter className="h-4 w-4" />
              Filters
            </Button>
            <Button onClick={startCreate}>
              <Plus className="h-4 w-4" />
              Create Duty
            </Button>
          </>
        }
      />

      <Card className="space-y-4 p-5">
        <div className="grid gap-4 lg:grid-cols-[1fr_0.4fr]">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Site</label>
            <select
              value={activeSiteId ?? ""}
              onChange={(event) => setSelectedSiteId(event.target.value || null)}
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
      </Card>

      {showCreate || editingDuty ? (
        <Card className="space-y-4 p-5">
          <div className="flex items-center justify-between gap-4">
            <SectionTitle
              title={editingDuty ? `Edit ${editingDuty.title}` : "Create duty"}
              description="Capture the work details, deadline, and equipment required."
            />
            <Button
              variant="secondary"
              onClick={() => {
                setShowCreate(false);
                setEditingDuty(null);
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
            <div className="space-y-2 lg:col-span-2">
              <label className="text-sm font-medium">Reference photos</label>
              <Input {...form.register("referencePhotos")} placeholder="https://..., https://..." />
            </div>
            <div className="flex gap-3 lg:col-span-2">
              <Button type="submit">{editingDuty ? "Save changes" : "Create duty"}</Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setShowCreate(false);
                  setEditingDuty(null);
                  form.reset();
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-2">
        {isLoading ? (
          <Card className="p-5">Loading duties...</Card>
        ) : duties.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-lg font-semibold text-slate-950">No duties for this site</p>
            <p className="mt-2 text-sm text-slate-500">Create the first duty to start assigning cleaners and due dates.</p>
            <div className="mt-4">
              <Button onClick={startCreate}>Create Duty</Button>
            </div>
          </Card>
        ) : (
          duties.map((duty) => (
            <Card key={duty.id} className="space-y-4 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-lg font-semibold text-slate-950">{duty.title}</p>
                  <p className="mt-1 text-sm text-slate-500">{duty.description || "No description"}</p>
                </div>
                <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{duty.status}</div>
              </div>
              <div className="flex flex-wrap gap-2 text-xs font-medium text-slate-600">
                <span className="rounded-full bg-slate-50 px-3 py-1 ring-1 ring-slate-200">{duty.priority}</span>
                <span className="rounded-full bg-slate-50 px-3 py-1 ring-1 ring-slate-200">{duty.dueDate ? new Date(duty.dueDate).toLocaleString() : "No due date"}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => startEdit(duty)}>
                  <Pencil className="h-4 w-4" />
                  Edit
                </Button>
                <Button variant="ghost" onClick={() => setDeleteTarget(duty)}>
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>

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
    </div>
  );
}
