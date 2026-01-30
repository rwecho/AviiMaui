import { useEffect, useRef, useState, useCallback } from "react";

export interface NativeFaceTrackingData {
  angleX: number;
  angleY: number;
  angleZ: number;
  eyeOpenL: number;
  eyeOpenR: number;
  eyeBallX: number;
  eyeBallY: number;
  mouthOpen: number;
  browL: number;
  browR: number;
}

interface UseNativeFaceTrackingOptions {
  onData?: (data: NativeFaceTrackingData) => void;
}

/**
 * 使用 MAUI 原生面部追踪的 Hook
 * 通过 HybridWebView Bridge 接收 ARKit 面部数据
 */
export function useNativeFaceTracking(options: UseNativeFaceTrackingOptions = {}) {
  const { onData } = options;
  const onDataRef = useRef(onData);
  onDataRef.current = onData;

  const [isAvailable, setIsAvailable] = useState(false);
  const [isTracking, setIsTracking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 检查是否运行在 MAUI 环境
  const isNativeEnv = useCallback(() => {
    return typeof window !== "undefined" && window.HybridWebView?.InvokeDotNet;
  }, []);

  // 检查面部追踪是否可用
  const checkAvailability = useCallback(async () => {
    if (!isNativeEnv()) {
      setIsAvailable(false);
      return false;
    }

    try {
      const result = await window.HybridWebView!.InvokeDotNet("IsFaceTrackingAvailable");
      const available = result?.available ?? false;
      setIsAvailable(available);
      return available;
    } catch (err) {
      console.error("[NativeFaceTracking] Failed to check availability:", err);
      setIsAvailable(false);
      return false;
    }
  }, [isNativeEnv]);

  // 启动面部追踪
  const startTracking = useCallback(async () => {
    if (!isNativeEnv()) {
      setError("Not running in MAUI environment");
      return false;
    }

    try {
      setError(null);
      const result = await window.HybridWebView!.InvokeDotNet("StartFaceTracking");
      
      if (result?.success) {
        setIsTracking(true);
        console.log("[NativeFaceTracking] Started");
        return true;
      } else {
        setError(result?.error || "Failed to start tracking");
        return false;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      console.error("[NativeFaceTracking] Failed to start:", err);
      return false;
    }
  }, [isNativeEnv]);

  // 停止面部追踪
  const stopTracking = useCallback(async () => {
    if (!isNativeEnv()) return;

    try {
      await window.HybridWebView!.InvokeDotNet("StopFaceTracking");
      setIsTracking(false);
      console.log("[NativeFaceTracking] Stopped");
    } catch (err) {
      console.error("[NativeFaceTracking] Failed to stop:", err);
    }
  }, [isNativeEnv]);

  // 监听来自 MAUI 的面部追踪数据
  useEffect(() => {
    const handleMessage = (event: CustomEvent<{ message: string }>) => {
      try {
        const raw = event.detail?.message;
        if (!raw) return;

        const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
        
        if (parsed.type === "faceTracking" && parsed.data) {
          onDataRef.current?.(parsed.data as NativeFaceTrackingData);
        }
      } catch (err) {
        // Ignore parse errors for non-face-tracking messages
      }
    };

    window.addEventListener(
      "HybridWebViewMessageReceived",
      handleMessage as EventListener
    );

    // Check availability on mount
    void checkAvailability();

    return () => {
      window.removeEventListener(
        "HybridWebViewMessageReceived",
        handleMessage as EventListener
      );
    };
  }, [checkAvailability]);

  return {
    isNative: isNativeEnv(),
    isAvailable,
    isTracking,
    error,
    startTracking,
    stopTracking,
    checkAvailability,
  };
}
