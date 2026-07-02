import { supabaseAdmin } from "@/lib/supabase";
import type { Job } from "@/lib/supabase";
import Link from "next/link";

export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<string, string> = {
  active:    "bg-green-100 text-green-800",
  completed: "bg-slate-100 text-slate-600",
  archived:  "bg-slate-100 text-slate-400",
};

export default async function JobsPage() {
  const db = supabaseAdmin();

  // Fetch jobs with a count of their scans
  const { data: jobs } = await db
    .from("jobs")
    .select("*")
    .order("created_at", { ascending: false })
    .returns<Job[]>();

  // Fetch scan counts per job
  const { data: scanCounts } = await db
    .from("scans")
    .select("job_id")
    .not("job_id", "is", null);

  const countByJob: Record<string, number> = {};
  for (const row of scanCounts ?? []) {
    if (row.job_id) countByJob[row.job_id] = (countByJob[row.job_id] ?? 0) + 1;
  }

  return (
    <main className="max-w-5xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Basin — Jobs</h1>
        <span className="text-sm text-slate-500">
          {jobs?.filter((j) => j.status === "active").length ?? 0} active
        </span>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-xs font-medium text-slate-500 uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3">Job</th>
              <th className="px-4 py-3">Address</th>
              <th className="px-4 py-3">Phases</th>
              <th className="px-4 py-3">Scans</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {jobs?.map((job) => (
              <tr key={job.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 font-medium text-slate-900">{job.name}</td>
                <td className="px-4 py-3 text-slate-500">{job.address ?? "—"}</td>
                <td className="px-4 py-3 text-slate-500">{job.phases.length}</td>
                <td className="px-4 py-3 text-slate-500">{countByJob[job.id] ?? 0}</td>
                <td className="px-4 py-3">
                  <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${STATUS_STYLE[job.status] ?? ""}`}>
                    {job.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/ops/jobs/${job.id}`} className="text-blue-600 hover:underline">
                    View →
                  </Link>
                </td>
              </tr>
            ))}
            {!jobs?.length && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                  No jobs yet. Create one via POST /api/jobs.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
