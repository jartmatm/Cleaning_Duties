import { Loader2, MailPlus, Trash2, UserRoundPlus, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "../../components/ui/button";
import { useSession } from "../../hooks/use-session";
import { Card } from "../../components/ui/card";
import { PageHeader } from "../../components/common/page-header";
import { SectionTitle } from "../../components/common/section-title";
import { ConfirmationDialog } from "../../components/common/confirmation-dialog";
import { notify } from "../../components/common/toast";
import { inviteCleaner, inviteSupervisor } from "../../services/invite-service";
import { listMySites, listSites, type SiteItem } from "../../services/sites-service";
import { deleteTeamMember, listCompanyUsers, updateTeamMember, type CompanyUser } from "../../services/users-service";

const inviteCleanerSchema = z.object({
  fullName: z.string().trim().min(2, "Enter the name."),
  email: z.string().email("Enter a valid email."),
  password: z.string(),
  siteIds: z.array(z.string()).min(1, "Select at least one site."),
});

type InviteCleanerInput = z.infer<typeof inviteCleanerSchema>;
type InviteMode = "Cleaner" | "Supervisor";

export function UsersPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const { companyId, userId, role } = useSession();
  const isCleaner = role === "Cleaner";
  const canManageCleaners = role === "Manager" || role === "Supervisor";
  const canManageSupervisors = role === "Manager";
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteMode, setInviteMode] = useState<InviteMode>("Cleaner");
  const [editingMember, setEditingMember] = useState<CompanyUser | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CompanyUser | null>(null);
  const [isDeletingCleaner, setIsDeletingCleaner] = useState(false);

  const { data: sites = [] } = useQuery({
    queryKey: role === "Manager" ? ["invite-sites", companyId] : ["invite-sites", companyId, userId],
    queryFn: () => role === "Manager" ? listSites(companyId ?? "") : listMySites(userId ?? ""),
    enabled: Boolean(companyId) && Boolean(userId) && canManageCleaners,
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

  useEffect(() => {
    if (!canManageCleaners || searchParams.get("invite") !== "1") {
      return;
    }

    setIsInviteOpen(true);

    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("invite");
    setSearchParams(nextParams, { replace: true });
  }, [canManageCleaners, searchParams, setSearchParams]);

  async function onSubmit(values: InviteCleanerInput) {
    try {
      if (!companyId) {
        throw new Error("No company is selected for this invitation.");
      }

      if (editingMember) {
        await updateTeamMember({
          memberId: editingMember.id,
          fullName: values.fullName,
          email: values.email,
          password: values.password,
          companyId,
          siteIds: values.siteIds,
        });

        notify({
          tone: "success",
          title: `${editingMember.role} updated`,
          message: `${values.fullName} was updated successfully.`,
        });
      } else {
        if (values.password.length < 8) {
          form.setError("password", { message: "Password must be at least 8 characters." });
          return;
        }

        const invite = inviteMode === "Supervisor" ? inviteSupervisor : inviteCleaner;
        await invite({
          fullName: values.fullName,
          email: values.email,
          password: values.password,
          companyId,
          siteIds: values.siteIds,
        });

        notify({
          tone: "success",
          title: `${inviteMode} created`,
          message: `${values.email} was added as a ${inviteMode.toLowerCase()} and assigned to ${values.siteIds.length} site${values.siteIds.length === 1 ? "" : "s"}.`,
        });
      }
      await queryClient.invalidateQueries({ queryKey: ["invite-sites", companyId] });
      await queryClient.invalidateQueries({ queryKey: ["company-users", companyId] });
      closeCleanerForm();
    } catch (error) {
      notify({
        tone: "error",
        title: editingMember ? "Update failed" : "Invite failed",
        message: error instanceof Error ? error.message : editingMember ? "The team member account could not be updated." : `The ${inviteMode.toLowerCase()} account could not be created.`,
      });
    }
  }

  function openCreateCleanerForm() {
    setInviteMode("Cleaner");
    setEditingMember(null);
    form.reset({ fullName: "", email: "", password: "", siteIds: [] });
    setIsInviteOpen(true);
  }

  function openCreateSupervisorForm() {
    setInviteMode("Supervisor");
    setEditingMember(null);
    form.reset({ fullName: "", email: "", password: "", siteIds: [] });
    setIsInviteOpen(true);
  }

  function openEditMemberForm(user: CompanyUser) {
    if (!canManageCleaners || (user.role === "Supervisor" && !canManageSupervisors)) {
      return;
    }

    setInviteMode(user.role === "Supervisor" ? "Supervisor" : "Cleaner");
    setEditingMember(user);
    form.reset({
      fullName: user.name,
      email: user.email ?? "",
      password: "",
      siteIds: user.siteIds,
    });
    setIsInviteOpen(true);
  }

  function closeCleanerForm() {
    setIsInviteOpen(false);
    setEditingMember(null);
    form.reset();
  }

  function toggleSite(siteId: string) {
    const current = form.getValues("siteIds");
    const next = current.includes(siteId) ? current.filter((id) => id !== siteId) : [...current, siteId];
    form.setValue("siteIds", next, { shouldValidate: true, shouldDirty: true });
  }

  function canManageMember(user: CompanyUser) {
    return canManageCleaners && (user.role === "Cleaner" || canManageSupervisors);
  }

  async function confirmDeleteCleaner() {
    if (!deleteTarget || !companyId) {
      return;
    }

    try {
      setIsDeletingCleaner(true);
      await deleteTeamMember({ memberId: deleteTarget.id, companyId });
      notify({
        tone: "success",
        title: `${deleteTarget.role} removed`,
        message: `${deleteTarget.name} was removed from the company.`,
      });
      await queryClient.invalidateQueries({ queryKey: ["company-users", companyId] });
      setDeleteTarget(null);
    } catch (error) {
      notify({
        tone: "error",
        title: "Delete failed",
        message: error instanceof Error ? error.message : "The team member account could not be removed.",
      });
    } finally {
      setIsDeletingCleaner(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Users"
        title="People and access"
        description={isCleaner ? "Review active cleaners and site access for your company." : "Manage supervisors and cleaners while keeping every person scoped to the sites they belong to."}
        actions={!canManageCleaners ? null : (
          <>
            <Button
              variant="secondary"
              onClick={openCreateCleanerForm}
              disabled={!companyId}
            >
              <MailPlus className="h-4 w-4" />
              Add Cleaner
            </Button>
            {canManageSupervisors ? (
              <Button
                onClick={openCreateSupervisorForm}
                disabled={!companyId}
              >
                <UserRoundPlus className="h-4 w-4" />
                Invite Supervisor
              </Button>
            ) : null}
          </>
        )}
      />

      {canManageCleaners && isInviteOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm">
          <Card className="w-full max-w-2xl space-y-6 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-lg font-semibold text-slate-950">{editingMember ? `Edit ${editingMember.role.toLowerCase()}` : inviteMode === "Supervisor" ? "Invite supervisor" : "Add cleaner"}</p>
                <p className="mt-1 text-sm text-slate-500">
                  {editingMember ? "Update the team member details, login email, password, and assigned sites." : `Create the account, set a password, and assign the ${inviteMode.toLowerCase()} to one or more sites.`}
                </p>
              </div>
              <button
                type="button"
                onClick={closeCleanerForm}
                className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                aria-label="Close user dialog"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)}>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium text-slate-700">{editingMember ? `${editingMember.role} name` : `${inviteMode} name`}</label>
                  <input
                    type="text"
                    {...form.register("fullName")}
                    className="w-full rounded-md border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400"
                    placeholder="Full name"
                  />
                  {form.formState.errors.fullName ? <p className="text-sm text-rose-600">{form.formState.errors.fullName.message}</p> : null}
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium text-slate-700">Email</label>
                  <input
                    type="email"
                    {...form.register("email")}
                    className="w-full rounded-md border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400"
                    placeholder={inviteMode === "Supervisor" ? "supervisor@company.com" : "cleaner@company.com"}
                  />
                  {form.formState.errors.email ? <p className="text-sm text-rose-600">{form.formState.errors.email.message}</p> : null}
                </div>

                <div className="space-y-2 md:col-span-2">
                  <label className="text-sm font-medium text-slate-700">Password</label>
                  <input
                    type="password"
                    {...form.register("password")}
                    className="w-full rounded-md border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-slate-400"
                    placeholder={editingMember ? "Leave blank to keep current password" : "Create a secure password"}
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
                      className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 transition hover:bg-slate-100"
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
                  onClick={closeCleanerForm}
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
                    editingMember ? "Save changes" : "Save"
                  )}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      ) : null}

      <Card className="space-y-4 p-5">
        <SectionTitle title="Team members" description="Active supervisors, cleaners, and the sites they can access." />
        <div className="grid gap-4 md:grid-cols-2">
          {isLoadingUsers ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-5 text-sm text-slate-500 md:col-span-2">
              Loading team members...
            </div>
          ) : usersError ? (
            <div className="rounded-lg border border-rose-200 bg-rose-50 p-5 text-sm text-rose-700 md:col-span-2">
              {usersError instanceof Error ? usersError.message : "Could not load team members."}
            </div>
          ) : users.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-5 text-sm text-slate-500 md:col-span-2">
              No team members found for this company.
            </div>
          ) : (
            users.map((user) => (
              <div
                key={user.id}
                role={canManageMember(user) ? "button" : undefined}
                tabIndex={canManageMember(user) ? 0 : undefined}
                onClick={canManageMember(user) ? () => openEditMemberForm(user) : undefined}
                onKeyDown={canManageMember(user) ? (event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openEditMemberForm(user);
                  }
                } : undefined}
                className={`flex h-full min-w-0 flex-col rounded-lg border border-slate-200 bg-slate-50 p-5 ${canManageMember(user) ? "cursor-pointer transition hover:-translate-y-0.5 hover:bg-white hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-slate-300" : ""}`}
              >
                <div className="min-w-0">
                  <p className="break-words font-semibold text-slate-950">{user.name}</p>
                  <p className="mt-1 break-words text-sm text-slate-500">{user.email ?? user.role}</p>
                </div>
                <div className="mt-auto flex flex-wrap items-end justify-between gap-3 pt-4">
                  <div className="flex min-w-0 flex-wrap gap-2">
                    {user.siteNames.length > 0 ? (
                      user.siteNames.map((siteName) => (
                        <span key={siteName} className="max-w-full break-words rounded-full bg-white px-3 py-1 text-xs font-medium text-slate-600 ring-1 ring-slate-200">
                          {siteName}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-slate-500">No sites assigned</span>
                    )}
                  </div>
                  <div className="ml-auto flex shrink-0 items-center gap-2">
                    <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                      {user.role}
                    </div>
                    <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                      {user.status}
                    </div>
                    {canManageMember(user) ? (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setDeleteTarget(user);
                        }}
                        className="rounded-full bg-white p-2 text-rose-600 ring-1 ring-rose-100 transition hover:bg-rose-50 hover:text-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-200"
                        aria-label={`Delete ${user.name}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      {deleteTarget ? (
        <ConfirmationDialog
          title={`Remove ${deleteTarget.role.toLowerCase()}`}
          description={role === "Supervisor" ? `Remove ${deleteTarget.name} from the sites you supervise. Their account remains active if they belong to another site.` : `Remove ${deleteTarget.name} from the company and delete their login account.`}
          confirmLabel={isDeletingCleaner ? "Deleting..." : "Delete"}
          cancelLabel="Cancel"
          destructive
          onCancel={() => {
            if (!isDeletingCleaner) {
              setDeleteTarget(null);
            }
          }}
          onConfirm={confirmDeleteCleaner}
        />
      ) : null}
    </div>
  );
}
