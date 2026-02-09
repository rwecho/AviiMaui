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

  networkMode: "off" | "sender" | "receiver";
  isNetworkActive: boolean;
  targetIp: string;
  networkPort: number;

  // Actions
  setShowDebugInfo: (show: boolean) => Promise<void>;
  setModelUrl: (url: string) => Promise<void>;
  setLerpFactor: (val: number) => Promise<void>;
  setModelScale: (val: number) => Promise<void>;
  setModelRotation: (val: number) => Promise<void>;

  setNetworkMode: (mode: "off" | "sender" | "receiver") => Promise<void>;
  setTargetIp: (ip: string) => Promise<void>;
  setNetworkPort: (port: number) => Promise<void>;
  toggleNetwork: (enabled: boolean) => Promise<void>;

  // Initialization
  loadSettings: () => Promise<void>;
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  showDebugInfo: true,
  modelUrl: DEFAULT_MODEL_URL,
  lerpFactor: DEFAULT_LERP_FACTOR,
  modelScale: DEFAULT_MODEL_SCALE,
  modelRotation: DEFAULT_MODEL_ROTATION,
  networkMode: "off",
  isNetworkActive: false,
  targetIp: "192.168.1.100", // Default placeholder
  networkPort: 9000,

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

  setNetworkMode: async (mode) => {
    set({ networkMode: mode });
    await mauiBridgeService.setStringValue("settings_networkMode", mode);
    // Also stop current network if switching
    await mauiBridgeService.stopNetwork();
    // If active, restart with new mode
    if (get().isNetworkActive && mode !== "off") {
      await get().toggleNetwork(true);
    }
  },

  setTargetIp: async (ip) => {
    set({ targetIp: ip });
    await mauiBridgeService.setStringValue("settings_targetIp", ip);
  },

  setNetworkPort: async (port) => {
    set({ networkPort: port });
    await mauiBridgeService.setStringValue(
      "settings_networkPort",
      String(port),
    );
  },

  toggleNetwork: async (enabled) => {
    const { networkMode, targetIp, networkPort } = get();
    set({ isNetworkActive: enabled });
    await mauiBridgeService.setStringValue(
      "settings_networkActive",
      String(enabled),
    );

    if (!enabled) {
      await mauiBridgeService.stopNetwork();
      return;
    }

    if (networkMode === "sender") {
      await mauiBridgeService.startNetworkSender(targetIp, networkPort);
    } else if (networkMode === "receiver") {
      await mauiBridgeService.startNetworkReceiver(networkPort);
    }
  },

  loadSettings: async () => {
    try {
      // Parallel fetch
      const [
        debugRes,
        modelRes,
        lerpRes,
        scaleRes,
        rotationRes,
        modeRes,
        activeRes,
        ipRes,
        portRes,
        sysInfoRes,
      ] = await Promise.all([
        mauiBridgeService.getStringValue("settings_showDebug"),
        mauiBridgeService.getStringValue("settings_modelUrl"),
        mauiBridgeService.getStringValue("settings_lerpFactor"),
        mauiBridgeService.getStringValue("settings_modelScale"),
        mauiBridgeService.getStringValue("settings_modelRotation"),
        mauiBridgeService.getStringValue("settings_networkMode"),
        mauiBridgeService.getStringValue("settings_networkActive"),
        mauiBridgeService.getStringValue("settings_targetIp"),
        mauiBridgeService.getStringValue("settings_networkPort"),
        mauiBridgeService.getSystemInfo(),
      ]);

      let finalMode = modeRes.data as "off" | "sender" | "receiver" | null;
      // Default Logic if no saved mode
      if (!finalMode || finalMode === "off") {
        const platform = sysInfoRes.data?.platform?.toLowerCase() || "";
        // Assuming platform strings like "ios", "android", "maccatalyst", "winui"
        // Or from operatingSystem field
        const os = sysInfoRes.data?.operatingSystem?.toLowerCase() || "";

        if (
          platform.includes("ios") ||
          platform.includes("android") ||
          os.includes("ios") ||
          os.includes("android")
        ) {
          finalMode = "sender";
        } else {
          // MacCatalyst, Windows, or others default to receiver
          finalMode = "receiver";
        }
      }

      // Default Active Logic
      // If user never set it (activeRes.data is null), default to true per requirement
      // If user set it ("true"/"false"), use that.
      const finalActive =
        activeRes.data !== null ? activeRes.data === "true" : true;

      const finalIp = ipRes.data || "192.168.1.100";
      const finalPort = portRes.data ? parseInt(portRes.data) : 9000;

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
        networkMode: finalMode,
        isNetworkActive: finalActive,
        targetIp: finalIp,
        networkPort: finalPort,
      });

      // Auto-start if active
      if (finalActive) {
        // Call toggleNetwork to trigger the native call
        // We use the store's action to ensure consistency
        get().toggleNetwork(true);
      }
    } catch (e) {
      console.error("Failed to load settings:", e);
    }
  },
}));
