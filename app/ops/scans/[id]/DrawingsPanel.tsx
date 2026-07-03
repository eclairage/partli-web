"use client";

import { useEffect, useState, useCallback } from "react";
import type { Drawings, FloorPlan, WallElevation } from "@/lib/roomplan";
import type { Annotation } from "@/lib/supabase";

interface PendingPin {
  target: string;
  x: number;
  y: number;
  screenX: number;
  screenY: number;
}

const FP_PAD = 2;   // feet of padding around floor plan
const EL_PAD = 0.5; // feet of padding around wall elevation

// ─── Floor plan SVG ──────────────────────────────────────────────────────────

function FloorPlanSvg({
  plan,
  annotations,
  onClick,
}: {
  plan: FloorPlan;
  annotations: Annotation[];
  onClick: (e: React.MouseEvent<SVGSVGElement>) => void;
}) {
  const { bounds } = plan;
  const vbX = bounds.min_x - FP_PAD;
  const vbY = bounds.min_z - FP_PAD;
  const vbW = bounds.max_x - bounds.min_x + FP_PAD * 2;
  const vbH = bounds.max_z - bounds.min_z + FP_PAD * 2;
  const W = 0.12; // wall stroke width, feet

  return (
    <svg
      viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
      preserveAspectRatio="xMidYMid meet"
      className="w-full rounded border border-slate-100 bg-slate-50"
      style={{ maxHeight: 480 }}
      onClick={onClick}
    >
      {/* Grid lines (light) */}
      {Array.from({ length: Math.ceil(vbW) + 1 }, (_, i) => vbX + i).map((x) => (
        <line key={`gx${x}`} x1={x} y1={vbY} x2={x} y2={vbY + vbH}
          stroke="#e2e8f0" strokeWidth={0.02} />
      ))}
      {Array.from({ length: Math.ceil(vbH) + 1 }, (_, i) => vbY + i).map((z) => (
        <line key={`gz${z}`} x1={vbX} y1={z} x2={vbX + vbW} y2={z}
          stroke="#e2e8f0" strokeWidth={0.02} />
      ))}

      {/* Objects (draw first so walls render on top) */}
      {plan.objects.map((o, i) => (
        <g key={i} transform={`rotate(${o.rotation_deg}, ${o.cx}, ${o.cz})`}>
          <rect
            x={o.cx - o.width_ft / 2} y={o.cz - o.depth_ft / 2}
            width={o.width_ft} height={o.depth_ft}
            fill="#e0f2fe" stroke="#7dd3fc" strokeWidth={0.04}
          />
          <text x={o.cx} y={o.cz} textAnchor="middle" dominantBaseline="middle"
            fontSize={0.3} fill="#0369a1" style={{ pointerEvents: "none" }}>
            {o.category}
          </text>
        </g>
      ))}

      {/* Openings */}
      {plan.openings.map((seg, i) => (
        <line key={i} x1={seg.x1} y1={seg.z1} x2={seg.x2} y2={seg.z2}
          stroke="#cbd5e1" strokeWidth={W * 0.6} strokeLinecap="round" strokeDasharray={`${W} ${W * 0.5}`} />
      ))}

      {/* Windows */}
      {plan.windows.map((seg, i) => (
        <line key={i} x1={seg.x1} y1={seg.z1} x2={seg.x2} y2={seg.z2}
          stroke="#3b82f6" strokeWidth={W * 0.6} strokeLinecap="round" strokeDasharray={`${W * 0.4} ${W * 0.2}`} />
      ))}

      {/* Doors */}
      {plan.doors.map((seg, i) => (
        <line key={i} x1={seg.x1} y1={seg.z1} x2={seg.x2} y2={seg.z2}
          stroke="#94a3b8" strokeWidth={W * 0.7} strokeLinecap="round" />
      ))}

      {/* Walls */}
      {plan.walls.map((seg, i) => (
        <line key={i} x1={seg.x1} y1={seg.z1} x2={seg.x2} y2={seg.z2}
          stroke="#1e293b" strokeWidth={W} strokeLinecap="square" />
      ))}

      {/* Annotation pins */}
      {annotations.map((a, i) => (
        <g key={a.id} style={{ pointerEvents: "none" }}>
          <circle cx={a.x} cy={a.y} r={0.35} fill="#f59e0b" stroke="white" strokeWidth={0.07} />
          <text x={a.x} y={a.y} textAnchor="middle" dominantBaseline="middle"
            fontSize={0.3} fill="white" fontWeight="bold">
            {i + 1}
          </text>
        </g>
      ))}

      {/* Scale bar (bottom-left, 5 ft) */}
      <g>
        <line x1={vbX + 0.5} y1={vbY + vbH - 0.5} x2={vbX + 5.5} y2={vbY + vbH - 0.5}
          stroke="#64748b" strokeWidth={0.08} />
        <line x1={vbX + 0.5} y1={vbY + vbH - 0.65} x2={vbX + 0.5} y2={vbY + vbH - 0.35}
          stroke="#64748b" strokeWidth={0.08} />
        <line x1={vbX + 5.5} y1={vbY + vbH - 0.65} x2={vbX + 5.5} y2={vbY + vbH - 0.35}
          stroke="#64748b" strokeWidth={0.08} />
        <text x={vbX + 3} y={vbY + vbH - 0.7} textAnchor="middle"
          fontSize={0.3} fill="#64748b">
          5 ft
        </text>
      </g>
    </svg>
  );
}

// ─── Wall elevation SVG ───────────────────────────────────────────────────────

function WallElevationSvg({
  elevation,
  annotations,
  onClick,
}: {
  elevation: WallElevation;
  annotations: Annotation[];
  onClick: (e: React.MouseEvent<SVGSVGElement>) => void;
}) {
  const W = elevation.width_ft;
  const H = elevation.height_ft;
  const P = EL_PAD;

  // SVG Y is inverted: sy(y_from_floor) = H - y
  const sy = (y: number) => H - y;

  return (
    <svg
      viewBox={`${-P} ${-P} ${W + P * 2} ${H + P * 2}`}
      preserveAspectRatio="xMidYMid meet"
      className="w-full rounded border border-slate-100 bg-white"
      style={{ maxHeight: 360 }}
      onClick={onClick}
    >
      {/* Wall background */}
      <rect x={0} y={0} width={W} height={H} fill="#f8fafc" />

      {/* Wall hatching (light diagonal lines to indicate wall material) */}
      <defs>
        <pattern id="hatch" width={0.5} height={0.5} patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <line x1={0} y1={0} x2={0} y2={0.5} stroke="#e2e8f0" strokeWidth={0.08} />
        </pattern>
      </defs>
      <rect x={0} y={0} width={W} height={H} fill="url(#hatch)" />

      {/* Wall outline */}
      <rect x={0} y={0} width={W} height={H} fill="none" stroke="#475569" strokeWidth={0.06} />

      {/* Elements */}
      {elevation.elements.map((el, i) => {
        // el.x_ft = left edge relative to wall centre → convert to left-from-left-edge
        const ex = el.x_ft + W / 2;
        const ey_bottom = el.y_ft;           // from floor
        const ey_top_svg = sy(ey_bottom + el.height_ft); // top in SVG coords

        if (el.type === "door") {
          return (
            <g key={i}>
              {/* Door opening (white cutout) */}
              <rect x={ex} y={ey_top_svg} width={el.width_ft} height={el.height_ft}
                fill="white" stroke="none" />
              {/* Door frame */}
              <rect x={ex} y={ey_top_svg} width={el.width_ft} height={el.height_ft}
                fill="none" stroke="#475569" strokeWidth={0.05} />
              {/* Door swing arc */}
              <path
                d={`M ${ex} ${sy(ey_bottom)} A ${el.width_ft} ${el.width_ft} 0 0 1 ${ex + el.width_ft} ${sy(ey_bottom + el.width_ft)}`}
                fill="none" stroke="#94a3b8" strokeWidth={0.04} strokeDasharray="0.15 0.1"
              />
            </g>
          );
        }

        if (el.type === "window") {
          return (
            <g key={i}>
              <rect x={ex} y={ey_top_svg} width={el.width_ft} height={el.height_ft}
                fill="#eff6ff" stroke="#3b82f6" strokeWidth={0.05} />
              {/* Window sill */}
              <line x1={ex} y1={sy(ey_bottom)} x2={ex + el.width_ft} y2={sy(ey_bottom)}
                stroke="#3b82f6" strokeWidth={0.08} />
              {/* Glazing bars */}
              <line x1={ex + el.width_ft / 2} y1={ey_top_svg}
                x2={ex + el.width_ft / 2} y2={ey_top_svg + el.height_ft}
                stroke="#93c5fd" strokeWidth={0.03} />
              <line x1={ex} y1={sy(ey_bottom + el.height_ft / 2)}
                x2={ex + el.width_ft} y2={sy(ey_bottom + el.height_ft / 2)}
                stroke="#93c5fd" strokeWidth={0.03} />
            </g>
          );
        }

        if (el.type === "opening") {
          return (
            <rect key={i} x={ex} y={ey_top_svg} width={el.width_ft} height={el.height_ft}
              fill="white" stroke="#cbd5e1" strokeWidth={0.04} strokeDasharray="0.15 0.1" />
          );
        }

        // Object
        return (
          <g key={i}>
            <rect x={ex} y={ey_top_svg} width={el.width_ft} height={el.height_ft}
              fill="#e0f2fe" stroke="#7dd3fc" strokeWidth={0.04} />
            <text x={ex + el.width_ft / 2} y={ey_top_svg + el.height_ft / 2}
              textAnchor="middle" dominantBaseline="middle"
              fontSize={0.28} fill="#0369a1" style={{ pointerEvents: "none" }}>
              {el.category}
            </text>
          </g>
        );
      })}

      {/* Floor line */}
      <line x1={-P} y1={H} x2={W + P} y2={H} stroke="#334155" strokeWidth={0.1} />

      {/* Ceiling line */}
      <line x1={0} y1={0} x2={W} y2={0} stroke="#334155" strokeWidth={0.06} strokeDasharray="0.3 0.15" />

      {/* Dimension labels */}
      <text x={W / 2} y={-0.15} textAnchor="middle" fontSize={0.3} fill="#64748b">
        {elevation.width_ft.toFixed(1)}′ wide
      </text>
      <text x={W + 0.15} y={H / 2} textAnchor="start" fontSize={0.3} fill="#64748b"
        transform={`rotate(90, ${W + 0.15}, ${H / 2})`}>
        {elevation.height_ft.toFixed(1)}′ tall
      </text>

      {/* Annotation pins */}
      {annotations.map((a, i) => (
        <g key={a.id} style={{ pointerEvents: "none" }}>
          <circle cx={a.x} cy={sy(a.y)} r={0.3} fill="#f59e0b" stroke="white" strokeWidth={0.06} />
          <text x={a.x} y={sy(a.y)} textAnchor="middle" dominantBaseline="middle"
            fontSize={0.25} fill="white" fontWeight="bold">
            {i + 1}
          </text>
        </g>
      ))}
    </svg>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export default function DrawingsPanel({ scanId }: { scanId: string }) {
  const [drawings, setDrawings] = useState<Drawings | null>(null);
  const [annotations, setAnnotations] = useState<Annotation[]>([]);
  const [tab, setTab] = useState("floor_plan");
  const [pending, setPending] = useState<PendingPin | null>(null);
  const [draftText, setDraftText] = useState("");
  const [draftAuthor, setDraftAuthor] = useState("");
  const [saving, setSaving] = useState(false);
  const [noDrawings, setNoDrawings] = useState(false);

  useEffect(() => {
    fetch(`/api/scans/${scanId}/drawings`).then(async (r) => {
      if (r.status === 422) { setNoDrawings(true); return; }
      setDrawings(await r.json());
    });
    fetch(`/api/scans/${scanId}/annotations`)
      .then((r) => r.json())
      .then((d) => setAnnotations(d.annotations ?? []));
  }, [scanId]);

  // Close popover on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setPending(null); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const handleSvgClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>, target: string, wallHeight?: number) => {
      if ((e.target as Element).closest("[data-pin]")) return; // clicking a pin
      const svg = e.currentTarget;
      const pt = svg.createSVGPoint();
      pt.x = e.clientX;
      pt.y = e.clientY;
      const svgPt = pt.matrixTransform(svg.getScreenCTM()!.inverse());
      const x = svgPt.x;
      // For elevations: flip Y so (0,0) = bottom-left of wall
      const y = wallHeight != null ? wallHeight - svgPt.y : svgPt.y;
      setPending({ target, x, y, screenX: e.clientX, screenY: e.clientY });
      setDraftText("");
    },
    []
  );

  const saveAnnotation = async () => {
    if (!pending || !draftText.trim()) return;
    setSaving(true);
    const res = await fetch(`/api/scans/${scanId}/annotations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target: pending.target, x: pending.x, y: pending.y, text: draftText, author: draftAuthor }),
    });
    if (res.ok) {
      setAnnotations((await res.json()).annotations);
      setPending(null);
    }
    setSaving(false);
  };

  const deleteAnnotation = async (id: string) => {
    const res = await fetch(`/api/scans/${scanId}/annotations/${id}`, { method: "DELETE" });
    if (res.ok) setAnnotations((await res.json()).annotations);
  };

  if (noDrawings) {
    return (
      <section className="rounded-lg border border-slate-200 p-5 text-sm text-slate-400">
        Drawings unavailable — scan predates transform support. Rescan to generate floor plan and elevations.
      </section>
    );
  }

  if (!drawings) {
    return (
      <section className="rounded-lg border border-slate-200 p-5 text-sm text-slate-400 animate-pulse">
        Loading drawings…
      </section>
    );
  }

  const tabs = ["floor_plan", ...drawings.wall_elevations.map((_, i) => `wall_${i}`)];
  const tabLabel = (t: string) =>
    t === "floor_plan"
      ? "Floor Plan"
      : `Wall ${parseInt(t.split("_")[1]) + 1} (${drawings.wall_elevations[parseInt(t.split("_")[1])].width_ft.toFixed(1)}′)`;

  const tabAnnotations = annotations.filter((a) => a.target === tab);

  const currentElevation =
    tab.startsWith("wall_")
      ? drawings.wall_elevations[parseInt(tab.split("_")[1])]
      : null;

  return (
    <section className="rounded-lg border border-slate-200 p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">Drawings</h2>
        <span className="text-xs text-slate-400 italic">Click to annotate</span>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 flex-wrap">
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => { setTab(t); setPending(null); }}
            className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
              tab === t
                ? "bg-slate-900 text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {tabLabel(t)}
          </button>
        ))}
      </div>

      {/* Drawing + sidebar */}
      <div className="flex gap-4 items-start">
        {/* Canvas */}
        <div className="flex-1 relative" style={{ cursor: "crosshair" }}>
          {tab === "floor_plan" && (
            <FloorPlanSvg
              plan={drawings.floor_plan}
              annotations={tabAnnotations}
              onClick={(e) => handleSvgClick(e, "floor_plan")}
            />
          )}
          {currentElevation && (
            <WallElevationSvg
              elevation={currentElevation}
              annotations={tabAnnotations}
              onClick={(e) => handleSvgClick(e, tab, currentElevation.height_ft)}
            />
          )}

          {/* Annotation popover */}
          {pending && (
            <div
              className="fixed z-50 bg-white border border-slate-200 rounded-xl shadow-xl p-3 space-y-2 w-52"
              style={{ left: pending.screenX + 16, top: Math.max(8, pending.screenY - 24) }}
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-xs font-semibold text-slate-700">Add note</p>
              <textarea
                autoFocus
                value={draftText}
                onChange={(e) => setDraftText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); saveAnnotation(); } }}
                placeholder="Note…"
                rows={2}
                className="w-full rounded border border-slate-300 px-2 py-1 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-blue-400"
              />
              <input
                value={draftAuthor}
                onChange={(e) => setDraftAuthor(e.target.value)}
                placeholder="Your name (optional)"
                className="w-full rounded border border-slate-300 px-2 py-1 text-xs focus:outline-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={saveAnnotation}
                  disabled={!draftText.trim() || saving}
                  className="flex-1 py-1 bg-slate-900 text-white rounded text-xs font-medium disabled:opacity-40"
                >
                  {saving ? "Saving…" : "Save"}
                </button>
                <button onClick={() => setPending(null)} className="py-1 px-2 text-xs text-slate-400 hover:text-slate-600">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Annotation list */}
        <div className="w-56 shrink-0">
          <p className="text-xs text-slate-400 mb-2 font-medium">
            {tabAnnotations.length === 0
              ? "No annotations"
              : `${tabAnnotations.length} note${tabAnnotations.length !== 1 ? "s" : ""}`}
          </p>
          <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
            {tabAnnotations.map((a, i) => (
              <div key={a.id} className="rounded-lg bg-amber-50 border border-amber-200 p-2.5 text-xs">
                <div className="flex items-start justify-between gap-1">
                  <div className="flex items-start gap-1.5 min-w-0">
                    <span className="mt-0.5 shrink-0 w-4 h-4 rounded-full bg-amber-400 text-white flex items-center justify-center text-[10px] font-bold">
                      {i + 1}
                    </span>
                    <p className="text-slate-800 break-words">{a.text}</p>
                  </div>
                  <button
                    onClick={() => deleteAnnotation(a.id)}
                    className="shrink-0 text-slate-300 hover:text-red-400 leading-none mt-0.5"
                    title="Delete"
                  >
                    ×
                  </button>
                </div>
                {(a.author || a.created_at) && (
                  <p className="text-slate-400 mt-1 pl-5">
                    {a.author}
                    {a.author && " · "}
                    {new Date(a.created_at).toLocaleDateString()}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
