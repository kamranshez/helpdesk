import { useNavigate } from "react-router";
import { authClient } from "../lib/auth-client";
import { Button } from "@/components/ui/button";

interface NavbarProps {
  userName: string;
}

export default function Navbar({ userName }: NavbarProps) {
  const navigate = useNavigate();

  async function handleSignOut() {
    await authClient.signOut();
    navigate("/login", { replace: true });
  }

  return (
    <nav className="bg-card border-b border-border px-6 py-3 flex items-center justify-between">
      <span className="text-lg font-semibold text-foreground">Helpdesk</span>
      <div className="flex items-center gap-4">
        <span className="text-sm text-muted-foreground">{userName}</span>
        <Button variant="ghost" size="sm" onClick={handleSignOut}>
          Sign out
        </Button>
      </div>
    </nav>
  );
}
