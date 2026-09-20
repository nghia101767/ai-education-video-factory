import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { storyboardReadiness, STORYBOARD_NOT_READY_TEXT, STORYBOARD_READY_TEXT } from "../lib/storyboard-readiness.ts";

test("Step 9 readiness derives from actual Script status", () => {
  assert.deepEqual(storyboardReadiness("approved"), { ready: true, text: STORYBOARD_READY_TEXT });
  for (const status of ["draft", "generated", "review", "rejected", "archived", ""]) assert.deepEqual(storyboardReadiness(status), { ready: false, text: STORYBOARD_NOT_READY_TEXT });
  assert.equal(STORYBOARD_READY_TEXT, "✨ Sẵn sàng tạo Storyboard");
  assert.equal(STORYBOARD_NOT_READY_TEXT, "Chưa sẵn sàng — cần duyệt kịch bản.");
});

test("Step 9 service is isolated from Video persistence", async () => {
  const source = await readFile(new URL("../lib/storyboard-generation-service.ts", import.meta.url), "utf8");
  assert.doesNotMatch(source, /\bVideo\b|ensureVideo|videoId/);
  assert.match(source, /Storyboard\.create/);
  assert.match(source, /Scene\.insertMany/);
});

test("Storyboard Studio exposes schema-compatible asset requirement editing", async () => {
  const source = await readFile(new URL("../components/storyboard-editor.tsx", import.meta.url), "utf8");
  for (const value of ["image", "illustration", "diagram", "text", "animation", "video", "background", "subject", "overlay", "supporting"]) assert.match(source, new RegExp(`\\b${value}\\b`));
  assert.match(source, /updateRequirement/); assert.match(source, /addRequirement/); assert.match(source, /removeRequirement/); assert.match(source, /required: e\.target\.checked/);
});
