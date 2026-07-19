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
import { apiUrl } from "../../services/api-client";
import { listSites, type SiteItem } from "../../services/sites-service";
import { listCompanyUsers } from "../../services/users-service";

const inviteCleanerSchema = z.object({
  fullName: z.string().trim().min(2, "Enter the cleaner name."),
  email: z.string().email("Enter a valid email."),
  password: z.string().min(8, "Password must be at least 8 characters."),
  siteIds: z.array(z.string()).min(1, "Select at least one site."),
});

type InviteCleanerInput = z.infer<typeof inviteCleanerSchema>;

function stringifyUnknown(value: unknown) {
  if (typeof value === "string") {
    return value;
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function getInviteErrorMessage(body: unknown, response: Response) {
  if (!body || typeof body !== "object") {
    return `Invite failed (${response.status}) at ${response.url}`;
  }

  const error = (body as { error?: unknown }).error;
  if (typeof error === "string" && error.trim()) {
    return error;
  }
  if (error && typeof error === "object") {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) {
      return message;
    }
    return `Invite failed (${response.status}) at ${response.url}: ${stringifyUnknown(error)}`;
  }

  const message = (body as { message?: unknown }).message;
  if (typeof message === "string" && message.trim()) {
    return message;
  }

  return `Invite failed (${response.status}) at ${response.url}: ${stringifyUnknown(body)}`;
}

export function UsersPage() {
  const queryClient = useQueryClient();
  const { companyId } = useSession();
  const [isInviteOpen, setIsInviteOpen] = useState(false);

  const { data: sites = [] } = useQuery({
    queryKey: ["invite-sites", companyId],
    queryFn: () => listSites(companyId ?? ""),
    enabled: Boolean(companyId),
  });

  const {
    data: users = [],
    isLoading: isLoadingUsers,
    error: usersError,
  } = useQuery({
    queryKey: ["company-users", companyId],
    queryFn: () => listCompanyUsers(companyId ?? ""),
    enabled: Boolean(companyId),
  });

  const form = useForm<InviteCleanerInput>({
    resolver: zodResolver(inviteCleanerSchema),
    defaultValues: {
      fullName: "",
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
      const response = await fetch(apiUrl("/invite"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          full_name: values.fullName,
          email: values.email,
          password: values.password,
          role: "Cleaner",
          company_id: companyId,
          site_ids: values.siteIds,
        }),
      });

      const contentType = response.headers.get("content-type") ?? "";
      const body = contentType.includes("application/json") ? await response.json() : { error: await response.text() };
      if (!response.ok) {
        throw new Error(getInviteErrorMessage(body, response));
      }

      notify({
        tone: "success",
        title: "Cleaner created",
        message: `${values.email} was added to the company and assigned to ${values.siteIds.length} site${values.siteIds.length === 1 ? "" : "s"}.`,
      });
      await queryClient.invalidateQueries({ queryKey: ["invite-sites", companyId] });
      await queryClient.invalidateQueries({ queryKey: ["company-users", companyId] });
      setIsInviteOpen(false);
      form.reset();
    } catch (error) {
      const message =
        error instanceof TypeError
          ? `Could not connect to the API at ${apiUrl("/invite")}. Make sure apps/api is running.`
          : error instanceof Error
            ? error.message
            : stringifyUnknown(error);
      notify({
        tone: "error",
        title: "Invite failed",
        message,
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
              Add Cleaner
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
                <p className="text-lg font-semibold text-slate-950">Add cleaner</p>
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
                  <label className="text-sm font-medium text-slate-700">Cleaner name</label>
                  <input
                    type="text"
                    {...form.register("fullName")}
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400"
                    placeholder="Full name"
                  />
                  {form.formState.errors.fullName ? <p className="text-sm text-rose-600">{form.formState.errors.fullName.message}</p> : null}
                </div>

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
        <SectionTitle title="Cleaners" description="Active cleaners and the sites they can access." />
        <div className="grid gap-4 md:grid-cols-2">
          {isLoadingUsers ? (
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-500 md:col-span-2">
              Loading team members...
            </div>
          ) : usersError ? (
            <div className="rounded-3xl border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700 md:col-span-2">
              {usersError instanceof Error ? usersError.message : "Could not load team members."}
            </div>
          ) : users.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500 md:col-span-2">
              No team members found for this company.
            </div>
          ) : (
            users.map((user) => (
              <div key={user.id} className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-semibold text-slate-950">{user.name}</p>
                    <p className="mt-1 text-sm text-slate-500">{user.role}</p>
                  </div>
                  <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                    {user.status}
                  </div>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {user.siteNames.length > 0 ? (
                    user.siteNames.map((siteName) => (
                      <span key={siteName} className="rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
                        {siteName}
                      </span>
                    ))
                  ) : (
                    <span className="text-xs text-slate-500">No sites assigned</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
