import {
  useEffect,
  useRef,
  forwardRef,
  useImperativeHandle,
  memo,
  useState,
  useCallback,
} from "react";
import {
  IonIcon,
  IonButton,
  IonSelect,
  IonSelectOption,
  IonText,
} from "@ionic/react";
import { settings } from "ionicons/icons";
import { FaceTrackingResult } from "../hooks/useFaceTracking";
import "./Live2DViewer.css";

type PixiApplication = import("pixi.js").Application;
type PixiDisplayObject = import("pixi.js").DisplayObject;

type Live2DModel = PixiDisplayObject & {
  internalModel: {
    coreModel: {
      setParameterValueById(id: string, value: number): void;
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
};

const PARAM_SCALES = {
  angleX: 2.5,
  angleY: 2.5,
  angleZ: 2.5,
  eyeBallX: 1.0,
  eyeBallY: 1.0,
};

const lerp = (current: number, target: number, factor: number) =>
  current + (target - current) * factor;

export interface Live2DViewerRef {
  updateFaceData: (data: FaceTrackingResult) => void;
  playMotion: (group: string, index?: number) => void;
  resetView: () => void;
}

export interface ModelOption {
  name: string;
  url: string;
}

interface Live2DViewerProps {
  id?: string | number;
  modelUrl: string;
  availableModels?: ModelOption[];
  onModelChange?: (url: string) => void;

  scale?: number;
  rotation?: number;
  offsetX?: number;
  offsetY?: number;
  minScale?: number;
  maxScale?: number;
  enablePan?: boolean;
  enableZoom?: boolean;

  lerpFactor?: number;
  showDebugInfo?: boolean;

  onLoad?: () => void;
  onError?: (error: string, id?: string | number) => void;
  onHit?: (hitAreas: string[], id?: string | number) => void;
}

const DRAG_THRESHOLD_PX = 4;
const DEFAULT_MIN_SCALE = 0.05;
const DEFAULT_MAX_SCALE = 2.0;
const DEFAULT_ZOOM_STEP = 0.05;

export const Live2DViewer = memo(
  forwardRef<Live2DViewerRef, Live2DViewerProps>(
    (
      {
        id,
        modelUrl,
        availableModels = [],
        onModelChange,
        scale = 0.3,
        rotation = 0,
        offsetX = 0,
        offsetY = 0,
        minScale = DEFAULT_MIN_SCALE,
        maxScale = DEFAULT_MAX_SCALE,
        enablePan = true,
        enableZoom = true,
        lerpFactor = 0.1,
        showDebugInfo = false,
        onLoad,
        onError,
        onHit,
      },
      ref,
    ) => {
      const containerRef = useRef<HTMLDivElement>(null);
      const controlsRef = useRef<HTMLDivElement>(null);
      const appRef = useRef<PixiApplication | null>(null);
      const modelRef = useRef<Live2DModel | null>(null);
      const initPromiseRef = useRef<Promise<void> | null>(null);
      const paramsRef = useRef({
        angleX: 0,
        angleY: 0,
        angleZ: 0,
        eyeOpenL: 1,
        eyeOpenR: 1,
        eyeBallX: 0,
        eyeBallY: 0,
        mouthOpen: 0,
      });
      const transformRef = useRef({
        scale,
        rotation,
        x: offsetX,
        y: offsetY,
      });

      const [viewScale, setViewScale] = useState(scale);
      const [viewOffset, setViewOffset] = useState({ x: offsetX, y: offsetY });
      const [menuOpen, setMenuOpen] = useState(false);

      const syncBaseTransform = useCallback(() => {
        setViewScale(scale);
        setViewOffset({ x: offsetX, y: offsetY });
      }, [scale, offsetX, offsetY]);

      useEffect(() => {
        syncBaseTransform();
      }, [syncBaseTransform]);

      const triggerMotion = useCallback((hitAreas: string[]) => {
        const model = modelRef.current;
        if (!model) return;

        if (hitAreas.includes("Head")) {
          model.motion("TapHead");
        } else if (hitAreas.includes("Body")) {
          model.motion("TapBody");
        } else {
          model.motion("Tap");
        }
      }, []);

      const applyTransforms = useCallback(() => {
        const model = modelRef.current;
        if (!model) return;
        model.scale.set(transformRef.current.scale);
        model.rotation = (transformRef.current.rotation * Math.PI) / 180;
        const app = appRef.current;
        if (!app) return;
        const centerX = app.screen.width / 2;
        const centerY = app.screen.height / 2;
        model.x = centerX + transformRef.current.x;
        model.y = centerY + transformRef.current.y;
      }, []);

      const handleResize = useCallback(() => {
        if (!appRef.current) return;
        applyTransforms();
      }, [applyTransforms]);

      const initRenderer = useCallback(async () => {
        if (!containerRef.current || appRef.current) return;
        try {
          const PIXI = await import("pixi.js");
          window.PIXI = PIXI;

          appRef.current = new PIXI.Application({
            backgroundAlpha: 0,
            resizeTo: containerRef.current,
            antialias: true,
            autoStart: true,
          });

          containerRef.current.appendChild(
            appRef.current.view as unknown as Node,
          );

          appRef.current.renderer.on("resize", () => {
            handleResize();
          });
        } catch (err) {
          if (err instanceof Error) onError?.(err.message, id);
        }
      }, [handleResize, id, onError]);

      const loadModel = useCallback(
        async (url: string) => {
          if (!appRef.current) return;
          try {
            const { Live2DModel } = await import("pixi-live2d-display");

            if (modelRef.current) {
              appRef.current.stage.removeChild(modelRef.current);
              modelRef.current.destroy();
              modelRef.current = null;
            }

            const model = await Live2DModel.from(url);
            modelRef.current = model as Live2DModel;

            modelRef.current.interactive = true;
            modelRef.current.autoInteract = true;
            modelRef.current.anchor.set(0.5, 0.5);

            modelRef.current.on("hit", (hitAreas: string[]) => {
              onHit?.(hitAreas, id);
              triggerMotion(hitAreas);
            });

            appRef.current.stage.addChild(modelRef.current);
            applyTransforms();
            onLoad?.();
          } catch (err) {
            if (err instanceof Error) onError?.(err.message, id);
          }
        },
        [applyTransforms, id, onError, onHit, onLoad, triggerMotion],
      );

      const updateFaceData = useCallback(
        (data: FaceTrackingResult, factor: number) => {
          const model = modelRef.current;
          if (!model?.internalModel?.coreModel) return;

          const params = paramsRef.current;
          const coreModel = model.internalModel.coreModel;

          const targetAngleX = data.angleX * PARAM_SCALES.angleX;
          const targetAngleY = data.angleY * PARAM_SCALES.angleY;
          const targetAngleZ = data.angleZ * PARAM_SCALES.angleZ;

          params.angleX = lerp(params.angleX, targetAngleX, factor);
          params.angleY = lerp(params.angleY, targetAngleY, factor);
          params.angleZ = lerp(params.angleZ, targetAngleZ, factor);
          params.eyeOpenL = lerp(params.eyeOpenL, data.eyeOpenL, factor);
          params.eyeOpenR = lerp(params.eyeOpenR, data.eyeOpenR, factor);
          params.eyeBallX = lerp(params.eyeBallX, data.eyeBallX, factor);
          params.eyeBallY = lerp(params.eyeBallY, data.eyeBallY, factor);
          params.mouthOpen = lerp(params.mouthOpen, data.mouthOpen, factor);

          try {
            coreModel.setParameterValueById("ParamAngleX", params.angleX);
            coreModel.setParameterValueById("ParamAngleY", params.angleY);
            coreModel.setParameterValueById("ParamAngleZ", params.angleZ);
            coreModel.setParameterValueById("ParamEyeLOpen", params.eyeOpenL);
            coreModel.setParameterValueById("ParamEyeROpen", params.eyeOpenR);
            coreModel.setParameterValueById("ParamEyeBallX", params.eyeBallX);
            coreModel.setParameterValueById("ParamEyeBallY", params.eyeBallY);
            coreModel.setParameterValueById(
              "ParamMouthOpenY",
              params.mouthOpen,
            );
          } catch {
            // ignore missing params
          }
        },
        [],
      );

      const playMotion = useCallback((group: string, index?: number) => {
        modelRef.current?.motion(group, index);
      }, []);

      useImperativeHandle(ref, () => ({
        updateFaceData: (data: FaceTrackingResult) => {
          updateFaceData(data, lerpFactor);
        },
        playMotion: (group, index) => {
          playMotion(group, index);
        },
        resetView: () => {
          syncBaseTransform();
        },
      }));

      useEffect(() => {
        if (!containerRef.current) return;

        const containerEl = containerRef.current;

        initPromiseRef.current = initRenderer();

        return () => {
          if (modelRef.current && appRef.current) {
            appRef.current.stage.removeChild(modelRef.current);
            modelRef.current.destroy();
            modelRef.current = null;
          }

          if (appRef.current) {
            if (
              appRef.current.view &&
              containerEl.contains(appRef.current.view as Node)
            ) {
              containerEl.removeChild(appRef.current.view as Node);
            }
            appRef.current.destroy(true, {
              children: true,
              texture: true,
              baseTexture: true,
            });
            appRef.current = null;
          }

          initPromiseRef.current = null;
        };
      }, [initRenderer]);

      useEffect(() => {
        let cancelled = false;

        const load = async () => {
          if (initPromiseRef.current) {
            await initPromiseRef.current;
          }
          if (cancelled) return;
          if (modelUrl) {
            await loadModel(modelUrl);
          }
        };

        load();

        return () => {
          cancelled = true;
        };
      }, [modelUrl, loadModel]);

      useEffect(() => {
        transformRef.current = {
          scale: viewScale,
          rotation,
          x: viewOffset.x,
          y: viewOffset.y,
        };
        applyTransforms();
      }, [viewScale, rotation, viewOffset, applyTransforms]);

      useEffect(() => {
        if (!containerRef.current) return;
        const observer = new ResizeObserver(() => {
          handleResize();
        });
        observer.observe(containerRef.current);
        return () => observer.disconnect();
      }, [handleResize]);

      const dragStateRef = useRef({
        active: false,
        startX: 0,
        startY: 0,
        baseX: 0,
        baseY: 0,
        moved: false,
      });

      const isFromControls = (target: EventTarget | null) => {
        if (!controlsRef.current || !target) return false;
        return controlsRef.current.contains(target as Node);
      };

      const handlePointerDown = (e: React.PointerEvent) => {
        if (!enablePan || isFromControls(e.target)) return;
        dragStateRef.current = {
          active: true,
          startX: e.clientX,
          startY: e.clientY,
          baseX: viewOffset.x,
          baseY: viewOffset.y,
          moved: false,
        };
      };

      const handlePointerMove = (e: React.PointerEvent) => {
        if (!enablePan || !dragStateRef.current.active) return;

        const dx = e.clientX - dragStateRef.current.startX;
        const dy = e.clientY - dragStateRef.current.startY;
        const movedEnough = Math.abs(dx) + Math.abs(dy) > DRAG_THRESHOLD_PX;

        if (!dragStateRef.current.moved && !movedEnough) return;

        if (!dragStateRef.current.moved) {
          dragStateRef.current.moved = true;
        }

        setViewOffset({
          x: dragStateRef.current.baseX + dx,
          y: dragStateRef.current.baseY + dy,
        });
      };

      const handlePointerUp = () => {
        dragStateRef.current.active = false;
      };

      const handleWheel = (e: React.WheelEvent) => {
        if (!enableZoom || isFromControls(e.target)) return;
        e.preventDefault();
        const delta = e.deltaY > 0 ? -DEFAULT_ZOOM_STEP : DEFAULT_ZOOM_STEP;
        setViewScale((prev) =>
          Math.min(maxScale, Math.max(minScale, prev + delta)),
        );
      };

      return (
        <div
          ref={containerRef}
          className="live2d-viewer"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
          onWheel={handleWheel}
        >
          <div ref={controlsRef} className="live2d-controls">
            <IonButton
              size="small"
              fill="clear"
              color="light"
              onClick={() => setMenuOpen((prev) => !prev)}
            >
              <IonIcon slot="icon-only" icon={settings} />
            </IonButton>

            {menuOpen && (
              <div className="live2d-controls-menu">
                <IonText color="light" className="live2d-controls-title">
                  Display Settings
                </IonText>

                {availableModels.length > 0 && onModelChange && (
                  <IonSelect
                    value={modelUrl}
                    placeholder="Select Model"
                    interface="popover"
                    onIonChange={(e) => onModelChange(e.detail.value)}
                    className="live2d-controls-select"
                  >
                    {availableModels.map((m) => (
                      <IonSelectOption key={m.url} value={m.url}>
                        {m.name}
                      </IonSelectOption>
                    ))}
                  </IonSelect>
                )}

                <div className="live2d-controls-actions">
                  <IonButton
                    size="small"
                    fill="outline"
                    color="light"
                    onClick={syncBaseTransform}
                  >
                    Reset View
                  </IonButton>
                </div>

                <div className="live2d-controls-meta">
                  Scale: {viewScale.toFixed(2)}x
                  <br />
                  Pos: {viewOffset.x.toFixed(0)}, {viewOffset.y.toFixed(0)}
                </div>
              </div>
            )}
          </div>

          {showDebugInfo && (
            <div className="live2d-debug">
              DEBUG MODE
              <br />
              Scale: {viewScale.toFixed(3)}
              <br />
              X: {viewOffset.x.toFixed(1)} Y: {viewOffset.y.toFixed(1)}
              <br />
              Rotation: {rotation}°
            </div>
          )}
        </div>
      );
    },
  ),
);
