import type { NotificationClickEvent } from "react-native-onesignal";
import { LogLevel, OneSignal } from "react-native-onesignal";
import { mobileConfig } from "@/lib/config";
import type { Company, Profile } from "@/types/domain";

let initialized = false;

function ensureInitialized() {
  if (!mobileConfig.oneSignalAppId || initialized) return Boolean(mobileConfig.oneSignalAppId);

  if (__DEV__) OneSignal.Debug.setLogLevel(LogLevel.Warn);
  OneSignal.initialize(mobileConfig.oneSignalAppId);
  initialized = true;
  return true;
}

function normalizeTags(profile: Profile, company: Company) {
  return {
    profile_id: profile.id,
    company_id: profile.companyId,
    company_name: company.name,
    role: profile.role,
    platform: "mobile",
  };
}

export const oneSignalService = {
  initialize(onNotificationClick: (event: NotificationClickEvent) => void) {
    if (!ensureInitialized()) return () => undefined;
    OneSignal.Notifications.addEventListener("click", onNotificationClick);

    return () => OneSignal.Notifications.removeEventListener("click", onNotificationClick);
  },

  identifyUser(profileId: string, email?: string | null) {
    if (!ensureInitialized()) return;

    OneSignal.login(profileId);
    if (email) OneSignal.User.addEmail(email);
  },

  identify(profile: Profile, company: Company, sessionEmail?: string | null) {
    if (!ensureInitialized()) return;

    this.identifyUser(profile.id, sessionEmail ?? profile.email);
    OneSignal.User.addTags(normalizeTags(profile, company));
    void OneSignal.Notifications.canRequestPermission().then((canRequest) => {
      if (canRequest) void OneSignal.Notifications.requestPermission(false);
    });
  },

  logout() {
    if (mobileConfig.oneSignalAppId && initialized) OneSignal.logout();
  },
};
