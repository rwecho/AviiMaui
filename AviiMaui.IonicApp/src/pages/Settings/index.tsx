import {
  IonBackButton,
  IonButtons,
  IonContent,
  IonHeader,
  IonItem,
  IonLabel,
  IonList,
  IonListHeader,
  IonPage,
  IonRange,
  IonTitle,
  IonToggle,
  IonToolbar,
  IonButton,
  IonIcon,
  IonInput,
  IonSelect,
  IonSelectOption,
} from "@ionic/react";
import React, { useState } from "react";
import { settingsOutline } from "ionicons/icons";
import { DEFAULT_MODEL_URL, useSettingsStore } from "../../store/settingsStore";
import "./Settings.css";

const SettingsPage: React.FC = () => {
  const {
    showDebugInfo,
    setShowDebugInfo,
    modelUrl,
    setModelUrl,
    lerpFactor,
    setLerpFactor,
    modelScale,
    setModelScale,
    modelRotation,
    setModelRotation,
    networkMode,
    targetIp,
    networkPort,
    setNetworkMode,
    setTargetIp,
    setNetworkPort,
    toggleNetwork,
  } = useSettingsStore();

  // Local state for active toggle to match UI pattern?
  // Let's assume if mode != off is selected, we want to configure it.
  // And a separate "Enabled" switch to actual start/stop.
  const [isNetworkActive, setIsNetworkActive] = useState(false);

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/home" />
          </IonButtons>
          <IonTitle>设置</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        <IonList>
          <IonListHeader>
            <IonLabel>调试</IonLabel>
          </IonListHeader>
          <IonItem>
            <IonLabel>显示调试信息</IonLabel>
            <IonToggle
              checked={showDebugInfo}
              onIonChange={(e) => setShowDebugInfo(e.detail.checked)}
            />
          </IonItem>

          <IonListHeader>
            <IonLabel>Remote Link (Windows/iOS)</IonLabel>
          </IonListHeader>
          <IonItem>
            <IonLabel>Mode</IonLabel>
            <IonSelect
              value={networkMode}
              onIonChange={(e) => setNetworkMode(e.detail.value)}
              interface="popover"
            >
              <IonSelectOption value="off">Off</IonSelectOption>
              <IonSelectOption value="sender">Sender (iOS)</IonSelectOption>
              <IonSelectOption value="receiver">
                Receiver (Windows)
              </IonSelectOption>
            </IonSelect>
          </IonItem>

          {networkMode !== "off" && (
            <>
              {networkMode === "sender" && (
                <IonItem>
                  <IonLabel position="stacked">Target IP (Windows PC)</IonLabel>
                  <IonInput
                    value={targetIp}
                    onIonChange={(e) => setTargetIp(e.detail.value!)}
                    placeholder="e.g. 192.168.1.100"
                  />
                </IonItem>
              )}
              <IonItem>
                <IonLabel position="stacked">
                  {networkMode === "sender" ? "Target Port" : "Listen Port"}
                </IonLabel>
                <IonInput
                  type="number"
                  value={networkPort}
                  onIonChange={(e) =>
                    setNetworkPort(parseInt(e.detail.value!, 10))
                  }
                />
              </IonItem>

              <IonItem>
                <IonLabel>Active</IonLabel>
                <IonToggle
                  checked={isNetworkActive}
                  onIonChange={(e) => {
                    setIsNetworkActive(e.detail.checked);
                    toggleNetwork(e.detail.checked);
                  }}
                />
              </IonItem>
            </>
          )}

          <IonListHeader>
            <IonLabel>Live2D 模型</IonLabel>
          </IonListHeader>
          <IonItem>
            <IonLabel>当前模型</IonLabel>
            <IonLabel slot="end" style={{ fontSize: "0.8em", color: "#888" }}>
              {modelUrl === DEFAULT_MODEL_URL
                ? "Hiyori (内置)"
                : modelUrl.split("/").pop() || "自定义"}
            </IonLabel>
          </IonItem>

          <IonListHeader>
            <IonLabel>内置模型 (Builtin)</IonLabel>
          </IonListHeader>
          {[
            {
              name: "Hiyori (V3)",
              path: "models/hiyori_free_en/runtime/hiyori_free_t08.model3.json",
              desc: "Cubism 4.0 Sample",
            },
            {
              name: "Kato Megumi (V2)",
              path: "models/katou_01/katou_01.model.json",
              desc: "Saekano (Live2D v2)",
            },
            {
              name: "Mashiro Seifuku (V2)",
              path: "models/mashiro/seifuku.model.json",
              desc: "Sakurasou (Uniform)",
            },
            {
              name: "Mashiro Shifuku (V2)",
              path: "models/mashiro/shifuku.model.json",
              desc: "Sakurasou (Casual)",
            },
            {
              name: "Rem (V2)",
              path: "models/rem/rem.json",
              desc: "Re:Zero",
            },
          ].map((model) => (
            <IonItem key={model.name}>
              <IonLabel>
                <h2>{model.name}</h2>
                <p>{model.desc}</p>
              </IonLabel>
              <IonButton
                fill="outline"
                slot="end"
                color={modelUrl === model.path ? "success" : "medium"}
                onClick={() => {
                  setModelUrl(model.path);
                }}
              >
                <IonIcon slot="start" icon={settingsOutline} />
                {modelUrl === model.path ? "Using" : "Switch"}
              </IonButton>
            </IonItem>
          ))}

          <IonListHeader>
            <IonLabel>平滑参数 (Lerp)</IonLabel>
          </IonListHeader>
          <IonItem lines="none">
            <IonLabel>
              平滑度: {lerpFactor.toFixed(2)}
              <p className="settings-help">
                值越小越平滑，但会有延迟 (推荐 0.1 - 0.5)
              </p>
            </IonLabel>
          </IonItem>
          <IonItem>
            <IonRange
              min={0.05}
              max={1.0}
              step={0.05}
              value={lerpFactor}
              onIonChange={(e) => setLerpFactor(e.detail.value as number)}
              labelPlacement="start"
            >
              <div slot="start">慢</div>
              <div slot="end">快</div>
            </IonRange>
          </IonItem>

          <IonListHeader>
            <IonLabel>摄像机距离 (Scale)</IonLabel>
          </IonListHeader>
          <IonItem lines="none">
            <IonLabel>
              缩放: {modelScale.toFixed(2)}
              <p className="settings-help">
                调整模型显示大小 (推荐 0.05 - 0.5)
              </p>
            </IonLabel>
          </IonItem>
          <IonItem>
            <IonRange
              min={0.01}
              max={0.5}
              step={0.01}
              value={modelScale}
              onIonChange={(e) => setModelScale(e.detail.value as number)}
              labelPlacement="start"
            >
              <div slot="start">远</div>
              <div slot="end">近</div>
            </IonRange>
          </IonItem>

          <IonListHeader>
            <IonLabel>模型旋转 (Rotation)</IonLabel>
          </IonListHeader>
          <IonItem lines="none">
            <IonLabel>
              角度: {modelRotation}°
              <p className="settings-help">调整模型旋转角度 (-180° ~ 180°)</p>
            </IonLabel>
          </IonItem>
          <IonItem>
            <IonRange
              min={-180}
              max={180}
              step={1}
              value={modelRotation}
              onIonChange={(e) => setModelRotation(e.detail.value as number)}
              labelPlacement="start"
            >
              <div slot="start">-180°</div>
              <div slot="end">180°</div>
            </IonRange>
          </IonItem>
        </IonList>
      </IonContent>
    </IonPage>
  );
};

export default SettingsPage;
