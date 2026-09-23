import { getChatGPTUser } from "@/app/chatgpt-auth";
import { apiError, json, unauthorized } from "@/lib/api";
import { myResponses } from "@/lib/repository";
export async function GET() {
  try {
    const viewer = await getChatGPTUser();
    if (!viewer) return unauthorized();
    return json({ responses: await myResponses(viewer.userId) });
  } catch (error) {
    return apiError(error);
  }
}
