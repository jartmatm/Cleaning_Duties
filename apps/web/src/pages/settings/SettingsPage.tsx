import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, ImageUp, Loader2, RotateCcw, Save } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { PageHeader } from "../../components/common/page-header";
import { SectionTitle } from "../../components/common/section-title";
import { notify } from "../../components/common/toast";
import { companyPalettes, getCompanyPalette } from "../../constants/company-palettes";
import { useSession } from "../../hooks/use-session";
import { updatePassword } from "../../services/auth-service";
import { getCompanySettings, updateCompanySettings, uploadCompanyLogo } from "../../services/company-service";
import { getCurrentProfile, updateProfileName } from "../../services/profile-service";

export function SettingsPage() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { userId, companyId, setCompanyBranding } = useSession();
  const [companyName, setCompanyName] = useState("");
  const [managerName, setManagerName] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [selectedPalette, setSelectedPalette] = useState("midnight");
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const { data: company, isLoading: isLoadingCompany } = useQuery({
    queryKey: ["company-settings", companyId],
    queryFn: () => getCompanySettings(companyId ?? ""),
    enabled: Boolean(companyId),
  });

  const { data: profile, isLoading: isLoadingProfile } = useQuery({
    queryKey: ["manager-profile", userId],
    queryFn: () => getCurrentProfile(userId ?? ""),
    enabled: Boolean(userId),
  });

  const activePalette = useMemo(() => getCompanyPalette(selectedPalette), [selectedPalette]);

  useEffect(() => {
    if (!company) {
      return;
    }

    setCompanyName(company.name);
    setLogoUrl(company.logoUrl);
    setSelectedPalette(company.colorPalette);
  }, [company]);

  useEffect(() => {
    if (profile) {
      setManagerName(profile.full_name);
    }
  }, [profile]);

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

      const trimmedCompanyName = companyName.trim();
      const trimmedManagerName = managerName.trim();

      if (!trimmedCompanyName) {
        throw new Error("Company name is required");
      }

      if (!trimmedManagerName) {
        throw new Error("Manager name is required");
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
      setCompanyBranding({
        companyName: updatedCompany.name,
        companyLogoUrl: updatedCompany.logoUrl,
        companyPalette: updatedCompany.colorPalette,
      });
      setLogoFile(null);
      setLogoPreviewUrl(null);
      setLogoUrl(updatedCompany.logoUrl);
      await queryClient.invalidateQueries({ queryKey: ["company-settings", companyId] });
      await queryClient.invalidateQueries({ queryKey: ["manager-profile", userId] });
      notify({ tone: "success", title: "Settings saved", message: "Company settings were updated successfully." });
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

  const isLoading = isLoadingCompany || isLoadingProfile;
  const displayedLogoUrl = logoPreviewUrl ?? logoUrl;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Settings"
        title="Company settings"
        description="Manage the company identity, manager profile, and brand palette used across the workspace."
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_0.7fr]">
        <Card className="space-y-6 p-5">
          <SectionTitle title="Company profile" description="Update the core details cleaners and managers see in the app." />

          {isLoading ? (
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-500">Loading settings...</div>
          ) : (
            <form
              className="space-y-5"
              onSubmit={(event) => {
                event.preventDefault();
                saveMutation.mutate();
              }}
            >
              <div className="grid gap-4 md:grid-cols-[auto_1fr] md:items-center">
                <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-[2rem] border border-slate-200 bg-slate-50">
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

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Company name</label>
                  <Input value={companyName} onChange={(event) => setCompanyName(event.target.value)} placeholder="Company name" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">Manager name</label>
                  <Input value={managerName} onChange={(event) => setManagerName(event.target.value)} placeholder="Manager name" />
                </div>
              </div>

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
                        className={`rounded-3xl border p-4 text-left transition ${
                          isSelected ? "border-slate-900 bg-white shadow-sm" : "border-slate-200 bg-slate-50 hover:bg-white"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-sm font-semibold text-slate-950">{palette.name}</span>
                          {isSelected ? <Check className="h-4 w-4 text-slate-900" /> : null}
                        </div>
                        <div className="mt-4 flex gap-2">
                          {[palette.primary, palette.accent, palette.surface, palette.text].map((color) => (
                            <span key={color} className="h-8 flex-1 rounded-2xl ring-1 ring-black/5" style={{ backgroundColor: color }} />
                          ))}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

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

        <Card className="space-y-5 p-5" style={{ backgroundColor: activePalette.surface }}>
          <SectionTitle title="Brand preview" description="A quick look at the selected identity." />
          <div className="rounded-[2rem] bg-white p-5 shadow-sm ring-1 ring-black/5">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl" style={{ backgroundColor: activePalette.primary }}>
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
            <div className="mt-5 rounded-2xl px-4 py-3 text-sm font-medium text-white" style={{ backgroundColor: activePalette.primary }}>
              Active palette: {activePalette.name}
            </div>
            <div className="mt-3 rounded-2xl px-4 py-3 text-sm font-medium" style={{ backgroundColor: activePalette.accent, color: activePalette.text }}>
              Site operations
            </div>
          </div>
        </Card>
      </div>

      <Card className="space-y-5 p-5">
        <SectionTitle title="Password" description="Update the password for the current signed-in manager." />
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
