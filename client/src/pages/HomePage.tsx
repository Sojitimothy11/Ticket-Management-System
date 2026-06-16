import { Navbar } from "../components/Navbar";

export function HomePage() {
  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
      <Navbar />
      <main style={{ padding: "40px 24px" }}>
        <h1 style={{ margin: "0 0 8px", color: "#0f172a" }}>Dashboard</h1>
        <p style={{ color: "#64748b" }}>Welcome to the Ticket Management System.</p>
      </main>
    </div>
  );
}
