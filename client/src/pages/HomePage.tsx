import { Navbar } from "../components/Navbar";

export function HomePage() {
  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="px-6 py-10">
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Dashboard</h1>
        <p className="text-slate-500">Welcome to the Ticket Management System.</p>
      </main>
    </div>
  );
}
