import { useNavigate, Link, useLocation } from "react-router";
import { authClient } from "../lib/auth-client";
import { Button } from "@/components/ui/button";
import { LayoutDashboard, Ticket, Users } from "lucide-react";

interface NavbarProps {
  userName: string;
}

type SessionUser = { role?: "admin" | "agent" };

export default function Navbar({ userName }: NavbarProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const { data: session } = authClient.useSession();
  const role = (session?.user as SessionUser | undefined)?.role;

  async function handleSignOut() {
    await authClient.signOut();
    navigate("/login", { replace: true });
  }

  function navLink(to: string, label: string, Icon: React.ElementType) {
    const active = location.pathname === to || location.pathname.startsWith(to + "/");
    return (
      <Link
        to={to}
        className={[
          "flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-md transition-colors",
          active
            ? "bg-primary/10 text-primary font-medium"
            : "text-muted-foreground hover:text-foreground hover:bg-muted",
        ].join(" ")}
      >
        <Icon className="h-3.5 w-3.5" />
        {label}
      </Link>
    );
  }

  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <nav className="bg-card border-b border-border px-6 py-0 flex items-center justify-between h-14 shadow-sm">
      <div className="flex items-center gap-1">
        <Link
          to="/"
          className="flex items-center gap-2 mr-4 text-foreground hover:opacity-80 transition-opacity"
        >
          <div className="w-7 h-7 rounded-md bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold" style={{ fontFamily: "var(--font-heading)" }}>
            ❖
          </div>
          <span className="text-base font-semibold tracking-tight" style={{ fontFamily: "var(--font-heading)" }}>Helpdesk</span>
        </Link>
        {navLink("/dashboard", "Dashboard", LayoutDashboard)}
        {navLink("/tickets", "Tickets", Ticket)}
        {role === "admin" && navLink("/users", "Users", Users)}
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-primary/15 text-primary flex items-center justify-center text-xs font-semibold">
            {initials || "?"}
          </div>
          <span className="text-sm text-muted-foreground hidden sm:block">{userName}</span>
        </div>
        <Button variant="ghost" size="sm" onClick={handleSignOut} className="text-muted-foreground hover:text-foreground text-xs">
          Sign out
        </Button>
      </div>
    </nav>
  );
}
