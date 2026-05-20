import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import Navbar from "@/components/Navbar";
import UsersList from "@/components/UsersList";
import CreateUserDialog from "@/components/CreateUserDialog";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default function UsersPage() {
  const { data: session } = authClient.useSession();
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <div className="min-h-screen bg-muted">
      <Navbar userName={session?.user.name ?? ""} />
      <div className="p-8 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-normal text-foreground" style={{ fontFamily: "var(--font-heading)" }}>Users</h1>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            New User
          </Button>
        </div>

        <UsersList />
      </div>

      <CreateUserDialog open={dialogOpen} onOpenChange={setDialogOpen} />
    </div>
  );
}
