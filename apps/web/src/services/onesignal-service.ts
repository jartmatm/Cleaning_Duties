import OneSignal from "react-onesignal";

const ONESIGNAL_APP_ID = "3d22eb0b-ce92-4065-b9dc-bf43c4e5d10d";
const ONESIGNAL_SUBSCRIPTION_DIALOG_KEY = "cleaning-duties.onesignal-subscription-dialog-shown";

type OneSignalTags = Record<string, string | number | boolean | null | undefined>;

let initPromise: Promise<void> | null = null;

function canUseOneSignal() {
  return typeof window !== "undefined" && window.isSecureContext && "serviceWorker" in navigator && "Notification" in window;
}

function isServerAssignedSubscriptionId(subscriptionId: string | null | undefined) {
  return Boolean(subscriptionId && !subscriptionId.startsWith("local-"));
}

function hasShownSubscriptionDialog() {
  return localStorage.getItem(ONESIGNAL_SUBSCRIPTION_DIALOG_KEY) === "true";
}

function markSubscriptionDialogShown() {
  localStorage.setItem(ONESIGNAL_SUBSCRIPTION_DIALOG_KEY, "true");
}

async function maybeShowSubscriptionDialog(subscriptionId: string | null | undefined) {
  if (!isServerAssignedSubscriptionId(subscriptionId) || hasShownSubscriptionDialog()) {
    return;
  }

  markSubscriptionDialogShown();
  window.alert(
    "Your OneSignal SDK integration is complete!\n\nYou can now send Push Notifications & In-App Messages through OneSignal. Tap below to enable push notifications.",
  );
  await OneSignal.Notifications.requestPermission();
}

async function setupPushSubscriptionObserver() {
  OneSignal.User.PushSubscription.addEventListener("change", (event) => {
    void maybeShowSubscriptionDialog(event.current.id);
  });

  const subscriptionId = OneSignal.User.PushSubscription.id;
  await maybeShowSubscriptionDialog(subscriptionId);
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
    }).then(setupPushSubscriptionObserver);

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
