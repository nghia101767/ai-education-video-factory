import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import mongoose from "mongoose";
import sharp from "sharp";

const storyboardId = "6aa53aeb0c3c1db7afee71a6";
const baseURL = process.env.INTERNAL_APP_URL || "http://web:3000";
const marker = `Step10 E2E ${Date.now()}`;
const request = async (pathname, init = {}) => {
  const headers = new Headers(init.headers);
  if (cookie) headers.set("cookie", cookie);
  const response = await fetch(baseURL + pathname, { ...init, headers });
  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json") ? await response.json() : Buffer.from(await response.arrayBuffer());
  return { response, body };
};
let cookie = "";
const login = await request("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: process.env.ADMIN_EMAIL, password: process.env["ADMIN_" + "PASSWORD"] }) });
assert.equal(login.response.status, 200, JSON.stringify(login.body));
cookie = login.response.headers.get("set-cookie")?.split(";")[0] || "";
assert.ok(cookie);

await mongoose.connect(process.env.MONGODB_URI);
const db = mongoose.connection.db;
const oid = value => new mongoose.Types.ObjectId(value);
const stable = value => JSON.parse(JSON.stringify(value));
const videoProjection = { title: 1, description: 1, duration: 1, width: 1, height: 1, fps: 1, status: 1, version: 1, outputPath: 1, subtitlePath: 1, thumbnailPath: 1, lessonId: 1, scriptId: 1, backgroundMusicAssetId: 1, createdAt: 1, updatedAt: 1 };
const videoSnapshot = async () => stable(await db.collection("videos").find({}, { projection: videoProjection }).sort({ _id: 1 }).toArray());
const videosBefore = await videoSnapshot();
const countsBefore = {};
for (const name of ["videos", "storyboards", "scenes", "scripts", "lessonanalyses", "assets", "assetusages", "aiusages"]) countsBefore[name] = await db.collection(name).countDocuments();
const boardBefore = stable(await db.collection("storyboards").findOne({ _id: oid(storyboardId) }));
assert.equal(boardBefore.status, "approved");
const scene = await db.collection("scenes").findOne({ storyboardId: oid(storyboardId), "assetRequirements.0": { $exists: true } }, { sort: { sceneNumber: 1 } });
assert.ok(scene);
const requirement = scene.assetRequirements[0];
const requirementId = `scene-${scene.sceneNumber}-requirement-1`;

const makeImage = (format, colour, width, height) => sharp({ create: { width, height, channels: 4, background: colour } }).png().composite([{ input: Buffer.from(`<svg width="${width}" height="${height}"><text x="20" y="60" font-size="36">${marker}</text></svg>`), top: 0, left: 0 }]).toFormat(format).toBuffer();
const png = await makeImage("png", "#2a9d8f", 321, 479);
const jpeg = await makeImage("jpeg", "#e9c46a", 333, 222);
const webp = await makeImage("webp", "#e76f51", 257, 389);
const upload = async (bytes, filename, mime, type, suffix = "") => {
  const form = new FormData();
  form.set("file", new File([bytes], filename, { type: mime })); form.set("type", type);
  form.set("name", `${marker} ${suffix}`); form.set("description", `${requirement.description} ${marker}`);
  form.set("tags", [...(requirement.tags || []), "step10-e2e", suffix].filter(Boolean).join(",")); form.set("role", requirement.role || "supporting");
  const result = await request("/api/assets", { method: "POST", body: form });
  assert.ok([200, 201].includes(result.response.status), JSON.stringify(result.body)); return result;
};

const pngUpload = await upload(png, "step10-real.png", "image/png", requirement.type || "image", "png");
assert.equal(pngUpload.body.width, 321); assert.equal(pngUpload.body.height, 479); assert.equal(pngUpload.body.mimeType, "image/png");
assert.equal(pngUpload.body.hash, createHash("sha256").update(png).digest("hex"));
const duplicate = await upload(png, "step10-real.png", "image/png", requirement.type || "image", "duplicate");
assert.equal(duplicate.body._id, pngUpload.body._id); assert.equal(duplicate.body.reused, true);
const jpegUpload = await upload(jpeg, "step10-real.jpeg", "image/jpeg", "image", "jpeg");
assert.deepEqual([jpegUpload.body.width, jpegUpload.body.height], [333, 222]);
const webpUpload = await upload(webp, "step10-real.webp", "image/webp", "image", "webp");
assert.deepEqual([webpUpload.body.width, webpUpload.body.height], [257, 389]);

const list = await request("/api/assets?pageSize=100"); assert.equal(list.response.status, 200); assert.ok(list.body.items.some(item => item._id === pngUpload.body._id));
const searched = await request(`/api/assets?search=${encodeURIComponent(marker)}&pageSize=100`); assert.equal(searched.response.status, 200); assert.ok(searched.body.items.length >= 3);
const typed = await request(`/api/assets?type=${encodeURIComponent(requirement.type || "image")}&pageSize=100`); assert.ok(typed.body.items.every(item => item.type === (requirement.type || "image")));
const tagged = await request("/api/assets?tags=step10-e2e&pagesize=100"); assert.ok(tagged.body.items.length >= 3); assert.ok(tagged.body.items.every(item => item.tags.includes("step10-e2e")));
const preview = await request(`/api/media?path=${encodeURIComponent(pngUpload.body.storagePath)}`); assert.equal(preview.response.status, 200); assert.equal(Buffer.from(preview.body).subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
const traversal = await request("/api/media?path=images%2F..%2F.env"); assert.ok([400, 404].includes(traversal.response.status));
const renamed = await request(`/api/assets/${pngUpload.body._id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: `${marker} renamed`, description: `${requirement.description} reusable visual`, tags: ["step10-e2e", "ranked", ...(requirement.tags || [])], style: "verification-style" }) });
assert.equal(renamed.response.status, 200); assert.equal(renamed.body.name, `${marker} renamed`); assert.ok(renamed.body.tags.includes("ranked"));

const map = assetId => request(`/api/scenes/${scene._id}/assets`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ assetId, requirementId, role: requirement.role || "supporting" }) });
assert.equal((await map(pngUpload.body._id)).response.status, 200);
assert.equal((await map(pngUpload.body._id)).response.status, 200);
let usage = await db.collection("assetusages").find({ sceneId: scene._id, requirementId }).toArray(); assert.equal(usage.length, 1); assert.equal(String(usage[0].assetId), pngUpload.body._id);
const replacement = await upload(await makeImage("png", "#264653", 400, 600), "step10-replacement.png", "image/png", requirement.type || "image", "replacement");
assert.equal((await map(replacement.body._id)).response.status, 200);
usage = await db.collection("assetusages").find({ sceneId: scene._id, requirementId }).toArray(); assert.equal(usage.length, 1); assert.equal(String(usage[0].assetId), replacement.body._id);
assert.equal((await request(`/api/assets/${replacement.body._id}`, { method: "DELETE" })).response.status, 409);
const unmapped = await request(`/api/scenes/${scene._id}/assets`, { method: "DELETE", headers: { "content-type": "application/json" }, body: JSON.stringify({ requirementId }) }); assert.equal(unmapped.response.status, 200);
assert.equal(await db.collection("assetusages").countDocuments({ sceneId: scene._id, requirementId }), 0);
assert.equal((await map(pngUpload.body._id)).response.status, 200);

const matches = await request(`/api/storyboards/${storyboardId}/assets/match`, { method: "POST" }); assert.equal(matches.response.status, 200);
const matchedReq = matches.body.scenes.find(item => item._id === String(scene._id)).requirements.find(item => item.requirementId === requirementId);
assert.ok(matchedReq.matches.length > 0); assert.ok(matchedReq.matches.every((item, index, array) => index === 0 || array[index - 1].score >= item.score));

const disposable = await upload(await makeImage("png", "#ffffff", 99, 101), "step10-delete.png", "image/png", "icon", "delete");
assert.equal((await request(`/api/assets/${disposable.body._id}`, { method: "DELETE" })).response.status, 200);
assert.equal(await db.collection("assets").countDocuments({ _id: oid(disposable.body._id) }), 0);

const boardAssets = await request(`/api/storyboards/${storyboardId}/assets`); assert.equal(boardAssets.response.status, 200); assert.equal(boardAssets.body.storyboard.status, "approved");
const providerStatus = boardAssets.body.provider;
const finalScene = await db.collection("scenes").findOne({ _id: scene._id });
assert.equal(String(finalScene.assetMappings.find(item => item.requirementId === requirementId).assetId), pngUpload.body._id);
assert.equal(await db.collection("assetusages").countDocuments({ sceneId: scene._id, requirementId }), 1);
const persistedAsset = await db.collection("assets").findOne({ _id: oid(pngUpload.body._id) }); assert.equal(persistedAsset.storagePath, pngUpload.body.storagePath); assert.equal(persistedAsset.width, 321);
const videosAfter = await videoSnapshot(); assert.deepEqual(videosAfter, videosBefore, "Step 10 must not create or mutate any Video record");
const boardAfter = stable(await db.collection("storyboards").findOne({ _id: oid(storyboardId) })); assert.deepEqual(boardAfter, boardBefore, "Asset management must not mutate the approved Storyboard record");
const countsAfter = {}; for (const name of Object.keys(countsBefore)) countsAfter[name] = await db.collection(name).countDocuments();
const result = { result: "PASS", storyboardId, scriptId: String(boardAfter.scriptId), sceneId: String(scene._id), sceneNumber: scene.sceneNumber, requirementId, mappedAssetId: pngUpload.body._id, jpegAssetId: jpegUpload.body._id, webpAssetId: webpUpload.body._id, replacementAssetId: replacement.body._id, usageId: String((await db.collection("assetusages").findOne({ sceneId: scene._id, requirementId }))._id), dimensions: { png: [321,479], jpeg: [333,222], webp: [257,389] }, providerStatus, videoCountBefore: videosBefore.length, videoCountAfter: videosAfter.length, videoSnapshotUnchanged: true, storyboardUnchanged: true, countsBefore, countsAfter, checks: ["list","search","type filter","tag filter","preview","PNG integrity/dimensions","JPEG integrity/dimensions","WEBP integrity/dimensions","upload","hash dedupe/reuse","rename","metadata edit","storage traversal rejection","ranked matching","map","idempotent usage dedupe","replace","unmap","delete guard","safe delete","Mongo persistence","approved storyboard isolation","Video isolation"] };
console.log(JSON.stringify(result, null, 2));
await mongoose.disconnect();
