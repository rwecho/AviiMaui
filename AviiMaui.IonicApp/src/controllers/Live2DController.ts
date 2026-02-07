/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Application } from "pixi.js";
import { FaceTrackingResult } from "../hooks/useFaceTracking";

// Core PIXI/Live2D Imports
// We need to import these dynamically usually, but here we can define interfaces
// The actual import will happen in the `init` method to avoid SSR/window issues

export interface Live2DModel {
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
}

const SCALES = {
  angleX: 2.5,
  angleY: 2.5,
  angleZ: 2.5,
  eyeBallX: 1.0,
  eyeBallY: 1.0,
};

function lerp(current: number, target: number, factor: number): number {
  return current + (target - current) * factor;
}

export class Live2DController {
  private app: Application | null = null;
  private model: Live2DModel | null = null;
  private container: HTMLDivElement;
  private currentParams = {
    angleX: 0,
    angleY: 0,
    angleZ: 0,
    eyeOpenL: 1,
    eyeOpenR: 1,
    eyeBallX: 0,
    eyeBallY: 0,
    mouthOpen: 0,
  };

  // Transform state
  private _scale: number = 0.1;
  private _rotation: number = 0;
  private _xOffset: number = 0;
  private _yOffset: number = 0;

  // Callbacks
  public onLoad?: () => void;
  public onError?: (error: string) => void;
  public onHit?: (hitAreas: string[]) => void;

  constructor(container: HTMLDivElement) {
    this.container = container;
  }

  public async init() {
    console.log("[Live2DController] Initializing Renderer");

    try {
      const PIXI = await import("pixi.js");
      window.PIXI = PIXI;

      // 1. Create PIXI Application if not exists
      if (!this.app) {
        this.app = new PIXI.Application({
          backgroundAlpha: 0,
          resizeTo: this.container, // Auto-resize to container
          antialias: true,
          autoStart: true,
        });

        this.container.appendChild(this.app.view as unknown as Node);

        this.app.renderer.on("resize", () => {
          this.handleResize();
        });
      }
    } catch (err) {
      console.error("[Live2DController] Init Error:", err);
      if (this.onError && err instanceof Error) this.onError(err.message);
    }
  }

  public async loadModel(modelUrl: string) {
    if (!this.app) return;

    console.log("[Live2DController] Loading Model:", modelUrl);

    try {
      const { Live2DModel } = await import("pixi-live2d-display");

      // Cleanup old model
      if (this.model) {
        this.app.stage.removeChild(this.model as any);
        this.model.destroy();
        this.model = null;
      }

      // Load Model
      const model = await Live2DModel.from(modelUrl);
      this.model = model as unknown as Live2DModel;

      // Configure Model
      this.model.interactive = true;
      this.model.autoInteract = true;
      this.model.anchor.set(0.5, 0.5);

      // Apply current transforms
      this.applyTransforms();

      // Setup Events
      this.model.on("hit", (hitAreas: string[]) => {
        if (this.onHit) this.onHit(hitAreas);
        this.triggerMotion(hitAreas);
      });

      // Add to Stage
      this.app.stage.addChild(this.model as any);

      // Initial Layout
      this.handleResize();

      if (this.onLoad) this.onLoad();
    } catch (err) {
      console.error("[Live2DController] Load Model Error:", err);
      if (this.onError && err instanceof Error) this.onError(err.message);
    }
  }

  public updateTransform(
    scale: number,
    rotation: number,
    x: number,
    y: number,
  ) {
    this._scale = scale;
    this._rotation = rotation;
    this._xOffset = x;
    this._yOffset = y;
    this.applyTransforms();
  }

  private applyTransforms() {
    if (!this.model) return;
    this.model.scale.set(this._scale);
    this.model.rotation = (this._rotation * Math.PI) / 180;
    // Position is handled in handleResize to respect screen center + offset
    this.handleResize();
  }

  public handleResize() {
    if (!this.app || !this.model) return;

    // Resize renderer (handled by resizeTo, but we double check)
    // this.app.renderer.resize(this.container.clientWidth, this.container.clientHeight);

    // Center model + offset
    const centerX = this.app.screen.width / 2;
    const centerY = this.app.screen.height / 2;

    this.model.x = centerX + this._xOffset;
    this.model.y = centerY + this._yOffset;
  }

  public updateFaceData(data: FaceTrackingResult, lerpFactor: number) {
    if (!this.model?.internalModel?.coreModel) return;

    const coreModel = this.model.internalModel.coreModel;
    const params = this.currentParams;

    // Apply Scaling
    const targetAngleX = data.angleX * SCALES.angleX;
    const targetAngleY = data.angleY * SCALES.angleY;
    const targetAngleZ = data.angleZ * SCALES.angleZ;

    // Lerp Smoothing
    params.angleX = lerp(params.angleX, targetAngleX, lerpFactor);
    params.angleY = lerp(params.angleY, targetAngleY, lerpFactor);
    params.angleZ = lerp(params.angleZ, targetAngleZ, lerpFactor);
    params.eyeOpenL = lerp(params.eyeOpenL, data.eyeOpenL, lerpFactor);
    params.eyeOpenR = lerp(params.eyeOpenR, data.eyeOpenR, lerpFactor);
    params.eyeBallX = lerp(params.eyeBallX, data.eyeBallX, lerpFactor);
    params.eyeBallY = lerp(params.eyeBallY, data.eyeBallY, lerpFactor);
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
      // Model might lack parameters
    }
  }

  public playMotion(group: string, index?: number) {
    this.model?.motion(group, index);
  }

  private triggerMotion(hitAreas: string[]) {
    if (!this.model) return;

    if (hitAreas.includes("Head")) {
      this.model.motion("TapHead");
    } else if (hitAreas.includes("Body")) {
      this.model.motion("TapBody");
    } else {
      this.model.motion("Tap");
    }
  }

  public destroy() {
    console.log("[Live2DController] Destroying...");

    if (this.model) {
      this.model.destroy();
      this.model = null;
    }

    if (this.app) {
      // Remove canvas from DOM
      if (
        this.app.view &&
        this.container.contains(this.app.view as unknown as Node)
      ) {
        this.container.removeChild(this.app.view as unknown as Node);
      }

      try {
        this.app.destroy(true, {
          children: true,
          texture: true,
          baseTexture: true,
        });
      } catch (e) {
        console.warn("[Live2DController] Destroy Error:", e);
      }
      this.app = null;
    }
  }
}
