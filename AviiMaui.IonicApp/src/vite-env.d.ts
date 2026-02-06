/// <reference types="vite/client" />

interface Window {
  // Used by pixi-live2d-display
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  PIXI?: any;
}


interface HybridWebViewMessageEvent extends CustomEvent {
  detail: { message: string };
}

interface WindowEventMap {
  HybridWebViewMessageReceived: HybridWebViewMessageEvent;
}
