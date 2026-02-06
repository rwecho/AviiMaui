import { useEffect, useRef, useState, useCallback } from "react";
import { mauiBridgeService } from "../services/MauiBridgeService";

export interface FaceTrackingResult {
  // Head rotation
  angleX: number; // Left-Right
  angleY: number; // Up-Down
  angleZ: number; // Tilt

  // Eyes
  eyeOpenL: number;
  eyeOpenR: number;
  eyeBallX: number;
  eyeBallY: number;

  // Mouth
  mouthOpen: number;

  // Eyebrows
  browL: number;
  browR: number;
}

interface UseFaceTrackingOptions {
  onResult?: (result: FaceTrackingResult) => void;
  // showVideo option is deprecated but kept for compatibility
  showVideo?: boolean;
}

export function useFaceTracking(options: UseFaceTrackingOptions = {}) {
  const { onResult } = options;
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  const [isReady, setIsReady] = useState(false);
  const [isTracking, setIsTracking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check availability
  const checkAvailability = useCallback(async () => {
    try {
      const result = await mauiBridgeService.isFaceTrackingAvailable();
      if (result.error !== null) {
        console.warn(
          "[FaceTracking] Availability check warning:",
          result.error
        );
        setIsReady(false);
        return false;
      }
      // result.data is boolean here
      setIsReady(result.data);
      return result.data;
    } catch (err) {
      console.error("[FaceTracking] Failed to check availability:", err);
      setIsReady(false);
      return false;
    }
  }, []);

  // Start tracking
  const startTracking = useCallback(async () => {
    try {
      setError(null);
      const result = await mauiBridgeService.startFaceTracking();

      if (result.error || !result.data) {
        setError(result.error || "Failed to start tracking (no data)");
        return false;
      }

      if (result.data.success) {
        setIsTracking(true);
        console.log("[FaceTracking] Started native tracking");
        return true;
      } else {
        setError(result.data.error || "Failed to start tracking");
        return false;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
      console.error("[FaceTracking] Failed to start:", err);
      return false;
    }
  }, []);

  // Stop tracking
  const stopTracking = useCallback(async () => {
    try {
      await mauiBridgeService.stopFaceTracking();
      setIsTracking(false);
      console.log("[FaceTracking] Stopped native tracking");
    } catch (err) {
      console.error("[FaceTracking] Failed to stop:", err);
    }
  }, []);

  // Listen for native messages
  useEffect(() => {
    const handleMessage = (event: HybridWebViewMessageEvent) => {
      try {
        const raw = event.detail?.message;
        if (!raw) return;

        const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;

        if (parsed.type === "faceTracking" && parsed.data) {
          const data = parsed.data;

          // Map native data to FaceTrackingResult
          const result: FaceTrackingResult = {
            angleX: data.angleX || 0,
            angleY: data.angleY || 0,
            angleZ: data.angleZ || 0,
            eyeOpenL: data.eyeOpenL || 0,
            eyeOpenR: data.eyeOpenR || 0,
            eyeBallX: data.eyeBallX || 0,
            eyeBallY: data.eyeBallY || 0,
            mouthOpen: data.mouthOpen || 0,
            browL: data.browL || 0,
            browR: data.browR || 0,
          };

          onResultRef.current?.(result);
        }
      } catch (err) {
        // Ignore parse errors
      }
    };

    window.addEventListener("HybridWebViewMessageReceived", handleMessage);

    // Initial check
    void checkAvailability();

    return () => {
      window.removeEventListener("HybridWebViewMessageReceived", handleMessage);
    };
  }, [checkAvailability]);

  // Normalize API to match previous hook structure where possible
  return {
    isReady, // Replaces isReady (MediaPipe loaded) with isReady (Native available)
    isTracking,
    error,
    initialize: checkAvailability, // Alias for backward compat
    startTracking,
    stopTracking,
    // Deprecated refs (kept null to avoid breaking destructuring)
    videoRef: { current: null },
    canvasRef: { current: null },
  };
}
