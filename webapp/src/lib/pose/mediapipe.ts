import type { PoseLandmarker } from "@mediapipe/tasks-vision";
import type { PoseKeypoints } from "./types";

const WASM_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.35/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/1/pose_landmarker_full.task";

let landmarkerPromise: Promise<PoseLandmarker> | null = null;

export async function getPoseLandmarker(): Promise<PoseLandmarker> {
  if (landmarkerPromise) return landmarkerPromise;

  landmarkerPromise = (async () => {
    const mp = await import("@mediapipe/tasks-vision");
    const vision = await mp.FilesetResolver.forVisionTasks(WASM_URL);
    try {
      return await mp.PoseLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
        runningMode: "IMAGE",
        numPoses: 1,
      });
    } catch {
      return mp.PoseLandmarker.createFromOptions(vision, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: "CPU" },
        runningMode: "IMAGE",
        numPoses: 1,
      });
    }
  })();

  return landmarkerPromise;
}

export async function detectPose(
  image: HTMLImageElement,
): Promise<PoseKeypoints | null> {
  const landmarker = await getPoseLandmarker();
  const result = landmarker.detect(image);
  if (!result.landmarks?.[0]) return null;
  return result.landmarks[0].map((l) => ({
    x: l.x,
    y: l.y,
    z: l.z,
    visibility: l.visibility ?? 0,
  }));
}
