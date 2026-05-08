import { describe, expect, it, vi } from "vitest";
import { mapPlaybackToActivity } from "../src/discord.js";

describe("mapPlaybackToActivity", () => {
  it("maps a regular YouTube video to watching activity", () => {
    vi.setSystemTime(new Date("2026-05-08T00:00:00.000Z"));
    const activity = mapPlaybackToActivity({
      type: "playback_update",
      source: "youtube",
      videoId: "abc123",
      url: "https://www.youtube.com/watch?v=abc123",
      title: "A video",
      channel: "A channel",
      channelAvatarUrl: "https://yt3.ggpht.com/channel-avatar=s88-c-k-c0x00ffffff-no-rj",
      currentTime: 30,
      duration: 90,
      updatedAt: Date.now()
    });
    expect(activity.type).toBe(3);
    expect(activity.name).toBe("A channel");
    expect(activity.details).toBe("A video");
    expect(activity.state).toBe("A channel");
    expect(activity.details_url).toBe("https://www.youtube.com/watch?v=abc123");
    expect(activity.state_url).toBe("https://www.youtube.com/watch?v=abc123");
    expect(activity.assets?.large_image).toBe("https://yt3.ggpht.com/channel-avatar=s88-c-k-c0x00ffffff-no-rj");
    expect(activity.assets?.large_text).toBe("A channel");
    expect(activity.timestamps?.end).toBeGreaterThan(activity.timestamps?.start ?? 0);
    vi.useRealTimers();
  });

  it("does not set an end timestamp for live videos", () => {
    const activity = mapPlaybackToActivity({
      type: "playback_update",
      source: "youtube",
      videoId: "live",
      url: "https://www.youtube.com/watch?v=live",
      title: "Live",
      currentTime: 10,
      isLive: true,
      updatedAt: Date.now()
    });
    expect(activity.timestamps?.end).toBeUndefined();
  });
});
