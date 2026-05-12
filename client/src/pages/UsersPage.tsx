import { authClient } from "@/lib/auth-client";
import Navbar from "@/components/Navbar";

export default function UsersPage() {
  const { data: session } = authClient.useSession();

  return (
    <div className="min-h-screen bg-background">
      <Navbar userName={session?.user.name ?? ""} />
      <div className="p-8">
        <h1 className="text-2xl font-bold text-foreground">Users</h1>
      </div>
    </div>
  );
}
