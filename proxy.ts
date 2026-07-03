import { NextRequest, NextResponse } from "next/server";

// Next.js 16: this file must be named proxy.ts and export `proxy` (not `middleware`).

function timingSafeStringEqual(a: string, b: string): boolean {
  const aLen = a.length;
  const bLen = b.length;
  let mismatch = aLen !== bLen ? 1 : 0;
  const len = Math.min(aLen, bLen);
  for (let i = 0; i < len; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

async function verifySupabaseJWT(token: string): Promise<boolean> {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/user`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        },
        signal: AbortSignal.timeout(5000),
      }
    );
    return res.ok;
  } catch {
    return false;
  }
}

export async function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const opsPassword = process.env.OPS_PASSWORD ?? "";

  // ── Ops admin: HTTP Basic Auth ─────────────────────────────────────────────
  if (pathname.startsWith("/ops")) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth.startsWith("Basic ")) {
      const decoded = atob(auth.slice(6));
      const colonIdx = decoded.indexOf(":");
      const password = colonIdx >= 0 ? decoded.slice(colonIdx + 1) : "";
      if (opsPassword && timingSafeStringEqual(password, opsPassword)) {
        return NextResponse.next();
      }
    }
    return new NextResponse("Unauthorized", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="Partli Ops"' },
    });
  }

  // ── iOS-facing API routes: Supabase JWT ────────────────────────────────────
  const isJobsRoute =
    pathname === "/api/jobs" || /^\/api\/jobs\/[^/]+$/.test(pathname);
  const isScanSubmit = pathname === "/api/scans" && req.method === "POST";
  const isMeRoute = pathname === "/api/me";
  const isHomeownersRoute = pathname === "/api/homeowners";

  if (isJobsRoute || isScanSubmit || isMeRoute || isHomeownersRoute) {
    const auth = req.headers.get("authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : null;
    if (token && (await verifySupabaseJWT(token))) return NextResponse.next();
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  // ── Ops API routes: Bearer OPS_PASSWORD ───────────────────────────────────
  // These are called server-side via server actions, not from the browser.
  // This guard is defense in depth against direct HTTP access.
  const isOpsApiRoute = /^\/api\/scans\/[^/]+(\/annotations(\/[^/]+)?|\/drawings|\/review)?$/.test(pathname);

  if (isOpsApiRoute) {
    const auth = req.headers.get("authorization") ?? "";
    if (auth.startsWith("Bearer ")) {
      const token = auth.slice(7).trim();
      if (opsPassword && timingSafeStringEqual(token, opsPassword)) {
        return NextResponse.next();
      }
      // Also accept a valid Supabase JWT for future mobile use
      if (await verifySupabaseJWT(token)) return NextResponse.next();
    }
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/ops/:path*", "/api/:path*"],
};
