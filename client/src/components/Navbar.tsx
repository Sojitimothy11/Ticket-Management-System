import { NavLink, useNavigate } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { authClient } from "../lib/auth-client";
import { cn } from "../lib/utils";
import { fetchTrashCount } from "../lib/ticketsApi";

function NavItem({ to, children, badge }: { to: string; children: React.ReactNode; badge?: number }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-1.5 border-b-2 border-transparent py-1 text-sm text-white/60 transition-colors hover:text-white",
          isActive && "border-signal text-white"
        )
      }
    >
      {children}
      {!!badge && <span className="rounded-full bg-signal px-1.5 text-xs font-semibold text-white">{badge}</span>}
    </NavLink>
  );
}

export function Navbar() {
  const { data: session } = authClient.useSession();
  const navigate = useNavigate();

  const { data: trashCount } = useQuery({
    queryKey: ["tickets", "trashCount"],
    queryFn: fetchTrashCount,
    enabled: !!session,
    refetchInterval: 10_000,
  });

  const handleSignOut = async () => {
    await authClient.signOut({
      fetchOptions: {
        onSuccess: () => navigate("/login"),
      },
    });
  };

  const isAdmin = (session?.user as { role?: string } | undefined)?.role === "ADMIN";

  return (
    <nav className="flex min-h-15 flex-wrap items-center justify-between gap-x-4 gap-y-2 bg-[#14171f] px-4 py-2 text-white sm:h-15 sm:flex-nowrap sm:px-6 sm:py-0">
      <div className="flex flex-wrap items-center gap-3 sm:flex-nowrap sm:gap-7">
        <NavLink to="/" className="font-heading text-sm font-semibold tracking-wide text-white">
          Ticket<span className="text-signal">/</span>Desk
        </NavLink>
        {session && <NavItem to="/tickets">Tickets</NavItem>}
        {session && <NavItem to="/recycle-bin" badge={trashCount}>Recycle Bin</NavItem>}
        {isAdmin && <NavItem to="/users">Users</NavItem>}
      </div>
      {session && (
        <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap sm:gap-4">
          <span className="font-mono text-xs text-white/50">{session.user.name}</span>
          <button
            onClick={handleSignOut}
            className="cursor-pointer rounded-md px-3 py-1.5 text-sm font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            Sign Out
          </button>
        </div>
      )}
    </nav>
  );
}
