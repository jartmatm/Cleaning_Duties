import { ChevronLeft, ChevronRight, ImageUp, Loader2, Save, X } from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent, type TouchEvent } from "react";
import { createPortal } from "react-dom";
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
  const canEdit = role === "Manager";
  const usesAssignedSites = role !== "Manager";
  const [notes, setNotes] = useState("");
  const [infoPhotos, setInfoPhotos] = useState<string[]>([]);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  const [viewerTouchStart, setViewerTouchStart] = useState<{ x: number; y: number } | null>(null);

  const { data: sites = [], isLoading } = useQuery({
    queryKey: usesAssignedSites ? ["sites", role, userId, "info"] : ["sites", companyId, "info"],
    queryFn: () => usesAssignedSites ? listMySites(userId ?? "") : listSites(companyId ?? ""),
    enabled: usesAssignedSites ? Boolean(userId) : Boolean(companyId),
  });

  const site = sites.find((item) => item.id === siteId) ?? null;

  useEffect(() => {
    if (!site) {
      return;
    }

    setNotes(site.notes);
    setInfoPhotos(site.infoPhotos);
    setSelectedPhotoIndex(null);
  }, [site]);

  useEffect(() => {
    if (selectedPhotoIndex === null) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setSelectedPhotoIndex(null);
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedPhotoIndex]);

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
    return <Navigate to="/dashboard" replace />;
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

  function showPreviousPhoto() {
    setSelectedPhotoIndex((current) => current === null || infoPhotos.length === 0
      ? current
      : (current - 1 + infoPhotos.length) % infoPhotos.length);
  }

  function showNextPhoto() {
    setSelectedPhotoIndex((current) => current === null || infoPhotos.length === 0
      ? current
      : (current + 1) % infoPhotos.length);
  }

  function handleViewerTouchEnd(event: TouchEvent<HTMLDivElement>) {
    if (!viewerTouchStart) return;

    const changedTouch = event.changedTouches[0];
    const distanceX = (changedTouch?.clientX ?? viewerTouchStart.x) - viewerTouchStart.x;
    const distanceY = (changedTouch?.clientY ?? viewerTouchStart.y) - viewerTouchStart.y;
    setViewerTouchStart(null);

    if (distanceY < -60 && Math.abs(distanceY) > Math.abs(distanceX)) {
      setSelectedPhotoIndex(null);
      return;
    }

    if (Math.abs(distanceX) < 40 || Math.abs(distanceX) <= Math.abs(distanceY) || infoPhotos.length < 2) return;
    if (distanceX > 0) {
      showPreviousPhoto();
      return;
    }
    showNextPhoto();
  }

  const selectedPhoto = selectedPhotoIndex === null ? null : infoPhotos[selectedPhotoIndex] ?? null;

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
                {infoPhotos.map((photoUrl, index) => (
                  <div key={`${photoUrl}-${index}`} className="group relative overflow-hidden rounded-md border border-slate-200 bg-slate-50">
                    <button
                      type="button"
                      onClick={() => setSelectedPhotoIndex(index)}
                      className="block w-full cursor-zoom-in focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-950"
                      aria-label={`Open reference photo ${index + 1} of ${infoPhotos.length}`}
                    >
                      <img src={photoUrl} alt="" className="h-32 w-full object-cover" />
                    </button>
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

      {selectedPhoto ? createPortal(
        <div
          className="fixed inset-0 z-[70] flex touch-none items-center justify-center bg-slate-950 p-3 sm:p-4"
          onClick={(event) => {
            if (event.target === event.currentTarget) setSelectedPhotoIndex(null);
          }}
          onTouchStart={(event) => {
            const touch = event.touches[0];
            setViewerTouchStart(touch ? { x: touch.clientX, y: touch.clientY } : null);
          }}
          onTouchEnd={handleViewerTouchEnd}
          role="dialog"
          aria-modal="true"
          aria-label="Site reference photo viewer"
        >
          <button
            type="button"
            onClick={() => setSelectedPhotoIndex(null)}
            className="absolute z-10 rounded-full bg-white p-3 text-slate-950 shadow-xl ring-1 ring-white/40 transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-white"
            style={{ right: "max(1rem, env(safe-area-inset-right))", top: "max(1rem, env(safe-area-inset-top))" }}
            aria-label="Close reference photo viewer"
          >
            <X className="h-6 w-6" />
          </button>

          {infoPhotos.length > 1 ? (
            <button
              type="button"
              onClick={showPreviousPhoto}
              className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/15 p-3 text-white transition hover:bg-white/25"
              aria-label="Previous reference photo"
            >
              <ChevronLeft className="h-7 w-7" />
            </button>
          ) : null}

          <img
            src={selectedPhoto}
            alt={`Site reference photo ${(selectedPhotoIndex ?? 0) + 1}`}
            className="max-h-[82dvh] max-w-full select-none rounded-md object-contain"
            draggable={false}
          />

          {infoPhotos.length > 1 ? (
            <button
              type="button"
              onClick={showNextPhoto}
              className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/15 p-3 text-white transition hover:bg-white/25"
              aria-label="Next reference photo"
            >
              <ChevronRight className="h-7 w-7" />
            </button>
          ) : null}

          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-white/15 px-4 py-2 text-sm font-semibold text-white">
            {(selectedPhotoIndex ?? 0) + 1} / {infoPhotos.length}
          </div>
        </div>,
        document.body,
      ) : null}
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
