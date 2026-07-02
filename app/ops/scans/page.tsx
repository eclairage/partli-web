import { supabaseAdmin } from "@/lib/supabase";
import type { Scan } from "@/lib/supabase";
import Link from "next/link";

const STATUS_STYLE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800",
  approved: "bg-green-100 text-green-800",
  flagged: "bg-red-100 text-red-800",
};

export const dynamic = "force-dynamic";

export default async function ScansPage() {
  const db = supabaseAdmin();
  const { data: scans } = await db
    .from("scans")
    .select("id, created_at, status, homeowners(name, address, phone)")
    .order("status", { ascending: true }) // pending sorts before approved/flagged alphabetically — good enough
    .order("created_at", { ascending: false })
    .returns<Scan[]>();

  return (
    <main className="max-w-5xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Basin — Scans</h1>
        <span className="text-sm text-slate-500">
          {scans?.filter((s) => s.status === "pending").length ?? 0} pending
        </span>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3">Homeowner</th>
              <th className="px-4 py-3">Address</th>
              <th className="px-4 py-3">Submitted</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {scans?.map((scan) => {
              const hw = scan.homeowners as unknown as {
                name: string;
                address: string | null;
                phone: string;
              } | null;
              return (
                <tr key={scan.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-slate-900">
                    {hw?.name ?? "—"}
                    <div className="text-xs text-slate-400">{hw?.phone}</div>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{hw?.address ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-500">
                    {new Date(scan.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLE[scan.status] ?? ""}`}
                    >
                      {scan.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/ops/scans/${scan.id}`}
                      className="text-blue-600 hover:underline"
                    >
                      Review →
                    </Link>
                  </td>
                </tr>
              );
            })}
            {!scans?.length && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  No scans yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
