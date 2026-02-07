import { IonSelect, IonSelectOption } from "@ionic/react";
import {
  useEffect,
  useRef,
  useState,
  useCallback,
  forwardRef,
  useImperativeHandle,
} from "react";
import type { Application, Container } from "pixi.js";
import type { FaceTrackingResult } from "../../hooks/useFaceTracking";

// Minimal interface for Live2DModel to avoid 'any'
interface Live2DModel {
  internalModel: {
    coreModel: {
      setParameterValueById(id: string, value: number): void;
    };
    motionManager?: {
      definitions?: Record<string, Array<{ File?: string; file?: string }>>;
    };
  };
  x: number;
  y: number;
  anchor: { set(x: number, y: number): void };
  scale: { set(x: number): void };
  rotation: number;
  destroy(): void;
  autoInteract: boolean;
  interactive: boolean;
  on(event: string, fn: (hitAreas: string[]) => void): void;
  motion(group: string, index?: number, priority?: number): void;
}

export interface ModelOption {
  name: string;
  url: string;
}

export interface Live2DViewerProps {
  modelUrl: string;
  availableModels?: ModelOption[];
  onModelChange?: (url: string) => void;
  scale?: number;
  rotation?: number;
  lerpFactor?: number;
  showDebugInfo?: boolean;
  onLoad?: () => void;
  onError?: (error: string) => void;
}

export interface Live2DViewerRef {
  updateFaceData: (data: FaceTrackingResult) => void;
  playMotion: (group: string, index?: number) => void;
}

function lerp(current: number, target: number, factor: number): number {
  return current + (target - current) * factor;
}

/**
 * Live2D Viewer Component with ref support
 */
export const Live2DViewer = forwardRef<Live2DViewerRef, Live2DViewerProps>(
  (
    {
      modelUrl,
      availableModels = [],
      onModelChange,
      scale = 0.15,
      rotation = 0,
      lerpFactor = 0.3,
      showDebugInfo = false,
      onLoad,
      onError,
    },
    ref,
  ) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const appRef = useRef<Application | null>(null);
    const modelRef = useRef<Live2DModel | null>(null);
    const viewportRef = useRef<Container | null>(null);

    // Pan and zoom state
    const panRef = useRef({ x: 0, y: 0 });
    const zoomRef = useRef(1);
    const isDraggingRef = useRef(false);
    const lastTouchRef = useRef<{ x: number; y: number } | null>(null);
    const lastTouchDistanceRef = useRef<number | null>(null);

    // Face tracking params with smoothing
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

    const [pixiReady, setPixiReady] = useState(false);
    const [motionGroups, setMotionGroups] = useState<
      Array<{ group: string; count: number }>
    >([]);
    const [debugInfo, setDebugInfo] = useState("");

    // Sensitivity scale factors
    const SCALES = {
      angleX: 2.5,
      angleY: 2.5,
      angleZ: 2.5,
      eyeBallX: 1.0,
      eyeBallY: 1.0,
    };

    // Expose methods via ref
    useImperativeHandle(ref, () => ({
      updateFaceData: (data: FaceTrackingResult) => {
        const model = modelRef.current;
        if (!model?.internalModel?.coreModel) return;

        const coreModel = model.internalModel.coreModel;
        const params = currentParamsRef.current;

        // Apply sensitivity scaling
        const targetAngleX = data.angleX * SCALES.angleX;
        const targetAngleY = data.angleY * SCALES.angleY;
        const targetAngleZ = data.angleZ * SCALES.angleZ;

        // Smooth the values
        params.angleX = lerp(params.angleX, targetAngleX, lerpFactor);
        params.angleY = lerp(params.angleY, targetAngleY, lerpFactor);
        params.angleZ = lerp(params.angleZ, targetAngleZ, lerpFactor);
        params.eyeOpenL = lerp(params.eyeOpenL, data.eyeOpenL, lerpFactor);
        params.eyeOpenR = lerp(params.eyeOpenR, data.eyeOpenR, lerpFactor);
        params.eyeBallX = lerp(
          params.eyeBallX,
          data.eyeBallX * SCALES.eyeBallX,
          lerpFactor,
        );
        params.eyeBallY = lerp(
          params.eyeBallY,
          data.eyeBallY * SCALES.eyeBallY,
          lerpFactor,
        );
        params.mouthOpen = lerp(params.mouthOpen, data.mouthOpen, lerpFactor);

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

        if (showDebugInfo) {
          setDebugInfo(
            JSON.stringify(
              data,
              (key, val) =>
                typeof val === "number" ? Number(val.toFixed(2)) : val,
              2,
            ),
          );
        }
      },
      playMotion: (group: string, index = 0) => {
        if (modelRef.current) {
          modelRef.current.motion(group, index, 3);
        }
      },
    }));

    // Initialize PIXI Application (once)
    useEffect(() => {
      let mounted = true;

      const initPixiApp = async () => {
        if (!canvasRef.current || appRef.current) return;

        try {
          const PIXI = await import("pixi.js");
          window.PIXI = PIXI;

          if (!mounted) return;

          const app = new PIXI.Application({
            view: canvasRef.current,
            backgroundAlpha: 0,
            resizeTo: canvasRef.current.parentElement || undefined,
            antialias: true,
          });
          appRef.current = app;

          // Create viewport container for pan/zoom
          const viewport = new PIXI.Container();
          viewport.x = app.screen.width / 2;
          viewport.y = app.screen.height / 2;
          app.stage.addChild(viewport);
          viewportRef.current = viewport;

          console.log("PIXI Application initialized");
          setPixiReady(true);
        } catch (err) {
          console.error("Failed to initialize PIXI:", err);
          if (mounted) {
            const errorMsg = err instanceof Error ? err.message : "初始化失败";
            onError?.(errorMsg);
          }
        }
      };

      void initPixiApp();

      const handleResize = () => {
        if (appRef.current && viewportRef.current) {
          viewportRef.current.x =
            appRef.current.screen.width / 2 + panRef.current.x;
          viewportRef.current.y =
            appRef.current.screen.height / 2 + panRef.current.y;
        }
      };
      window.addEventListener("resize", handleResize);

      return () => {
        mounted = false;
        window.removeEventListener("resize", handleResize);
        if (appRef.current) {
          appRef.current.destroy(true);
          appRef.current = null;
        }
      };
    }, [onError]);

    // Load Live2D model (changes when modelUrl changes)
    useEffect(() => {
      if (!pixiReady || !modelUrl) return;

      let mounted = true;

      const loadModel = async () => {
        if (!appRef.current || !viewportRef.current) return;

        try {
          // @ts-ignore - Dynamic import type
          const { Live2DModel } = await import("pixi-live2d-display/cubism4");

          if (!mounted) return;

          // Remove old model if exists
          if (modelRef.current) {
            console.log("Removing old model...");
            viewportRef.current.removeChild(modelRef.current as any);
            modelRef.current.destroy();
            modelRef.current = null;
          }

          console.log("Loading Live2D model:", modelUrl);
          const model = await Live2DModel.from(modelUrl);

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

            if (hitAreas.includes("Head")) {
              model.motion("TapHead");
            } else if (hitAreas.includes("Body")) {
              model.motion("TapBody");
            } else {
              model.motion("Tap");
            }
          });

          model.anchor.set(0.5, 0.5);
          model.scale.set(scale);
          model.rotation = rotation;
          model.x = 0;
          model.y = 50;

          viewportRef.current.addChild(model);

          // Extract motion groups
          const definitions =
            model.internalModel?.motionManager?.definitions || {};
          const groups = Object.keys(definitions).map((group) => ({
            group,
            count: definitions[group]?.length || 0,
          }));
          setMotionGroups(groups);
          console.log("Available motions:", groups);

          console.log("Live2D model loaded successfully!");
          onLoad?.();
        } catch (err) {
          console.error("Failed to load Live2D model:", err);
          if (mounted) {
            const errorMsg = err instanceof Error ? err.message : "加载失败";
            onError?.(errorMsg);
          }
        }
      };

      void loadModel();

      return () => {
        mounted = false;
        if (modelRef.current && viewportRef.current) {
          viewportRef.current.removeChild(modelRef.current as any);
          modelRef.current.destroy();
          modelRef.current = null;
        }
      };
    }, [pixiReady, modelUrl, scale, rotation, onLoad, onError]);

    // Update model scale/rotation when they change
    useEffect(() => {
      if (modelRef.current) {
        modelRef.current.scale.set(scale);
        modelRef.current.rotation = rotation;
      }
    }, [scale, rotation]);

    // Pan and zoom handlers
    useEffect(() => {
      if (
        !pixiReady ||
        !canvasRef.current ||
        !appRef.current ||
        !viewportRef.current
      )
        return;

      const canvas = canvasRef.current;
      const viewport = viewportRef.current;
      const app = appRef.current;

      const updateViewport = () => {
        viewport.scale.set(zoomRef.current);
        viewport.x = app.screen.width / 2 + panRef.current.x;
        viewport.y = app.screen.height / 2 + panRef.current.y;
      };

      const handleWheel = (e: WheelEvent) => {
        e.preventDefault();
        const zoomDelta = e.deltaY > 0 ? 0.9 : 1.1;
        zoomRef.current = Math.max(
          0.1,
          Math.min(5, zoomRef.current * zoomDelta),
        );
        updateViewport();
      };

      const handleMouseDown = (e: MouseEvent) => {
        isDraggingRef.current = true;
        lastTouchRef.current = { x: e.clientX, y: e.clientY };
      };

      const handleMouseMove = (e: MouseEvent) => {
        if (!isDraggingRef.current || !lastTouchRef.current) return;

        const dx = e.clientX - lastTouchRef.current.x;
        const dy = e.clientY - lastTouchRef.current.y;

        panRef.current.x += dx;
        panRef.current.y += dy;

        lastTouchRef.current = { x: e.clientX, y: e.clientY };
        updateViewport();
      };

      const handleMouseUp = () => {
        isDraggingRef.current = false;
        lastTouchRef.current = null;
      };

      const handleTouchStart = (e: TouchEvent) => {
        if (e.touches.length === 1) {
          isDraggingRef.current = true;
          lastTouchRef.current = {
            x: e.touches[0].clientX,
            y: e.touches[0].clientY,
          };
        } else if (e.touches.length === 2) {
          const dx = e.touches[1].clientX - e.touches[0].clientX;
          const dy = e.touches[1].clientY - e.touches[0].clientY;
          lastTouchDistanceRef.current = Math.sqrt(dx * dx + dy * dy);
        }
      };

      const handleTouchMove = (e: TouchEvent) => {
        e.preventDefault();

        if (
          e.touches.length === 1 &&
          isDraggingRef.current &&
          lastTouchRef.current
        ) {
          const dx = e.touches[0].clientX - lastTouchRef.current.x;
          const dy = e.touches[0].clientY - lastTouchRef.current.y;

          panRef.current.x += dx;
          panRef.current.y += dy;

          lastTouchRef.current = {
            x: e.touches[0].clientX,
            y: e.touches[0].clientY,
          };
          updateViewport();
        } else if (
          e.touches.length === 2 &&
          lastTouchDistanceRef.current !== null
        ) {
          const dx = e.touches[1].clientX - e.touches[0].clientX;
          const dy = e.touches[1].clientY - e.touches[0].clientY;
          const distance = Math.sqrt(dx * dx + dy * dy);

          const zoomDelta = distance / lastTouchDistanceRef.current;
          zoomRef.current = Math.max(
            0.1,
            Math.min(5, zoomRef.current * zoomDelta),
          );

          lastTouchDistanceRef.current = distance;
          updateViewport();
        }
      };

      const handleTouchEnd = () => {
        isDraggingRef.current = false;
        lastTouchRef.current = null;
        lastTouchDistanceRef.current = null;
      };

      canvas.addEventListener("wheel", handleWheel, { passive: false });
      canvas.addEventListener("mousedown", handleMouseDown);
      canvas.addEventListener("mousemove", handleMouseMove);
      canvas.addEventListener("mouseup", handleMouseUp);
      canvas.addEventListener("mouseleave", handleMouseUp);
      canvas.addEventListener("touchstart", handleTouchStart, {
        passive: false,
      });
      canvas.addEventListener("touchmove", handleTouchMove, { passive: false });
      canvas.addEventListener("touchend", handleTouchEnd);

      return () => {
        canvas.removeEventListener("wheel", handleWheel);
        canvas.removeEventListener("mousedown", handleMouseDown);
        canvas.removeEventListener("mousemove", handleMouseMove);
        canvas.removeEventListener("mouseup", handleMouseUp);
        canvas.removeEventListener("mouseleave", handleMouseUp);
        canvas.removeEventListener("touchstart", handleTouchStart);
        canvas.removeEventListener("touchmove", handleTouchMove);
        canvas.removeEventListener("touchend", handleTouchEnd);
      };
    }, [pixiReady]);

    const playMotion = useCallback((motionKey: string) => {
      if (!modelRef.current) return;

      const [group, indexStr] = motionKey.split(":");
      const index = parseInt(indexStr, 10);

      console.log(`Playing motion: ${group}, index: ${index}`);
      modelRef.current.motion(group, index, 3);
    }, []);

    return (
      <div
        style={{
          width: "100%",
          height: "100%",
          position: "relative",
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

        {/* Model Selector */}
        {availableModels.length > 0 && onModelChange && (
          <div
            style={{
              position: "absolute",
              top: 16,
              left: 16,
              backgroundColor: "rgba(0,0,0,0.6)",
              borderRadius: 16,
              overflow: "hidden",
              zIndex: 10,
            }}
          >
            <IonSelect
              interface="popover"
              placeholder="Select Model"
              value={modelUrl}
              onIonChange={(e) => onModelChange(e.detail.value)}
              style={{
                color: "white",
                fontSize: 12,
                padding: "6px 10px",
                minWidth: 140,
              }}
            >
              {availableModels.map((model) => (
                <IonSelectOption key={model.url} value={model.url}>
                  {model.name}
                </IonSelectOption>
              ))}
            </IonSelect>
          </div>
        )}

        {/* Motion Selector */}
        {motionGroups.length > 0 && (
          <div
            style={{
              position: "absolute",
              top: availableModels.length > 0 ? 64 : 16,
              left: 16,
              backgroundColor: "rgba(0,0,0,0.6)",
              borderRadius: 16,
              overflow: "hidden",
              zIndex: 10,
            }}
          >
            <IonSelect
              interface="popover"
              placeholder="Play Motion"
              onIonChange={(e) => playMotion(e.detail.value)}
              style={{
                color: "white",
                fontSize: 12,
                padding: "6px 10px",
                minWidth: 140,
              }}
            >
              {motionGroups.flatMap((mg) =>
                Array.from({ length: mg.count }, (_, i) => (
                  <IonSelectOption
                    key={`${mg.group}:${i}`}
                    value={`${mg.group}:${i}`}
                  >
                    {mg.group} {i + 1}
                  </IonSelectOption>
                )),
              )}
            </IonSelect>
          </div>
        )}

        {/* Debug Info */}
        {showDebugInfo && debugInfo && (
          <div
            style={{
              position: "absolute",
              top: 16,
              right: 16,
              padding: "10px",
              backgroundColor: "rgba(0, 0, 0, 0.6)",
              color: "#0f0",
              borderRadius: "8px",
              fontFamily: "monospace",
              fontSize: "10px",
              pointerEvents: "none",
              maxWidth: "200px",
              whiteSpace: "pre-wrap",
              zIndex: 10,
            }}
          >
            {debugInfo}
          </div>
        )}
      </div>
    );
  },
);

Live2DViewer.displayName = "Live2DViewer";

export default Live2DViewer;
