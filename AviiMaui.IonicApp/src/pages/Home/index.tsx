import {
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  IonButtons,
  IonSpinner,
  IonButton,
  IonIcon,
  IonMenuButton,
} from "@ionic/react";
import { useEffect, useRef, useState, useCallback } from "react";
import { videocam, videocamOff, phonePortrait } from "ionicons/icons";
import {
  useFaceTracking,
  FaceTrackingResult,
} from "../../hooks/useFaceTracking";
import {
  useNativeFaceTracking,
  NativeFaceTrackingData,
} from "../../hooks/useNativeFaceTracking";
import VersionFooter from "../../components/VersionFooter";
import { apiService } from "../../services/apiService";

// Local model from public folder
const SAMPLE_MODEL_URL = "/hiyori_free_en/runtime/hiyori_free_t08.model3.json";

// Smoothing factor for parameter changes (0-1, lower = smoother)
const LERP_FACTOR = 0.3;

function lerp(current: number, target: number, factor: number): number {
  return current + (target - current) * factor;
}

/**
 * Home Page (Refactored) - Features Live2D with Face Tracking
 */
const HomePage: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appRef = useRef<any>(null);
  const modelRef = useRef<any>(null);
  const currentParamsRef = useRef({
    angleX: 0,
    angleY: 0,
    angleZ: 0,
    eyeOpenL: 1,
    eyeOpenR: 1,
    eyeBallX: 0,
    eyeBallY: 0,
    mouthOpen: 0,
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [trackingMode, setTrackingMode] = useState<"none" | "native" | "web">(
    "none",
  );
  const [appVersion, setAppVersion] = useState<string>("");

  // Load app version
  useEffect(() => {
    const loadVersion = async () => {
      const res = await apiService.getSystemInfo();
      if (res.error === null && res.data.appVersion) {
        setAppVersion(res.data.appVersion);
      } else {
        setAppVersion("1.0.0");
      }
    };
    void loadVersion();
  }, []);

  // Apply face data to Live2D model
  const applyFaceData = useCallback(
    (data: FaceTrackingResult | NativeFaceTrackingData) => {
      const model = modelRef.current;
      if (!model?.internalModel?.coreModel) return;

      const coreModel = model.internalModel.coreModel;
      const params = currentParamsRef.current;

      // Smooth the values
      params.angleX = lerp(params.angleX, data.angleX, LERP_FACTOR);
      params.angleY = lerp(params.angleY, data.angleY, LERP_FACTOR);
      params.angleZ = lerp(params.angleZ, data.angleZ, LERP_FACTOR);
      params.eyeOpenL = lerp(params.eyeOpenL, data.eyeOpenL, LERP_FACTOR);
      params.eyeOpenR = lerp(params.eyeOpenR, data.eyeOpenR, LERP_FACTOR);
      params.eyeBallX = lerp(params.eyeBallX, data.eyeBallX, LERP_FACTOR);
      params.eyeBallY = lerp(params.eyeBallY, data.eyeBallY, LERP_FACTOR);
      params.mouthOpen = lerp(params.mouthOpen, data.mouthOpen, LERP_FACTOR);

      try {
        coreModel.setParameterValueById("ParamAngleX", params.angleX);
        coreModel.setParameterValueById("ParamAngleY", params.angleY);
        coreModel.setParameterValueById("ParamAngleZ", params.angleZ);
        coreModel.setParameterValueById("ParamEyeLOpen", params.eyeOpenL);
        coreModel.setParameterValueById("ParamEyeROpen", params.eyeOpenR);
        coreModel.setParameterValueById("ParamEyeBallX", params.eyeBallX);
        coreModel.setParameterValueById("ParamEyeBallY", params.eyeBallY);
        coreModel.setParameterValueById("ParamMouthOpenY", params.mouthOpen);
      } catch {
        // Some models may not have all parameters
      }
    },
    [],
  );

  // Native (MAUI/ARKit) face tracking
  const {
    isNative,
    isAvailable: isNativeAvailable,
    isTracking: isNativeTracking,
    error: nativeError,
    startTracking: startNativeTracking,
    stopTracking: stopNativeTracking,
  } = useNativeFaceTracking({
    onData: applyFaceData,
  });

  // Web (MediaPipe) face tracking
  const {
    videoRef,
    isReady: isWebReady,
    isTracking: isWebTracking,
    error: webError,
    initialize: initWebTracking,
    startTracking: startWebTracking,
    stopTracking: stopWebTracking,
  } = useFaceTracking({
    onResult: applyFaceData,
    showVideo: false,
  });

  // Toggle native tracking
  const toggleNativeTracking = useCallback(async () => {
    if (isNativeTracking) {
      await stopNativeTracking();
      setTrackingMode("none");
    } else {
      // Stop web tracking if active
      if (isWebTracking) {
        stopWebTracking();
      }
      const success = await startNativeTracking();
      if (success) {
        setTrackingMode("native");
      }
    }
  }, [
    isNativeTracking,
    isWebTracking,
    startNativeTracking,
    stopNativeTracking,
    stopWebTracking,
  ]);

  // Toggle web tracking
  const toggleWebTracking = useCallback(async () => {
    if (isWebTracking) {
      stopWebTracking();
      setTrackingMode("none");
    } else {
      // Stop native tracking if active
      if (isNativeTracking) {
        await stopNativeTracking();
      }
      if (!isWebReady) {
        await initWebTracking();
      }
      await startWebTracking();
      setTrackingMode("web");
    }
  }, [
    isWebTracking,
    isNativeTracking,
    isWebReady,
    initWebTracking,
    startWebTracking,
    stopWebTracking,
    stopNativeTracking,
  ]);

  // Initialize Live2D
  useEffect(() => {
    let mounted = true;

    const initLive2D = async () => {
      if (!canvasRef.current) return;

      try {
        const PIXI = await import("pixi.js");
        (window as any).PIXI = PIXI;
        // @ts-ignore
        const { Live2DModel } = await import("pixi-live2d-display/cubism4");

        if (!mounted) return;

        const app = new PIXI.Application({
          view: canvasRef.current,
          backgroundAlpha: 0,
          resizeTo: canvasRef.current.parentElement || undefined,
          antialias: true,
        });
        appRef.current = app;

        console.log("Loading Live2D model...");
        const model = await Live2DModel.from(SAMPLE_MODEL_URL);

        if (!mounted) {
          model.destroy();
          return;
        }

        modelRef.current = model;
        model.autoInteract = false;

        model.anchor.set(0.5, 0.5);
        model.scale.set(0.15); // Scale factor
        model.x = app.screen.width / 2;
        model.y = app.screen.height / 2 + 50; // Y offset

        app.stage.addChild(model);

        console.log("Live2D model loaded successfully!");
        setLoading(false);
      } catch (err) {
        console.error("Failed to load Live2D model:", err);
        if (mounted) {
          setError(err instanceof Error ? err.message : "加载失败");
          setLoading(false);
        }
      }
    };

    void initLive2D();

    const handleResize = () => {
      if (appRef.current && modelRef.current) {
        modelRef.current.x = appRef.current.screen.width / 2;
        modelRef.current.y = appRef.current.screen.height / 2 + 100;
      }
    };
    window.addEventListener("resize", handleResize);

    return () => {
      mounted = false;
      window.removeEventListener("resize", handleResize);
      stopWebTracking();
      if (modelRef.current) {
        modelRef.current.destroy();
        modelRef.current = null;
      }
      if (appRef.current) {
        appRef.current.destroy(true);
        appRef.current = null;
      }
    };
  }, [stopWebTracking]);

  const currentError = error || nativeError || webError;
  const isAnyTracking = isNativeTracking || isWebTracking;

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            {/* Keep Menu Button for access to debug logs/test pages if needed */}
            <IonMenuButton color="medium" />
          </IonButtons>
          <IonTitle>Avii</IonTitle>
          <IonButtons slot="end">
            {/* Native tracking button (only show if in MAUI and available) */}
            {isNative && isNativeAvailable && (
              <IonButton onClick={toggleNativeTracking} disabled={loading}>
                <IonIcon
                  slot="icon-only"
                  icon={phonePortrait}
                  color={isNativeTracking ? "success" : "medium"}
                />
              </IonButton>
            )}
            {/* Web tracking button */}
            <IonButton onClick={toggleWebTracking} disabled={loading}>
              <IonIcon
                slot="icon-only"
                icon={isWebTracking ? videocamOff : videocam}
                color={isWebTracking ? "danger" : "primary"}
              />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <div
          style={{
            width: "100%",
            height: "100%",
            position: "relative",
            backgroundColor: "#1a1a2e",
          }}
        >
          <canvas
            ref={canvasRef}
            style={{
              width: "100%",
              height: "100%",
              display: "block",
            }}
          />

          {/* Camera Preview Window - visible when web tracking is active */}
          <div
            style={{
              position: "absolute",
              bottom: 16,
              left: 16,
              width: 120,
              height: 160,
              borderRadius: 12,
              overflow: "hidden",
              boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
              border: "2px solid rgba(255,255,255,0.2)",
              backgroundColor: "#000",
              display: isWebTracking ? "block" : "none",
            }}
          >
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              style={{
                width: "100%",
                height: "100%",
                objectFit: "cover",
                transform: "scaleX(-1)", // Mirror effect
              }}
            />
            {/* Camera label */}
            <div
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                backgroundColor: "rgba(0,0,0,0.6)",
                color: "white",
                fontSize: 10,
                textAlign: "center",
                padding: "2px 0",
              }}
            >
              📷 摄像头
            </div>
          </div>

          {/* Tracking Status */}
          {isAnyTracking && (
            <div
              style={{
                position: "absolute",
                top: 16,
                right: 16,
                backgroundColor:
                  trackingMode === "native"
                    ? "rgba(0,150,255,0.8)"
                    : "rgba(0,200,0,0.8)",
                color: "white",
                padding: "4px 12px",
                borderRadius: 16,
                fontSize: 12,
              }}
            >
              ● {trackingMode === "native" ? "原生追踪" : "Web追踪"}
            </div>
          )}

          {/* Loading Overlay */}
          {loading && (
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "rgba(26, 26, 46, 0.9)",
                color: "white",
              }}
            >
              <IonSpinner name="crescent" />
              <p style={{ marginTop: 16 }}>正在加载 Live2D 模型...</p>
            </div>
          )}

          {/* Error Message */}
          {currentError && (
            <div
              style={{
                position: "absolute",
                bottom: 80,
                left: 16,
                right: 16,
                backgroundColor: "rgba(255, 100, 100, 0.9)",
                color: "white",
                padding: 12,
                borderRadius: 8,
                textAlign: "center",
              }}
            >
              {currentError}
            </div>
          )}
        </div>
      </IonContent>
    </IonPage>
  );
};

export default HomePage;
