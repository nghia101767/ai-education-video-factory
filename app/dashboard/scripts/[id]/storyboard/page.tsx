import { StoryboardEditor } from "@/components/storyboard-editor";
export default async function Page({ params }: { params: Promise<{ id: string }> }) { return <StoryboardEditor scriptId={(await params).id} />; }
