import {
  IonContent,
  IonHeader,
  IonPage,
  IonTitle,
  IonToolbar,
  IonButtons,
  IonButton,
  IonIcon,
  IonMenuButton,
  IonSpinner,
} from "@ionic/react";
import { useEffect, useRef, useState, useCallback } from "react";
import { videocam, videocamOff, settingsOutline } from "ionicons/icons";
import { useHistory } from "react-router-dom";

import {
  useFaceTracking,
  FaceTrackingResult,
} from "../../hooks/useFaceTracking";
import { useSettingsStore } from "../../store/settingsStore";
import { Live2DViewer, Live2DViewerRef } from "../../components/Live2DViewer";
import { ModelOption } from "../../components/Live2DViewer";

const AVAILABLE_MODELS: ModelOption[] = [
  {
    name: "Hiyori",
    url: "models/hiyori_free_en/runtime/hiyori_free_t08.model3.json",
  },
  { name: "chitose", url: "models/chitose/runtime/chitose.model3.json" },
  {
    name: "natori",
    url: "models/natori_pro_en/runtime/natori_pro_t06.model3.json",
  },
  { name: "rice", url: "models/rice_pro_en/runtime/rice_pro_t03.model3.json" },
  {
    name: "tororo",
    url: "models/tororo_hijiki/tororo/runtime/tororo.model3.json",
  },
  {
    name: "hijiki",
    url: "models/tororo_hijiki/hijiki/runtime/hijiki.model3.json",
  },
  {
    name: "wanko",
    url: "models/wanko/runtime/wanko_touch.model3.json",
  },
];

const HomePage: React.FC = () => {
  const history = useHistory();
  const {
    modelUrl,
    setModelUrl,
    lerpFactor,
    showDebugInfo,
    modelScale,
    modelRotation,
  } = useSettingsStore();

  const viewerRef = useRef<Live2DViewerRef>(null);

  const [loading, setLoading] = useState(false);
  const [displayError, setDisplayError] = useState<string | null>(null);

  // Face Tracking
  const applyFaceData = useCallback((data: FaceTrackingResult) => {
    viewerRef.current?.updateFaceData(data);
  }, []);

  const {
    isReady: isTrackingAvailable,
    isTracking,
    error: trackingError,
    startTracking,
    stopTracking,
  } = useFaceTracking({
    onResult: applyFaceData,
  });

  const toggleTracking = useCallback(async () => {
    if (isTracking) await stopTracking();
    else await startTracking();
  }, [isTracking, startTracking, stopTracking]);

  // Model Events
  const handleModelChange = useCallback(
    (url: string) => {
      setLoading(true);
      setModelUrl(url);
    },
    [setModelUrl],
  );

  const handleLoad = useCallback(() => {
    setLoading(false);
    setDisplayError(null);
  }, []);

  const handleError = useCallback((err: string) => {
    setLoading(false);
    setDisplayError(`Model Error: ${err}`);
  }, []);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonMenuButton color="medium" />
          </IonButtons>
          <IonTitle>Avii</IonTitle>
          <IonButtons slot="end">
            <IonButton
              onClick={toggleTracking}
              disabled={!isTrackingAvailable || loading}
              color={isTracking ? "success" : "medium"}
            >
              <IonIcon
                slot="icon-only"
                icon={isTracking ? videocam : videocamOff}
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
          <Live2DViewer
            ref={viewerRef}
            modelUrl={modelUrl}
            availableModels={AVAILABLE_MODELS}
            onModelChange={handleModelChange}
            scale={modelScale}
            rotation={modelRotation}
            lerpFactor={lerpFactor}
            showDebugInfo={showDebugInfo}
            onLoad={handleLoad}
            onError={handleError}
          />

          {/* Loading Overlay */}
          {loading && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "rgba(0,0,0,0.7)",
                color: "white",
                zIndex: 20,
              }}
            >
              <IonSpinner name="crescent" />
              <p style={{ marginTop: 10 }}>Loading Model...</p>
            </div>
          )}

          {/* Error Display */}
          {(displayError || trackingError) && (
            <div
              style={{
                position: "absolute",
                bottom: 20,
                left: 20,
                right: 20,
                backgroundColor: "rgba(255, 50, 50, 0.9)",
                color: "white",
                padding: 10,
                borderRadius: 8,
                textAlign: "center",
                zIndex: 30,
              }}
            >
              {displayError || trackingError}
            </div>
          )}

          {/* Tracking Active Badge */}
          {isTracking && (
            <div
              style={{
                position: "absolute",
                top: 16,
                right: 60,
                backgroundColor: "rgba(0,150,255,0.8)",
                color: "white",
                padding: "4px 12px",
                borderRadius: 16,
                fontSize: 12,
                pointerEvents: "none",
                zIndex: 10,
              }}
            >
              ● Tracking Active
            </div>
          )}
        </div>
      </IonContent>
    </IonPage>
  );
};

export default HomePage;
