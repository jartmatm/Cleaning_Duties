import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Check, Cloud, CreditCard, ExternalLink, FileSpreadsheet, ImageUp, Loader2, RefreshCw, RotateCcw, Save, Unplug } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Toggle } from "../../components/ui/base/toggle/toggle";
import { PageHeader } from "../../components/common/page-header";
import { SectionTitle } from "../../components/common/section-title";
import { notify } from "../../components/common/toast";
import { companyPalettes, getCompanyPalette } from "../../constants/company-palettes";
import { useSession } from "../../hooks/use-session";
import { updatePassword } from "../../services/auth-service";
import { createCheckoutSession, createPortalSession, getBillingStatus } from "../../services/billing-service";
import { getCompanySettings, updateArchiveCleanupSettings, updateCompanySettings, uploadCompanyLogo } from "../../services/company-service";
import {
  beginGoogleDriveConnection,
  completeGoogleDriveConnection,
  disconnectGoogleDrive,
  getDataExportSettings,
  syncDataExportNow,
  updateDataExportSettings,
  type DataExportFormat,
  type DataExportPeriodicity,
  type DataExportSettings,
} from "../../services/data-export-service";
import { getCurrentProfile, updateProfileName } from "../../services/profile-service";

function formatDate(value: string | null | undefined) {
  if (!value) return "Not scheduled";
  return new Date(`${value.slice(0, 10)}T00:00:00`).toLocaleDateString("en-AU");
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Not yet";
  return new Date(value).toLocaleString("en-AU", { dateStyle: "medium", timeStyle: "short" });
}

export function SettingsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const oauthCompletionStartedRef = useRef(false);
  const { userId, companyId, role, setCompanyBranding } = useSession();
  const [companyName, setCompanyName] = useState("");
  const [managerName, setManagerName] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [selectedPalette, setSelectedPalette] = useState("midnight");
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [archiveCleanupEnabled, setArchiveCleanupEnabled] = useState(false);
  const [archiveCleanupDays, setArchiveCleanupDays] = useState("10");
  const [dataExportEnabled, setDataExportEnabled] = useState(false);
  const [dataExportFormat, setDataExportFormat] = useState<DataExportFormat>("google_sheets");
  const [dataExportPeriodicity, setDataExportPeriodicity] = useState<DataExportPeriodicity>("daily");
  const [dataExportIntervalDays, setDataExportIntervalDays] = useState("1");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const canManageCompany = role === "Manager";
  const isPersonalSettings = !canManageCompany;
  const canManagePreloadedDuties = role === "Manager";

  const { data: company, isLoading: isLoadingCompany } = useQuery({
    queryKey: ["company-settings", companyId],
    queryFn: () => getCompanySettings(companyId ?? ""),
    enabled: Boolean(companyId) && canManageCompany,
  });

  const { data: profile, isLoading: isLoadingProfile } = useQuery({
    queryKey: ["manager-profile", userId],
    queryFn: () => getCurrentProfile(userId ?? ""),
    enabled: Boolean(userId),
  });

  const { data: billingStatus, isLoading: isLoadingBilling } = useQuery({
    queryKey: ["billing-status", companyId],
    queryFn: () => getBillingStatus(companyId ?? ""),
    enabled: Boolean(companyId) && canManagePreloadedDuties,
  });

  const { data: dataExport, isLoading: isLoadingDataExport } = useQuery({
    queryKey: ["company-data-export", companyId],
    queryFn: () => getDataExportSettings(companyId ?? ""),
    enabled: Boolean(companyId) && canManageCompany,
  });

  const activePalette = useMemo(() => getCompanyPalette(selectedPalette), [selectedPalette]);

  useEffect(() => {
    if (!company) {
      return;
    }

    setCompanyName(company.name);
    setLogoUrl(company.logoUrl);
    setSelectedPalette(company.colorPalette);
    setArchiveCleanupEnabled(company.archiveCleanupEnabled);
    setArchiveCleanupDays(String(company.archiveCleanupDays || 10));
  }, [company]);

  useEffect(() => {
    if (profile) {
      setManagerName(profile.full_name);
    }
  }, [profile]);

  useEffect(() => {
    if (!dataExport) return;
    setDataExportEnabled(dataExport.enabled);
    setDataExportFormat(dataExport.format);
    setDataExportPeriodicity(dataExport.periodicity);
    setDataExportIntervalDays(String(dataExport.intervalDays));
  }, [dataExport]);

  useEffect(() => {
    const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const oauthCode = hashParams.get("google_drive_code");
    const oauthState = hashParams.get("google_drive_state");
    const oauthError = hashParams.get("google_drive_error");
    if ((oauthCode && oauthState) || oauthError) {
      window.history.replaceState({}, "", `${window.location.pathname}${window.location.search}`);
    }

    if (oauthCode && oauthState && !oauthCompletionStartedRef.current) {
      oauthCompletionStartedRef.current = true;
      void completeGoogleDriveConnection(oauthCode, oauthState)
        .then(async ({ initialSyncFailed }) => {
          await queryClient.invalidateQueries({ queryKey: ["company-data-export", companyId] });
          notify({
            tone: initialSyncFailed ? "info" : "success",
            title: "Google Drive connected",
            message: initialSyncFailed
              ? "The account is connected, but the first export could not be completed. Try Sync now."
              : "Your analytics file is ready and will keep the same Drive link.",
          });
        })
        .catch((error) => {
          notify({ tone: "error", title: "Could not connect Google Drive", message: error instanceof Error ? error.message : "Please try again." });
        });
      return;
    }

    if (oauthError) {
      notify({ tone: "error", title: "Could not connect Google Drive", message: "Google did not complete the authorization." });
      return;
    }

    const params = new URLSearchParams(window.location.search);
    const result = params.get("google_drive");
    if (!result) return;

    const detail = params.get("google_drive_detail");
    if (result === "connected") {
      notify({
        tone: detail === "initial_sync_failed" ? "info" : "success",
        title: "Google Drive connected",
        message: detail === "initial_sync_failed"
          ? "The account is connected, but the first export could not be completed. Try Sync now."
          : "Your analytics file is ready and will keep the same Drive link.",
      });
      void queryClient.invalidateQueries({ queryKey: ["company-data-export", companyId] });
    } else {
      notify({ tone: "error", title: "Could not connect Google Drive", message: "Please try the connection again." });
    }

    params.delete("google_drive");
    params.delete("google_drive_detail");
    const query = params.toString();
    window.history.replaceState({}, "", `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`);
  }, [companyId, queryClient]);

  useEffect(() => {
    return () => {
      if (logoPreviewUrl) {
        URL.revokeObjectURL(logoPreviewUrl);
      }
    };
  }, [logoPreviewUrl]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!companyId || !userId) {
        throw new Error("Missing settings context");
      }

      const trimmedManagerName = managerName.trim();

      if (!trimmedManagerName) {
        throw new Error("Name is required");
      }

      if (isPersonalSettings) {
        await updateProfileName(userId, trimmedManagerName);
        return null;
      }

      const trimmedCompanyName = companyName.trim();

      if (!trimmedCompanyName) {
        throw new Error("Company name is required");
      }

      const uploadedLogoUrl = logoFile ? await uploadCompanyLogo(companyId, logoFile) : logoUrl;
      const updatedCompany = await updateCompanySettings(companyId, {
        name: trimmedCompanyName,
        logoUrl: uploadedLogoUrl,
        colorPalette: selectedPalette,
      });
      await updateProfileName(userId, trimmedManagerName);

      return updatedCompany;
    },
    onSuccess: async (updatedCompany) => {
      if (updatedCompany) {
        setCompanyBranding({
          companyName: updatedCompany.name,
          companyLogoUrl: updatedCompany.logoUrl,
          companyPalette: updatedCompany.colorPalette,
        });
        setLogoFile(null);
        setLogoPreviewUrl(null);
        setLogoUrl(updatedCompany.logoUrl);
        await queryClient.invalidateQueries({ queryKey: ["company-settings", companyId] });
      }
      await queryClient.invalidateQueries({ queryKey: ["manager-profile", userId] });
      notify({
        tone: "success",
        title: "Settings saved",
        message: isPersonalSettings ? "Your profile was updated successfully." : "Company settings were updated successfully.",
      });
    },
    onError: (error) => {
      notify({ tone: "error", title: "Could not save settings", message: error instanceof Error ? error.message : "Unknown error" });
    },
  });

  const passwordMutation = useMutation({
    mutationFn: async () => {
      if (newPassword.length < 8) {
        throw new Error("Password must be at least 8 characters.");
      }

      if (newPassword !== confirmPassword) {
        throw new Error("Passwords do not match.");
      }

      await updatePassword(newPassword);
    },
    onSuccess: () => {
      setNewPassword("");
      setConfirmPassword("");
      notify({ tone: "success", title: "Password updated", message: "Your password was changed successfully." });
    },
    onError: (error) => {
      notify({ tone: "error", title: "Could not update password", message: error instanceof Error ? error.message : "Unknown error" });
    },
  });

  const archiveCleanupMutation = useMutation({
    mutationFn: async (input: { enabled: boolean; days: number }) => {
      if (!companyId) {
        throw new Error("Missing company context");
      }

      return updateArchiveCleanupSettings(companyId, input);
    },
    onSuccess: async (updatedCompany) => {
      setArchiveCleanupEnabled(updatedCompany.archiveCleanupEnabled);
      setArchiveCleanupDays(String(updatedCompany.archiveCleanupDays || 10));
      await queryClient.invalidateQueries({ queryKey: ["company-settings", companyId] });
    },
    onError: (error) => {
      notify({ tone: "error", title: "Could not update archive cleanup", message: error instanceof Error ? error.message : "Unknown error" });
      setArchiveCleanupEnabled(company?.archiveCleanupEnabled ?? false);
      setArchiveCleanupDays(String(company?.archiveCleanupDays || 10));
    },
  });

  const dataExportMutation = useMutation({
    mutationFn: async (input: {
      enabled: boolean;
      format: DataExportFormat;
      periodicity: DataExportPeriodicity;
      intervalDays: number;
    }) => {
      if (!companyId) throw new Error("Missing company context");
      return updateDataExportSettings(companyId, input);
    },
    onSuccess: async (updatedSettings) => {
      setDataExportEnabled(updatedSettings.enabled);
      setDataExportFormat(updatedSettings.format);
      setDataExportPeriodicity(updatedSettings.periodicity);
      setDataExportIntervalDays(String(updatedSettings.intervalDays));
      queryClient.setQueryData<DataExportSettings | null>(["company-data-export", companyId], updatedSettings);
      await queryClient.invalidateQueries({ queryKey: ["company-data-export", companyId] });
    },
    onError: (error) => {
      notify({ tone: "error", title: "Could not update data exports", message: error instanceof Error ? error.message : "Unknown error" });
      setDataExportEnabled(dataExport?.enabled ?? false);
      setDataExportFormat(dataExport?.format ?? "google_sheets");
      setDataExportPeriodicity(dataExport?.periodicity ?? "daily");
      setDataExportIntervalDays(String(dataExport?.intervalDays ?? 1));
    },
  });

  const connectDriveMutation = useMutation({
    mutationFn: () => beginGoogleDriveConnection(window.location.origin),
    onSuccess: ({ url }) => window.location.assign(url),
    onError: (error) => {
      notify({ tone: "error", title: "Could not connect Google Drive", message: error instanceof Error ? error.message : "Unknown error" });
    },
  });

  const syncDataExportMutation = useMutation({
    mutationFn: syncDataExportNow,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["company-data-export", companyId] });
      notify({ tone: "success", title: "Export updated", message: "The existing Drive file now contains the latest company data." });
    },
    onError: (error) => {
      notify({ tone: "error", title: "Could not update the export", message: error instanceof Error ? error.message : "Unknown error" });
    },
  });

  const disconnectDriveMutation = useMutation({
    mutationFn: disconnectGoogleDrive,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["company-data-export", companyId] });
      notify({ tone: "success", title: "Google Drive disconnected", message: "Automatic updates are now off. Existing Drive files were kept." });
    },
    onError: (error) => {
      notify({ tone: "error", title: "Could not disconnect Google Drive", message: error instanceof Error ? error.message : "Unknown error" });
    },
  });

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      if (!companyId) {
        throw new Error("Missing company context");
      }

      return createCheckoutSession(companyId);
    },
    onSuccess: (session) => {
      window.location.assign(session.url);
    },
    onError: (error) => {
      notify({ tone: "error", title: "Could not start checkout", message: error instanceof Error ? error.message : "Unknown error" });
    },
  });

  const portalMutation = useMutation({
    mutationFn: async () => {
      if (!companyId) {
        throw new Error("Missing company context");
      }

      return createPortalSession(companyId);
    },
    onSuccess: (session) => {
      window.location.assign(session.url);
    },
    onError: (error) => {
      notify({ tone: "error", title: "Could not open billing portal", message: error instanceof Error ? error.message : "Unknown error" });
    },
  });

  function handleLogoChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0] ?? null;
    event.target.value = "";

    if (!file) {
      return;
    }

    if (logoPreviewUrl) {
      URL.revokeObjectURL(logoPreviewUrl);
    }

    setLogoFile(file);
    setLogoPreviewUrl(URL.createObjectURL(file));
  }

  function resetForm() {
    setCompanyName(company?.name ?? "");
    setManagerName(profile?.full_name ?? "");
    setLogoUrl(company?.logoUrl ?? null);
    setSelectedPalette(company?.colorPalette ?? "midnight");
    setLogoFile(null);
    if (logoPreviewUrl) {
      URL.revokeObjectURL(logoPreviewUrl);
      setLogoPreviewUrl(null);
    }
  }

  function normalizeArchiveCleanupDays(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 3);
    const parsed = Number(digits || 10);
    return String(Math.min(Math.max(parsed, 1), 999));
  }

  function saveArchiveCleanupSettings(enabled: boolean, daysValue: string) {
    const normalizedDays = normalizeArchiveCleanupDays(daysValue);
    setArchiveCleanupDays(normalizedDays);
    archiveCleanupMutation.mutate({ enabled, days: Number(normalizedDays) });
  }

  function normalizeDataExportInterval(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 3);
    const parsed = Number(digits || 1);
    return String(Math.min(Math.max(parsed, 1), 999));
  }

  function saveDataExportSettings(input: {
    enabled?: boolean;
    format?: DataExportFormat;
    periodicity?: DataExportPeriodicity;
    intervalDays?: string;
  }) {
    const nextEnabled = input.enabled ?? dataExportEnabled;
    const nextFormat = input.format ?? dataExportFormat;
    const nextPeriodicity = input.periodicity ?? dataExportPeriodicity;
    const normalizedInterval = normalizeDataExportInterval(input.intervalDays ?? dataExportIntervalDays);

    setDataExportEnabled(nextEnabled);
    setDataExportFormat(nextFormat);
    setDataExportPeriodicity(nextPeriodicity);
    setDataExportIntervalDays(normalizedInterval);
    dataExportMutation.mutate({
      enabled: nextEnabled,
      format: nextFormat,
      periodicity: nextPeriodicity,
      intervalDays: Number(normalizedInterval),
    });
  }

  const isLoading = (canManageCompany && isLoadingCompany) || isLoadingProfile;
  const displayedLogoUrl = logoPreviewUrl ?? logoUrl;
  const isDriveConnected = Boolean(dataExport?.connectedAt);
  const isDataExportBusy = dataExportMutation.isPending
    || connectDriveMutation.isPending
    || syncDataExportMutation.isPending
    || disconnectDriveMutation.isPending;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Settings"
        title={isPersonalSettings ? "Profile settings" : "Company settings"}
        description={
          isPersonalSettings
            ? "Update your personal details and account password."
            : "Manage the company identity, manager profile, and brand palette used across the workspace."
        }
      />

      <div className={isPersonalSettings ? "grid gap-6" : "grid gap-6 xl:grid-cols-[1fr_0.7fr]"}>
        <Card className="space-y-6 p-5">
          <SectionTitle
            title={isPersonalSettings ? "Personal profile" : "Company profile"}
            description={isPersonalSettings ? "Update the name shown on your account." : "Update the core details supervisors and cleaners see in the app."}
          />

          {isLoading ? (
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">Loading settings...</div>
          ) : (
            <form
              className="space-y-5"
              onSubmit={(event) => {
                event.preventDefault();
                saveMutation.mutate();
              }}
            >
              {canManageCompany ? (
                <div className="grid gap-4 md:grid-cols-[auto_1fr] md:items-center">
                  <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
                    {displayedLogoUrl ? (
                      <img src={displayedLogoUrl} alt={`${companyName} logo`} className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-2xl font-semibold text-slate-400">{companyName.slice(0, 1) || "C"}</span>
                    )}
                  </div>
                  <div className="space-y-3">
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
                    <Button type="button" variant="secondary" onClick={() => fileInputRef.current?.click()} disabled={saveMutation.isPending}>
                      <ImageUp className="h-4 w-4" />
                      Upload logo
                    </Button>
                    <p className="text-sm text-slate-500">Square PNG or JPG works best.</p>
                  </div>
                </div>
              ) : null}

              <div className="grid gap-4 md:grid-cols-2">
                {canManageCompany ? (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Company name</label>
                    <Input value={companyName} onChange={(event) => setCompanyName(event.target.value)} placeholder="Company name" />
                  </div>
                ) : null}
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">{isPersonalSettings ? "Name" : "Manager name"}</label>
                  <Input value={managerName} onChange={(event) => setManagerName(event.target.value)} placeholder={isPersonalSettings ? "Your name" : "Manager name"} />
                </div>
              </div>

              {canManageCompany ? (
                <div className="space-y-3">
                  <label className="text-sm font-medium text-slate-700">Company palette</label>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {companyPalettes.map((palette) => {
                      const isSelected = selectedPalette === palette.id;
                      return (
                        <button
                          key={palette.id}
                          type="button"
                          onClick={() => setSelectedPalette(palette.id)}
                          className={`rounded-lg border p-4 text-left transition ${
                            isSelected ? "border-slate-900 bg-white shadow-sm" : "border-slate-200 bg-slate-50 hover:bg-white"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-sm font-semibold text-slate-950">{palette.name}</span>
                            {isSelected ? <Check className="h-4 w-4 text-slate-900" /> : null}
                          </div>
                          <div className="mt-4 flex gap-2">
                            {[palette.primary, palette.accent, palette.surface, palette.text].map((color) => (
                              <span key={color} className="h-8 flex-1 rounded-md ring-1 ring-black/5" style={{ backgroundColor: color }} />
                            ))}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              <div className="flex flex-wrap justify-end gap-3">
                <Button type="button" variant="secondary" onClick={resetForm} disabled={saveMutation.isPending}>
                  <RotateCcw className="h-4 w-4" />
                  Cancel
                </Button>
                <Button type="submit" disabled={saveMutation.isPending}>
                  {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save
                </Button>
              </div>
            </form>
          )}
        </Card>

        {canManageCompany ? (
          <Card className="space-y-5 p-5" style={{ backgroundColor: activePalette.surface }}>
            <SectionTitle title="Brand preview" description="A quick look at the selected identity." />
            <div className="rounded-lg bg-white p-5 shadow-sm ring-1 ring-black/5">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-md" style={{ backgroundColor: activePalette.primary }}>
                  {displayedLogoUrl ? (
                    <img src={displayedLogoUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <span className="font-semibold text-white">{companyName.slice(0, 1) || "C"}</span>
                  )}
                </div>
                <div>
                  <p className="text-sm font-semibold" style={{ color: activePalette.text }}>
                    {companyName || "Company"}
                  </p>
                  <p className="text-xs text-slate-500">{managerName || "Manager"}</p>
                </div>
              </div>
              <div className="mt-5 rounded-md px-4 py-3 text-sm font-medium text-white" style={{ backgroundColor: activePalette.primary }}>
                Active palette: {activePalette.name}
              </div>
              <div className="mt-3 rounded-md px-4 py-3 text-sm font-medium" style={{ backgroundColor: activePalette.accent, color: activePalette.text }}>
                Site operations
              </div>
            </div>
          </Card>
        ) : null}
      </div>

      {canManagePreloadedDuties ? (
        <div className="space-y-6">
          <Card className="space-y-5 p-5">
            <SectionTitle
              title="Billing"
              description="Manage the company subscription, invoices, billing details, and tax IDs."
            />
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-slate-950">
                    {isLoadingBilling ? "Loading billing..." : `Subscription: ${billingStatus?.status ?? "inactive"}`}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {billingStatus?.currentPeriodEnd
                      ? `Current period ends ${new Date(billingStatus.currentPeriodEnd).toLocaleDateString("en-AU")}`
                      : "Stripe Billing handles recurring invoices and payment collection."}
                  </p>
                </div>
                <div className="flex flex-wrap gap-3">
                  {billingStatus?.hasCustomer ? (
                    <Button type="button" variant="secondary" onClick={() => portalMutation.mutate()} disabled={portalMutation.isPending || checkoutMutation.isPending}>
                      {portalMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                      Manage billing
                    </Button>
                  ) : null}
                  <Button type="button" onClick={() => checkoutMutation.mutate()} disabled={checkoutMutation.isPending || portalMutation.isPending}>
                    {checkoutMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                    {billingStatus?.hasSubscription ? "Update subscription" : "Start subscription"}
                  </Button>
                </div>
              </div>
            </div>
          </Card>

          <Card className="space-y-6 p-5">
            <SectionTitle
              title="Analytics exports"
              description="Keep a Google Drive file updated for reporting and business intelligence."
            />

            <div className="flex flex-col gap-4 border-y border-slate-200 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-md ${isDriveConnected ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                  <Cloud className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-950">{isDriveConnected ? "Google Drive connected" : "Connect Google Drive"}</p>
                  <p className="truncate text-sm text-slate-500">{dataExport?.googleEmail ?? "No Google account connected"}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {isDriveConnected ? (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => disconnectDriveMutation.mutate()}
                    disabled={isDataExportBusy}
                  >
                    {disconnectDriveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unplug className="h-4 w-4" />}
                    Disconnect
                  </Button>
                ) : (
                  <Button type="button" onClick={() => connectDriveMutation.mutate()} disabled={isDataExportBusy || isLoadingDataExport}>
                    {connectDriveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Cloud className="h-4 w-4" />}
                    Connect
                  </Button>
                )}
              </div>
            </div>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <Toggle
                size="md"
                label="Automatic updates"
                isSelected={dataExportEnabled}
                isDisabled={dataExportMutation.isPending || isLoadingDataExport}
                onChange={(isSelected) => saveDataExportSettings({ enabled: isSelected })}
              />
              {dataExportMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" /> : null}
            </div>

            <div className="grid gap-5 lg:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">File format</label>
                <div className="grid grid-cols-3 overflow-hidden rounded-md border border-slate-200 bg-slate-50 p-1">
                  {([
                    ["google_sheets", "Google Sheets"],
                    ["csv", "CSV"],
                    ["json", "JSON"],
                  ] as Array<[DataExportFormat, string]>).map(([format, label]) => (
                    <button
                      key={format}
                      type="button"
                      onClick={() => saveDataExportSettings({ format })}
                      disabled={dataExportMutation.isPending || isLoadingDataExport}
                      className={`min-h-9 rounded px-2 py-2 text-sm font-medium transition ${
                        dataExportFormat === format ? "bg-slate-950 text-white shadow-sm" : "text-slate-600 hover:bg-white hover:text-slate-950"
                      } disabled:cursor-not-allowed disabled:opacity-60`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="data-export-periodicity" className="text-sm font-medium text-slate-700">Periodicity</label>
                <select
                  id="data-export-periodicity"
                  value={dataExportPeriodicity}
                  onChange={(event) => saveDataExportSettings({ periodicity: event.target.value as DataExportPeriodicity })}
                  disabled={dataExportMutation.isPending || isLoadingDataExport}
                  className="h-10 w-full rounded-md border border-slate-200 bg-white px-3 text-sm text-slate-900 outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-100"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="custom">Every X days</option>
                </select>
              </div>
            </div>

            {dataExportPeriodicity === "custom" ? (
              <div className="grid max-w-xs gap-2">
                <label className="text-sm font-medium text-slate-700">Days between updates</label>
                <Input
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={3}
                  value={dataExportIntervalDays}
                  onChange={(event) => setDataExportIntervalDays(event.target.value.replace(/\D/g, "").slice(0, 3))}
                  onBlur={() => saveDataExportSettings({ intervalDays: dataExportIntervalDays || "1" })}
                  disabled={dataExportMutation.isPending}
                />
              </div>
            ) : null}

            <div className="grid gap-3 border-t border-slate-200 pt-4 text-sm sm:grid-cols-3">
              <div>
                <p className="text-slate-500">Schedule started</p>
                <p className="mt-1 font-medium text-slate-950">{formatDate(dataExport?.scheduleStartedAt ?? new Date().toISOString())}</p>
              </div>
              <div>
                <p className="text-slate-500">Next update</p>
                <p className="mt-1 font-medium text-slate-950">{dataExportEnabled ? formatDateTime(dataExport?.nextRunAt) : "Automatic updates off"}</p>
              </div>
              <div>
                <p className="text-slate-500">Last updated</p>
                <p className="mt-1 font-medium text-slate-950">{formatDateTime(dataExport?.lastExportedAt)}</p>
              </div>
            </div>

            {dataExport?.lastExportStatus === "failed" && dataExport.lastExportError ? (
              <p className="rounded-md bg-rose-50 px-3 py-2 text-sm text-rose-700">{dataExport.lastExportError}</p>
            ) : null}

            <div className="flex flex-wrap justify-end gap-3">
              {dataExport?.googleFileUrl ? (
                <Button type="button" variant="secondary" onClick={() => window.open(dataExport.googleFileUrl ?? "", "_blank", "noopener,noreferrer")}>
                  <ExternalLink className="h-4 w-4" />
                  Open file
                </Button>
              ) : null}
              <Button
                type="button"
                onClick={() => syncDataExportMutation.mutate()}
                disabled={!isDriveConnected || isDataExportBusy}
              >
                {syncDataExportMutation.isPending || dataExport?.lastExportStatus === "running" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : dataExportFormat === "google_sheets" ? (
                  <FileSpreadsheet className="h-4 w-4" />
                ) : (
                  <RefreshCw className="h-4 w-4" />
                )}
                Sync now
              </Button>
            </div>
          </Card>

          <Card className="space-y-4 p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <Toggle
                size="md"
                label="Delete archived duties"
                isSelected={archiveCleanupEnabled}
                isDisabled={archiveCleanupMutation.isPending || isLoadingCompany}
                onChange={(isSelected) => {
                  setArchiveCleanupEnabled(isSelected);
                  const nextDays = isSelected ? archiveCleanupDays || "10" : archiveCleanupDays;
                  saveArchiveCleanupSettings(isSelected, nextDays);
                }}
              />
              {archiveCleanupMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" /> : null}
            </div>

            {archiveCleanupEnabled ? (
              <div className="grid max-w-xs gap-2">
                <label className="text-sm font-medium text-slate-700">Days to keep archived duties</label>
                <Input
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={3}
                  value={archiveCleanupDays}
                  onChange={(event) => {
                    const digits = event.target.value.replace(/\D/g, "").slice(0, 3);
                    setArchiveCleanupDays(digits);
                  }}
                  onBlur={() => saveArchiveCleanupSettings(true, archiveCleanupDays || "10")}
                  disabled={archiveCleanupMutation.isPending}
                />
              </div>
            ) : null}
          </Card>

          <Card className="space-y-5 p-5">
            <SectionTitle
              title="Preloaded Duties"
              description="Manage reusable duties that can be selected while creating new work."
            />
            <div className="flex flex-wrap gap-3">
              <Button type="button" variant="secondary" onClick={() => navigate("/settings/preloaded-duties")}>
                View Duties
              </Button>
              <Button type="button" onClick={() => navigate("/settings/preloaded-duties?create=1")}>
                Create New
              </Button>
            </div>
          </Card>
        </div>
      ) : null}

      <Card className="space-y-5 p-5">
        <SectionTitle title="Password" description="Update the password for the current signed-in user." />
        <form
          className="grid gap-4 md:grid-cols-2"
          onSubmit={(event) => {
            event.preventDefault();
            passwordMutation.mutate();
          }}
        >
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">New password</label>
            <Input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder="Enter new password"
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700">Confirm password</label>
            <Input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Confirm new password"
              autoComplete="new-password"
            />
          </div>
          <div className="flex flex-wrap justify-end gap-3 md:col-span-2">
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                setNewPassword("");
                setConfirmPassword("");
              }}
              disabled={passwordMutation.isPending}
            >
              <RotateCcw className="h-4 w-4" />
              Cancel
            </Button>
            <Button type="submit" disabled={passwordMutation.isPending || !newPassword || !confirmPassword}>
              {passwordMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Save password
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}
