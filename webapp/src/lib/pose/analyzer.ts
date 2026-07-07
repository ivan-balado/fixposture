import type { Landmark, Metric, PoseKeypoints, Severity } from "./types";
import { LANDMARK_INDEX as L } from "./types";

const VISIBILITY_MIN = 0.5;

function visible(kp: PoseKeypoints, ...indices: number[]) {
  return indices.every((i) => (kp[i]?.visibility ?? 0) >= VISIBILITY_MIN);
}

function midpoint(a: Landmark, b: Landmark) {
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function dist(a: { x: number; y: number }, b: { x: number; y: number }) {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

function tiltFromVerticalDeg(
  from: { x: number; y: number },
  to: { x: number; y: number },
) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return Math.abs((Math.atan2(dx, dy) * 180) / Math.PI);
}

function angleAt(
  a: { x: number; y: number },
  vertex: { x: number; y: number },
  b: { x: number; y: number },
) {
  const v1x = a.x - vertex.x;
  const v1y = a.y - vertex.y;
  const v2x = b.x - vertex.x;
  const v2y = b.y - vertex.y;
  const dot = v1x * v2x + v1y * v2y;
  const m1 = Math.hypot(v1x, v1y);
  const m2 = Math.hypot(v2x, v2y);
  if (!m1 || !m2) return 0;
  const cos = Math.max(-1, Math.min(1, dot / (m1 * m2)));
  return (Math.acos(cos) * 180) / Math.PI;
}

function classify(value: number, thresholds: [number, number, number]): Severity {
  const [t1, t2, t3] = thresholds;
  if (value < t1) return "optimo";
  if (value < t2) return "leve";
  if (value < t3) return "moderado";
  return "derivar";
}

function chooseLateralSide(kp: PoseKeypoints): "left" | "right" {
  const l =
    (kp[L.LEFT_EAR]?.visibility ?? 0) +
    (kp[L.LEFT_SHOULDER]?.visibility ?? 0) +
    (kp[L.LEFT_HIP]?.visibility ?? 0);
  const r =
    (kp[L.RIGHT_EAR]?.visibility ?? 0) +
    (kp[L.RIGHT_SHOULDER]?.visibility ?? 0) +
    (kp[L.RIGHT_HIP]?.visibility ?? 0);
  return l >= r ? "left" : "right";
}

export function analyzePose(kp: PoseKeypoints): Metric[] {
  const out: Metric[] = [];

  if (visible(kp, L.LEFT_SHOULDER, L.RIGHT_SHOULDER)) {
    const lS = kp[L.LEFT_SHOULDER];
    const rS = kp[L.RIGHT_SHOULDER];
    const dy = Math.abs(lS.y - rS.y);
    const width = dist(lS, rS);
    const ratio = width > 0 ? dy / width : 0;
    out.push({
      key: "shoulder_dy",
      label: "Δy hombros",
      value: ratio * 100,
      unit: "%",
      severity: classify(ratio, [0.02, 0.04, 0.07]),
      note: lS.y < rS.y ? "L más alto" : "R más alto",
    });
  } else {
    out.push({
      key: "shoulder_dy",
      label: "Δy hombros",
      value: null,
      unit: "%",
      severity: "no_medible",
      note: "hombros no visibles",
    });
  }

  if (visible(kp, L.NOSE, L.LEFT_SHOULDER, L.RIGHT_SHOULDER)) {
    const mS = midpoint(kp[L.LEFT_SHOULDER], kp[L.RIGHT_SHOULDER]);
    const angle = tiltFromVerticalDeg(mS, kp[L.NOSE]);
    out.push({
      key: "head_tilt",
      label: "Inclinación cabeza",
      value: angle,
      unit: "°",
      severity: classify(angle, [3, 6, 10]),
    });
  } else {
    out.push({
      key: "head_tilt",
      label: "Inclinación cabeza",
      value: null,
      unit: "°",
      severity: "no_medible",
    });
  }

  if (visible(kp, L.LEFT_HIP, L.RIGHT_HIP)) {
    const lH = kp[L.LEFT_HIP];
    const rH = kp[L.RIGHT_HIP];
    const dy = Math.abs(lH.y - rH.y);
    const width = dist(lH, rH);
    const ratio = width > 0 ? dy / width : 0;
    out.push({
      key: "hip_dy",
      label: "Δy caderas",
      value: ratio * 100,
      unit: "%",
      severity: classify(ratio, [0.015, 0.03, 0.05]),
    });
  } else {
    out.push({
      key: "hip_dy",
      label: "Δy caderas",
      value: null,
      unit: "%",
      severity: "no_medible",
    });
  }

  if (visible(kp, L.LEFT_SHOULDER, L.RIGHT_SHOULDER, L.LEFT_HIP, L.RIGHT_HIP)) {
    const mS = midpoint(kp[L.LEFT_SHOULDER], kp[L.RIGHT_SHOULDER]);
    const mH = midpoint(kp[L.LEFT_HIP], kp[L.RIGHT_HIP]);
    const angle = tiltFromVerticalDeg(mH, mS);
    out.push({
      key: "trunk_tilt",
      label: "Inclinación tronco",
      value: angle,
      unit: "°",
      severity: classify(angle, [2, 5, 10]),
    });
  }

  const side = chooseLateralSide(kp);
  const ear = side === "left" ? kp[L.LEFT_EAR] : kp[L.RIGHT_EAR];
  const shoulder = side === "left" ? kp[L.LEFT_SHOULDER] : kp[L.RIGHT_SHOULDER];
  const hip = side === "left" ? kp[L.LEFT_HIP] : kp[L.RIGHT_HIP];
  const knee = side === "left" ? kp[L.LEFT_KNEE] : kp[L.RIGHT_KNEE];

  if (
    ear?.visibility >= VISIBILITY_MIN &&
    shoulder?.visibility >= VISIBILITY_MIN &&
    hip?.visibility >= VISIBILITY_MIN
  ) {
    const offset = Math.abs(ear.x - shoulder.x);
    const refHeight = Math.abs(shoulder.y - hip.y);
    const ratio = refHeight > 0 ? offset / refHeight : 0;
    out.push({
      key: "forward_head",
      label: "Forward head",
      value: ratio * 100,
      unit: "%",
      severity: classify(ratio, [0.05, 0.1, 0.18]),
      note: `lado ${side}; requiere foto lateral para ser real`,
    });
  } else {
    out.push({
      key: "forward_head",
      label: "Forward head",
      value: null,
      unit: "%",
      severity: "no_medible",
      note: "oreja u hombro laterales no visibles",
    });
  }

  if (
    kp[L.NOSE]?.visibility >= VISIBILITY_MIN &&
    shoulder?.visibility >= VISIBILITY_MIN &&
    hip?.visibility >= VISIBILITY_MIN
  ) {
    const deviation = 180 - angleAt(kp[L.NOSE], shoulder, hip);
    const magnitude = Math.abs(deviation);
    out.push({
      key: "spine_curvature",
      label: "Curvatura aparente tronco",
      value: magnitude,
      unit: "°",
      severity: classify(magnitude, [10, 20, 30]),
      note: "aproximación — MediaPipe no da puntos vertebrales",
    });
  } else {
    out.push({
      key: "spine_curvature",
      label: "Curvatura aparente tronco",
      value: null,
      unit: "°",
      severity: "no_medible",
    });
  }

  if (
    hip?.visibility >= VISIBILITY_MIN &&
    knee?.visibility >= VISIBILITY_MIN
  ) {
    const angle = tiltFromVerticalDeg(hip, knee);
    out.push({
      key: "femur_tilt",
      label: "Inclinación fémur (proxy pelvis)",
      value: angle,
      unit: "°",
      severity: classify(angle, [5, 10, 15]),
      note: "proxy pobre de inclinación pélvica; interpretar con reservas",
    });
  } else {
    out.push({
      key: "femur_tilt",
      label: "Inclinación fémur",
      value: null,
      unit: "°",
      severity: "no_medible",
    });
  }

  return out;
}

export function severityColor(s: Severity): string {
  switch (s) {
    case "optimo":
      return "text-emerald-400";
    case "leve":
      return "text-yellow-400";
    case "moderado":
      return "text-orange-400";
    case "derivar":
      return "text-red-400";
    case "no_medible":
      return "text-zinc-500";
  }
}

export function severityLabel(s: Severity): string {
  switch (s) {
    case "optimo":
      return "óptimo";
    case "leve":
      return "leve";
    case "moderado":
      return "moderado";
    case "derivar":
      return "derivar";
    case "no_medible":
      return "no medible";
  }
}
