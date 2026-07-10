"use client";

import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};
const getArSupport = () => document.createElement("a").relList.supports("ar");
const getServerArSupport = () => false;

export default function UsdzViewer({
  usdzUrl,
  posterUrl,
}: {
  usdzUrl: string;
  posterUrl?: string | null;
}) {
  const arSupported = useSyncExternalStore(noopSubscribe, getArSupport, getServerArSupport);

  if (arSupported) {
    return (
      <a
        rel="ar"
        href={usdzUrl}
        className="inline-flex items-center gap-2 text-sm text-partli-accent hover:underline"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={posterUrl ?? "/icons/3d-placeholder.svg"}
          alt=""
          className="w-10 h-10 rounded object-cover"
        />
        View in AR (Quick Look) ↗
      </a>
    );
  }

  return (
    <div className="space-y-1">
      <a
        href={usdzUrl}
        download
        className="inline-flex items-center gap-2 text-sm text-partli-accent hover:underline"
      >
        ↓ Download USDZ
      </a>
      <p className="text-xs text-slate-400">
        3D AR preview is only available in Safari on Mac/iOS — download to inspect the mesh in
        another USDZ-capable app.
      </p>
    </div>
  );
}
