"use client";

import { useState } from "react";
import type { ElevationElement } from "@/lib/roomplan";
import { updateWallFinishes } from "@/lib/ops-actions";

// ─── Finish types ─────────────────────────────────────────────────────────────

export type FinishType =
  | "paint"
  | "tile"
  | "cement_board"
  | "waterproof_panel"
  | "drywall"
  | "none";

const FINISH_OPTIONS: { value: FinishType | ""; label: string }[] = [
  { value: "", label: "— unset —" },
  { value: "paint", label: "Paint" },
  { value: "tile", label: "Tile" },
  { value: "waterproof_panel", label: "Waterproof panel" },
  { value: "cement_board", label: "Cement board" },
  { value: "drywall", label: "Drywall" },
  { value: "none", label: "None / skip" },
];

const FINISH_PILL: Record<FinishType, string> = {
  paint: "bg-blue-100 text-blue-800",
  tile: "bg-amber-100 text-amber-800",
  waterproof_panel: "bg-teal-100 text-teal-800",
  cement_board: "bg-stone-100 text-stone-700",
  drywall: "bg-slate-100 text-slate-600",
  none: "bg-red-50 text-red-400",
};

// ─── Surface row builder ──────────────────────────────────────────────────────

export interface SurfaceWallInput {
  width_ft: number;
  height_ft: number;
  elements?: ElevationElement[]; // present only for Path-A+ scans
}

interface SurfaceRow {
  key: string;
  label: string;
  dim: string;
  gross: number;
  deductions: number;
  net: number;
}

function buildRows(walls: SurfaceWallInput[], floorAreaSqft: number): SurfaceRow[] {
  const rows: SurfaceRow[] = walls.map((w, i) => {
    const gross = w.width_ft * w.height_ft;
    const deductions = (w.elements ?? [])
      .filter((e) => e.type === "door" || e.type === "window" || e.type === "opening")
      .reduce((sum, e) => sum + e.width_ft * e.height_ft, 0);
    return {
      key: `wall_${i}`,
      label: `Wall ${i + 1}`,
      dim: `${w.width_ft.toFixed(1)}′ × ${w.height_ft.toFixed(1)}′`,
      gross,
      deductions,
      net: Math.max(0, gross - deductions),
    };
  });

  rows.push({
    key: "floor",
    label: "Floor",
    dim: `${floorAreaSqft.toFixed(1)} ft²`,
    gross: floorAreaSqft,
    deductions: 0,
    net: floorAreaSqft,
  });

  rows.push({
    key: "ceiling",
    label: "Ceiling",
    dim: `${floorAreaSqft.toFixed(1)} ft²`,
    gross: floorAreaSqft,
    deductions: 0,
    net: floorAreaSqft,
  });

  return rows;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SurfacesPanel({
  scanId,
  walls,
  floorAreaSqft,
  initialFinishes,
}: {
  scanId: string;
  walls: SurfaceWallInput[];
  floorAreaSqft: number;
  initialFinishes: Record<string, string> | null;
}) {
  const rows = buildRows(walls, floorAreaSqft);
  const [finishes, setFinishes] = useState<Record<string, string>>(initialFinishes ?? {});
  const [saving, setSaving] = useState(false);

  async function handleChange(key: string, value: string) {
    const next = { ...finishes };
    if (value === "") {
      delete next[key];
    } else {
      next[key] = value;
    }
    setFinishes(next);
    setSaving(true);
    await updateWallFinishes(scanId, next);
    setSaving(false);
  }

  // Totals by finish
  const byFinish: Partial<Record<FinishType, number>> = {};
  for (const row of rows) {
    const f = finishes[row.key] as FinishType | undefined;
    if (f) byFinish[f] = (byFinish[f] ?? 0) + row.net;
  }

  const totalNet = rows.reduce((s, r) => s + r.net, 0);
  const hasDeductions = rows.some((r) => r.deductions > 0);

  return (
    <section className="rounded-lg border border-slate-200 p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Surfaces &amp; Finishes
        </h2>
        {saving && <span className="text-xs text-slate-400 italic">Saving…</span>}
      </div>

      <div className="overflow-x-auto -mx-1">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-xs text-slate-500 border-b border-slate-100">
              <th className="text-left pb-2 pr-4 font-medium">Surface</th>
              <th className="text-left pb-2 pr-6 font-medium text-slate-400">Dimensions</th>
              <th className="text-right pb-2 pr-4 font-medium">Gross</th>
              {hasDeductions && (
                <th className="text-right pb-2 pr-4 font-medium">Openings</th>
              )}
              <th className="text-right pb-2 pr-6 font-medium">Net area</th>
              <th className="text-left pb-2 font-medium">Finish</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {rows.map((row) => (
              <tr key={row.key} className="group">
                <td className="py-2.5 pr-4 font-medium text-partli-ink">{row.label}</td>
                <td className="py-2.5 pr-6 font-mono text-xs text-slate-400">{row.dim}</td>
                <td className="py-2.5 pr-4 text-right font-mono text-slate-500 text-xs">
                  {row.gross.toFixed(1)} ft²
                </td>
                {hasDeductions && (
                  <td className="py-2.5 pr-4 text-right font-mono text-xs text-slate-400">
                    {row.deductions > 0 ? `−${row.deductions.toFixed(1)} ft²` : "—"}
                  </td>
                )}
                <td className="py-2.5 pr-6 text-right font-mono font-semibold text-partli-ink">
                  {row.net.toFixed(1)} ft²
                </td>
                <td className="py-2.5">
                  <select
                    value={finishes[row.key] ?? ""}
                    onChange={(e) => handleChange(row.key, e.target.value)}
                    className="text-xs rounded border border-slate-200 px-2 py-1 bg-white text-slate-700 focus:outline-none focus:ring-1 focus:ring-partli-accent cursor-pointer"
                  >
                    {FINISH_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>
                        {o.label}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="border-t-2 border-slate-200">
            <tr>
              <td className="pt-3 font-semibold text-partli-ink">Total</td>
              <td />
              <td />
              {hasDeductions && <td />}
              <td className="pt-3 text-right font-mono font-bold text-partli-ink">
                {totalNet.toFixed(1)} ft²
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      {/* By-finish summary */}
      {Object.keys(byFinish).length > 0 && (
        <div className="pt-3 border-t border-slate-100 space-y-2">
          <p className="text-xs font-medium text-slate-400">By finish</p>
          <div className="flex flex-wrap gap-2">
            {(Object.entries(byFinish) as [FinishType, number][]).map(([f, sqft]) => (
              <span
                key={f}
                className={`px-2.5 py-1 rounded-full text-xs font-medium ${FINISH_PILL[f]}`}
              >
                {f.replace(/_/g, " ")}: {sqft.toFixed(1)} ft²
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
