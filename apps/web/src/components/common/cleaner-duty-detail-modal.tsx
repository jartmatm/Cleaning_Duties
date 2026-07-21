import { useState, type ChangeEvent } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Camera, CheckCircle2, Loader2, X } from "lucide-react";
import { Button } from "../ui/button";
import { Card } from "../ui/card";
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
      <Card className="max-h-[90vh] w-full max-w-3xl overflow-y-auto p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xl font-semibold text-slate-950">{duty.title}</p>
            <p className="mt-1 text-sm text-slate-500">{site?.name ?? "Assigned site"} · {duty.status}</p>
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
