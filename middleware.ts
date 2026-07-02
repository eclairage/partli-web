import { NextRequest, NextResponse } from "next/server";

// Verify a Supabase JWT by calling the /auth/v1/user endpoint.
// This adds ~100-200ms latency per protected request; acceptable for MVP.
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

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ── Ops admin: HTTP Basic Auth ─────────────────────────────────────────────
  if (pathname.startsWith("/ops")) {
    const auth = req.headers.get("authorization") ?? "";
    const [scheme, encoded] = auth.split(" ");
    if (scheme === "Basic" && encoded) {
      const decoded = atob(encoded);
      const [, password] = decoded.split(":");
      if (password === process.env.OPS_PASSWORD) return NextResponse.next();
    }
    return new NextResponse("Unauthorized", {
      status: 401,
      headers: { "WWW-Authenticate": 'Basic realm="Partli Ops"' },
    });
  }

  // ── iOS-facing API routes: Supabase JWT ────────────────────────────────────
  // Protect job listing/detail and scan submission.
  // Leave /api/scans/:id/* open — ops web admin client components call those
  // from the browser without a JWT (the /ops page itself is Basic-Auth gated).
  const isJobsRoute =
    pathname === "/api/jobs" || /^\/api\/jobs\/[^/]+$/.test(pathname);
  const isScanSubmit = pathname === "/api/scans" && req.method === "POST";

  if (isJobsRoute || isScanSubmit) {
    const auth = req.headers.get("authorization") ?? "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : null;
    if (token && (await verifySupabaseJWT(token))) return NextResponse.next();
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/ops/:path*", "/api/:path*"],
};
