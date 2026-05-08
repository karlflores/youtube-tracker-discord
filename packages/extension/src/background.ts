import { NATIVE_HOST_NAME, validateExtensionMessage, type ExtensionToHostMessage, type HostToExtensionMessage } from "@youtube-discord-presence/shared";
import { browserApi } from "./browser";

type Port = chrome.runtime.Port;
type MessageSender = chrome.runtime.MessageSender;
type SendResponse = (response?: unknown) => void;

interface TabState {
  tabId: number;
  message: ExtensionToHostMessage;
  seenAt: number;
}

let nativePort: Port | undefined;
let status: HostToExtensionMessage = {
  type: "host_status",
  nativeHost: "connected",
  discord: "disconnected",
  updatedAt: Date.now()
};
const tabs = new Map<number, TabState>();
let trackingEnabled = true;

connectNative();
loadTrackingPreference();

browserApi.runtime.onMessage.addListener((raw: unknown, sender: MessageSender, sendResponse: SendResponse) => {
  if (isPopupRequest(raw)) {
    sendResponse({ status, active: trackingEnabled ? getActivePlayback()?.message : undefined, trackingEnabled });
    return true;
  }

  if (isTrackingSetRequest(raw)) {
    void setTrackingEnabled(raw.enabled).then(() => {
      sendResponse({ status, active: trackingEnabled ? getActivePlayback()?.message : undefined, trackingEnabled });
    });
    return true;
  }

  try {
    const message = validateExtensionMessage(withSenderTab(raw, sender.tab?.id));
    if (message.type === "playback_update" && typeof message.tabId === "number") {
      tabs.set(message.tabId, { tabId: message.tabId, message, seenAt: Date.now() });
      if (trackingEnabled) forwardActivePlayback();
    } else if (message.type === "clear_presence" && typeof message.tabId === "number") {
      tabs.delete(message.tabId);
      if (trackingEnabled) forwardActivePlayback();
    }
  } catch (error) {
    console.warn("Ignored invalid content message", error);
  }
  return false;
});

browserApi.tabs.onRemoved.addListener((tabId: number) => {
  tabs.delete(tabId);
  if (trackingEnabled) forwardActivePlayback();
});

browserApi.tabs.onUpdated.addListener((tabId: number, changeInfo: chrome.tabs.TabChangeInfo) => {
  if (changeInfo.url && !changeInfo.url.includes("youtube.com/watch") && !changeInfo.url.includes("youtube.com/shorts")) {
    tabs.delete(tabId);
    if (trackingEnabled) forwardActivePlayback();
  }
});

setInterval(() => {
  const cutoff = Date.now() - 30000;
  for (const [tabId, state] of tabs) {
    if (state.seenAt < cutoff) tabs.delete(tabId);
  }
  if (trackingEnabled) forwardActivePlayback();
}, 15000);

function loadTrackingPreference(): void {
  browserApi.storage.local.get({ trackingEnabled: true }, (items: { trackingEnabled?: unknown }) => {
    trackingEnabled = typeof items.trackingEnabled === "boolean" ? items.trackingEnabled : true;
    if (!trackingEnabled) clearPresence("no_active_playback");
  });
}

async function setTrackingEnabled(enabled: boolean): Promise<void> {
  trackingEnabled = enabled;
  await browserApi.storage.local.set({ trackingEnabled });
  if (trackingEnabled) {
    forwardActivePlayback();
  } else {
    clearPresence("no_active_playback");
  }
}

function connectNative(): void {
  try {
    nativePort = browserApi.runtime.connectNative(NATIVE_HOST_NAME);
    nativePort.onMessage.addListener((message: unknown) => {
      status = message as HostToExtensionMessage;
    });
    nativePort.onDisconnect.addListener(() => {
      nativePort = undefined;
      status = {
        type: "host_error",
        code: "native_disconnected",
        message: browserApi.runtime.lastError?.message ?? "Native host disconnected.",
        updatedAt: Date.now()
      };
      setTimeout(connectNative, 3000);
    });
    nativePort.postMessage({ type: "status_request", updatedAt: Date.now() });
  } catch (error) {
    status = {
      type: "host_error",
      code: "native_unavailable",
      message: error instanceof Error ? error.message : "Native host unavailable.",
      updatedAt: Date.now()
    };
    setTimeout(connectNative, 3000);
  }
}

function forwardActivePlayback(): void {
  if (!trackingEnabled) {
    clearPresence("no_active_playback");
    return;
  }
  const active = getActivePlayback();
  if (active) {
    postToNative(active.message);
  } else {
    clearPresence("no_active_playback");
  }
}

function clearPresence(reason: "no_active_playback"): void {
  postToNative({ type: "clear_presence", reason, updatedAt: Date.now() });
}

function postToNative(message: ExtensionToHostMessage): void {
  if (!nativePort) {
    connectNative();
    return;
  }
  nativePort.postMessage(message);
}

function getActivePlayback(): TabState | undefined {
  return [...tabs.values()].sort((a, b) => b.seenAt - a.seenAt)[0];
}

function isPopupRequest(raw: unknown): raw is { type: "popup_status_request" } {
  return typeof raw === "object" && raw !== null && (raw as { type?: unknown }).type === "popup_status_request";
}

function isTrackingSetRequest(raw: unknown): raw is { type: "tracking_set"; enabled: boolean } {
  return typeof raw === "object"
    && raw !== null
    && (raw as { type?: unknown }).type === "tracking_set"
    && typeof (raw as { enabled?: unknown }).enabled === "boolean";
}

function withSenderTab(raw: unknown, tabId: number | undefined): unknown {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return raw;
  return { ...raw, tabId };
}
