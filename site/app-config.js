(() => {
  const native = document.documentElement.hasAttribute("data-native-app");
  const preview = new URLSearchParams(location.search).get("app") === "1";
  window.GIFT_APP_NATIVE = native;
  if (native || preview) document.documentElement.classList.add("gift-app");
  window.GIFT_APP_API_BASE = native ? "https://christmasidea.co.uk" : "";
})();
