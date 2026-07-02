import { supabaseAdmin } from "@/lib/supabase";
import type { Scan } from "@/lib/supabase";
import Link from "next/link";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending:   "bg-amber-100 text-amber-800",
    approved:  "bg-green-100 text-green-800",
    flagged:   "bg-red-100 text-red-800",
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${styles[status] ?? ""}`}>
      {status}
    </span>
  );
}

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = supabaseAdmin();

  const [jobResult, scansResult] = await Promise.all([
    db.from("jobs").select("*").eq("id", id).single(),
    db
      .from("scans")
      .select("id, created_at, phase, status, photo_urls, usdz_url, room_data")
      .eq("job_id", id)
      .order("created_at", { ascending: true })
      .returns<Scan[]>(),
  ]);

  if (jobResult.error || !jobResult.data) notFound();

  const job = jobResult.data;
  const allScans = scansResult.data ?? [];

  // Group scans by phase (most recent scan per phase wins display)
  const byPhase: Record<string, Scan[]> = {};
  for (const scan of allScans) {
    const phase = scan.phase ?? "Untagged";
    if (!byPhase[phase]) byPhase[phase] = [];
    byPhase[phase].push(scan);
  }

  const completedPhases = new Set(Object.keys(byPhase));

  return (
    <main className="max-w-4xl mx-auto px-6 py-10 space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <Link href="/ops/jobs" className="text-sm text-slate-500 hover:text-slate-800">
            ← All jobs
          </Link>
          <h1 className="text-2xl font-bold text-slate-900 mt-1">{job.name}</h1>
          {job.address && <p className="text-slate-500 text-sm mt-0.5">{job.address}</p>}
        </div>
        <span className={`px-2 py-0.5 rounded text-xs font-medium mt-1 ${
          job.status === "active" ? "bg-green-100 text-green-800" : "bg-slate-100 text-slate-500"
        }`}>
          {job.status}
        </span>
      </div>

      {/* Phase progress */}
      <section className="rounded-lg border border-slate-200 p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-4">
          Phases — {completedPhases.size} of {job.phases.length} scanned
        </h2>
        <div className="flex flex-wrap gap-2">
          {job.phases.map((phase: string) => (
            <a
              key={phase}
              href={`#phase-${encodeURIComponent(phase)}`}
              className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors ${
                completedPhases.has(phase)
                  ? "bg-green-50 border-green-200 text-green-800"
                  : "bg-slate-50 border-slate-200 text-slate-500"
              }`}
            >
              {completedPhases.has(phase) ? "✓ " : ""}{phase}
            </a>
          ))}
        </div>
      </section>

      {/* Scans per phase */}
      {job.phases.map((phase: string) => {
        const scans = byPhase[phase] ?? [];
        const latestScan = scans[scans.length - 1];

        return (
          <section
            key={phase}
            id={`phase-${encodeURIComponent(phase)}`}
            className="rounded-lg border border-slate-200"
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
              <h2 className="font-semibold text-slate-900">{phase}</h2>
              {latestScan ? (
                <div className="flex items-center gap-2">
                  <StatusBadge status={latestScan.status} />
                  <span className="text-xs text-slate-400">
                    {new Date(latestScan.created_at).toLocaleDateString()}
                  </span>
                </div>
              ) : (
                <span className="text-xs text-slate-400">Not yet scanned</span>
              )}
            </div>

            {latestScan ? (
              <div className="p-5 space-y-4">
                {/* Room summary */}
                {latestScan.room_data && (
                  <div className="grid grid-cols-4 gap-3 text-center">
                    {[
                      ["sq ft", (latestScan.room_data as any).floor_area_sqft?.toFixed(1)],
                      ["walls", (latestScan.room_data as any).wall_count],
                      ["doors", (latestScan.room_data as any).doors?.length ?? 0],
                      ["objects", (latestScan.room_data as any).objects?.length ?? 0],
                    ].map(([label, value]) => (
                      <div key={label} className="rounded-md bg-slate-50 p-2">
                        <div className="text-lg font-bold text-slate-900">{value}</div>
                        <div className="text-xs text-slate-500">{label}</div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Photos */}
                {latestScan.photo_urls && latestScan.photo_urls.length > 0 && (
                  <div className="grid grid-cols-4 gap-2">
                    {latestScan.photo_urls.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={url}
                          alt={`Photo ${i + 1}`}
                          className="w-full aspect-square object-cover rounded-lg hover:opacity-90 transition-opacity"
                        />
                      </a>
                    ))}
                  </div>
                )}

                <div className="flex items-center gap-4">
                  {latestScan.usdz_url && (
                    <a
                      href={latestScan.usdz_url}
                      download
                      className="text-sm text-blue-600 hover:underline"
                    >
                      ↓ USDZ model
                    </a>
                  )}
                  <Link
                    href={`/ops/scans/${latestScan.id}`}
                    className="text-sm text-blue-600 hover:underline"
                  >
                    Full review →
                  </Link>
                  {scans.length > 1 && (
                    <span className="text-xs text-slate-400">{scans.length} scans total for this phase</span>
                  )}
                </div>
              </div>
            ) : (
              <div className="px-5 py-6 text-sm text-slate-400 text-center">
                No scan yet — installer will capture this phase on site.
              </div>
            )}
          </section>
        );
      })}

      {/* Any untagged scans */}
      {byPhase["Untagged"] && (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-amber-600 mb-2">
            Untagged Scans
          </h2>
          <p className="text-sm text-amber-800">
            {byPhase["Untagged"].length} scan(s) submitted without a phase label.
          </p>
        </section>
      )}
    </main>
  );
}
