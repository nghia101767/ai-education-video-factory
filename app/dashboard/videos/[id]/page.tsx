import { VideoStudio } from "@/components/video-studio";
import { AudioMixControls } from "@/components/audio-mix-controls";
export default async function Page({ params }: { params: Promise<{ id: string }> }) { const id = (await params).id; return <div style={{ flex: 1, minWidth: 0 }}><VideoStudio videoId={id}/><AudioMixControls videoId={id}/></div>; }
