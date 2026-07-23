import { CheckCircle2, AlertCircle, Info, X, Loader2 } from "lucide-react";
import { create } from "zustand";
import { useEffect } from "react";

type ToastTone = "success" | "error" | "info" | "loading";

type ToastItem = {
  id: string;
  title: string;
  message?: string;
  tone: ToastTone;
};

type ToastState = {
  toasts: ToastItem[];
  push: (toast: Omit<ToastItem, "id">) => string;
  dismiss: (id: string) => void;
};

const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  push: (toast) => {
    const id = crypto.randomUUID();
    set({ toasts: [...get().toasts, { id, ...toast }] });
    if (toast.tone !== "loading") {
      window.setTimeout(() => {
        get().dismiss(id);
      }, 3500);
    }
    return id;
  },
  dismiss: (id) => set({ toasts: get().toasts.filter((toast) => toast.id !== id) }),
}));

export function notify(toast: Omit<ToastItem, "id">) {
  return useToastStore.getState().push(toast);
}

export function ToastViewport() {
  const toasts = useToastStore((state) => state.toasts);
  const dismiss = useToastStore((state) => state.dismiss);

  useEffect(() => {
    const loadingToast = toasts.find((toast) => toast.tone === "loading");
    if (loadingToast) {
      const timeout = window.setTimeout(() => dismiss(loadingToast.id), 10000);
      return () => window.clearTimeout(timeout);
    }
    return undefined;
  }, [dismiss, toasts]);

  return (
    <div className="fixed bottom-4 right-4 z-50 flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-3 sm:w-full">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="rounded-lg border border-slate-200 bg-white p-4 shadow-lg shadow-slate-200/60 ring-1 ring-black/5"
        >
          <div className="flex items-start gap-3">
            <div
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-md ${
                toast.tone === "success"
                  ? "bg-emerald-50 text-emerald-600"
                  : toast.tone === "error"
                    ? "bg-rose-50 text-rose-600"
                    : toast.tone === "loading"
                      ? "bg-slate-100 text-slate-700"
                      : "bg-sky-50 text-sky-600"
              }`}
            >
              {toast.tone === "success" ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : toast.tone === "error" ? (
                <AlertCircle className="h-5 w-5" />
              ) : toast.tone === "loading" ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Info className="h-5 w-5" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-950">{toast.title}</p>
              {toast.message ? <p className="mt-1 text-sm text-slate-500">{toast.message}</p> : null}
            </div>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              className="rounded-full p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              aria-label="Dismiss toast"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
