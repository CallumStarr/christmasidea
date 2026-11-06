import { NATIVE_ORIGINS } from "./app-verification.js";

const params = new URLSearchParams(location.search);
const parentOrigin = params.get("parent");
const sitekey = params.get("sitekey");
if (NATIVE_ORIGINS.includes(parentOrigin) && /^[a-zA-Z0-9_-]{10,100}$/.test(sitekey || "") && parent !== window) {
  const send = (state, token) => parent.postMessage({ type: "gift-app-verification", state, token }, parentOrigin);
  window.onAppCheckReady = () => {
    let widget;
    try {
      widget = window.turnstile.render("#check", {
        sitekey, appearance: "interaction-only", size: "flexible",
        callback: (token) => send("token", token),
        "before-interactive-callback": () => send("interactive"),
        "expired-callback": () => {
          send("expired");
          window.turnstile.reset(widget);
        },
        "error-callback": () => send("error"),
        "timeout-callback": () => send("error"),
      });
    } catch { send("error"); }
  };
  const script = document.createElement("script");
  script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onAppCheckReady&render=explicit";
  script.addEventListener("error", () => send("error"));
  document.head.append(script);
} else {
  document.querySelector("#check").textContent = "Open the gift finder in the Santa's Helper app.";
}
