export type Landmark = {
  x: number;
  y: number;
  z: number;
  visibility: number;
};

export type PoseKeypoints = Landmark[];

export type Severity = "optimo" | "leve" | "moderado" | "derivar" | "no_medible";

export type Metric = {
  key: string;
  label: string;
  value: number | null;
  unit: string;
  severity: Severity;
  note?: string;
};

export const LANDMARK_INDEX = {
  NOSE: 0,
  LEFT_EAR: 7,
  RIGHT_EAR: 8,
  LEFT_SHOULDER: 11,
  RIGHT_SHOULDER: 12,
  LEFT_HIP: 23,
  RIGHT_HIP: 24,
  LEFT_KNEE: 25,
  RIGHT_KNEE: 26,
  LEFT_ANKLE: 27,
  RIGHT_ANKLE: 28,
} as const;

export const POSE_CONNECTIONS: [number, number][] = [
  [11, 12],
  [11, 23],
  [12, 24],
  [23, 24],
  [11, 13],
  [13, 15],
  [12, 14],
  [14, 16],
  [23, 25],
  [25, 27],
  [24, 26],
  [26, 28],
  [0, 7],
  [0, 8],
  [7, 8],
];
