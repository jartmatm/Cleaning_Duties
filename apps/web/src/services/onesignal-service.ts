import OneSignal, { type NotificationClickEvent } from "react-onesignal";

const ONESIGNAL_APP_ID = "3d22eb0b-ce92-4065-b9dc-bf43c4e5d10d";
const ONESIGNAL_SUBSCRIPTION_DIALOG_KEY = "cleaning-duties.onesignal-subscription-dialog-shown";

type OneSignalTags = Record<string, string | number | boolean | null | undefined>;

let initPromise: Promise<void> | null = null;
let clickListenerRegistered = false;

function canUseOneSignal() {
  return typeof window !== "undefined" && window.isSecureContext && "serviceWorker" in navigator && "Notification" in window;
}

function hasShownSubscriptionDialog() {
  return localStorage.getItem(ONESIGNAL_SUBSCRIPTION_DIALOG_KEY) === "true";
}

function markSubscriptionDialogShown() {
  localStorage.setItem(ONESIGNAL_SUBSCRIPTION_DIALOG_KEY, "true");
}

async function maybeShowSubscriptionDialog() {
  if (hasShownSubscriptionDialog() || OneSignal.Notifications.permission) {
    return;
  }

  markSubscriptionDialogShown();
  await OneSignal.Slidedown.promptPush({ forceSlidedownOverNative: true });
}

async function setupPushSubscriptionPrompt() {
  await maybeShowSubscriptionDialog();
}

function setupNotificationClickListener() {
  if (clickListenerRegistered) return;

  OneSignal.Notifications.addEventListener("click", (event: NotificationClickEvent) => {
    const data = event.notification.additionalData as { dutyId?: unknown } | undefined;
    const destination = typeof data?.dutyId === "string" ? "/duties" : "/dashboard";
    if (window.location.pathname !== destination) window.location.assign(destination);
  });
  clickListenerRegistered = true;
}

export const oneSignalService = {
  async initialize() {
    if (!canUseOneSignal()) {
      return;
    }

    initPromise ??= OneSignal.init({
      appId: ONESIGNAL_APP_ID,
      serviceWorkerPath: "onesignal/OneSignalSDKWorker.js",
      serviceWorkerParam: { scope: "/onesignal/" },
      allowLocalhostAsSecureOrigin: true,
    }).then(async () => {
      setupNotificationClickListener();
      await setupPushSubscriptionPrompt();
    });

    await initPromise;
  },

  async login(profileId: string) {
    await this.initialize();
    if (!canUseOneSignal()) {
      return;
    }

    await OneSignal.login(profileId);
  },

  async logout() {
    if (!initPromise || !canUseOneSignal()) {
      return;
    }

    await initPromise;
    await OneSignal.logout();
  },

  async addEmail(email: string | null | undefined) {
    if (!email) {
      return;
    }

    await this.initialize();
    if (!canUseOneSignal()) {
      return;
    }

    await OneSignal.User.addEmail(email);
  },

  async addTags(tags: OneSignalTags) {
    await this.initialize();
    if (!canUseOneSignal()) {
      return;
    }

    const normalizedTags = Object.fromEntries(
      Object.entries(tags)
        .filter(([, value]) => value !== null && value !== undefined)
        .map(([key, value]) => [key, String(value)]),
    );

    if (Object.keys(normalizedTags).length > 0) {
      await OneSignal.User.addTags(normalizedTags);
    }
  },
};
