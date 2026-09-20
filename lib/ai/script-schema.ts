import { z } from "zod";
import { estimateDuration } from "@/lib/ai/validator";
export const SCRIPT_SCHEMA_VERSION = "script-schema-v2";
const text = z.string().trim().min(1).max(2000);
const spoken = text.refine(value => !/[<>*_`#=×÷±√^{}\[\]•]|\p{Extended_Pictographic}|^\s*[-+]\s/mu.test(value), "Narration must be plain, TTS-friendly text")
  .refine(value => value.split(/[.!?;\n]/).every(sentence => sentence.trim().split(/\s+/).length <= 40), "Use short spoken sentences");
export const scriptSceneSchema = z.strictObject({ order: z.number().int().min(1), narration: spoken, visualDescription: text, duration: z.number().positive().max(35), onScreenText: z.string().trim().max(200) });
// narration is the complete spoken track. Hook/conclusion/CTA are editorial excerpts.
export const scriptSchema = z.strictObject({
  title: text, hook: spoken, narration: spoken, conclusion: spoken,
  targetAudience: text, educationalGoal: text, callToAction: z.string().trim().max(200),
  estimatedDuration: z.number().min(25).max(35), targetDuration: z.literal(30),
  scenes: z.array(scriptSceneSchema).min(1).max(8), keywords: z.array(text).min(1).max(20),
}).superRefine((script, ctx) => {
  const issue = (message: string) => ctx.addIssue({ code: "custom", message });
  if (!/[ăâđêôơưáàảãạấầẩẫậắằẳẵặéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/iu.test(script.narration)) issue("Narration must be Vietnamese");
  if (script.scenes.some((scene, index) => scene.order !== index + 1)) issue("Scene order must be unique and sequential");
  if (Math.abs(script.scenes.reduce((sum, scene) => sum + scene.duration, 0) - script.estimatedDuration) > 0.5) issue("Scene duration total must match estimatedDuration (±0.5s)");
  const duration = estimateDuration(script.narration);
  if (duration < 25 || duration > 35) issue("Narration must contain approximately 72–99 whitespace-delimited syllables (25–35 seconds)");
  if (Math.abs(duration - script.estimatedDuration) > 3) issue("Estimated duration differs from spoken-length estimate by more than 3s");
  const normalize = (s: string) => s.replace(/\s+/g, " ").trim();
  if (normalize(script.scenes.map(scene => scene.narration).join(" ")) !== normalize(script.narration)) issue("Scene narration must concatenate to the complete narration");
  if (!script.narration.startsWith(script.hook) || !script.narration.includes(script.conclusion) || (script.callToAction && !script.narration.endsWith(script.callToAction))) issue("Hook, conclusion and CTA must be excerpts of the complete narration");
});
export type GeneratedScript = z.infer<typeof scriptSchema>;
export function scriptFields(value: Record<string, unknown>) { return Object.fromEntries(Object.keys(scriptSchema.shape).map(key => [key, value[key]])); }
