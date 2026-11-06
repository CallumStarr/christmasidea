import { App } from "@capacitor/app";
import { Browser } from "@capacitor/browser";
import { Clipboard } from "@capacitor/clipboard";
import { Haptics, ImpactStyle } from "@capacitor/haptics";
import { Share } from "@capacitor/share";
import { SplashScreen } from "@capacitor/splash-screen";
import { StatusBar, Style } from "@capacitor/status-bar";

function notify(message, error) {
  console.warn(message, error);
  const dialog = [...document.querySelectorAll("dialog[open]")].at(-1);
  let output;
  if (dialog) {
    output = dialog.querySelector(".native-error");
    if (!output) {
      output = document.createElement("p");
      output.className = "native-error status err";
      output.setAttribute("role", "alert");
      dialog.prepend(output);
    }
  } else {
    output = document.querySelector(document.body.classList.contains("swipe-mode") ? "#feedback" : "#monetization-status");
  }
  if (output) output.textContent = message;
}
window.GIFT_NATIVE = {
  async share(options) {
    try { return await Share.share(options); }
    catch (error) {
      if (error?.message === "Share canceled") throw new DOMException("Sharing was cancelled.", "AbortError");
      throw error;
    }
  },
  copy: (text) => Clipboard.write({ string: text }),
  async haptic() {
    try { await Haptics.impact({ style: ImpactStyle.Light }); }
    catch (error) { console.warn("Haptic feedback is unavailable on this device.", error); }
  },
};
document.addEventListener("submit", () => {
  const active = document.activeElement;
  if (active?.matches("input,textarea")) active.blur();
}, true);

document.addEventListener("click", (event) => {
  const link = event.target.closest("a[href]");
  if (!link || event.defaultPrevented) return;
  const url = new URL(link.href, location.href);
  if (url.protocol !== "https:" && url.protocol !== "http:") return;
  if (url.origin === location.origin && url.hash && url.pathname === location.pathname) return;
  event.preventDefault();
  const destination = url.origin === location.origin
    ? new URL(`${url.pathname}${url.search}${url.hash}`, "https://christmasidea.co.uk").href : url.href;
  Browser.open({ url: destination, toolbarColor: "#fbf7f0", presentationStyle: "pageSheet" })
    .catch((error) => notify("Couldn't open this page. Check your connection and try again.", error));
});

App.addListener("backButton", () => {
  const dialogs = [...document.querySelectorAll("dialog[open]")];
  if (dialogs.length) { dialogs.at(-1).close(); return; }
  if (document.body.classList.contains("swipe-mode")) {
    document.querySelector("#deck-edit").click();
    return;
  }
  const previous = document.querySelector("#app-step-back");
  if (previous && !previous.disabled && !previous.closest("[hidden]")) { previous.click(); return; }
  void App.minimizeApp().catch((error) => notify("Couldn't minimise the app.", error));
}).catch((error) => notify("Android back navigation couldn't be initialised.", error));

StatusBar.setStyle({ style: Style.Light }).catch((error) => console.warn("Status bar styling is unavailable.", error));
SplashScreen.hide().catch((error) => console.warn("The splash screen couldn't be hidden.", error));
