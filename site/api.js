const NO_IDEAS = () => ({ ideas: [], source: "none", productDiscoveryEnabled: false });

function failure(notice, { error = true } = {}) {
  return { ...NO_IDEAS(), notice, error };
}

function requestError(status, data) {
  if (status === 400 && typeof data?.error === "string" && data.error.length <= 180) return data.error;
  if (status === 403 && data?.retryTurnstile === true) {
    return "The security check needs refreshing. Please wait for it to reload, then try again.";
  }
  if (status === 403) return "Please complete the security check and try again.";
  if (status === 413) return "That description is too long. Shorten it and try again.";
  if (status === 429) return "Too many searches just now. Wait a moment, then try again.";
  return "Gift suggestions are temporarily unavailable. Your description is still here; please try again.";
}

export async function fetchIdeas(input, {
  fetchImpl = fetch,
  enabled = true,
  turnstileToken = "",
  signal,
} = {}) {
  if (!enabled) return failure("Gift suggestions are available from the Santa's Helper website.");

  let response;
  try {
    response = await fetchImpl("/api/ideas", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...input, turnstileToken }),
      signal,
    });
  } catch {
    if (signal?.aborted) {
      const cancelled = signal.reason === "cancelled";
      return failure(
        cancelled
          ? "Search cancelled. Your description is still here."
          : "This search is taking longer than expected. Your description is still here; please try again.",
        { error: !cancelled },
      );
    }
    return failure("The recommendation service didn't respond. Your description is still here; please try again.");
  }

  let data;
  try {
    data = await response.json();
  } catch {
    return failure("We couldn't read the suggestions from the service. Your description is still here; please try again.");
  }

  if (Array.isArray(data?.ideas) && data.fallback === true) {
    return {
      ideas: data.ideas,
      source: "catalogue",
      productDiscoveryEnabled: data.product_discovery_enabled === true,
      recipient: data.recipient,
      notice: data.ideas.length ? data.error || "" : data.note || data.error || "We couldn't find suitable ideas this time. Try adding a little more detail.",
      error: false,
    };
  }

  if (response.ok && Array.isArray(data?.ideas) && data.ideas.length) {
    return {
      ideas: data.ideas,
      source: typeof data.source === "string" ? data.source : "ai",
      recipientSummary: typeof data.recipient_summary === "string" ? data.recipient_summary : "",
      recipient: data.recipient,
      productDiscoveryEnabled: data.product_discovery_enabled === true,
      error: false,
    };
  }

  if (response.ok) {
    return {
      ...NO_IDEAS(),
      notice: typeof data?.note === "string" && data.note
        ? data.note
        : "We couldn't find enough suitable ideas. Try adding detail or adjusting the budget.",
      error: false,
    };
  }

  return {
    ...failure(requestError(response.status, data)),
    retryTurnstile: response.status === 403 && data?.retryTurnstile === true,
  };
}

export async function fetchProducts(ideas, { fetchImpl = fetch, enabled = true } = {}) {
  if (!enabled || !ideas.length) return { products: [], unavailable: false };
  try {
    const response = await fetchImpl("/api/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ideas }),
    });
    if (!response.ok) return { products: [], unavailable: true };
    const data = await response.json();
    return Array.isArray(data?.products)
      ? {
        products: data.products,
        ...(Array.isArray(data.offers) ? { offers: data.offers } : {}),
        unavailable: data.unavailable === true,
        limited: data.limited === true,
      }
      : { products: [], unavailable: true };
  } catch {
    return { products: [], unavailable: true };
  }
}

export async function sendFeedback(body, { fetchImpl = fetch, enabled = true } = {}) {
  if (!enabled) return false;
  try {
    const response = await fetchImpl("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true,
    });
    if (!response.ok) return false;
    const data = await response.json();
    return data?.recorded === true;
  } catch {
    return false;
  }
}
