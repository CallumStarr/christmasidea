export const APP_ORIGIN = "https://christmasidea.co.uk";
export const NATIVE_ORIGINS = ["capacitor://localhost", "https://localhost"];

export function validVerificationMessage(event, frameWindow) {
  return event.origin === APP_ORIGIN && event.source === frameWindow
    && event.data?.type === "gift-app-verification";
}

export function createAppVerification({ container, siteKey, onToken, onError, onExpire }) {
  const frame = document.createElement("iframe");
  frame.className = "app-verification-frame";
  frame.title = "Gift finder security check";
  frame.referrerPolicy = "strict-origin-when-cross-origin";
  container.append(frame);
  let timer;
  const fail = (message) => {
    clearTimeout(timer);
    container.hidden = true;
    container.classList.remove("turnstile-interactive");
    onError(message);
  };
  window.addEventListener("message", (event) => {
    if (!validVerificationMessage(event, frame.contentWindow)) return;
    const { state, token } = event.data;
    if (state === "token" && typeof token === "string" && token.length > 0 && token.length <= 2048) {
      clearTimeout(timer);
      container.hidden = true;
      container.classList.remove("turnstile-interactive");
      onToken(token);
    } else if (state === "interactive") {
      clearTimeout(timer);
      container.hidden = false;
      container.classList.add("turnstile-interactive");
      frame.classList.add("is-interactive");
    } else if (state === "expired") {
      onExpire();
    } else if (state === "error") {
      fail("The security check couldn't load. Check your connection, then try again.");
    }
  });
  frame.addEventListener("error", () => fail("The security check couldn't connect. Please try again."));
  function reset() {
    clearTimeout(timer);
    container.hidden = false;
    frame.classList.remove("is-interactive");
    const parent = location.protocol === "capacitor:" ? "capacitor://localhost" : location.origin;
    if (!NATIVE_ORIGINS.includes(parent)) {
      fail("This app origin isn't supported by the security check.");
      return;
    }
    const url = new URL("/app-verify", APP_ORIGIN);
    url.searchParams.set("parent", parent);
    url.searchParams.set("sitekey", siteKey);
    url.searchParams.set("attempt", crypto.randomUUID());
    frame.src = url.href;
    timer = setTimeout(() => fail("The security check timed out. Check your connection, then try again."), 25000);
  }
  reset();
  return { reset };
}
