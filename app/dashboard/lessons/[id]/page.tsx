import { LessonWorkspace } from "@/components/lesson-workspace";
export default async function LessonDetail({ params }: { params: Promise<{ id: string }> }) { return <LessonWorkspace lessonId={(await params).id} />; }
