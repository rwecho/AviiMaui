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
import { videocam, videocamOff } from "ionicons/icons";
import type { Application } from "pixi.js";

import {
  useFaceTracking,
  FaceTrackingResult,
} from "../../hooks/useFaceTracking";
import { mauiBridgeService } from "../../services/MauiBridgeService";

// Local model from public folder
const SAMPLE_MODEL_URL = "/hiyori_free_en/runtime/hiyori_free_t08.model3.json";

// Smoothing factor for parameter changes (0-1, lower = smoother)
const LERP_FACTOR = 0.3;

// Sensitivity scale factors
const SCALES = {
  angleX: 2.5,
  angleY: 2.5,
  angleZ: 2.5,
  eyeBallX: 1.0,
  eyeBallY: 1.0,
};

// Minimal interface for Live2DModel to avoid 'any'
interface Live2DModel {
  internalModel: {
    coreModel: {
      setParameterValueById(id: string, value: number): void;
    };
  };
  x: number;
  y: number;
  anchor: { set(x: number, y: number): void };
  scale: { set(x: number): void };
  destroy(): void;
  autoInteract: boolean;
  interactive: boolean;
  on(event: string, fn: (hitAreas: string[]) => void): void;
  motion(group: string, index?: number, priority?: number): void;
}

function lerp(current: number, target: number, factor: number): number {
  return current + (target - current) * factor;
}

/**
 * Home Page - Features Live2D with Native Face Tracking
 */
const HomePage: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appRef = useRef<Application | null>(null);
  const modelRef = useRef<Live2DModel | null>(null);
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
  const [appVersion, setAppVersion] = useState<string>("");
  
  // Debug State
  const [fps, setFps] = useState(0);
  const [debugData, setDebugData] = useState<string>("");
  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(Date.now());

  // Load app version and prevent sleep
  useEffect(() => {
    const init = async () => {
      // Load version
      const res = await mauiBridgeService.getSystemInfo();
      if (res.error === null && res.data.appVersion) {
        setAppVersion(res.data.appVersion);
      } else {
        setAppVersion("1.0.0");
      }
      
      // Keep screen on
      await mauiBridgeService.setKeepScreenOn(true);
    };
    
    void init();

    return () => {
      // Allow sleep when leaving this page
      void mauiBridgeService.setKeepScreenOn(false);
    };
  }, []);

  // Apply face data to Live2D model
  const applyFaceData = useCallback((data: FaceTrackingResult) => {
    // FPS Calculation
    frameCountRef.current++;
    const now = Date.now();
    if (now - lastTimeRef.current >= 1000) {
      setFps(frameCountRef.current);
      frameCountRef.current = 0;
      lastTimeRef.current = now;
    }

    // Update Debug Data (Throttled slightly by UI render, but good enough)
    setDebugData(JSON.stringify(data, (key, val) => {
        // Limit precision for display to keep it readable
        return typeof val === 'number' ? Number(val.toFixed(2)) : val;
    }, 2));

    const model = modelRef.current;
    if (!model?.internalModel?.coreModel) return;

    const coreModel = model.internalModel.coreModel;
    const params = currentParamsRef.current;

    // Apply sensitivity scaling
    const targetAngleX = data.angleX * SCALES.angleX;
    const targetAngleY = data.angleY * SCALES.angleY;
    const targetAngleZ = data.angleZ * SCALES.angleZ;

    // Smooth the values
    params.angleX = lerp(params.angleX, targetAngleX, LERP_FACTOR);
    params.angleY = lerp(params.angleY, targetAngleY, LERP_FACTOR);
    params.angleZ = lerp(params.angleZ, targetAngleZ, LERP_FACTOR);
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
  }, []);


  // Native face tracking hook
  const {
    isReady: isTrackingAvailable,
    isTracking,
    error: trackingError,
    startTracking,
    stopTracking,
  } = useFaceTracking({
    onResult: applyFaceData,
  });

  // Toggle tracking
  const toggleTracking = useCallback(async () => {
    if (isTracking) {
      await stopTracking();
    } else {
      await startTracking();
    }
  }, [isTracking, startTracking, stopTracking]);

  // Initialize Live2D
  useEffect(() => {
    let mounted = true;

    const initLive2D = async () => {
      if (!canvasRef.current) return;

      try {
        const PIXI = await import("pixi.js");
        window.PIXI = PIXI;
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

        modelRef.current = model as unknown as Live2DModel;
        
        // Enable interaction
        model.interactive = true;
        model.autoInteract = true;
        
        // Handle hit events
        model.on("hit", (hitAreas: string[]) => {
          console.log("Hit areas:", hitAreas);
          const hitString = hitAreas.join(", ");
          
          // Update debug info (prepend to keep history or just replace)
          setDebugData(prev => {
             // Keep strictly the face tracking data, but maybe add a helper toast or overlay?
             // Actually, let's just log it to our debug overlay for now
             return `Last Hit: ${hitString}\n` + prev.split('\n').filter(l => !l.startsWith('Last Hit:')).join('\n');
          });

          if (hitAreas.includes("Head")) {
             model.motion("TapHead");
          } else if (hitAreas.includes("Body")) {
             model.motion("TapBody");
          } else {
             // Default generic tap
             model.motion("Tap");
          }
        });

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
      stopTracking();
      if (modelRef.current) {
        modelRef.current.destroy();
        modelRef.current = null;
      }
      if (appRef.current) {
        appRef.current.destroy(true);
        appRef.current = null;
      }
    };
  }, [stopTracking]);

  const currentError = error || trackingError;

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonMenuButton color="medium" />
          </IonButtons>
          <IonTitle>Avii</IonTitle>
          <IonButtons slot="end">
            {/* Tracking Toggle Button - Only show if native tracking is available */}
            {isTrackingAvailable ? (
              <IonButton onClick={toggleTracking} disabled={loading}>
                <IonIcon
                  slot="icon-only"
                  icon={isTracking ? videocam : videocamOff}
                  color={isTracking ? "success" : "medium"}
                />
              </IonButton>
            ) : (
              !loading && (
                <IonButton disabled>
                  <IonIcon
                    slot="icon-only"
                    icon={videocamOff}
                    color="medium"
                    style={{ opacity: 0.5 }}
                  />
                </IonButton>
              )
            )}
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

          {/* Tracking Status Indicator */}
          {isTracking && (
            <div
              style={{
                position: "absolute",
                top: 16,
                right: 16,
                backgroundColor: "rgba(0,150,255,0.8)",
                color: "white",
                padding: "4px 12px",
                borderRadius: 16,
                fontSize: 12,
              }}
            >
              ● 面部追踪中
            </div>
          )}

          {/* Debug Overlay */}
          {isTracking && (
            <div
              style={{
                position: "absolute",
                top: 60,
                left: 16,
                padding: "10px",
                backgroundColor: "rgba(0, 0, 0, 0.5)",
                color: "#0f0",
                borderRadius: "8px",
                fontFamily: "monospace",
                fontSize: "10px",
                pointerEvents: "none",
                maxWidth: "200px",
                whiteSpace: "pre-wrap",
              }}
            >
              <div style={{ fontWeight: "bold", marginBottom: "4px" }}>
                FPS: {fps}
              </div>
              <div>{debugData}</div>
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
