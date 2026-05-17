import { useNavigate, Link } from "react-router";
import { authClient } from "../lib/auth-client";
import { Button } from "@/components/ui/button";

interface NavbarProps {
  userName: string;
}

type SessionUser = { role?: "admin" | "agent" };

export default function Navbar({ userName }: NavbarProps) {
  const navigate = useNavigate();
  const { data: session } = authClient.useSession();
  const role = (session?.user as SessionUser | undefined)?.role;

  async function handleSignOut() {
    await authClient.signOut();
    navigate("/login", { replace: true });
  }

  return (
    <nav className="bg-card border-b border-border px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-6">
        <Link to="/" className="text-lg font-semibold text-foreground hover:opacity-80 transition-opacity">Helpdesk</Link>
        <Link to="/tickets" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
          Tickets
        </Link>
        {role === "admin" && (
          <Link to="/users" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Users
          </Link>
        )}
      </div>
      <div className="flex items-center gap-4">
        <span className="text-sm text-muted-foreground">{userName}</span>
        <Button variant="ghost" size="sm" onClick={handleSignOut}>
          Sign out
        </Button>
      </div>
    </nav>
  );
}
