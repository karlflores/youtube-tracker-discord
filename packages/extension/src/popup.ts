import { browserApi } from "./browser";

const statusEl = document.querySelector("#status");
const activeEl = document.querySelector("#active");
const statusDotEl = document.querySelector("#status-dot");
const toggleEl = document.querySelector<HTMLInputElement>("#tracking-toggle");

toggleEl?.addEventListener("change", () => {
  void browserApi.runtime.sendMessage({ type: "tracking_set", enabled: toggleEl.checked }, (response: any) => {
    render(response);
  });
});

void browserApi.runtime.sendMessage({ type: "popup_status_request" }, (response: any) => {
  render(response);
});

function render(response: any): void {
  const status = response?.status;
  const active = response?.active;
  const trackingEnabled = response?.trackingEnabled !== false;
  if (toggleEl) {
    toggleEl.checked = trackingEnabled;
  }
  if (statusEl) {
    statusEl.textContent = status?.type === "host_error"
      ? status.message
      : `Discord ${status?.discord ?? "unknown"}`;
  }
  if (statusDotEl) {
    statusDotEl.className = status?.type === "host_error" || status?.discord !== "connected"
      ? "status-dot status-dot--warn"
      : "status-dot status-dot--ok";
  }
  if (activeEl) {
    activeEl.textContent = !trackingEnabled
      ? "Tracking is off"
      : active?.type === "playback_update"
      ? `${active.title} (${Math.floor(active.currentTime)}s)`
      : "No active YouTube playback";
  }
}
