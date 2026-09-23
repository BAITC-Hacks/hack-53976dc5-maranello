import { readBody, apiError } from "@/lib/api";
import { revokeSession, sessionCookie } from "@/lib/app-auth";
export async function POST(request: Request) {
  try {
    await readBody(request);
    await revokeSession(request);
    return Response.json({ok:true},{headers:{"Cache-Control":"no-store","Set-Cookie":sessionCookie("",request,0)}});
  } catch(error) { return apiError(error); }
}
