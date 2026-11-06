/**
 * Credential-bearing upstream request that never follows redirects.
 * Workers reject redirect: "error", so use "manual" and fail on any redirect-shaped response.
 * The TypeError mirrors a fetch network failure, so callers keep their existing error mapping.
 */
export async function fetchWithoutRedirect(fetchImpl, url, init) {
  const response = await fetchImpl(url, { ...init, redirect: "manual" });
  if (response.type === "opaqueredirect" || (response.status >= 300 && response.status < 400)) {
    try {
      await response.body?.cancel();
    } catch {
      // The redirect is already rejected; a failed body cancel must not mask that.
    }
    const error = new TypeError("Upstream redirect rejected");
    error.code = "upstream_redirect";
    throw error;
  }
  return response;
}
