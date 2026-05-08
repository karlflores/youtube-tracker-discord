import { browserApi } from "./browser";

const statusEl = document.querySelector("#status");
const activeEl = document.querySelector("#active");

void browserApi.runtime.sendMessage({ type: "popup_status_request" }, (response: any) => {
  const status = response?.status;
  const active = response?.active;
  if (statusEl) {
    statusEl.textContent = status?.type === "host_error"
      ? `Native host error: ${status.message}`
      : `Discord: ${status?.discord ?? "unknown"}`;
  }
  if (activeEl) {
    activeEl.textContent = active?.type === "playback_update"
      ? `${active.title} (${Math.floor(active.currentTime)}s)`
      : "No active YouTube playback";
  }
});
