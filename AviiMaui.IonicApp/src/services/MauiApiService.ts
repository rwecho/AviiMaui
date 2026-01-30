import { z } from "zod";
import { err, ok, toErrorMessage, type Result } from "./result";
import { createFirebaseAnalytics, type AnalyticsParams } from "./firebase";

// Basic schema for System Info
const SystemInfoSchema = z.object({
  platform: z.string(),
  appVersion: z.string(),
  deviceModel: z.string(),
  manufacturer: z.string(),
  deviceName: z.string(),
  operatingSystem: z.string(),
});
export type SystemInfo = z.infer<typeof SystemInfoSchema>;


export class MauiApiService {
  private async callMauiBridge(
    method: string,
    args?: unknown[] | Record<string, unknown>,
  ): Promise<Result<string>> {
    const argValues = Array.isArray(args)
      ? args
      : args
        ? Object.values(args)
        : [];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const hwv = (window as any).HybridWebView;
    if (!hwv || typeof hwv.InvokeDotNet !== "function") {
      return err("HybridWebView bridge is not available");
    }

    try {
      const result = await hwv.InvokeDotNet(method, argValues);
      return ok(typeof result === "string" ? result : JSON.stringify(result));
    } catch (e) {
      return err(toErrorMessage(e, `Bridge call failed: ${method}`));
    }
  }

  /**
   * Correctly types the bridge call and handles parsing + error checking
   */
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

  /**
   * For methods that just return success (or error)
   */
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

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private firebaseAnalytics = createFirebaseAnalytics(async (method, args) => {
    const res = await this.callMauiBridge(method, args);
    if (res.error !== null) throw new Error(res.error);
    return res.data;
  });

  // --- Helper / Native Methods ---

  async getStringValue(key: string): Promise<Result<string | null>> {
    const res = await this.invoke(
      "GetStringValue",
      [key],
      z.string().nullable(),
    );
    return res;
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
    // SystemInfo object is serialized directly.
    return this.invoke("GetSystemInfo", [], SystemInfoSchema);
  }

  async trackAnalyticsEvent(
    eventName: string,
    parameters?: AnalyticsParams,
  ): Promise<Result<void>> {
    return this.invokeVoid("TrackAnalyticsEventAsync", [eventName, parameters]);
  }

  async signOut(): Promise<Result<void>> {
    return this.invokeVoid("SignOutAsync");
  }

  // --- Logs ---

  async getLogFiles(): Promise<Result<{ files: any[]; error?: string }>> {
    // C# returns { files: [...] }
    const schema = z.object({
      files: z.array(z.any()),
      error: z.string().optional(),
    });
    return this.invoke("GetLogFilesAsync", [], schema);
  }

  async getLogFileContent(fileName: string): Promise<Result<any | null>> {
    // C# returns { fileName, content, size, lastModified }
    const schema = z.object({
      fileName: z.string(),
      content: z.string(),
      size: z.number(),
      lastModified: z.string(), // or date? C# DateTime serializes to string usually
    });
    return this.invoke("GetLogFileContentAsync", [fileName], schema);
  }

  async deleteLogFile(fileName: string): Promise<Result<boolean>> {
    // C# returns { success: true, message: ... }
    const res = await this.invokeVoid("DeleteLogFileAsync", [fileName]);
    if (res.error !== null) return err(res.error);
    return ok(true);
  }

  async clearAllLogs(): Promise<Result<boolean>> {
    const res = await this.invokeVoid("ClearAllLogsAsync");
    if (res.error !== null) return err(res.error);
    return ok(true);
  }

  async openExternalLink(url: string): Promise<Result<void>> {
    return this.invokeVoid("OpenExternalLinkAsync", [url]);
  }

  /**
   * 从相册选择图片
   * @returns 包含 Base64 编码图片数据的结果
   */
  async pickImage(): Promise<Result<PickImageResult>> {
    // C# returns { success: true, base64:..., contentType:..., fileName:..., size:... }
    // OR { cancelled: true }
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
}

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
