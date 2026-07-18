import { Loader2, MailPlus, UserRoundPlus, X } from "lucide-react";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "../../components/ui/button";
import { useSession } from "../../hooks/use-session";
import { Card } from "../../components/ui/card";
import { PageHeader } from "../../components/common/page-header";
import { SectionTitle } from "../../components/common/section-title";
import { notify } from "../../components/common/toast";
import { listSites, type SiteItem } from "../../services/sites-service";

const inviteCleanerSchema = z.object({
  email: z.string().email("Enter a valid email."),
  password: z.string().min(8, "Password must be at least 8 characters."),
  siteIds: z.array(z.string()).min(1, "Select at least one site."),
});

type InviteCleanerInput = z.infer<typeof inviteCleanerSchema>;

export function UsersPage() {
  const queryClient = useQueryClient();
  const { companyId } = useSession();
  const [isInviteOpen, setIsInviteOpen] = useState(false);

  const { data: sites = [] } = useQuery({
    queryKey: ["invite-sites", companyId],
    queryFn: () => listSites(companyId ?? ""),
    enabled: Boolean(companyId),
  });

  const form = useForm<InviteCleanerInput>({
    resolver: zodResolver(inviteCleanerSchema),
    defaultValues: {
      email: "",
      password: "",
      siteIds: [],
    },
  });

  const selectedSiteIds = form.watch("siteIds");

  const siteCountLabel = useMemo(() => {
    return sites.length > 0 ? `${sites.length} available site${sites.length === 1 ? "" : "s"}` : "No sites available";
  }, [sites.length]);

  async function onSubmit(values: InviteCleanerInput) {
    try {
      const response = await fetch("/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: values.email,
          password: values.password,
          role: "Cleaner",
          company_id: companyId,
          site_ids: values.siteIds,
        }),
      });

      const body = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(body.error ?? "Invite failed");
      }

      notify({
        tone: "success",
        title: "Cleaner created",
        message: `${values.email} was added to the company and assigned to ${values.siteIds.length} site${values.siteIds.length === 1 ? "" : "s"}.`,
      });
      await queryClient.invalidateQueries({ queryKey: ["invite-sites", companyId] });
      setIsInviteOpen(false);
      form.reset();
    } catch (error) {
      notify({
        tone: "error",
        title: "Invite failed",
        message: error instanceof Error ? error.message : "Unknown error",
      });
    }
  }

  function toggleSite(siteId: string) {
    const current = form.getValues("siteIds");
    const next = current.includes(siteId) ? current.filter((id) => id !== siteId) : [...current, siteId];
    form.setValue("siteIds", next, { shouldValidate: true, shouldDirty: true });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Users"
        title="People and access"
        description="Invite managers and cleaners, review invitation status, and keep every person scoped to the sites they belong to."
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setIsInviteOpen(true);
              }}
              disabled={!companyId}
            >
              <MailPlus className="h-4 w-4" />
              Invite Cleaner
            </Button>
            <Button disabled>
              <UserRoundPlus className="h-4 w-4" />
              Invite Manager
            </Button>
          </>
        }
      />

      {isInviteOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-2xl space-y-6 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-lg font-semibold text-slate-950">Invite cleaner</p>
                <p className="mt-1 text-sm text-slate-500">
                  Create the account, set a password, and assign the cleaner to one or more sites.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsInviteOpen(false);
                  form.reset();
                }}
                className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close invite dialog"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)}>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium text-slate-700">Email</label>
                  <input
                    type="email"
                    {...form.register("email")}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400"
                    placeholder="cleaner@company.com"
                  />
                  {form.formState.errors.email ? <p className="text-sm text-rose-600">{form.formState.errors.email.message}</p> : null}
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium text-slate-700">Password</label>
                  <input
                    type="password"
                    {...form.register("password")}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400"
                    placeholder="Create a secure password"
                  />
                  {form.formState.errors.password ? <p className="text-sm text-rose-600">{form.formState.errors.password.message}</p> : null}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-4">
                  <label className="text-sm font-medium text-slate-700">Assign sites</label>
                  <span className="text-xs text-slate-500">{siteCountLabel}</span>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {sites.map((site: SiteItem) => (
                    <label
                      key={site.id}
                      className="flex cursor-pointer items-start gap-3 rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 transition hover:bg-slate-100"
                    >
                      <input
                        type="checkbox"
                        checked={selectedSiteIds.includes(site.id)}
                        onChange={() => toggleSite(site.id)}
                        className="mt-1 h-4 w-4 rounded border-slate-300"
                      />
                      <div>
                        <p className="text-sm font-medium text-slate-950">{site.name}</p>
                        <p className="mt-1 text-xs text-slate-500">{site.address ?? "No address set"}</p>
                      </div>
                    </label>
                  ))}
                </div>
                {form.formState.errors.siteIds ? <p className="text-sm text-rose-600">{form.formState.errors.siteIds.message}</p> : null}
              </div>

              <div className="flex flex-wrap justify-end gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    setIsInviteOpen(false);
                    form.reset();
                  }}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={form.formState.isSubmitting || sites.length === 0}>
                  {form.formState.isSubmitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    "Save"
                  )}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      ) : null}

      <Card className="space-y-4 p-5">
        <SectionTitle title="Team members" description="Role and invitation state across the company." />
        <div className="grid gap-4 md:grid-cols-2">
          {[
            { name: "Alicia Gomez", role: "Manager", status: "Active" },
            { name: "Kevin Brown", role: "Cleaner", status: "Pending invitation" },
            { name: "Mia Patel", role: "Cleaner", status: "Active" },
            { name: "Daniel Brooks", role: "Manager", status: "Active" },
          ].map((user) => (
            <div key={user.name} className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold text-slate-950">{user.name}</p>
                  <p className="mt-1 text-sm text-slate-500">{user.role}</p>
                </div>
                <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                  {user.status}
                </div>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
