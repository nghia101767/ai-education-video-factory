export const STORYBOARD_READY_TEXT = "✨ Sẵn sàng tạo Storyboard";
export const STORYBOARD_NOT_READY_TEXT = "Chưa sẵn sàng — cần duyệt kịch bản.";
export function storyboardReadiness(status: string) { return status === "approved" ? { ready: true, text: STORYBOARD_READY_TEXT } : { ready: false, text: STORYBOARD_NOT_READY_TEXT }; }
