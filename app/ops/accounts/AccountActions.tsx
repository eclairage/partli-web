"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setInstallerRole, removeInstallerRole, removeHomeownerRecord } from "@/lib/ops-actions";

export default function AccountActions({
  userId,
  isInstaller,
  hasHomeowner,
}: {
  userId: string;
  isInstaller: boolean;
  hasHomeowner: boolean;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function run(action: string, fn: () => Promise<{ ok: true } | { error: string }>) {
    setLoading(action);
    setError(null);
    const result = await fn();
    if ("error" in result) setError(result.error);
    else router.refresh();
    setLoading(null);
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {isInstaller ? (
        <button
          onClick={() => run("remove-installer", () => removeInstallerRole(userId))}
          disabled={!!loading}
          className="px-2 py-1 rounded text-xs border border-slate-300 text-slate-500 hover:border-red-300 hover:text-red-600 disabled:opacity-40 transition-colors"
        >
          {loading === "remove-installer" ? "…" : "Remove installer role"}
        </button>
      ) : (
        <button
          onClick={() => run("set-installer", () => setInstallerRole(userId))}
          disabled={!!loading}
          className="px-2 py-1 rounded text-xs bg-partli-primary text-white hover:opacity-90 disabled:opacity-40 transition-opacity"
        >
          {loading === "set-installer" ? "…" : "Set as installer"}
        </button>
      )}

      {hasHomeowner && (
        <button
          onClick={() => run("remove-homeowner", () => removeHomeownerRecord(userId))}
          disabled={!!loading}
          className="px-2 py-1 rounded text-xs border border-slate-300 text-slate-500 hover:border-red-300 hover:text-red-600 disabled:opacity-40 transition-colors"
        >
          {loading === "remove-homeowner" ? "…" : "Unlink homeowner"}
        </button>
      )}

      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}
