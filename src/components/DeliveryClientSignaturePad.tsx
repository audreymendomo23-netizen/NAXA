"use client";

import { useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

type Point = { x: number; y: number };
type Props = { missionId: string; onDone: () => void };

export function DeliveryClientSignaturePad({ missionId, onDone }: Props) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const strokesRef = useRef<Point[][]>([]);
  const activeStrokeRef = useRef<Point[]>([]);
  const [drawing, setDrawing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  function point(event: React.PointerEvent<HTMLCanvasElement>): Point {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
    };
  }

  function start(event: React.PointerEvent<HTMLCanvasElement>) {
    event.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(event.pointerId);
    const next = point(event);
    activeStrokeRef.current = [next];
    setDrawing(true);
    const context = canvas.getContext("2d");
    if (context) {
      context.lineWidth = 2.5;
      context.lineCap = "round";
      context.lineJoin = "round";
      context.beginPath();
      context.moveTo(next.x * canvas.width, next.y * canvas.height);
      context.lineTo(next.x * canvas.width + 0.5, next.y * canvas.height + 0.5);
      context.stroke();
    }
  }

  function move(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing) return;
    event.preventDefault();
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    const next = point(event);
    const points = activeStrokeRef.current;
    const previous = points[points.length - 1];
    if (context && canvas && previous) {
      context.beginPath();
      context.moveTo(previous.x * canvas.width, previous.y * canvas.height);
      context.lineTo(next.x * canvas.width, next.y * canvas.height);
      context.stroke();
    }
    points.push(next);
  }

  function finish(event?: React.PointerEvent<HTMLCanvasElement>) {
    if (!activeStrokeRef.current.length) return;
    event?.preventDefault();
    strokesRef.current = [...strokesRef.current, activeStrokeRef.current];
    activeStrokeRef.current = [];
    setDrawing(false);
  }

  function clear() {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (context && canvas) context.clearRect(0, 0, canvas.width, canvas.height);
    strokesRef.current = [];
    activeStrokeRef.current = [];
    setDrawing(false);
    setError("");
  }

  async function submit() {
    finish();
    if (!strokesRef.current.length || busy) {
      setError("La signature est obligatoire.");
      return;
    }
    setBusy(true); setError("");
    const { error: rpcError } = await supabaseBrowser().rpc("naxa_delivery_confirm_signature", {
      p_mission: missionId,
      p_strokes: strokesRef.current,
    });
    if (rpcError) setError(rpcError.message || "La signature n'a pas pu être enregistrée.");
    else onDone();
    setBusy(false);
  }

  return <section className="rounded-xl border border-amber-200 bg-white p-3">
    <div>
      <h4 className="font-extrabold text-slate-900">Signature du Client · secours hors connexion</h4>
      <p className="mt-1 text-xs text-slate-600">Le Client signe directement sur le téléphone du Livreur. La signature est conservée sous forme de tracés normalisés et associée à cette mission.</p>
    </div>
    <canvas
      ref={canvasRef}
      width={720}
      height={260}
      className="mt-3 w-full touch-none rounded-lg border border-dashed border-slate-400 bg-white"
      style={{ height: 160 }}
      onPointerDown={start}
      onPointerMove={move}
      onPointerUp={finish}
      onPointerCancel={finish}
      onLostPointerCapture={finish}
      aria-label="Zone de signature du Client"
    />
    {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    <div className="mt-3 flex flex-wrap gap-2">
      <button type="button" disabled={busy} onClick={clear} className="min-h-10 rounded-lg border px-3 py-2 text-sm font-semibold">Effacer</button>
      <button type="button" disabled={busy || !strokesRef.current.length} onClick={() => void submit()} className="min-h-10 rounded-lg bg-[#0B3D26] px-3 py-2 text-sm font-bold text-white disabled:opacity-50">{busy ? "Enregistrement…" : "Valider la signature et la remise"}</button>
    </div>
  </section>;
}
