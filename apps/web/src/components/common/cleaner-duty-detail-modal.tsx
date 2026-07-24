import { useEffect, useMemo, useRef, useState, type ChangeEvent, type TouchEvent } from "react";
import { createPortal } from "react-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Camera, CheckCircle2, ChevronLeft, ChevronRight, Loader2, Pencil, X } from "lucide-react";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
import { DutyStatusBadge } from "./duty-status-badge";
import { notify } from "./toast";
import { uploadDutyEvidencePhotos } from "../../services/duty-photo-service";
import { addDutyComment, appendDutyEvidencePhotos, updateDutyStatus, type DutyItem } from "../../services/duties-service";
import type { SiteItem } from "../../services/sites-service";

type CleanerDutyDetailModalProps = {
  duty: DutyItem;
  site: SiteItem | null;
  userId: string | null;
  onClose: () => void;
  onCompleted?: (duty: DutyItem) => void;
};

export function CleanerDutyDetailModal({ duty, site, userId, onClose, onCompleted }: CleanerDutyDetailModalProps) {
  const queryClient = useQueryClient();
  const isCompletedDuty = duty.status === "Completed";
  const [beforeFiles, setBeforeFiles] = useState<File[]>([]);
  const [afterFiles, setAfterFiles] = useState<File[]>([]);
  const [comment, setComment] = useState("");
  const [isEditingCompletedDuty, setIsEditingCompletedDuty] = useState(!isCompletedDuty);
  const [selectedReferencePhotoIndex, setSelectedReferencePhotoIndex] = useState<number | null>(null);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const selectedReferencePhoto = selectedReferencePhotoIndex === null ? null : duty.referencePhotos[selectedReferencePhotoIndex] ?? null;
  const isFormEditable = !isCompletedDuty || isEditingCompletedDuty;

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const completeMutation = useMutation({
    mutationFn: async () => {
      if (!userId) {
        throw new Error("Missing cleaner profile");
      }
      if (!site) {
        throw new Error("Missing site context");
      }
      const beforeUrls = beforeFiles.length
        ? await uploadDutyEvidencePhotos({ bucketName: site.storageBucket, siteId: site.id, dutyTitle: duty.title, files: beforeFiles, type: "before" })
        : [];
      const afterUrls = afterFiles.length
        ? await uploadDutyEvidencePhotos({ bucketName: site.storageBucket, siteId: site.id, dutyTitle: duty.title, files: afterFiles, type: "after" })
        : [];
      if (beforeUrls.length > 0 || afterUrls.length > 0) {
        await appendDutyEvidencePhotos({ dutyId: duty.id, beforePhotos: beforeUrls, afterPhotos: afterUrls });
      }
      await addDutyComment({ dutyId: duty.id, profileId: userId, body: comment });
      return updateDutyStatus(duty.id, "Completed");
    },
    onSuccess: async (completedDuty) => {
      await queryClient.invalidateQueries({ queryKey: ["cleaner-assigned-duties", userId] });
      await queryClient.invalidateQueries({ queryKey: ["duties"] });
      notify({
        tone: "success",
        title: isCompletedDuty ? "Duty updated" : "Duty completed",
        message: isCompletedDuty ? "The completed duty changes were saved." : "The duty was marked as completed.",
      });
      if (!isCompletedDuty) {
        onCompleted?.(completedDuty);
      }
      onClose();
    },
    onError: (error) => notify({ tone: "error", title: "Could not complete duty", message: error instanceof Error ? error.message : "Unknown error" }),
  });

  function showPreviousReferencePhoto() {
    setSelectedReferencePhotoIndex((current) => {
      if (current === null || duty.referencePhotos.length === 0) {
        return current;
      }

      return (current - 1 + duty.referencePhotos.length) % duty.referencePhotos.length;
    });
  }

  function showNextReferencePhoto() {
    setSelectedReferencePhotoIndex((current) => {
      if (current === null || duty.referencePhotos.length === 0) {
        return current;
      }

      return (current + 1) % duty.referencePhotos.length;
    });
  }

  function handleReferencePhotoTouchEnd(event: TouchEvent<HTMLDivElement>) {
    if (touchStartX === null) {
      return;
    }

    const touchEndX = event.changedTouches[0]?.clientX ?? touchStartX;
    const distance = touchEndX - touchStartX;
    setTouchStartX(null);

    if (Math.abs(distance) < 40) {
      return;
    }

    if (distance > 0) {
      showPreviousReferencePhoto();
      return;
    }

    showNextReferencePhoto();
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
      <Card className="max-h-[90vh] w-full max-w-3xl overflow-y-auto p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xl font-semibold text-slate-950">{duty.title}</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-sm text-slate-500">{site?.name ?? "Assigned site"}</span>
              <DutyStatusBadge status={duty.status} />
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-full p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700" aria-label="Close duty detail">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <InfoBlock label="Priority" value={duty.priority} />
          <InfoBlock label="Due date" value={duty.dueDate ? new Date(duty.dueDate).toLocaleString() : "No due date"} />
          <InfoBlock label="Equipment" value={duty.equipment.length ? duty.equipment.join(", ") : "None listed"} />
        </div>

        <div className="mt-5 rounded-md bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-950">Description</p>
          <p className="mt-2 text-sm text-slate-600">{duty.description || "No description provided."}</p>
        </div>

        {duty.referencePhotos.length > 0 ? (
          <div className="mt-5 space-y-3 rounded-md border border-slate-200 bg-white p-3 sm:p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm font-semibold text-slate-950">Reference Photos</p>
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">{duty.referencePhotos.length}</span>
            </div>
            <div className="-mx-1 flex snap-x flex-wrap gap-2 overflow-x-auto px-1 pb-1 sm:mx-0 sm:overflow-visible sm:px-0 sm:pb-0">
              {duty.referencePhotos.map((photoUrl, index) => (
                <button
                  key={photoUrl}
                  type="button"
                  onClick={() => setSelectedReferencePhotoIndex(index)}
                  className="group relative h-14 w-14 flex-none snap-start overflow-hidden rounded-md bg-slate-100 ring-1 ring-slate-200 transition hover:ring-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400"
                  aria-label={`Open reference photo ${index + 1}`}
                >
                  <img src={photoUrl} alt={`Reference photo ${index + 1}`} className="h-full w-full object-cover transition duration-200 group-hover:scale-105" />
                  <span className="absolute bottom-1 right-1 rounded-full bg-slate-950/70 px-1.5 py-0.5 text-[10px] font-semibold text-white">{index + 1}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <PhotoPicker label="Before photos" existingPhotoUrls={duty.beforePhotos} files={beforeFiles} onChange={setBeforeFiles} editable={isFormEditable} />
          <PhotoPicker label="After photos" existingPhotoUrls={duty.afterPhotos} files={afterFiles} onChange={setAfterFiles} editable={isFormEditable} />
        </div>

        <div className="mt-5 space-y-2">
          <label className="text-sm font-semibold text-slate-950" htmlFor="duty-completion-comment">
            Comments
          </label>
          <textarea
            id="duty-completion-comment"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            disabled={!isFormEditable}
            rows={4}
            className="w-full rounded-md border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
            placeholder={isFormEditable ? "Add any updates, issues, or notes about this duty." : "Select Edit (Completed) to add a new comment."}
          />
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose} disabled={completeMutation.isPending}>Cancel</Button>
          {isCompletedDuty && !isEditingCompletedDuty ? (
            <Button type="button" onClick={() => setIsEditingCompletedDuty(true)}>
              <Pencil className="h-4 w-4" />
              Edit (Completed)
            </Button>
          ) : (
            <Button type="button" onClick={() => completeMutation.mutate()} disabled={completeMutation.isPending}>
              {completeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              Completed
            </Button>
          )}
        </div>
      </Card>

      {selectedReferencePhoto ? (
        <div
          className="fixed inset-0 z-[60] flex touch-none items-center justify-center bg-slate-950 p-3 sm:p-4"
          onTouchStart={(event) => setTouchStartX(event.touches[0]?.clientX ?? null)}
          onTouchEnd={handleReferencePhotoTouchEnd}
          role="dialog"
          aria-modal="true"
          aria-label="Reference photo viewer"
        >
          <button
            type="button"
            onClick={() => setSelectedReferencePhotoIndex(null)}
            className="absolute right-4 top-4 z-10 rounded-full bg-white/15 p-3 text-white transition hover:bg-white/25"
            aria-label="Close reference photo viewer"
          >
            <X className="h-6 w-6" />
          </button>
          {duty.referencePhotos.length > 1 ? (
            <button
              type="button"
              onClick={showPreviousReferencePhoto}
              className="absolute left-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/15 p-3 text-white transition hover:bg-white/25"
              aria-label="Previous reference photo"
            >
              <ChevronLeft className="h-7 w-7" />
            </button>
          ) : null}
          <img
            src={selectedReferencePhoto}
            alt={`Reference photo ${(selectedReferencePhotoIndex ?? 0) + 1}`}
            className="max-h-[78dvh] w-full max-w-full select-none rounded-md object-contain sm:max-h-[82vh]"
            draggable={false}
          />
          {duty.referencePhotos.length > 1 ? (
            <button
              type="button"
              onClick={showNextReferencePhoto}
              className="absolute right-3 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/15 p-3 text-white transition hover:bg-white/25"
              aria-label="Next reference photo"
            >
              <ChevronRight className="h-7 w-7" />
            </button>
          ) : null}
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-white/15 px-4 py-2 text-sm font-semibold text-white">
            {(selectedReferencePhotoIndex ?? 0) + 1} / {duty.referencePhotos.length}
          </div>
        </div>
      ) : null}
    </div>,
    document.body,
  );
}

function InfoBlock(props: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase text-slate-500">{props.label}</p>
      <p className="mt-2 text-sm font-medium text-slate-950">{props.value}</p>
    </div>
  );
}

function PhotoPicker(props: { label: string; existingPhotoUrls: string[]; files: File[]; onChange: (files: File[]) => void; editable: boolean }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const previews = useMemo(
    () => props.files.map((file) => ({ file, previewUrl: URL.createObjectURL(file) })),
    [props.files],
  );

  useEffect(() => {
    return () => {
      previews.forEach((preview) => URL.revokeObjectURL(preview.previewUrl));
    };
  }, [previews]);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.target.files ?? []);
    event.target.value = "";

    if (selectedFiles.length === 0) {
      return;
    }

    props.onChange([...props.files, ...selectedFiles]);
  }

  return (
    <div className="rounded-md border border-dashed border-slate-300 bg-slate-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {props.editable ? (
          <>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="inline-flex min-h-11 items-center gap-2 rounded-md bg-slate-950 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              <Camera className="h-4 w-4" />
              {props.label}
            </button>
            <input ref={inputRef} type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={handleChange} />
          </>
        ) : (
          <p className="text-sm font-semibold text-slate-950">{props.label}</p>
        )}
        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
          {props.existingPhotoUrls.length + props.files.length} photos
        </span>
      </div>
      {props.editable ? <p className="mt-2 text-sm text-slate-500">Tap again to add more photos from camera or gallery.</p> : null}
      {props.existingPhotoUrls.length > 0 || previews.length > 0 ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {props.existingPhotoUrls.map((photoUrl, index) => (
            <div key={photoUrl} className="relative h-10 w-10 overflow-hidden rounded-md bg-white ring-1 ring-slate-200">
              <img src={photoUrl} alt={`Saved ${props.label.toLowerCase()} ${index + 1}`} className="h-full w-full object-cover" loading="lazy" />
            </div>
          ))}
          {previews.map((preview, index) => (
            <div key={`${preview.file.name}-${preview.file.lastModified}-${index}`} className="relative h-10 w-10 overflow-hidden rounded-md bg-white ring-1 ring-slate-200">
              <img src={preview.previewUrl} alt={`New ${props.label.toLowerCase()} ${index + 1}`} className="h-full w-full object-cover" />
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-slate-500">No photos uploaded.</p>
      )}
    </div>
  );
}
