import { z } from "zod";

export const STORYBOARD_SCHEMA_VERSION = "storyboard-schema-v1";
const text = z.string().trim().min(1).max(3000);
export const assetRequirementSchema = z.strictObject({
  type: z.enum(["image", "illustration", "diagram", "text", "animation", "video"]),
  description: text,
  role: z.enum(["background", "subject", "overlay", "supporting"]),
  required: z.boolean(),
});
export const storyboardSceneSchema = z.strictObject({
  order: z.number().int().min(1), startTime: z.number().min(0), endTime: z.number().positive(), duration: z.number().positive(),
  narration: text, visualDescription: text, camera: text, transition: text, onScreenText: z.string().trim().max(300),
  assetRequirements: z.array(assetRequirementSchema).min(1).max(8),
});
export const storyboardOutputSchema = z.strictObject({
  title: text, duration: z.number().min(25).max(35), aspectRatio: z.literal("9:16"), fps: z.literal(30),
  scenes: z.array(storyboardSceneSchema).min(4).max(10),
});
export type StoryboardOutput = z.infer<typeof storyboardOutputSchema>;
export type StoryboardScene = z.infer<typeof storyboardSceneSchema>;

export function storyboardOutputFields(value: Record<string, unknown>) {
  return Object.fromEntries(Object.keys(storyboardOutputSchema.shape).map(key => [key, value[key]]));
}
