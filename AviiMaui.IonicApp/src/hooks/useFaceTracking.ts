import { useEffect, useRef, useState, useCallback } from "react";
import { FaceLandmarker, FilesetResolver, DrawingUtils } from "@mediapipe/tasks-vision";
import { Face } from "kalidokit";

export interface FaceTrackingResult {
  // Head rotation
  angleX: number; // Left-Right
  angleY: number; // Up-Down
  angleZ: number; // Tilt

  // Eyes
  eyeOpenL: number;
  eyeOpenR: number;
  eyeBallX: number;
  eyeBallY: number;

  // Mouth
  mouthOpen: number;

  // Eyebrows
  browL: number;
  browR: number;
}

interface UseFaceTrackingOptions {
  onResult?: (result: FaceTrackingResult) => void;
  showVideo?: boolean;
}

export function useFaceTracking(options: UseFaceTrackingOptions = {}) {
  const { onResult, showVideo = false } = options;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const faceLandmarkerRef = useRef<FaceLandmarker | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  const [isReady, setIsReady] = useState(false);
  const [isTracking, setIsTracking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initialize MediaPipe FaceLandmarker
  const initialize = useCallback(async () => {
    try {
      console.log("[FaceTracking] Initializing MediaPipe...");

      const vision = await FilesetResolver.forVisionTasks(
        "/mediapipe/wasm"
      );

      const faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            "/mediapipe/models/face_landmarker.task",
          delegate: "GPU",
        },
        runningMode: "VIDEO",
        numFaces: 1,
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true,
      });

      faceLandmarkerRef.current = faceLandmarker;
      setIsReady(true);
      console.log("[FaceTracking] MediaPipe initialized successfully");
      return true;
    } catch (err) {
      console.error("[FaceTracking] Failed to initialize:", err);
      setError(err instanceof Error ? err.message : "初始化失败");
      return false;
    }
  }, []);

  // Start camera and tracking
  const startTracking = useCallback(async () => {
    if (!faceLandmarkerRef.current) {
      setError("MediaPipe 尚未初始化");
      return;
    }

    try {
      console.log("[FaceTracking] Starting camera...");

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: "user",
        },
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      setIsTracking(true);
      console.log("[FaceTracking] Camera started, beginning tracking loop");

      // Start detection loop
      const detect = () => {
        if (!videoRef.current || !faceLandmarkerRef.current) return;

        const video = videoRef.current;
        if (video.readyState < 2) {
          animationFrameRef.current = requestAnimationFrame(detect);
          return;
        }

        const results = faceLandmarkerRef.current.detectForVideo(
          video,
          performance.now()
        );

        if (results.faceLandmarks && results.faceLandmarks.length > 0) {
          const landmarks = results.faceLandmarks[0];

          // Use Kalidokit to solve face rig
          const faceRig = Face.solve(landmarks, {
            runtime: "mediapipe",
            video: video,
          });

          if (faceRig && onResult) {
            const trackingResult: FaceTrackingResult = {
              // Head rotation (Kalidokit uses rotationDegrees)
              angleX: faceRig.head.y * 30, // Horizontal (left-right)
              angleY: faceRig.head.x * 30, // Vertical (up-down)
              angleZ: faceRig.head.z * 30, // Tilt

              // Eyes (0-1 range)
              eyeOpenL: 1 - faceRig.eye.l, // Invert: 0 = open, 1 = closed
              eyeOpenR: 1 - faceRig.eye.r,
              eyeBallX: faceRig.pupil?.x ?? 0,
              eyeBallY: faceRig.pupil?.y ?? 0,

              // Mouth
              mouthOpen: faceRig.mouth.y,

              // Eyebrows
              browL: faceRig.brow ?? 0,
              browR: faceRig.brow ?? 0,
            };

            onResult(trackingResult);
          }

          // Optional: Draw landmarks on debug canvas
          if (showVideo && canvasRef.current) {
            const ctx = canvasRef.current.getContext("2d");
            if (ctx) {
              ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
              const drawingUtils = new DrawingUtils(ctx);
              drawingUtils.drawConnectors(
                landmarks,
                FaceLandmarker.FACE_LANDMARKS_TESSELATION,
                { color: "#C0C0C070", lineWidth: 1 }
              );
            }
          }
        }

        animationFrameRef.current = requestAnimationFrame(detect);
      };

      detect();
    } catch (err) {
      console.error("[FaceTracking] Failed to start camera:", err);
      setError(err instanceof Error ? err.message : "摄像头启动失败");
    }
  }, [onResult, showVideo]);

  // Stop tracking
  const stopTracking = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (videoRef.current?.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }

    setIsTracking(false);
    console.log("[FaceTracking] Stopped tracking");
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopTracking();
      if (faceLandmarkerRef.current) {
        faceLandmarkerRef.current.close();
      }
    };
  }, [stopTracking]);

  return {
    videoRef,
    canvasRef,
    isReady,
    isTracking,
    error,
    initialize,
    startTracking,
    stopTracking,
  };
}
