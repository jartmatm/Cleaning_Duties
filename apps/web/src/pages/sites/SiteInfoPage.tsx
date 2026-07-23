import { ImageUp, Loader2, Save, X } from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Navigate, useParams } from "react-router-dom";
import { Button } from "../../components/ui/button";
import { Card } from "../../components/ui/card";
import { PageHeader } from "../../components/common/page-header";
import { SectionTitle } from "../../components/common/section-title";
import { notify } from "../../components/common/toast";
import { useSession } from "../../hooks/use-session";
import { listMySites, listSites, updateSiteInformation, uploadSiteInfoPhoto } from "../../services/sites-service";

export function SiteInfoPage() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { siteId } = useParams();
  const { companyId, userId, role } = useSession();
  const canEdit = role === "Owner" || role === "Manager";
  const [notes, setNotes] = useState("");
  const [infoPhotos, setInfoPhotos] = useState<string[]>([]);

  const { data: sites = [], isLoading } = useQuery({
    queryKey: role === "Cleaner" ? ["sites", "cleaner", userId, "info"] : ["sites", companyId, "info"],
    queryFn: () => role === "Cleaner" ? listMySites(userId ?? "") : listSites(companyId ?? ""),
    enabled: role === "Cleaner" ? Boolean(userId) : Boolean(companyId),
  });

  const site = sites.find((item) => item.id === siteId) ?? null;

  useEffect(() => {
    if (!site) {
      return;
    }

    setNotes(site.notes);
    setInfoPhotos(site.infoPhotos);
  }, [site]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!site || !canEdit) {
        throw new Error("Missing site context");
      }

      return updateSiteInformation(site.id, { notes, infoPhotos });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["layout-sites"] });
      await queryClient.invalidateQueries({ queryKey: ["sites"] });
      notify({ tone: "success", title: "Site information saved", message: "The site notes were updated." });
    },
    onError: (error) => notify({ tone: "error", title: "Could not save site information", message: error instanceof Error ? error.message : "Unknown error" }),
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!site) {
        throw new Error("Missing site context");
      }

      const bucketName = site.storageBucket || `site-${site.id}`;
      return uploadSiteInfoPhoto({ bucketName, siteId: site.id, file });
    },
    onSuccess: (photoUrl) => {
      setInfoPhotos((current) => [...current, photoUrl]);
    },
    onError: (error) => notify({ tone: "error", title: "Photo upload failed", message: error instanceof Error ? error.message : "Unknown error" }),
  });

  if (!siteId) {
    return <Navigate to="/" replace />;
  }

  async function handlePhotoSelection(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";

    for (const file of files) {
      await uploadMutation.mutateAsync(file);
    }
  }

  function removePhoto(photoUrl: string) {
    setInfoPhotos((current) => current.filter((item) => item !== photoUrl));
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Site information"
        title={site?.name ?? "Site information"}
        description={canEdit ? "Edit operational notes, instructions, and reference photos for this site." : "Review important site information before starting work."}
        actions={canEdit ? (
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending || isLoading || !site}>
            {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
          </Button>
        ) : null}
      />

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card className="space-y-4 p-5">
          <SectionTitle
            title={canEdit ? "Editor" : "Important information"}
            description={canEdit ? "Write the site README in a clear, scannable format." : undefined}
          />
          {canEdit ? (
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={18}
              className="min-h-[28rem] w-full resize-y rounded-md border border-slate-200 bg-white px-4 py-3 text-sm leading-6 outline-none transition placeholder:text-slate-400 focus:border-slate-400"
              placeholder={"Access instructions\nLock-up process\nCleaner notes\nKnown risks\nClient preferences"}
            />
          ) : (
            <ReadOnlyNotes notes={site?.notes ?? ""} />
          )}
        </Card>

        <div className="space-y-6">
          {canEdit ? (
            <Card className="space-y-4 p-5">
              <SectionTitle title="Photos" description="Upload visual references for this site." />
              <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handlePhotoSelection} />
              <Button type="button" variant="secondary" onClick={() => fileInputRef.current?.click()} disabled={uploadMutation.isPending || !site}>
                {uploadMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImageUp className="h-4 w-4" />}
                Upload photos
              </Button>
            </Card>
          ) : null}

          <Card className="space-y-4 p-5">
            <SectionTitle title="Reference photos" description={infoPhotos.length ? `${infoPhotos.length} photos uploaded.` : "No reference photos uploaded yet."} />
            {infoPhotos.length ? (
              <div className="grid grid-cols-2 gap-3">
                {infoPhotos.map((photoUrl) => (
                  <div key={photoUrl} className="group relative overflow-hidden rounded-md border border-slate-200 bg-slate-50">
                    <img src={photoUrl} alt="" className="h-32 w-full object-cover" />
                    {canEdit ? (
                      <button
                        type="button"
                        onClick={() => removePhoto(photoUrl)}
                        className="absolute right-2 top-2 rounded-full bg-white/90 p-1.5 text-slate-700 opacity-0 shadow-sm transition group-hover:opacity-100"
                        aria-label="Remove photo"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-500">Photos added by managers will appear here.</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function ReadOnlyNotes({ notes }: { notes: string }) {
  if (!notes.trim()) {
    return <p className="text-sm text-slate-500">No site information has been added yet.</p>;
  }

  return (
    <div className="min-h-[20rem] whitespace-pre-wrap rounded-md border border-slate-200 bg-slate-50 p-5 text-sm leading-6 text-slate-700">
      {notes}
    </div>
  );
}
