import { useNavigate } from "react-router";
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

  return (
    <nav
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "0 24px",
        height: "60px",
        background: "#1e293b",
        color: "#f8fafc",
        boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
      }}
    >
      <span style={{ fontWeight: 700, fontSize: "1rem", letterSpacing: "0.01em" }}>
        Ticket Management System
      </span>
      {session && (
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          <span style={{ fontSize: "0.9rem", color: "#cbd5e1" }}>
            {session.user.name}
          </span>
          <button
            onClick={handleSignOut}
            style={{
              padding: "6px 16px",
              background: "#dc2626",
              color: "#fff",
              border: "none",
              borderRadius: "6px",
              fontSize: "0.875rem",
              cursor: "pointer",
              fontWeight: 500,
            }}
          >
            Sign Out
          </button>
        </div>
      )}
    </nav>
  );
}
