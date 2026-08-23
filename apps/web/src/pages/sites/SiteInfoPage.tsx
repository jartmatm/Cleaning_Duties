import { ChevronLeft, ChevronRight, ImageUp, Loader2, RotateCcw, Save, X, ZoomIn, ZoomOut } from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent, type TouchEvent, type WheelEvent } from "react";
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

type Point = { x: number; y: number };

export function SiteInfoPage() {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const viewerImageRef = useRef<HTMLImageElement | null>(null);
  const pinchStartRef = useRef<{ distance: number; scale: number; midpoint: Point; offset: Point } | null>(null);
  const panStartRef = useRef<{ point: Point; offset: Point } | null>(null);
  const { siteId } = useParams();
  const { companyId, userId, role } = useSession();
  const canEdit = role === "Manager";
  const usesAssignedSites = role !== "Manager";
  const [notes, setNotes] = useState("");
  const [infoPhotos, setInfoPhotos] = useState<string[]>([]);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  const [viewerTouchStart, setViewerTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [zoomScale, setZoomScale] = useState(1);
  const [zoomOffset, setZoomOffset] = useState<Point>({ x: 0, y: 0 });

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
    setZoomScale(1);
    setZoomOffset({ x: 0, y: 0 });
    pinchStartRef.current = null;
    panStartRef.current = null;
    setViewerTouchStart(null);

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

  function clampZoomOffset(offset: Point, scale: number) {
    const image = viewerImageRef.current;
    if (!image || scale <= 1) return { x: 0, y: 0 };

    const availableWidth = Math.max(0, window.innerWidth - 24);
    const availableHeight = Math.max(0, window.innerHeight - 24);
    const maxX = Math.max(0, (image.offsetWidth * scale - availableWidth) / 2);
    const maxY = Math.max(0, (image.offsetHeight * scale - availableHeight) / 2);
    return {
      x: Math.min(Math.max(offset.x, -maxX), maxX),
      y: Math.min(Math.max(offset.y, -maxY), maxY),
    };
  }

  function updateZoom(nextScaleValue: number, focalPoint?: Point) {
    const nextScale = Math.min(Math.max(nextScaleValue, 1), 4);
    const ratio = nextScale / zoomScale;
    const center = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    const focal = focalPoint ?? center;
    const nextOffset = nextScale === 1
      ? { x: 0, y: 0 }
      : {
          x: focal.x - center.x - ratio * (focal.x - center.x - zoomOffset.x),
          y: focal.y - center.y - ratio * (focal.y - center.y - zoomOffset.y),
        };

    setZoomScale(nextScale);
    setZoomOffset(clampZoomOffset(nextOffset, nextScale));
  }

  function resetZoom() {
    setZoomScale(1);
    setZoomOffset({ x: 0, y: 0 });
  }

  function touchPoint(touch: { clientX: number; clientY: number }) {
    return { x: touch.clientX, y: touch.clientY };
  }

  function touchDistance(first: { clientX: number; clientY: number }, second: { clientX: number; clientY: number }) {
    return Math.hypot(second.clientX - first.clientX, second.clientY - first.clientY);
  }

  function touchMidpoint(first: { clientX: number; clientY: number }, second: { clientX: number; clientY: number }) {
    return { x: (first.clientX + second.clientX) / 2, y: (first.clientY + second.clientY) / 2 };
  }

  function handleViewerTouchStart(event: TouchEvent<HTMLDivElement>) {
    if (event.touches.length >= 2) {
      const first = event.touches[0];
      const second = event.touches[1];
      if (!first || !second) return;
      pinchStartRef.current = {
        distance: touchDistance(first, second),
        scale: zoomScale,
        midpoint: touchMidpoint(first, second),
        offset: zoomOffset,
      };
      panStartRef.current = null;
      setViewerTouchStart(null);
      return;
    }

    const touch = event.touches[0];
    if (!touch) return;
    const point = touchPoint(touch);
    setViewerTouchStart(point);
    panStartRef.current = zoomScale > 1 ? { point, offset: zoomOffset } : null;
  }

  function handleViewerTouchMove(event: TouchEvent<HTMLDivElement>) {
    if (event.touches.length >= 2 && pinchStartRef.current) {
      const first = event.touches[0];
      const second = event.touches[1];
      if (!first || !second) return;

      const pinch = pinchStartRef.current;
      const nextScale = Math.min(Math.max(pinch.scale * (touchDistance(first, second) / Math.max(pinch.distance, 1)), 1), 4);
      const midpoint = touchMidpoint(first, second);
      const center = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
      const ratio = nextScale / pinch.scale;
      const nextOffset = {
        x: midpoint.x - center.x - ratio * (pinch.midpoint.x - center.x - pinch.offset.x),
        y: midpoint.y - center.y - ratio * (pinch.midpoint.y - center.y - pinch.offset.y),
      };
      setZoomScale(nextScale);
      setZoomOffset(clampZoomOffset(nextOffset, nextScale));
      return;
    }

    const touch = event.touches[0];
    const panStart = panStartRef.current;
    if (!touch || !panStart || zoomScale <= 1) return;
    setZoomOffset(clampZoomOffset({
      x: panStart.offset.x + touch.clientX - panStart.point.x,
      y: panStart.offset.y + touch.clientY - panStart.point.y,
    }, zoomScale));
  }

  function handleViewerTouchEnd(event: TouchEvent<HTMLDivElement>) {
    if (pinchStartRef.current) {
      pinchStartRef.current = null;
      panStartRef.current = null;
      setViewerTouchStart(null);
      if (zoomScale < 1.05) resetZoom();
      return;
    }

    if (zoomScale > 1) {
      panStartRef.current = null;
      setViewerTouchStart(null);
      return;
    }

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

  function handleViewerWheel(event: WheelEvent<HTMLDivElement>) {
    event.preventDefault();
    updateZoom(zoomScale + (event.deltaY < 0 ? 0.35 : -0.35), { x: event.clientX, y: event.clientY });
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
          onTouchStart={handleViewerTouchStart}
          onTouchMove={handleViewerTouchMove}
          onTouchEnd={handleViewerTouchEnd}
          onWheel={handleViewerWheel}
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
            ref={viewerImageRef}
            src={selectedPhoto}
            alt={`Site reference photo ${(selectedPhotoIndex ?? 0) + 1}`}
            className={`max-h-[82dvh] max-w-full select-none rounded-md object-contain ${zoomScale > 1 ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in"}`}
            style={{ transform: `translate3d(${zoomOffset.x}px, ${zoomOffset.y}px, 0) scale(${zoomScale})`, willChange: "transform" }}
            onDoubleClick={(event) => updateZoom(zoomScale > 1 ? 1 : 2.25, { x: event.clientX, y: event.clientY })}
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

          <div
            className="absolute left-1/2 -translate-x-1/2 rounded-full bg-white/15 px-4 py-2 text-sm font-semibold text-white backdrop-blur-sm"
            style={{ bottom: "calc(max(1.25rem, env(safe-area-inset-bottom)) + 3.75rem)" }}
          >
            {(selectedPhotoIndex ?? 0) + 1} / {infoPhotos.length}
          </div>

          <div
            className="absolute left-1/2 z-10 flex -translate-x-1/2 items-center gap-1 rounded-md bg-white/15 p-1 text-white backdrop-blur-sm"
            style={{ bottom: "max(1.25rem, env(safe-area-inset-bottom))" }}
          >
            <button
              type="button"
              onClick={() => updateZoom(zoomScale - 0.5)}
              disabled={zoomScale <= 1}
              className="rounded p-2 transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Zoom out"
              title="Zoom out"
            >
              <ZoomOut className="h-5 w-5" />
            </button>
            <span className="w-12 text-center text-xs font-semibold">{Math.round(zoomScale * 100)}%</span>
            <button
              type="button"
              onClick={() => updateZoom(zoomScale + 0.5)}
              disabled={zoomScale >= 4}
              className="rounded p-2 transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Zoom in"
              title="Zoom in"
            >
              <ZoomIn className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={resetZoom}
              disabled={zoomScale <= 1}
              className="rounded p-2 transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Reset zoom"
              title="Reset zoom"
            >
              <RotateCcw className="h-5 w-5" />
            </button>
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
