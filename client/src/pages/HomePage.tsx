import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Navbar } from "../components/Navbar";
import { categoryLabels, type TicketCategory, type TicketStatus } from "../lib/tickets";

// ─── Types ───────────────────────────────────────────────────────────────────

type Analytics = {
  totalTickets: number;
  openTickets: number;
  resolvedTickets: number;
  aiResolvedCount: number;
  humanResolvedCount: number;
  aiResolvedPercent: number;
  humanResolvedPercent: number;
  averageResolutionMinutes: number | null;
  categoryBreakdown: { category: TicketCategory; count: number }[];
  statusBreakdown: { status: TicketStatus; count: number }[];
  dailyVolume: { date: string; count: number }[];
};

// ─── API helpers ─────────────────────────────────────────────────────────────

const API = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

async function fetchAnalytics(): Promise<Analytics> {
  const res = await fetch(`${API}/api/tickets/analytics`, { credentials: "include" });
  if (!res.ok) throw new Error(`Failed to load analytics (${res.status})`);
  return res.json();
}

function formatDuration(minutes: number | null): string {
  if (minutes === null) return "—";
  if (minutes < 60) return `${Math.round(minutes)}m`;
  const hours = minutes / 60;
  if (hours < 24) return `${Math.round(hours * 10) / 10}h`;
  const days = hours / 24;
  return `${Math.round(days * 10) / 10}d`;
}

function formatDayLabel(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ─── KPI card ────────────────────────────────────────────────────────────────

function KpiCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-5">
      <p className="text-sm text-slate-500 mb-1">{label}</p>
      <p className="text-3xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

// ─── Chart card ──────────────────────────────────────────────────────────────

function ChartCard({
  title,
  className = "",
  children,
}: {
  title: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`bg-white rounded-lg border border-slate-200 shadow-sm p-5 ${className}`}>
      <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide mb-4">{title}</h2>
      {children}
    </div>
  );
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

const RESOLVER_COLORS = { ai: "#2563eb", human: "#94a3b8" };
const CATEGORY_COLOR = "#6366f1";
const STATUS_COLORS: Record<TicketStatus, string> = {
  OPEN: "#22c55e",
  RESOLVED: "#3b82f6",
  CLOSED: "#94a3b8",
};
const VOLUME_COLOR = "#2563eb";

export function HomePage() {
  const { data, isPending, error } = useQuery({
    queryKey: ["tickets", "analytics"],
    queryFn: fetchAnalytics,
    refetchInterval: 10_000,
  });

  const resolverData = data
    ? [
        { name: "Resolved by AI", value: data.aiResolvedCount, color: RESOLVER_COLORS.ai },
        { name: "Resolved by Agent", value: data.humanResolvedCount, color: RESOLVER_COLORS.human },
      ]
    : [];

  const categoryData = data?.categoryBreakdown.map((c) => ({ label: categoryLabels[c.category], count: c.count })) ?? [];

  const statusData = data?.statusBreakdown.map((s) => ({ label: s.status, count: s.count, color: STATUS_COLORS[s.status] })) ?? [];

  const volumeData = data?.dailyVolume.map((d) => ({ label: formatDayLabel(d.date), count: d.count })) ?? [];

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="px-6 py-10">
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Dashboard</h1>
        <p className="text-slate-500 mb-6">Welcome to the Ticket Management System.</p>

        {isPending && <p className="text-slate-500">Loading…</p>}

        {error && (
          <p className="text-red-600 bg-red-50 border border-red-200 rounded-md px-4 py-3 text-sm">
            {error.message}
          </p>
        )}

        {data && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <KpiCard label="Total Tickets" value={String(data.totalTickets)} />
              <KpiCard label="Open Tickets" value={String(data.openTickets)} />
              <KpiCard label="Resolved Tickets" value={String(data.resolvedTickets)} />
              <KpiCard label="Average Resolution Time" value={formatDuration(data.averageResolutionMinutes)} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
              <ChartCard title="Resolved by AI vs. Agent">
                {data.resolvedTickets === 0 ? (
                  <p className="text-slate-400 text-sm">No resolved tickets yet.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie
                        data={resolverData}
                        dataKey="value"
                        nameKey="name"
                        innerRadius={60}
                        outerRadius={90}
                        paddingAngle={2}
                        label={({ percent }) => `${Math.round((percent ?? 0) * 100)}%`}
                      >
                        {resolverData.map((entry) => (
                          <Cell key={entry.name} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value, name) => [`${value} tickets`, name]} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>

              <ChartCard title="Tickets by Category">
                {categoryData.every((c) => c.count === 0) ? (
                  <p className="text-slate-400 text-sm">No tickets yet.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={categoryData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                      <CartesianGrid stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 12 }} interval={0} angle={-15} textAnchor="end" height={50} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                      <Tooltip formatter={(value) => [`${value} tickets`, "Count"]} />
                      <Bar dataKey="count" fill={CATEGORY_COLOR} radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>

              <ChartCard title="Tickets by Status">
                {statusData.every((s) => s.count === 0) ? (
                  <p className="text-slate-400 text-sm">No tickets yet.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={260}>
                    <BarChart data={statusData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                      <CartesianGrid stroke="#f1f5f9" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                      <Tooltip formatter={(value) => [`${value} tickets`, "Count"]} />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {statusData.map((entry) => (
                          <Cell key={entry.label} fill={entry.color} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>
            </div>

            <ChartCard title={`Ticket Volume (Last ${data.dailyVolume.length} Days)`}>
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={volumeData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <defs>
                    <linearGradient id="volumeFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={VOLUME_COLOR} stopOpacity={0.3} />
                      <stop offset="95%" stopColor={VOLUME_COLOR} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="#f1f5f9" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value) => [`${value} tickets`, "Created"]} />
                  <Area type="monotone" dataKey="count" stroke={VOLUME_COLOR} fill="url(#volumeFill)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </ChartCard>
          </>
        )}
      </main>
    </div>
  );
}
