import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import PortalApp from "./portal/PortalApp.jsx";
import "./index.css";

// Chrome/Android fire this once, early, when the page becomes installable — capture it here
// (before any component mounts) so the Download view can trigger the native install prompt
// later, whenever the user actually clicks the install button.
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  window.__deferredPwaPrompt = e;
});

// Once a new service worker takes over an already-open tab, reload once so it actually picks
// up the new build instead of continuing to run the old JS that's already in memory.
if ("serviceWorker" in navigator) {
  let reloadedForUpdate = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloadedForUpdate) return;
    reloadedForUpdate = true;
    window.location.reload();
  });
}

const isPortal = window.location.pathname.startsWith("/portal");

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {isPortal ? <PortalApp /> : <App />}
  </React.StrictMode>
);
