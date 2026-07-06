import { supabaseAdmin } from "@/lib/supabase";
import AccountActions from "./AccountActions";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const db = supabaseAdmin();

  const { data: { users }, error } = await db.auth.admin.listUsers({ perPage: 200 });

  // Fetch all homeowner records to join by user_id
  const { data: homeowners } = await db
    .from("homeowners")
    .select("id, name, user_id")
    .not("user_id", "is", null);

  const homeownerByUserId = Object.fromEntries(
    (homeowners ?? []).map((h) => [h.user_id, h])
  );

  const sorted = [...(users ?? [])].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  return (
    <main className="max-w-4xl mx-auto px-6 py-10 w-full space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-partli-ink">Accounts</h1>
        <p className="text-sm text-slate-500 mt-1">
          {sorted.length} user{sorted.length !== 1 ? "s" : ""}
        </p>
      </div>

      {error && (
        <p className="text-sm text-red-600">Failed to load users: {error.message}</p>
      )}

      <div className="rounded-lg border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
            <tr>
              <th className="text-left px-4 py-3">Email</th>
              <th className="text-left px-4 py-3">Role</th>
              <th className="text-left px-4 py-3">Homeowner</th>
              <th className="text-left px-4 py-3">Joined</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {sorted.map((user) => {
              const isInstaller = user.app_metadata?.role === "installer";
              const homeowner = homeownerByUserId[user.id];
              const role = isInstaller ? "installer" : homeowner ? "homeowner" : "new";

              return (
                <tr key={user.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3 font-medium text-partli-ink">
                    {user.email ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      role === "installer"
                        ? "bg-partli-primary/10 text-partli-primary"
                        : role === "homeowner"
                        ? "bg-green-100 text-green-800"
                        : "bg-slate-100 text-slate-500"
                    }`}>
                      {role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">
                    {homeowner?.name ?? "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-400 font-mono text-xs">
                    {new Date(user.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <AccountActions
                      userId={user.id}
                      isInstaller={isInstaller}
                      hasHomeowner={!!homeowner}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </main>
  );
}
