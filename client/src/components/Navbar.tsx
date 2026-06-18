import { Link, useNavigate } from "react-router";
import { authClient } from "../lib/auth-client";

export function Navbar() {
  const { data: session } = authClient.useSession();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => navigate("/login"),
      },
    });
  };

  const isAdmin = (session?.user as { role?: string } | undefined)?.role === "ADMIN";

  return (
    <nav className="flex items-center justify-between h-15 px-6 bg-slate-800 text-slate-50 shadow">
      <div className="flex items-center gap-6">
        <Link to="/" className="font-bold text-sm tracking-wide hover:text-slate-200 transition-colors">
          Ticket Management System
        </Link>
        {session && (
          <Link
            to="/tickets"
            className="text-sm text-slate-300 hover:text-white transition-colors"
          >
            Tickets
          </Link>
        )}
        {isAdmin && (
          <Link
            to="/users"
            className="text-sm text-slate-300 hover:text-white transition-colors"
          >
            Users
          </Link>
        )}
      </div>
      {session && (
        <div className="flex items-center gap-4">
          <span className="text-sm text-slate-300">{session.user.name}</span>
          <button
            onClick={handleSignOut}
            className="px-4 py-1.5 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-md cursor-pointer transition-colors"
          >
            Sign Out
          </button>
        </div>
      )}
    </nav>
  );
}
