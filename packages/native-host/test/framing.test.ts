import { PassThrough } from "node:stream";
import { describe, expect, it } from "vitest";
import { NativeMessageReader, writeNativeMessage } from "../src/framing.js";

describe("native messaging framing", () => {
  it("reads length-prefixed messages", async () => {
    const input = new PassThrough();
    const reader = new NativeMessageReader(input);
    const message = await new Promise((resolve) => {
      reader.once("message", resolve);
      writeNativeMessage(input, { type: "status_request", updatedAt: 1 });
    });
    expect(message).toEqual({ type: "status_request", updatedAt: 1 });
  });

  it("writes length-prefixed messages", () => {
    const output = new PassThrough();
    const chunks: Buffer[] = [];
    output.on("data", (chunk) => chunks.push(chunk));
    writeNativeMessage(output, { ok: true });
    const frame = Buffer.concat(chunks);
    const length = frame.readUInt32LE(0);
    expect(JSON.parse(frame.subarray(4, 4 + length).toString("utf8"))).toEqual({ ok: true });
  });
});
