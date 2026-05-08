import { describe, expect, it } from "vitest";
import { validateExtensionMessage } from "../src/index.js";

describe("validateExtensionMessage", () => {
  it("accepts a valid playback update", () => {
    expect(validateExtensionMessage({
      type: "playback_update",
      source: "youtube",
      videoId: "abc123",
      url: "https://www.youtube.com/watch?v=abc123",
      title: "A video",
      channelAvatarUrl: "https://yt3.ggpht.com/avatar=s88-c-k-c0x00ffffff-no-rj",
      currentTime: 12,
      duration: 120,
      updatedAt: 1
    })).toMatchObject({
      type: "playback_update",
      videoId: "abc123",
      channelAvatarUrl: "https://yt3.ggpht.com/avatar=s88-c-k-c0x00ffffff-no-rj"
    });
  });

  it("accepts clear messages", () => {
    expect(validateExtensionMessage({ type: "clear_presence", reason: "paused", updatedAt: 2 })).toEqual({
      type: "clear_presence",
      reason: "paused",
      updatedAt: 2
    });
  });

  it("rejects non-youtube URLs", () => {
    expect(() => validateExtensionMessage({
      type: "playback_update",
      source: "youtube",
      videoId: "abc123",
      url: "https://example.com/watch?v=abc123",
      title: "A video",
      currentTime: 12,
      updatedAt: 1
    })).toThrow(/YouTube/);
  });

  it("rejects unknown message types", () => {
    expect(() => validateExtensionMessage({ type: "unknown", updatedAt: 1 })).toThrow(/Unknown/);
  });
});
