import { getAppUser } from "@/lib/app-auth";
import Workspace from "./workspace";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getAppUser();
  return <Workspace user={user ? { name: user.displayName, email: user.email, role: user.role } : null}
    signInHref="/login" />;
}
