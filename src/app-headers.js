export function appFrameHeaders(pathname, headers) {
  if (!["/app-verify", "/app-verify.html"].includes(pathname)) return headers;
  const result = { ...headers };
  delete result["X-Frame-Options"];
  result["Content-Security-Policy"] = result["Content-Security-Policy"]
    .replace("frame-ancestors 'none'", "frame-ancestors capacitor://localhost https://localhost");
  result["Cache-Control"] = "no-store";
  return result;
}
