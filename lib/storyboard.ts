export type SceneInput = { sceneNumber?: number; order?: number; startTime: number; endTime: number; duration: number; narration: string; visualDescription: string; imagePrompt?: string; camera?: string; transition?: string; onScreenText?: string; assetRequirements?: Array<{ type: string; description: string; role: string; required: boolean }> };
export function validateStoryboard(scenes: SceneInput[], scriptDuration: number) {
  const errors: string[] = [];
  const ordered = [...scenes].sort((a, b) => Number(a.order ?? a.sceneNumber) - Number(b.order ?? b.sceneNumber));
  const numbers = ordered.map(scene => Number(scene.order ?? scene.sceneNumber));
  if (numbers[0] !== 1 || new Set(numbers).size !== numbers.length || numbers.some((value, index) => value !== index + 1)) errors.push("Scene order must start at 1 and be unique and continuous");
  ordered.forEach((scene, index) => {
    const number = scene.order ?? scene.sceneNumber;
    if (!scene.narration?.trim()) errors.push(`Scene ${number} narration is empty`);
    if (!scene.visualDescription?.trim() || scene.visualDescription.trim().length < 12) errors.push(`Scene ${number} visual plan is not specific`);
    if (!scene.imagePrompt?.trim() && (!scene.assetRequirements?.length || scene.assetRequirements.some(item => !item.description?.trim() || !item.type || !item.role || typeof item.required !== "boolean"))) errors.push(`Scene ${number} asset requirements are not Step-10-ready`);
    if (scene.startTime < 0 || scene.endTime <= scene.startTime || scene.duration <= 0 || Math.abs(scene.duration - (scene.endTime - scene.startTime)) > 0.2) errors.push(`Scene ${number} has invalid timing`);
    if (index > 0 && scene.startTime < ordered[index - 1].endTime) errors.push(`Scene ${number} overlaps the previous scene`);
  });
  const totalDuration = ordered.length ? ordered[ordered.length - 1].endTime : 0;
  if (totalDuration > scriptDuration + 0.01) errors.push(`Storyboard duration ${totalDuration}s exceeds script ${scriptDuration}s`);
  if (totalDuration < 25 || totalDuration > 35 || Math.abs(totalDuration - scriptDuration) > 2) errors.push(`Storyboard duration ${totalDuration}s must be near the script target ${scriptDuration}s (25–35s)`);
  return { valid: errors.length === 0, errors, totalDuration, sceneCount: ordered.length };
}
