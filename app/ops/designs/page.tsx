import { supabaseAdmin } from "@/lib/supabase";
import type { Design, Homeowner } from "@/lib/supabase";
import Link from "next/link";

export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<string, string> = {
  draft:     "bg-amber-100 text-amber-800",
  published: "bg-green-100 text-green-800",
  approved:  "bg-partli-accent/15 text-partli-accent",
  archived:  "bg-slate-100 text-slate-400",
};

function money(cents: number | null): string {
  if (cents == null) return "—";
  return `$${(cents / 100).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
}

type DesignRow = Design & { homeowners?: Pick<Homeowner, "name"> | null };

export default async function DesignsPage() {
  const db = supabaseAdmin();

  const { data: designs } = await db
    .from("designs")
    .select("*, homeowners(name)")
    .order("updated_at", { ascending: false })
    .returns<DesignRow[]>();

  const draftCount = designs?.filter((d) => d.status === "draft").length ?? 0;

  return (
    <main className="max-w-5xl mx-auto px-6 py-10 w-full">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-partli-ink">Designs</h1>
        <span className="font-mono text-xs text-partli-muted">
          {draftCount} in draft
        </span>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3">Homeowner</th>
              <th className="px-4 py-3">Title</th>
              <th className="px-4 py-3">Fixed price</th>
              <th className="px-4 py-3">Renderings</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Updated</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {designs?.map((d) => (
              <tr key={d.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 font-medium text-partli-ink">
                  {d.homeowners?.name ?? "—"}
                </td>
                <td className="px-4 py-3 text-slate-500">{d.title ?? "Untitled"}</td>
                <td className="px-4 py-3 font-mono text-slate-500">
                  {money(d.fixed_price_cents)}
                </td>
                <td className="px-4 py-3 font-mono text-slate-500">
                  {d.rendering_urls?.length ?? 0}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                      STATUS_STYLE[d.status] ?? ""
                    }`}
                  >
                    {d.status}
                    {d.version > 1 ? ` · v${d.version}` : ""}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-400 text-xs">
                  {new Date(d.updated_at).toLocaleDateString()}
                </td>
                <td className="px-4 py-3 text-right">
                  {d.scan_id ? (
                    <Link
                      href={`/ops/scans/${d.scan_id}`}
                      className="text-partli-accent hover:underline"
                    >
                      Open scan →
                    </Link>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>
              </tr>
            ))}
            {!designs?.length && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                  No designs yet. Start one from an approved scan.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
