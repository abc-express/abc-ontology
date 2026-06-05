import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { writeSseEvent } from "./sse.js";

describe("sse", () => {
  it("writeSseEvent formats event and JSON data", () => {
    const chunks: string[] = [];
    const res = {
      write(line: string) {
        chunks.push(line);
      },
    };
    writeSseEvent(res as never, "token", { text: "hi" });
    assert.equal(chunks.join(""), 'event: token\ndata: {"text":"hi"}\n\n');
  });
});
