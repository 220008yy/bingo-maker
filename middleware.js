// middleware.js
export const config = {
  matcher: ["/((?!_next|assets|favicon.ico|robots.txt|manifest.webmanifest|img).*)"],
};

export default function middleware(req) {
  const BASIC_USER = process.env.BASIC_USER || "bingo";
  const BASIC_PASS = process.env.BASIC_PASS || "letmein";

  const auth = req.headers.get("authorization");
  if (auth?.startsWith("Basic ")) {
    const [, b64] = auth.split(" ");
    const [user, pass] = atob(b64).split(":");
    if (user === BASIC_USER && pass === BASIC_PASS) return;
  }
  return new Response("Authorization Required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="bingo"' },
  });
}
