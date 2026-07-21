import { useState, type ChangeEvent, type TouchEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Camera, CheckCircle2, ChevronLeft, ChevronRight, Loader2, X } from "lucide-react";
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
};

export function CleanerDutyDetailModal({ duty, site, userId, onClose }: CleanerDutyDetailModalProps) {
  const queryClient = useQueryClient();
  const [beforeFiles, setBeforeFiles] = useState<File[]>([]);
  const [afterFiles, setAfterFiles] = useState<File[]>([]);
  const [comment, setComment] = useState("");
  const [selectedReferencePhotoIndex, setSelectedReferencePhotoIndex] = useState<number | null>(null);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const selectedReferencePhoto = selectedReferencePhotoIndex === null ? null : duty.referencePhotos[selectedReferencePhotoIndex] ?? null;

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
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["cleaner-assigned-duties", userId] });
      await queryClient.invalidateQueries({ queryKey: ["duties"] });
      notify({ tone: "success", title: "Duty completed", message: "The duty was marked as completed." });
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

  return (
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

        <div className="mt-5 rounded-2xl bg-slate-50 p-4">
          <p className="text-sm font-semibold text-slate-950">Description</p>
          <p className="mt-2 text-sm text-slate-600">{duty.description || "No description provided."}</p>
        </div>

        {duty.referencePhotos.length > 0 ? (
          <div className="mt-5 space-y-3">
            <p className="text-sm font-semibold text-slate-950">Reference Photos</p>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
              {duty.referencePhotos.map((photoUrl, index) => (
                <button
                  key={photoUrl}
                  type="button"
                  onClick={() => setSelectedReferencePhotoIndex(index)}
                  className="group relative aspect-square overflow-hidden rounded-2xl bg-slate-100 ring-1 ring-slate-200 transition hover:ring-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-400"
                  aria-label={`Open reference photo ${index + 1}`}
                >
                  <img src={photoUrl} alt={`Reference photo ${index + 1}`} className="h-full w-full object-cover transition duration-200 group-hover:scale-105" />
                </button>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <PhotoPicker label="Before photos" files={beforeFiles} onChange={setBeforeFiles} />
          <PhotoPicker label="After photos" files={afterFiles} onChange={setAfterFiles} />
        </div>

        <div className="mt-5 space-y-2">
          <label className="text-sm font-semibold text-slate-950" htmlFor="duty-completion-comment">
            Comments
          </label>
          <textarea
            id="duty-completion-comment"
            value={comment}
            onChange={(event) => setComment(event.target.value)}
            rows={4}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm outline-none transition focus:border-slate-400 focus:ring-2 focus:ring-slate-200"
            placeholder="Add any updates, issues, or notes about this duty."
          />
        </div>

        <div className="mt-6 flex flex-wrap justify-end gap-3">
          <Button type="button" variant="secondary" onClick={onClose} disabled={completeMutation.isPending}>Cancel</Button>
          <Button type="button" onClick={() => completeMutation.mutate()} disabled={completeMutation.isPending || duty.status === "Completed"}>
            {completeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Completed
          </Button>
        </div>
      </Card>

      {selectedReferencePhoto ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950 p-4"
          onTouchStart={(event) => setTouchStartX(event.touches[0]?.clientX ?? null)}
          onTouchEnd={handleReferencePhotoTouchEnd}
          role="dialog"
          aria-modal="true"
          aria-label="Reference photo viewer"
        >
          <button
            type="button"
            onClick={() => setSelectedReferencePhotoIndex(null)}
            className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
            aria-label="Close reference photo viewer"
          >
            <X className="h-6 w-6" />
          </button>
          {duty.referencePhotos.length > 1 ? (
            <button
              type="button"
              onClick={showPreviousReferencePhoto}
              className="absolute left-4 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/10 p-3 text-white transition hover:bg-white/20 sm:block"
              aria-label="Previous reference photo"
            >
              <ChevronLeft className="h-7 w-7" />
            </button>
          ) : null}
          <img
            src={selectedReferencePhoto}
            alt={`Reference photo ${(selectedReferencePhotoIndex ?? 0) + 1}`}
            className="max-h-[82vh] max-w-full select-none rounded-2xl object-contain"
            draggable={false}
          />
          {duty.referencePhotos.length > 1 ? (
            <button
              type="button"
              onClick={showNextReferencePhoto}
              className="absolute right-4 top-1/2 hidden -translate-y-1/2 rounded-full bg-white/10 p-3 text-white transition hover:bg-white/20 sm:block"
              aria-label="Next reference photo"
            >
              <ChevronRight className="h-7 w-7" />
            </button>
          ) : null}
          <div className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white">
            {(selectedReferencePhotoIndex ?? 0) + 1} / {duty.referencePhotos.length}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function InfoBlock(props: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase text-slate-500">{props.label}</p>
      <p className="mt-2 text-sm font-medium text-slate-950">{props.value}</p>
    </div>
  );
}

function PhotoPicker(props: { label: string; files: File[]; onChange: (files: File[]) => void }) {
  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    props.onChange(Array.from(event.target.files ?? []));
  }

  return (
    <label className="block cursor-pointer rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-4 transition hover:bg-slate-100">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-950">
        <Camera className="h-4 w-4" />
        {props.label}
      </div>
      <p className="mt-2 text-sm text-slate-500">{props.files.length ? `${props.files.length} file${props.files.length === 1 ? "" : "s"} selected` : "Optional evidence upload"}</p>
      <input type="file" accept="image/*" multiple className="hidden" onChange={handleChange} />
    </label>
  );
}
