import { useNavigate } from "react-router";
import { authClient } from "../lib/auth-client";

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
    <nav className="bg-white border-b border-gray-200 px-6 py-3 flex items-center justify-between">
      <span className="text-lg font-semibold text-gray-900">Helpdesk</span>
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-600">{userName}</span>
        <button
          onClick={handleSignOut}
          className="text-sm font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
        >
          Sign out
        </button>
      </div>
    </nav>
  );
}
