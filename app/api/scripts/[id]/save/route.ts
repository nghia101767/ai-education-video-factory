import { PATCH as updateScript } from "@/app/api/scripts/[id]/route";

// Explicit save alias for clients that model editing as an action.
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return updateScript(request, context);
}
