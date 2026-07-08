import { Plus, Search, Trash2, Pencil } from "lucide-react";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { siteFormSchema, type SiteFormInput } from "@cleaning-duties/shared";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { PageHeader } from "../../components/common/page-header";
import { SectionTitle } from "../../components/common/section-title";
import { ConfirmationDialog } from "../../components/common/confirmation-dialog";
import { Input } from "../../components/ui/input";
import { createSite, deleteSite, listSites, type SiteItem, updateSite } from "../../services/sites-service";
import { useSession } from "../../hooks/use-session";

export function SitesPage() {
  const queryClient = useQueryClient();
  const { companyId } = useSession();
  const [search, setSearch] = useState("");
  const [editingSite, setEditingSite] = useState<SiteItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SiteItem | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const { data: sites = [], isLoading } = useQuery({
    queryKey: ["sites", companyId, search],
    queryFn: () => listSites(companyId ?? "", search),
    enabled: Boolean(companyId),
  });

  const form = useForm<SiteFormInput>({
    resolver: zodResolver(siteFormSchema),
    defaultValues: {
      name: "",
      address: "",
      notes: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: (values: SiteFormInput) => {
      if (!companyId) {
        throw new Error("Missing company context");
      }
      return createSite(companyId, values);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["sites"] });
      form.reset();
      setShowCreate(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ siteId, values }: { siteId: string; values: SiteFormInput }) => updateSite(siteId, values),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["sites"] });
      setEditingSite(null);
      form.reset();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteSite,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["sites"] });
      setDeleteTarget(null);
    },
  });

  const filteredCount = useMemo(() => sites.length, [sites]);

  function startCreate() {
    setEditingSite(null);
    setShowCreate(true);
    form.reset({ name: "", address: "", notes: "" });
  }

  function startEdit(site: SiteItem) {
    setShowCreate(false);
    setEditingSite(site);
    form.reset({
      name: site.name,
      address: site.address ?? "",
      notes: site.notes,
    });
  }

  async function onSubmit(values: SiteFormInput) {
    if (editingSite) {
      await updateMutation.mutateAsync({ siteId: editingSite.id, values });
      return;
    }

    await createMutation.mutateAsync(values);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Sites"
        title="Company sites"
        description="Manage the buildings, teams, and site-specific workstreams under one company."
        actions={
          <>
            <Button variant="secondary" onClick={() => setSearch("")}>
              <Search className="h-4 w-4" />
              Clear search
            </Button>
            <Button onClick={startCreate}>
              <Plus className="h-4 w-4" />
              Create Site
            </Button>
          </>
        }
      />

      <Card className="space-y-4 p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex-1">
            <label className="sr-only" htmlFor="site-search">
              Search sites
            </label>
            <div className="flex items-center gap-3 rounded-2xl bg-slate-50 px-4 py-3 ring-1 ring-slate-200">
              <Search className="h-4 w-4 text-slate-400" />
              <Input
                id="site-search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search site name..."
                className="border-0 bg-transparent p-0 ring-0 focus:border-0"
              />
            </div>
          </div>
          <div className="text-sm text-slate-500">
            {filteredCount} site{filteredCount === 1 ? "" : "s"}
          </div>
        </div>
      </Card>

      {showCreate || editingSite ? (
        <Card className="space-y-4 p-5">
          <div className="flex items-center justify-between gap-4">
            <SectionTitle
              title={editingSite ? `Edit ${editingSite.name}` : "Create site"}
              description="Use the site form to add a new building or update existing details."
            />
            <Button variant="secondary" onClick={() => {
              setShowCreate(false);
              setEditingSite(null);
              form.reset({ name: "", address: "", notes: "" });
            }}>
              Close
            </Button>
          </div>
          <form className="grid gap-4 lg:grid-cols-2" onSubmit={form.handleSubmit(onSubmit)}>
            <div className="space-y-2">
              <label className="text-sm font-medium">Site name</label>
              <Input {...form.register("name")} placeholder="North Tower" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Address</label>
              <Input {...form.register("address")} placeholder="123 Collins St, Melbourne" />
            </div>
            <div className="space-y-2 lg:col-span-2">
              <label className="text-sm font-medium">Notes</label>
              <textarea
                {...form.register("notes")}
                rows={4}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400"
                placeholder="Access notes, lock-up instructions, resident expectations..."
              />
            </div>
            <div className="flex gap-3 lg:col-span-2">
              <Button type="submit">{editingSite ? "Save changes" : "Create site"}</Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setShowCreate(false);
                  setEditingSite(null);
                  form.reset({ name: "", address: "", notes: "" });
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {isLoading ? (
          <Card className="p-5">Loading sites...</Card>
        ) : sites.length === 0 ? (
          <Card className="p-8 text-center">
            <p className="text-lg font-semibold text-slate-950">No sites yet</p>
            <p className="mt-2 text-sm text-slate-500">Create the first site to start organizing duties and cleaners.</p>
            <div className="mt-4">
              <Button onClick={startCreate}>Create Site</Button>
            </div>
          </Card>
        ) : (
          sites.map((site) => (
            <Card key={site.id} className="space-y-4 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-lg font-semibold text-slate-950">{site.name}</p>
                  <p className="mt-1 text-sm text-slate-500">{site.address || "No address set"}</p>
                </div>
                <div className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">Active</div>
              </div>
              <p className="text-sm text-slate-600 line-clamp-3">{site.notes || "No notes."}</p>
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" onClick={() => startEdit(site)}>
                  <Pencil className="h-4 w-4" />
                  Edit
                </Button>
                <Button variant="ghost" onClick={() => setDeleteTarget(site)}>
                  <Trash2 className="h-4 w-4" />
                  Delete
                </Button>
              </div>
            </Card>
          ))
        )}
      </div>

      <Card className="space-y-4 p-5">
        <SectionTitle title="Site overview" description="Quick rollup of manager attention." />
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-sm text-slate-500">Most active</p>
            <p className="mt-2 font-semibold text-slate-950">North Tower</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-sm text-slate-500">At risk</p>
            <p className="mt-2 font-semibold text-slate-950">Sunset Offices</p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-sm text-slate-500">New this month</p>
            <p className="mt-2 font-semibold text-slate-950">2 sites</p>
          </div>
        </div>
      </Card>

      {deleteTarget ? (
        <ConfirmationDialog
          title={`Delete ${deleteTarget.name}?`}
          description="This will permanently remove the site and its related data."
          confirmLabel={deleteMutation.isPending ? "Deleting..." : "Delete site"}
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
