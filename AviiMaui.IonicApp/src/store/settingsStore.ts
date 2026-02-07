import { create } from "zustand";
import { mauiBridgeService } from "../services/MauiBridgeService";

export const DEFAULT_MODEL_URL =
  "models/hiyori_free_en/runtime/hiyori_free_t08.model3.json";
export const DEFAULT_LERP_FACTOR = 0.3;
export const DEFAULT_MODEL_SCALE = 0.15;
export const DEFAULT_MODEL_ROTATION = 0;

interface SettingsState {
  showDebugInfo: boolean;
  modelUrl: string;
  lerpFactor: number;
  modelScale: number;
  modelRotation: number;

  // Actions
  setShowDebugInfo: (show: boolean) => Promise<void>;
  setModelUrl: (url: string) => Promise<void>;
  setLerpFactor: (val: number) => Promise<void>;
  setModelScale: (val: number) => Promise<void>;
  setModelRotation: (val: number) => Promise<void>;

  // Initialization
  loadSettings: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  showDebugInfo: true,
  modelUrl: DEFAULT_MODEL_URL,
  lerpFactor: DEFAULT_LERP_FACTOR,
  modelScale: DEFAULT_MODEL_SCALE,
  modelRotation: DEFAULT_MODEL_ROTATION,

  setShowDebugInfo: async (show: boolean) => {
    set({ showDebugInfo: show });
    await mauiBridgeService.setStringValue("settings_showDebug", String(show));
  },

  setModelUrl: async (url: string) => {
    set({ modelUrl: url });
    await mauiBridgeService.setStringValue("settings_modelUrl", url);
  },

  setLerpFactor: async (val: number) => {
    set({ lerpFactor: val });
    await mauiBridgeService.setStringValue("settings_lerpFactor", String(val));
  },

  setModelScale: async (val: number) => {
    set({ modelScale: val });
    await mauiBridgeService.setStringValue("settings_modelScale", String(val));
  },

  setModelRotation: async (val: number) => {
    set({ modelRotation: val });
    await mauiBridgeService.setStringValue(
      "settings_modelRotation",
      String(val),
    );
  },

  loadSettings: async () => {
    try {
      // Parallel fetch
      const [debugRes, modelRes, lerpRes, scaleRes, rotationRes] =
        await Promise.all([
          mauiBridgeService.getStringValue("settings_showDebug"),
          mauiBridgeService.getStringValue("settings_modelUrl"),
          mauiBridgeService.getStringValue("settings_lerpFactor"),
          mauiBridgeService.getStringValue("settings_modelScale"),
          mauiBridgeService.getStringValue("settings_modelRotation"),
        ]);

      set({
        showDebugInfo: debugRes.data ? debugRes.data === "true" : true,
        modelUrl: modelRes.data || DEFAULT_MODEL_URL,
        lerpFactor: lerpRes.data
          ? parseFloat(lerpRes.data)
          : DEFAULT_LERP_FACTOR,
        modelScale: scaleRes.data
          ? parseFloat(scaleRes.data)
          : DEFAULT_MODEL_SCALE,
        modelRotation: rotationRes.data
          ? parseFloat(rotationRes.data)
          : DEFAULT_MODEL_ROTATION,
      });
    } catch (e) {
      console.error("Failed to load settings:", e);
    }
  },
}));
