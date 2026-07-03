import { supabaseAdmin } from "@/lib/supabase";
import type { Scan, RoomData, IntakeData, Annotation } from "@/lib/supabase";
import { computeDrawings } from "@/lib/roomplan";
import Link from "next/link";
import { notFound } from "next/navigation";
import ReviewForm from "./ReviewForm";
import DrawingsPanel from "./DrawingsPanel";

export const dynamic = "force-dynamic";

function ftIn(ft: number) {
  const feet = Math.floor(ft);
  const inches = Math.round((ft - feet) * 12);
  return inches === 0 ? `${feet}'` : `${feet}' ${inches}"`;
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    pending: "bg-amber-100 text-amber-800",
    approved: "bg-green-100 text-green-800",
    flagged: "bg-red-100 text-red-800",
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${styles[status] ?? ""}`}>
      {status}
    </span>
  );
}

export default async function ScanDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = supabaseAdmin();

  const { data: scan } = await db
    .from("scans")
    .select("*, homeowners(*)")
    .eq("id", id)
    .single<Scan>();

  if (!scan) notFound();

  const hw = scan.homeowners as unknown as {
    name: string;
    phone: string;
    email: string | null;
    address: string | null;
  } | null;

  const room = scan.room_data as RoomData | null;
  const pathRoom = scan.path_room_data as RoomData | null;
  const intake = scan.intake_data as IntakeData | null;
  const initialAnnotations = (scan.annotations as Annotation[]) ?? [];
  const initialDrawings =
    room && Array.isArray(room.walls?.[0]?.transform)
      ? computeDrawings(room)
      : null;

  return (
    <main className="max-w-4xl mx-auto px-6 py-10 space-y-8 w-full">
      <div className="flex items-center gap-3">
        <Link href="/ops/scans" className="text-sm text-slate-500 hover:text-partli-ink">
          ← All scans
        </Link>
        <StatusBadge status={scan.status} />
        {scan.reviewed_at && (
          <span className="text-xs text-slate-400">
            Reviewed {new Date(scan.reviewed_at).toLocaleDateString()} by {scan.reviewed_by}
          </span>
        )}
      </div>

      {/* Homeowner */}
      <section className="rounded-lg border border-slate-200 p-5">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">
          Homeowner
        </h2>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div><span className="text-slate-500">Name</span><p className="font-medium text-partli-ink">{hw?.name ?? "—"}</p></div>
          <div><span className="text-slate-500">Phone</span><p className="font-medium text-partli-ink">{hw?.phone ?? "—"}</p></div>
          <div><span className="text-slate-500">Email</span><p className="font-medium text-partli-ink">{hw?.email ?? "—"}</p></div>
          <div><span className="text-slate-500">Address</span><p className="font-medium text-partli-ink">{hw?.address ?? "—"}</p></div>
        </div>
      </section>

      {/* Room Data */}
      {room && (
        <section className="rounded-lg border border-slate-200 p-5 space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Room Data
          </h2>
          <div className="grid grid-cols-4 gap-3 text-center">
            {[
              ["Floor area", `${room.floor_area_sqft.toFixed(1)} sq ft`],
              ["Walls", room.wall_count],
              ["Doors", room.doors.length],
              ["Windows", room.windows.length],
            ].map(([label, value]) => (
              <div key={label} className="rounded-md bg-slate-50 p-3">
                <div className="text-xl font-bold font-mono text-partli-ink">{value}</div>
                <div className="text-xs text-slate-500 mt-0.5">{label}</div>
              </div>
            ))}
          </div>

          {room.walls.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-slate-700 mb-2">Walls</h3>
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-slate-500">
                  <tr>
                    <th className="pb-1">#</th>
                    <th className="pb-1">Width</th>
                    <th className="pb-1">Height</th>
                    <th className="pb-1">Confidence</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono">
                  {room.walls.map((w, i) => (
                    <tr key={i}>
                      <td className="py-1 text-slate-400">{i + 1}</td>
                      <td className="py-1">{ftIn(w.width_ft)}</td>
                      <td className="py-1">{ftIn(w.height_ft)}</td>
                      <td className="py-1 capitalize">{w.confidence}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {room.objects.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-slate-700 mb-2">Detected Objects</h3>
              <div className="flex flex-wrap gap-2">
                {room.objects.map((o, i) => (
                  <span key={i} className="px-2 py-0.5 rounded bg-slate-100 text-xs capitalize">
                    {o.category}
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Drawings — only rendered when scan has transform data (Path A+) */}
      {initialDrawings && (
        <DrawingsPanel
          scanId={id}
          initialDrawings={initialDrawings}
          initialAnnotations={initialAnnotations}
        />
      )}

      {/* Photos */}
      {scan.photo_urls && scan.photo_urls.length > 0 && (
        <section className="rounded-lg border border-slate-200 p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-3">
            Fixture Photos ({scan.photo_urls.length})
          </h2>
          <div className="grid grid-cols-3 gap-3">
            {scan.photo_urls.map((url, i) => (
              <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={url}
                  alt={`Fixture photo ${i + 1}`}
                  className="w-full aspect-square object-cover rounded-lg hover:opacity-90 transition-opacity"
                />
              </a>
            ))}
          </div>
        </section>
      )}

      {/* USDZ */}
      {scan.usdz_url && (
        <section className="rounded-lg border border-slate-200 p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-2">
            3D Model
          </h2>
          <a
            href={scan.usdz_url}
            download
            className="inline-flex items-center gap-2 text-sm text-partli-accent hover:underline"
          >
            ↓ Download USDZ (opens in Quick Look on Mac / iOS)
          </a>
        </section>
      )}

      {/* Intake questionnaire */}
      {intake && (
        <section className="rounded-lg border border-slate-200 p-5 space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Pre-Install Intake
          </h2>
          <div className="grid grid-cols-2 gap-x-8 gap-y-3 text-sm">
            {[
              ["Toilet rough-in", intake.toilet_rough_in_inches != null ? `${intake.toilet_rough_in_inches}"` : null],
              ["Vanity opening width", intake.vanity_opening_width_inches != null ? `${intake.vanity_opening_width_inches}"` : null],
              ["Wall material", intake.wall_material],
              ["Shutoff valves accessible", intake.shutoff_valves],
              ["Tub/shower drain", intake.tub_shower_drain],
              ["GFCI outlet", intake.gfci_outlet],
              ["Exhaust fan", intake.exhaust_fan],
            ].map(([label, value]) => (
              <div key={label}>
                <span className="text-slate-500 text-xs">{label}</span>
                <p className="font-medium text-partli-ink capitalize">{value ?? "—"}</p>
              </div>
            ))}
          </div>
          {intake.access_notes && (
            <div>
              <span className="text-slate-500 text-xs">Access notes</span>
              <p className="text-sm mt-0.5">{intake.access_notes}</p>
            </div>
          )}
          {intake.intake_photo_urls?.length > 0 && (
            <div>
              <p className="text-xs text-slate-500 mb-2">Intake photos ({intake.intake_photo_urls.length})</p>
              <div className="grid grid-cols-4 gap-2">
                {intake.intake_photo_urls.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={`Intake photo ${i + 1}`}
                      className="w-full aspect-square object-cover rounded-lg hover:opacity-90 transition-opacity" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Path scan */}
      {(pathRoom || scan.path_usdz_url) && (
        <section className="rounded-lg border border-slate-200 p-5 space-y-4">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400">
            Path Scan — Bathroom to Exterior Door
          </h2>
          {pathRoom && (
            <div className="grid grid-cols-4 gap-3 text-center">
              {[
                ["Path length", `${pathRoom.floor_area_sqft.toFixed(0)} sq ft`],
                ["Sections", pathRoom.wall_count],
                ["Doors", pathRoom.doors.length],
                ["Openings", pathRoom.openings.length],
              ].map(([label, value]) => (
                <div key={label} className="rounded-md bg-slate-50 p-2">
                  <div className="text-lg font-bold font-mono text-partli-ink">{value}</div>
                  <div className="text-xs text-slate-500">{label}</div>
                </div>
              ))}
            </div>
          )}
          {pathRoom?.doors && pathRoom.doors.length > 0 && (
            <div>
              <p className="text-xs text-slate-500 mb-1">Door clearances along path</p>
              <div className="flex flex-wrap gap-2">
                {pathRoom.doors.map((d, i) => (
                  <span key={i} className="px-2 py-0.5 rounded bg-slate-100 text-xs font-mono">
                    Door {i + 1}: {ftIn(d.width_ft)} wide
                  </span>
                ))}
              </div>
            </div>
          )}
          {scan.path_usdz_url && (
            <a href={scan.path_usdz_url} download
              className="inline-flex items-center gap-2 text-sm text-partli-accent hover:underline">
              ↓ Download path USDZ
            </a>
          )}
        </section>
      )}

      {/* Ops note (if already reviewed) */}
      {scan.ops_note && (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-amber-600 mb-1">
            Ops Note
          </h2>
          <p className="text-sm text-amber-900">{scan.ops_note}</p>
        </section>
      )}

      {/* Review form — only show if not yet reviewed */}
      {scan.status === "pending" && (
        <section className="rounded-lg border border-slate-200 p-5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-400 mb-4">
            Review
          </h2>
          <ReviewForm scanId={scan.id} />
        </section>
      )}
    </main>
  );
}
