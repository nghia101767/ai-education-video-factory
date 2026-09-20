import { SystemSetting } from "@/models";
import { connectToDatabase } from "@/lib/mongodb";

export const IMAGE_PROVIDER_IDS = ["mock", "openai", "huggingface", "gemini"] as const;
export type ImageProviderId = typeof IMAGE_PROVIDER_IDS[number];
export const IMAGE_SETTING_KEYS = ["ai.image.provider", "ai.image.model", "ai.image.huggingface.model", "ai.image.gemini.model"] as const;
export const IMAGE_MODEL_DEFAULTS: Record<ImageProviderId, string> = {
  mock: "mock-image-v1",
  openai: "gpt-image-1",
  huggingface: "black-forest-labs/FLUX.1-schnell",
  gemini: "gemini-2.5-flash-image",
};

const MODEL_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,199}$/;
export function validateImageProviderId(value: unknown): ImageProviderId {
  const id = String(value || "").trim().toLowerCase();
  if (!IMAGE_PROVIDER_IDS.includes(id as ImageProviderId)) throw new Error("INVALID_IMAGE_PROVIDER");
  return id as ImageProviderId;
}
export function validateImageModel(value: unknown) {
  const model = String(value || "").trim();
  if (!MODEL_PATTERN.test(model)) throw new Error("INVALID_IMAGE_MODEL");
  return model;
}
export function envImageProvider(): ImageProviderId {
  const candidate = (process.env.IMAGE_PROVIDER || process.env.AI_IMAGE_PROVIDER || "mock").toLowerCase();
  return IMAGE_PROVIDER_IDS.includes(candidate as ImageProviderId) ? candidate as ImageProviderId : "mock";
}
export function envImageModel(provider: ImageProviderId) {
  if (provider === "openai") return process.env.OPENAI_IMAGE_MODEL || IMAGE_MODEL_DEFAULTS.openai;
  if (provider === "huggingface") return process.env.HF_IMAGE_MODEL || IMAGE_MODEL_DEFAULTS.huggingface;
  if (provider === "gemini") return process.env.GEMINI_IMAGE_MODEL || IMAGE_MODEL_DEFAULTS.gemini;
  return IMAGE_MODEL_DEFAULTS.mock;
}
export type ResolvedImageSettings = { provider: ImageProviderId; model: string };
export async function loadImageSettings(): Promise<ResolvedImageSettings> {
  await connectToDatabase();
  const rows = await SystemSetting.find({ key: { $in: [...IMAGE_SETTING_KEYS] } }).lean() as unknown as Array<{ key: string; value: unknown }>;
  const values = Object.fromEntries(rows.map(row => [row.key, row.value]));
  const provider = values["ai.image.provider"] ? validateImageProviderId(values["ai.image.provider"]) : envImageProvider();
  const providerSpecific = provider === "huggingface" ? values["ai.image.huggingface.model"] : provider === "gemini" ? values["ai.image.gemini.model"] : undefined;
  const model = validateImageModel(providerSpecific || values["ai.image.model"] || envImageModel(provider));
  return { provider, model };
}
export async function saveImageSettings(input: { provider: unknown; model: unknown }): Promise<ResolvedImageSettings> {
  const provider = validateImageProviderId(input.provider); const model = validateImageModel(input.model);
  await connectToDatabase();
  const writes: Array<{ key: string; value: string }> = [{ key: "ai.image.provider", value: provider }, { key: "ai.image.model", value: model }];
  if (provider === "huggingface") writes.push({ key: "ai.image.huggingface.model", value: model });
  if (provider === "gemini") writes.push({ key: "ai.image.gemini.model", value: model });
  await SystemSetting.bulkWrite(writes.map(item => ({ updateOne: { filter: { key: item.key }, update: { $set: { ...item, category: "ai" } }, upsert: true } })));
  return { provider, model };
}
