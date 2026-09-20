import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import { isValidObjectId } from "mongoose";
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Asset, AssetUsage, Scene, Storyboard } from "@/models";
import { storage } from "@/lib/storage";
import { validateAssetUpload, validateUploadContent } from "@/lib/upload-validation";
import { contentHash } from "@/lib/ai/cache";
import { checkBudget, recordCacheHit, recordFailure, recordUsage, BudgetExceededError } from "@/lib/ai/usage-service";
import { createImageProvider, imageProviderStatus, validateGeneratedRaster, ImageProviderError, type ImageProvider } from "@/lib/ai/image-provider";
import { loadImageSettings } from "@/lib/ai/image-settings";

export const visualAssetTypes = ["character", "background", "object", "icon", "illustration", "diagram", "image"] as const;
export type VisualAssetType = typeof visualAssetTypes[number];
export const readyStatuses = ["generated", "mock", "ready"];
export const IMAGE_PROMPT_VERSION = "asset-image-v2";
export const SUITABLE_MATCH_SCORE = 50;
const clean = (value: unknown, max = 1000) => String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
export const normalizeTags = (value: unknown) => [...new Set((Array.isArray(value) ? value : String(value || "").split(",")).map(item => clean(item, 80).toLowerCase()).filter(Boolean))].slice(0, 30);
export const normalizeText = (value: unknown) => clean(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const typeGroup = (type: string) => type === "image" ? new Set(visualAssetTypes) : new Set([type, "image"]);

function imageFailure(error: unknown) {
  if (error instanceof BudgetExceededError) return { errorCode: "BUDGET_EXCEEDED", status: "blocked_budget" as const };
  if (error instanceof ImageProviderError) return { errorCode: error.code, status: error.code === "CONFIGURATION_ERROR" ? "not_configured" as const : "failed" as const, requestId: error.requestId };
  return { errorCode: "PROVIDER_ERROR", status: "failed" as const };
}
async function recordImageFailure(error: unknown, input: { provider: string; model: string; sceneId?: unknown; storyboardId?: unknown; cacheKey: string; started: number }) {
  const failure = imageFailure(error);
  await recordFailure({ provider: input.provider, providerType: input.provider === "mock" ? "local" : "cloud", model: input.model, operation: "image_generation", sceneId: input.sceneId, storyboardId: input.storyboardId, requestId: failure.requestId, imageCount: 0, cacheKey: input.cacheKey, durationMs: Date.now() - input.started, status: failure.status, success: false, errorCode: failure.errorCode, error: error instanceof Error ? error.message : "Image generation failed" }).catch(() => undefined);
}

export function imageDimensions(mime: string, data: Buffer) {
  if (mime === "image/png" && data.length >= 24) return { width: data.readUInt32BE(16), height: data.readUInt32BE(20) };
  if (mime === "image/webp" && data.length >= 30) {
    const kind = data.subarray(12, 16).toString();
    if (kind === "VP8X") return { width: 1 + data.readUIntLE(24, 3), height: 1 + data.readUIntLE(27, 3) };
    if (kind === "VP8 " && data.subarray(23, 26).equals(Buffer.from([0x9d, 0x01, 0x2a]))) return { width: data.readUInt16LE(26) & 0x3fff, height: data.readUInt16LE(28) & 0x3fff };
    if (kind === "VP8L" && data[20] === 0x2f) { const bits = data.readUInt32LE(21); return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 }; }
  }
  if (mime === "image/jpeg") for (let i = 2; i + 9 < data.length;) { if (data[i++] !== 0xff) continue; const marker = data[i++]; if (marker === 0xd9 || marker === 0xda) break; const length = data.readUInt16BE(i); if (length < 2 || i + length > data.length) break; if ([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)) return { height: data.readUInt16BE(i + 3), width: data.readUInt16BE(i + 5) }; i += length; }
  throw new Error("Unable to read valid image dimensions");
}

export function validateVisualUpload(name: string, mime: string, data: Buffer, type: string, maxSize = Number(process.env.MAX_IMAGE_ASSET_SIZE || 20 * 1024 * 1024)) {
  if (!visualAssetTypes.includes(type as VisualAssetType)) throw new Error("Unsupported visual asset type");
  if (!data.length || data.length > maxSize) throw new Error(`Image must be between 1 byte and ${Math.round(maxSize / 1024 / 1024)}MB`);
  if (path.basename(name) !== name || name.includes("\0")) throw new Error("Invalid upload filename");
  validateAssetUpload(name, mime, data, "image");
  validateUploadContent(name, mime, data);
  const dimensions = imageDimensions(mime, data);
  if (dimensions.width < 1 || dimensions.height < 1 || dimensions.width > 12000 || dimensions.height > 12000) throw new Error("Invalid image dimensions");
  return dimensions;
}

export async function uploadVisualAsset(input: { file: File; type: VisualAssetType; name?: string; description?: string; tags?: unknown; role?: string; style?: string; characterIdentity?: string; characterAppearance?: string }) {
  const data = Buffer.from(await input.file.arrayBuffer());
  const dimensions = validateVisualUpload(input.file.name, input.file.type, data, input.type);
  const hash = createHash("sha256").update(data).digest("hex");
  const existing = await Asset.findOne({ hash, type: input.type, status: { $in: readyStatuses } });
  if (existing) return { asset: existing, reused: true };
  const ext = path.extname(input.file.name).toLowerCase(); const filename = `${randomUUID()}${ext}`;
  await storage.save("images", filename, data);
  try {
    const asset = await Asset.create({ type: input.type, name: clean(input.name, 160) || path.basename(input.file.name, ext), description: clean(input.description, 2000), filename, storagePath: `images/${filename}`, mimeType: input.file.type, width: dimensions.width, height: dimensions.height, size: data.length, hash, provider: "local-upload", source: "upload", role: clean(input.role, 80), style: clean(input.style, 200), characterIdentity: clean(input.characterIdentity, 200), characterAppearance: clean(input.characterAppearance, 1000), tags: normalizeTags(input.tags), status: "ready", metadata: { originalName: path.basename(input.file.name), integrity: "sha256", ...dimensions, size: data.length } });
    return { asset, reused: false };
  } catch (error) { await storage.delete("images", filename).catch(() => undefined); throw error; }
}

export type MatchRequirement = { type: string; description: string; role?: string; tags?: string[]; style?: string; aspectRatio?: string; characterIdentity?: string };
export function scoreAsset(asset: Record<string, any>, requirement: MatchRequirement) {
  if (!typeGroup(requirement.type).has(String(asset.type))) return -1;
  let score = asset.type === requirement.type ? 40 : 20;
  const wantedTags = new Set(normalizeTags(requirement.tags)); const assetTags = new Set(normalizeTags(asset.tags));
  score += [...wantedTags].filter(tag => assetTags.has(tag)).length * 12;
  const wantedWords = new Set(normalizeText(requirement.description).split(" ").filter(word => word.length > 2));
  const assetWords = new Set(normalizeText([asset.name, asset.description, asset.prompt, ...(asset.tags || [])].join(" ")).split(" "));
  score += [...wantedWords].filter(word => assetWords.has(word)).length * 3;
  if (requirement.role && normalizeText(asset.role) === normalizeText(requirement.role)) score += 10;
  if (requirement.style && normalizeText(asset.style) === normalizeText(requirement.style)) score += 10;
  if (requirement.aspectRatio && (asset.aspectRatio === requirement.aspectRatio || (asset.width && asset.height && `${asset.width}:${asset.height}` === requirement.aspectRatio))) score += 8;
  if (requirement.characterIdentity && normalizeText(asset.characterIdentity || asset.character) === normalizeText(requirement.characterIdentity)) score += 25;
  return score;
}
export async function findMatchingAssets(requirement: MatchRequirement, limit = 8) {
  const assets = await Asset.find({ type: { $in: [...typeGroup(requirement.type)] }, status: { $in: readyStatuses }, storagePath: /^images\// }).lean();
  return assets.map(asset => ({ asset, score: scoreAsset(asset as any, requirement), suitable: scoreAsset(asset as any, requirement) >= SUITABLE_MATCH_SCORE })).filter(item => item.score >= 20).sort((a, b) => b.score - a.score || String(a.asset._id).localeCompare(String(b.asset._id))).slice(0, Math.max(1, Math.min(limit, 20)));
}

export async function assignAsset(input: { sceneId: string; assetId: string; requirementId: string; role: string; usageType?: "generated" | "matched" | "uploaded" }) {
  if (![input.sceneId, input.assetId].every(isValidObjectId) || !/^[a-zA-Z0-9:_-]{1,120}$/.test(input.requirementId) || !/^[a-zA-Z0-9_-]{1,40}$/.test(input.role)) throw new Error("Invalid asset mapping input");
  const [scene, asset] = await Promise.all([Scene.findById(input.sceneId).lean(), Asset.findById(input.assetId).lean()]) as [any, any];
  if (!scene) throw new Error("Scene not found"); if (!asset || !asset.storagePath?.startsWith("images/") || !readyStatuses.includes(asset.status)) throw new Error("Asset is not ready");
  const storyboardId = scene.storyboardId; if (!storyboardId) throw new Error("Scene is not attached to a storyboard");
  const old = (scene.assetMappings || []).find((mapping: any) => mapping.requirementId === input.requirementId);
  const mapping = { requirementId: input.requirementId, assetId: asset._id, role: input.role, assignedAt: new Date() };
  await Scene.updateOne({ _id: scene._id }, { $pull: { assetMappings: { requirementId: input.requirementId } } });
  await Scene.updateOne({ _id: scene._id }, { $push: { assetMappings: mapping }, $addToSet: { assetIds: asset._id } });
  await AssetUsage.deleteMany({ sceneId: scene._id, requirementId: input.requirementId });
  if (old?.assetId && String(old.assetId) !== String(asset._id)) { const stillUsed = await Scene.exists({ _id: scene._id, assetMappings: { $elemMatch: { assetId: old.assetId, requirementId: { $ne: input.requirementId } } } }); if (!stillUsed) await Scene.updateOne({ _id: scene._id }, { $pull: { assetIds: old.assetId } }); }
  await AssetUsage.findOneAndUpdate({ assetId: asset._id, storyboardId, sceneId: scene._id, requirementId: input.requirementId, role: input.role }, { usageType: input.usageType || "matched" }, { upsert: true, new: true, setDefaultsOnInsert: true });
  return Scene.findById(scene._id).populate("assetIds").lean();
}
export async function unassignAsset(input: { sceneId: string; requirementId: string }) {
  const scene = await Scene.findById(input.sceneId).lean() as any; if (!scene) throw new Error("Scene not found"); const mapping = (scene.assetMappings || []).find((item: any) => item.requirementId === input.requirementId); if (!mapping) throw new Error("Asset mapping not found");
  await Scene.updateOne({ _id: scene._id }, { $pull: { assetMappings: { requirementId: input.requirementId } } }); await AssetUsage.deleteMany({ sceneId: scene._id, requirementId: input.requirementId });
  const other = (scene.assetMappings || []).some((item: any) => item.requirementId !== input.requirementId && String(item.assetId) === String(mapping.assetId)); if (!other) await Scene.updateOne({ _id: scene._id }, { $pull: { assetIds: mapping.assetId } }); return Scene.findById(scene._id).lean();
}

export async function storyboardAssetRequirements(storyboardId: string, includeMatches = false) {
  if (!isValidObjectId(storyboardId)) throw new Error("Invalid storyboardId"); const storyboard = await Storyboard.findOne({ _id: storyboardId, status: "approved" }).lean() as any; if (!storyboard) throw new Error("Approved storyboard not found");
  const [scenes, selected] = await Promise.all([Scene.find({ storyboardId }).sort({ sceneNumber: 1 }).populate("stylePresetId").populate("characterProfileId").lean(), loadImageSettings()]);
  return { storyboard, provider: imageProviderStatus(selected.provider, selected.model), scenes: await Promise.all(scenes.map(async (scene: any) => ({ _id: scene._id, sceneNumber: scene.sceneNumber, visualDescription: scene.visualDescription, mappings: scene.assetMappings || [], requirements: await Promise.all((scene.assetRequirements || []).map(async (req: any, index: number) => { const requirementId = `scene-${scene.sceneNumber}-requirement-${index + 1}`; const mapped = (scene.assetMappings || []).find((item: any) => item.requirementId === requirementId); const enriched = { ...req, requirementId, style: scene.stylePresetId?.name, aspectRatio: scene.stylePresetId?.aspectRatio || storyboard.aspectRatio, characterIdentity: scene.characterProfileId?.name, status: mapped ? "mapped" : "missing", mappedAssetId: mapped?.assetId }; return { ...enriched, ...(includeMatches ? { matches: await findMatchingAssets(enriched, 5) } : {}) }; })) }))) };
}

export async function generateSceneImageAsset(sceneId: string) {
  const started = Date.now(); const selected = await loadImageSettings(); const provider = createImageProvider(selected.provider, selected.model); let filename = ""; let asset: any; let usage: any;
  const scene = await Scene.findById(sceneId).populate("stylePresetId").populate("characterProfileId").lean() as any; if (!scene) throw new Error("Scene not found");
  const style = scene.stylePresetId, character = scene.characterProfileId; const prompt = [style?.visualPromptPrefix, scene.imagePrompt, character && `Consistent character ${character.name}: ${character.appearance || ""}; ${character.visualStyle || ""}`].filter(Boolean).join(". ");
  const request = { prompt, aspectRatio: style?.aspectRatio || "9:16", negativePrompt: style?.negativePrompt, style: style?.name || "default", character: character?.name, dimensions: { width: 1024, height: 1536 } };
  const cacheKey = contentHash({ operation: "image_generation", provider: provider.providerId, model: provider.model, prompt, promptVersion: "image-v1", style: style ? { id: style._id, name: style.name, negativePrompt: style.negativePrompt, aspectRatio: style.aspectRatio } : "default", character: character ? { id: character._id, name: character.name, appearance: character.appearance, visualStyle: character.visualStyle } : null, settings: { aspectRatio: request.aspectRatio } });
  if (provider.providerId !== "mock") try { await checkBudget(); } catch (error) { await recordImageFailure(error, { provider: provider.providerId, model: provider.model, sceneId, cacheKey, started }); throw error; }
  const existing = await Asset.findOne({ type: "image", provider: provider.providerId, model: provider.model, "metadata.cacheKey": cacheKey, status: { $in: readyStatuses } });
  if (existing) { await Scene.updateOne({ _id: sceneId }, { $addToSet: { assetIds: existing._id }, status: "asset-ready" }); await AssetUsage.findOneAndUpdate({ assetId: existing._id, sceneId }, { usageType: "matched" }, { upsert: true }); await recordCacheHit({ provider: provider.providerId, model: provider.model, operation: "image_generation", sceneId, cacheKey, cacheSource: "Asset" }); return { ...existing.toObject(), reused: true }; }
  try {
    const result = await provider.generateImage(request); const valid = await validateGeneratedRaster(result.data, result.mimeType); filename = `${cacheKey}.${valid.extension}`; await storage.save("images", filename, result.data);
    asset = await Asset.create({ type: "image", sceneId, prompt, provider: provider.providerId, model: provider.model, style: style?.name || "default", character: character?.name, hash: valid.hash, status: result.status, storagePath: `images/${filename}`, filename, mimeType: valid.mimeType, width: valid.width, height: valid.height, size: valid.size, metadata: { message: result.message, cacheKey, promptVersion: "image-v1", stylePresetId: style?._id, characterProfileId: character?._id, mock: result.status === "mock", requestId: result.requestId } });
    usage = await recordUsage({ provider: provider.providerId, providerType: provider.providerId === "mock" ? "local" : "cloud", model: provider.model, operation: "image_generation", sceneId, requestId: result.requestId, imageCount: result.usage?.imageCount ?? 1, cacheKey, durationMs: Date.now() - started });
    await Scene.updateOne({ _id: sceneId }, { $addToSet: { assetIds: asset._id }, status: "asset-ready" }); await AssetUsage.findOneAndUpdate({ assetId: asset._id, sceneId }, { usageType: "generated" }, { upsert: true }); return { ...asset.toObject(), reused: false };
  } catch (error) { if (asset?._id) { await AssetUsage.deleteMany({ assetId: asset._id }).catch(() => undefined); await Scene.updateOne({ _id: sceneId }, { $pull: { assetIds: asset._id } }).catch(() => undefined); await Asset.deleteOne({ _id: asset._id }).catch(() => undefined); } if (usage?._id) await usage.deleteOne().catch(() => undefined); if (filename) await storage.delete("images", filename).catch(() => undefined); await recordImageFailure(error, { provider: provider.providerId, model: provider.model, sceneId, cacheKey, started }); throw error; }
}

export async function generateRequirementAsset(input: { storyboardId: string; sceneId: string; requirementId: string; settings?: Record<string, unknown> }, injectedProvider?: ImageProvider) {
  const started = Date.now(); let filename = ""; let createdAsset: any; let usage: any;
  const selected = injectedProvider ? { provider: injectedProvider.providerId, model: injectedProvider.model } : await loadImageSettings();
  const provider = injectedProvider || createImageProvider(selected.provider, selected.model); const model = provider.model;
  const data = await storyboardAssetRequirements(input.storyboardId); const scene = data.scenes.find((item: any) => String(item._id) === input.sceneId); const requirement = scene?.requirements.find((item: any) => item.requirementId === input.requirementId); if (!scene || !requirement) throw new Error("Storyboard requirement not found");
  const prompt = [requirement.description, requirement.style && `Style: ${requirement.style}`, requirement.characterIdentity && `Consistent character identity: ${requirement.characterIdentity}`].filter(Boolean).join(". "); const dimensions = { width: 1024, height: 1536 };
  const cacheKey = contentHash({ provider: provider.providerId, model, prompt, promptVersion: IMAGE_PROMPT_VERSION, type: requirement.type, style: requirement.style || null, dimensions, settings: input.settings || {}, aspectRatio: requirement.aspectRatio, characterIdentity: requirement.characterIdentity || null });
  if (provider.providerId !== "mock") try { await checkBudget(); } catch (error) { await recordImageFailure(error, { provider: provider.providerId, model, storyboardId: input.storyboardId, sceneId: input.sceneId, cacheKey, started }); throw error; }
  const cached = await Asset.findOne({ "metadata.cacheKey": cacheKey, provider: provider.providerId, model, status: { $in: readyStatuses } });
  if (cached) { await assignAsset({ sceneId: input.sceneId, assetId: String(cached._id), requirementId: input.requirementId, role: requirement.role, usageType: "matched" }); await recordCacheHit({ provider: provider.providerId, model, operation: "image_generation", storyboardId: input.storyboardId, sceneId: input.sceneId, cacheKey, cacheSource: "Asset", imageCount: 0, durationMs: Date.now() - started }); return { asset: cached, reused: true, cacheHit: true }; }
  const ranked = await findMatchingAssets(requirement, 1); const suitable = ranked.find(item => item.suitable && item.asset.provider === provider.providerId && item.asset.model === model); if (suitable) { await assignAsset({ sceneId: input.sceneId, assetId: String(suitable.asset._id), requirementId: input.requirementId, role: requirement.role, usageType: "matched" }); await recordCacheHit({ provider: provider.providerId, model, operation: "image_generation", storyboardId: input.storyboardId, sceneId: input.sceneId, cacheKey, cacheSource: "ranked_asset_match", imageCount: 0, durationMs: Date.now() - started }); return { asset: suitable.asset, reused: true, cacheHit: false, matchScore: suitable.score }; }
  try {
    const result = await provider.generateImage({ prompt, aspectRatio: requirement.aspectRatio, style: requirement.style, character: requirement.characterIdentity, type: requirement.type, dimensions, settings: input.settings });
    const valid = await validateGeneratedRaster(result.data, result.mimeType); const extension = valid.extension; filename = `${cacheKey}.${extension}`; await storage.save("images", filename, result.data);
    createdAsset = await Asset.create({ type: requirement.type, name: clean(requirement.description, 160), description: requirement.description, storagePath: `images/${filename}`, filename, mimeType: valid.mimeType, width: valid.width, height: valid.height, size: valid.size, hash: valid.hash, provider: provider.providerId, model, prompt, promptVersion: IMAGE_PROMPT_VERSION, source: "ai-generated", status: result.status, style: requirement.style, aspectRatio: requirement.aspectRatio, role: requirement.role, characterIdentity: requirement.characterIdentity, metadata: { cacheKey, promptVersion: IMAGE_PROMPT_VERSION, dimensions: { width: valid.width, height: valid.height }, size: valid.size, integrity: "sha256", settings: input.settings || {}, mock: result.status === "mock", requestId: result.requestId } });
    usage = await recordUsage({ provider: provider.providerId, providerType: provider.providerId === "mock" ? "local" : "cloud", model, operation: "image_generation", storyboardId: input.storyboardId, sceneId: input.sceneId, requestId: result.requestId, imageCount: result.usage?.imageCount ?? 1, durationMs: Date.now() - started, cached: false, cacheKey, success: true });
    await assignAsset({ sceneId: input.sceneId, assetId: String(createdAsset._id), requirementId: input.requirementId, role: requirement.role, usageType: "generated" }); return { asset: createdAsset, reused: false, cacheHit: false };
  } catch (error) {
    if (createdAsset?._id) { await AssetUsage.deleteMany({ assetId: createdAsset._id }).catch(() => undefined); await Scene.updateOne({ _id: input.sceneId }, { $pull: { assetIds: createdAsset._id, assetMappings: { assetId: createdAsset._id } } }).catch(() => undefined); await Asset.deleteOne({ _id: createdAsset._id }).catch(() => undefined); }
    if (usage?._id) await usage.deleteOne().catch(() => undefined); if (filename) await storage.delete("images", filename).catch(() => undefined); await recordImageFailure(error, { provider: provider.providerId, model, storyboardId: input.storyboardId, sceneId: input.sceneId, cacheKey, started }); throw error;
  }
}
