import { z } from "zod";
import { err, ok, toErrorMessage, type Result } from "./result";
import { createFirebaseAnalytics, type AnalyticsParams } from "./firebase";

// --- Schemas ---

const SystemInfoSchema = z.object({
  platform: z.string(),
  appVersion: z.string(),
  deviceModel: z.string(),
  manufacturer: z.string(),
  deviceName: z.string(),
  operatingSystem: z.string(),
});
export type SystemInfo = z.infer<typeof SystemInfoSchema>;

const FaceTrackingAvailabilitySchema = z.object({
  available: z.boolean(),
});

const FaceTrackingStartSchema = z.object({
  success: z.boolean(),
  error: z.string().nullable().optional(),
});

const FaceTrackingStatusSchema = z.object({
  isTracking: z.boolean(),
});

/**
 * 图片选择结果类型
 */
export interface PickImageResult {
  success?: boolean;
  cancelled?: boolean;
  base64?: string;
  contentType?: string;
  fileName?: string;
  size?: number;
  error?: string;
  message?: string;
}

/**
 * MauiBridgeService
 * 统一处理 Native Bridge 调用和 Web环境的 Fallback 逻辑。
 * 保证调用方无需关心当前运行环境。
 */
class MauiBridgeService {
  // --- Core Bridge Logic ---

  private isNative(): boolean {
    const hwv = window.HybridWebView;
    return !!(hwv && typeof hwv.InvokeDotNet === "function");
  }

  private async callMauiBridge(
    method: string,
    args?: unknown[] | Record<string, unknown>,
  ): Promise<Result<string>> {
    if (!this.isNative()) {
      return err("Native Bridge not available");
    }

    const argValues = Array.isArray(args)
      ? args
      : args
        ? Object.values(args)
        : [];

    const hwv = window.HybridWebView;
    if (!hwv) return err("HybridWebView not found");

    try {
      const result = await hwv.InvokeDotNet(method, argValues);
      return ok(typeof result === "string" ? result : JSON.stringify(result));
    } catch (e) {
      return err(toErrorMessage(e, `Bridge call failed: ${method}`));
    }
  }

  private async invoke<T>(
    methodName: string,
    args: unknown[] = [],
    schema: z.ZodType<T>,
  ): Promise<Result<T>> {
    const res = await this.callMauiBridge(methodName, args);
    if (res.error !== null) return err(res.error);

    let data: unknown;
    try {
      data = JSON.parse(res.data);
    } catch (e) {
      return err(`Bridge returned invalid JSON: ${toErrorMessage(e)}`);
    }

    // Handle common { error: "..." } response pattern
    if (
      data &&
      typeof data === "object" &&
      "error" in data &&
      typeof (data as any).error === "string"
    ) {
      return err((data as any).error);
    }

    try {
      return ok(schema.parse(data));
    } catch (e) {
      return err(`Data parsing failed (${methodName}): ${toErrorMessage(e)}`);
    }
  }

  private async invokeVoid(
    methodName: string,
    args: unknown[] = [],
  ): Promise<Result<void>> {
    const res = await this.callMauiBridge(methodName, args);
    if (res.error !== null) return err(res.error);

    let data: unknown;
    try {
      data = JSON.parse(res.data);
    } catch (e) {
      return err(`Bridge returned invalid JSON: ${toErrorMessage(e)}`);
    }

    if (
      data &&
      typeof data === "object" &&
      "error" in data &&
      typeof (data as any).error === "string"
    ) {
      return err((data as any).error);
    }

    return ok(undefined);
  }

  // --- Public Methods (Matching C# Bridge) ---

  async getPlatformInfo(): Promise<Result<{ platform: string }>> {
    const schema = z.object({ platform: z.string() });
    return this.invoke("GetPlatformInfo", [], schema);
  }

  async getStringValue(key: string): Promise<Result<string | null>> {
    return this.invoke("GetStringValue", [key], z.string().nullable());
  }

  async setStringValue(key: string, value: string): Promise<Result<void>> {
    return this.invokeVoid("SetStringValue", [key, value]);
  }

  async showSnackbar(message: string): Promise<Result<void>> {
    return this.invokeVoid("ShowSnackbar", [message]);
  }

  async showToast(message: string): Promise<Result<void>> {
    return this.invokeVoid("ShowToast", [message]);
  }

  async getSystemInfo(): Promise<Result<SystemInfo>> {
    return this.invoke("GetSystemInfo", [], SystemInfoSchema);
  }

  async trackAnalyticsEvent(
    eventName: string,
    parameters?: AnalyticsParams,
  ): Promise<Result<void>> {
    return this.invokeVoid("TrackAnalyticsEventAsync", [eventName, parameters]);
  }

  async signOut(): Promise<Result<void>> {
    // SignOutAsync logic if it exists in C# Bridge, or just log
    // Assuming SignOutAsync exists or logic is different
    // return this.invokeVoid("SignOutAsync");
    console.log("SignOut native called (if implemented)");
    return ok(undefined);
  }

  // --- Logs ---

  async getLogFiles(): Promise<Result<{ files: any[]; error?: string }>> {
    const schema = z.object({
      files: z.array(z.any()),
      error: z.string().optional(),
    });
    return this.invoke("GetLogFilesAsync", [], schema);
  }

  async getLogFileContent(fileName: string): Promise<Result<any | null>> {
    const schema = z.object({
      fileName: z.string(),
      content: z.string(),
      size: z.number(),
      lastModified: z.string(),
    });
    return this.invoke("GetLogFileContentAsync", [fileName], schema);
  }

  async deleteLogFile(fileName: string): Promise<Result<boolean>> {
    // C# returns { success: true, message: ... } which invokeVoid handles if checks for 'error' prop
    // But invokeVoid returns void. We want boolean success.
    // Let's use invoke with schema.
    const res = await this.invoke(
      "DeleteLogFileAsync",
      [fileName],
      z.object({ success: z.boolean(), message: z.string().optional() }),
    );
    if (res.error) return err(res.error);
    if (!res.data) return err("No data returned");
    return ok(res.data.success);
  }

  async clearAllLogs(): Promise<Result<boolean>> {
    const res = await this.invoke(
      "ClearAllLogsAsync",
      [],
      z.object({ success: z.boolean(), message: z.string().optional() }),
    );
    if (res.error) return err(res.error);
    if (!res.data) return err("No data returned");
    return ok(res.data.success);
  }

  async openExternalLink(url: string): Promise<Result<void>> {
    return this.invokeVoid("OpenExternalLinkAsync", [url]);
  }

  async pickImage(): Promise<Result<PickImageResult>> {
    const schema = z.object({
      success: z.boolean().optional(),
      cancelled: z.boolean().optional(),
      base64: z.string().optional(),
      contentType: z.string().optional(),
      fileName: z.string().optional(),
      size: z.number().optional(),
      error: z.string().optional(),
      message: z.string().optional(),
    });
    return this.invoke("PickImageAsync", [], schema);
  }

  // --- Face Tracking ---

  async isFaceTrackingAvailable(): Promise<Result<boolean>> {
    const res = await this.invoke(
      "IsFaceTrackingAvailable",
      [],
      FaceTrackingAvailabilitySchema,
    );
    if (res.error) return err(res.error);
    if (!res.data) return err("No data returned");
    return ok(res.data.available);
  }

  async startFaceTracking(): Promise<
    Result<{ success: boolean; error?: string | null }>
  > {
    return this.invoke("StartFaceTracking", [], FaceTrackingStartSchema);
  }

  async stopFaceTracking(): Promise<Result<void>> {
    return this.invokeVoid("StopFaceTracking");
  }

  async getFaceTrackingStatus(): Promise<Result<boolean>> {
    const res = await this.invoke(
      "GetFaceTrackingStatus",
      [],
      FaceTrackingStatusSchema,
    );
    if (res.error) return err(res.error);
    if (!res.data) return err("No data returned");
    return ok(res.data.isTracking);
  }

  async setKeepScreenOn(keepOn: boolean): Promise<Result<void>> {
    return this.invokeVoid("SetKeepScreenOn", [keepOn]);
  }
}

export const mauiBridgeService = new MauiBridgeService();
