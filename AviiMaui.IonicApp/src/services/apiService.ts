import { MauiApiService } from "./MauiApiService";

const mauiService = new MauiApiService();

// Fallback for Web/Dev when Bridge is missing
const webFallbackService = new (class {
  async getSystemInfo() {
    return {
      error: null,
      data: {
        platform: "Web",
        appVersion: "1.0.0",
        deviceModel: navigator.userAgent,
        manufacturer: "Browser",
        deviceName: "Browser",
        operatingSystem: "Web",
      },
    };
  }
  async showToast(msg: string) {
    console.log("[Toast]", msg);
    return { error: null };
  }
  async showSnackbar(msg: string) {
    console.log("[Snackbar]", msg);
    return { error: null };
  }
  async signOut() {
    console.log("SignOut called");
    return { error: null };
  }
  async getStringValue(key: string) {
    return { error: null, data: localStorage.getItem(key) };
  }
  async setStringValue(key: string, value: string) {
    localStorage.setItem(key, value);
    return { error: null };
  }
  async trackAnalyticsEvent(name: string, params: any) {
    console.log("[Analytics]", name, params);
    return { error: null };
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  [key: string]: any; // Allow indexing
})();

/**
 * Global API Service instance.
 * Automatically chooses between Bridge (Maui) and Web Fallback.
 */
export const apiService = new Proxy({} as MauiApiService, {
  get: (target, prop) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return async (...args: any[]) => {
      // Check for HybridWebView bridge
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const hwv = (window as any).HybridWebView;
      if (hwv && hwv.InvokeDotNet) {
        // Use Maui Service
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const fn = (mauiService as any)[prop];
        if (typeof fn === "function") {
          return fn.apply(mauiService, args);
        }
      }

      // Use Web Fallback
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const fallbackFn = (webFallbackService as any)[prop];
      if (typeof fallbackFn === "function") {
        return fallbackFn.apply(webFallbackService, args);
      }
      
      console.warn(`Method ${String(prop)} not implemented in web fallback`);
      return { error: "Not implemented in web mode" };
    };
  },
});
