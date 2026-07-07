"use client";

import { useCallback, useRef, useState } from "react";
import { analyzePose, severityColor, severityLabel } from "@/lib/pose/analyzer";
import { detectPose } from "@/lib/pose/mediapipe";
import { POSE_CONNECTIONS } from "@/lib/pose/types";
import type { Metric, PoseKeypoints } from "@/lib/pose/types";

type Status = "idle" | "loading" | "detecting" | "done" | "error";

export default function SpikePage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [metrics, setMetrics] = useState<Metric[] | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState<number | null>(null);

  const handleFile = useCallback(async (file: File) => {
    setStatus("loading");
    setErrorMsg(null);
    setMetrics(null);
    setElapsed(null);

    try {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.src = url;
      await img.decode();

      const canvas = canvasRef.current;
      if (!canvas) throw new Error("canvas no montado");
      const maxW = 720;
      const scale = img.width > maxW ? maxW / img.width : 1;
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no 2d context");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      setStatus("detecting");
      const t0 = performance.now();
      const kp = await detectPose(img);
      const t1 = performance.now();
      setElapsed(t1 - t0);
      URL.revokeObjectURL(url);

      if (!kp) {
        setStatus("error");
        setErrorMsg("MediaPipe no detectó pose en la imagen.");
        return;
      }

      drawKeypoints(ctx, kp, canvas.width, canvas.height);
      setMetrics(analyzePose(kp));
      setStatus("done");
    } catch (e) {
      setStatus("error");
      setErrorMsg(e instanceof Error ? e.message : String(e));
    }
  }, []);

  return (
    <main className="mx-auto max-w-4xl px-6 py-16">
      <div className="mb-8 space-y-2">
        <p className="text-xs uppercase tracking-widest text-zinc-500">
          Fix Posture · spike técnico (interno)
        </p>
        <h1 className="text-3xl font-semibold tracking-tight">
          Validación de MediaPipe Pose
        </h1>
        <p className="max-w-2xl text-sm text-zinc-400">
          Sube una foto (frontal, posterior o lateral). Verás los keypoints
          detectados y las 8 métricas del PRD §6.2 con umbrales. Todo corre en
          tu navegador — la foto no sale del dispositivo.
        </p>
      </div>

      <label
        htmlFor="file"
        className="mb-6 flex cursor-pointer items-center justify-center rounded border border-dashed border-zinc-700 bg-zinc-900/40 px-6 py-8 text-sm text-zinc-400 transition hover:border-zinc-500 hover:text-zinc-200"
      >
        {status === "idle"
          ? "Click o arrastra una imagen (JPG/PNG)"
          : status === "loading"
            ? "Cargando imagen…"
            : status === "detecting"
              ? "Cargando modelo y detectando pose (primera vez ~5s)…"
              : status === "error"
                ? "Error — sube otra imagen"
                : "Detectado. Click para analizar otra."}
        <input
          id="file"
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
        />
      </label>

      {errorMsg && (
        <p className="mb-6 rounded border border-red-800 bg-red-950/40 px-4 py-2 text-sm text-red-300">
          {errorMsg}
        </p>
      )}

      <canvas
        ref={canvasRef}
        className={`mb-6 w-full rounded border border-zinc-800 ${status === "idle" ? "hidden" : ""}`}
      />

      {metrics && (
        <div className="space-y-3">
          {elapsed !== null && (
            <p className="text-xs text-zinc-500">
              Inferencia: {elapsed.toFixed(0)} ms
            </p>
          )}
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-left text-xs uppercase tracking-widest text-zinc-500">
                <th className="py-2">Métrica</th>
                <th className="py-2">Valor</th>
                <th className="py-2">Severidad</th>
                <th className="py-2">Nota</th>
              </tr>
            </thead>
            <tbody>
              {metrics.map((m) => (
                <tr key={m.key} className="border-b border-zinc-900">
                  <td className="py-2 pr-4 text-zinc-300">{m.label}</td>
                  <td className="py-2 pr-4 font-mono text-zinc-100">
                    {m.value === null
                      ? "—"
                      : `${m.value.toFixed(1)} ${m.unit}`}
                  </td>
                  <td className={`py-2 pr-4 font-medium ${severityColor(m.severity)}`}>
                    {severityLabel(m.severity)}
                  </td>
                  <td className="py-2 text-xs text-zinc-500">{m.note ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="pt-4 text-xs text-zinc-600">
            Umbrales inventados como placeholder — el fisio real los debe
            calibrar. Las métricas frontal/posterior solo son válidas si la
            foto es esa vista; ídem lateral.
          </p>
        </div>
      )}
    </main>
  );
}

function drawKeypoints(
  ctx: CanvasRenderingContext2D,
  kp: PoseKeypoints,
  w: number,
  h: number,
) {
  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(16, 185, 129, 0.8)";
  for (const [a, b] of POSE_CONNECTIONS) {
    const pa = kp[a];
    const pb = kp[b];
    if (!pa || !pb) continue;
    if ((pa.visibility ?? 0) < 0.3 || (pb.visibility ?? 0) < 0.3) continue;
    ctx.beginPath();
    ctx.moveTo(pa.x * w, pa.y * h);
    ctx.lineTo(pb.x * w, pb.y * h);
    ctx.stroke();
  }

  for (const p of kp) {
    if ((p.visibility ?? 0) < 0.3) continue;
    ctx.fillStyle = "rgba(244, 63, 94, 0.9)";
    ctx.beginPath();
    ctx.arc(p.x * w, p.y * h, 4, 0, Math.PI * 2);
    ctx.fill();
  }
}
