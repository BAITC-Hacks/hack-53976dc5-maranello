import { readBody, apiError } from "@/lib/api";
import { revokeSession, sessionCookie } from "@/lib/app-auth";
export async function POST(request: Request) {
  try {
    await readBody(request);
    await revokeSession(request);
    return Response.json({ok:true},{headers:{"Cache-Control":"no-store","Set-Cookie":sessionCookie("signed-out",request,86400*365)}});
  } catch(error) { return apiError(error); }
}
