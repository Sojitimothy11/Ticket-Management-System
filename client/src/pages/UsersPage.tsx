import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Trash2 } from "lucide-react";
import { Navbar } from "../components/Navbar";

// ─── Types ───────────────────────────────────────────────────────────────────

type User = {
  id: string;
  name: string;
  email: string;
  role: "ADMIN" | "AGENT";
  emailVerified: boolean;
  createdAt: string;
};

// ─── API helpers ─────────────────────────────────────────────────────────────

const API = import.meta.env.VITE_API_URL ?? "http://localhost:3000";

async function fetchUsers(): Promise<User[]> {
  const res = await fetch(`${API}/api/users`, { credentials: "include" });
  if (!res.ok) throw new Error(`Failed to load users (${res.status})`);
  return res.json();
}

async function createUser(body: { name: string; email: string; password: string; role: "AGENT" | "ADMIN" }): Promise<User> {
  const res = await fetch(`${API}/api/users`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to create user");
  return data;
}

async function deleteUser(id: string): Promise<void> {
  const res = await fetch(`${API}/api/users/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (!res.ok) {
    const data = await res.json();
    throw new Error(data.error ?? "Failed to delete user");
  }
}

async function updateUser(id: string, body: { name: string; email: string; role: "AGENT" | "ADMIN"; password?: string }): Promise<User> {
  const res = await fetch(`${API}/api/users/${id}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Failed to update user");
  return data;
}

// ─── Shared form field component ─────────────────────────────────────────────

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 mb-1.5">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}

function inputCls(hasError: boolean) {
  return `w-full px-3 py-2 border rounded-md text-sm outline-none focus:ring-2 focus:border-transparent ${
    hasError ? "border-red-400 focus:ring-red-400" : "border-slate-300 focus:ring-blue-500"
  }`;
}

// ─── Create User Modal ───────────────────────────────────────────────────────

const createSchema = z.object({
  name: z.string().trim().min(1, "Full name is required"),
  email: z.string().trim().email("Invalid email address"),
  password: z.string().trim().min(8, "Password must be at least 8 characters"),
  role: z.enum(["AGENT", "ADMIN"]),
});
type CreateFormData = z.infer<typeof createSchema>;

function CreateUserModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const backdropRef = useRef<HTMLDivElement>(null);

  const { register, handleSubmit, formState: { errors }, reset } = useForm<CreateFormData>({
    resolver: zodResolver(createSchema),
    defaultValues: { role: "AGENT" },
  });

  const mutation = useMutation({
    mutationFn: createUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      reset();
      onClose();
    },
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onMouseDown={(e) => { if (e.target === backdropRef.current) onClose(); }}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-slate-900">Create User</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors text-xl leading-none cursor-pointer" aria-label="Close">×</button>
        </div>

        <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="flex flex-col gap-4">
          <Field label="Full Name" error={errors.name?.message}>
            <input {...register("name")} type="text" placeholder="Jane Doe" className={inputCls(!!errors.name)} />
          </Field>

          <Field label="Email" error={errors.email?.message}>
            <input {...register("email")} type="email" placeholder="jane@example.com" autoComplete="off" className={inputCls(!!errors.email)} />
          </Field>

          <Field label="Password" error={errors.password?.message}>
            <input {...register("password")} type="password" placeholder="••••••••" autoComplete="new-password" className={inputCls(!!errors.password)} />
          </Field>

          <Field label="Role">
            <select {...register("role")} className={inputCls(false) + " bg-white"}>
              <option value="AGENT">Agent</option>
              <option value="ADMIN">Admin</option>
            </select>
          </Field>

          {mutation.isError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {mutation.error.message}
            </p>
          )}

          <div className="flex justify-end gap-3 mt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors cursor-pointer">
              Cancel
            </button>
            <button type="submit" disabled={mutation.isPending} className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed rounded-md transition-colors cursor-pointer">
              {mutation.isPending ? "Creating…" : "Create User"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Edit User Modal ──────────────────────────────────────────────────────────

const editSchema = z.object({
  name: z.string().trim().min(1, "Full name is required"),
  email: z.string().trim().email("Invalid email address"),
  password: z.string().trim().refine(
    (val) => val === "" || val.length >= 8,
    { message: "Password must be at least 8 characters" }
  ),
  role: z.enum(["AGENT", "ADMIN"]),
});
type EditFormData = z.infer<typeof editSchema>;

function EditUserModal({ user, onClose }: { user: User; onClose: () => void }) {
  const queryClient = useQueryClient();
  const backdropRef = useRef<HTMLDivElement>(null);

  const { register, handleSubmit, formState: { errors } } = useForm<EditFormData>({
    resolver: zodResolver(editSchema),
    defaultValues: { name: user.name, email: user.email, role: user.role, password: "" },
  });

  const mutation = useMutation({
    mutationFn: (data: EditFormData) =>
      updateUser(user.id, {
        name: data.name,
        email: data.email,
        role: data.role,
        ...(data.password ? { password: data.password } : {}),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      onClose();
    },
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onMouseDown={(e) => { if (e.target === backdropRef.current) onClose(); }}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-slate-900">Edit User</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors text-xl leading-none cursor-pointer" aria-label="Close">×</button>
        </div>

        <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="flex flex-col gap-4">
          <Field label="Full Name" error={errors.name?.message}>
            <input {...register("name")} type="text" className={inputCls(!!errors.name)} />
          </Field>

          <Field label="Email" error={errors.email?.message}>
            <input {...register("email")} type="email" autoComplete="off" className={inputCls(!!errors.email)} />
          </Field>

          <Field label="New Password (leave blank to keep current)" error={errors.password?.message}>
            <input {...register("password")} type="password" placeholder="••••••••" autoComplete="new-password" className={inputCls(!!errors.password)} />
          </Field>

          <Field label="Role">
            <select {...register("role")} className={inputCls(false) + " bg-white"}>
              <option value="AGENT">Agent</option>
              <option value="ADMIN">Admin</option>
            </select>
          </Field>

          {mutation.isError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {mutation.error.message}
            </p>
          )}

          <div className="flex justify-end gap-3 mt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors cursor-pointer">
              Cancel
            </button>
            <button type="submit" disabled={mutation.isPending} className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 disabled:cursor-not-allowed rounded-md transition-colors cursor-pointer">
              {mutation.isPending ? "Saving…" : "Save Changes"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────

function DeleteConfirmModal({ user, onClose }: { user: User; onClose: () => void }) {
  const queryClient = useQueryClient();
  const backdropRef = useRef<HTMLDivElement>(null);

  const mutation = useMutation({
    mutationFn: () => deleteUser(user.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      onClose();
    },
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      ref={backdropRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onMouseDown={(e) => { if (e.target === backdropRef.current) onClose(); }}
    >
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4 p-6">
        <div className="flex items-center gap-3 mb-3">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-red-100 shrink-0">
            <Trash2 size={18} className="text-red-600" />
          </div>
          <h2 className="text-lg font-semibold text-slate-900">Delete User</h2>
        </div>

        <p className="text-sm text-slate-600 mb-1">
          Are you sure you want to delete <span className="font-medium text-slate-900">{user.name}</span>?
        </p>
        <p className="text-sm text-slate-400 mb-6">This action can be undone by an administrator.</p>

        {mutation.isError && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2 mb-4">
            {mutation.error.message}
          </p>
        )}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={mutation.isPending}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 rounded-md transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="px-4 py-2 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 disabled:bg-red-300 disabled:cursor-not-allowed rounded-md transition-colors cursor-pointer"
          >
            {mutation.isPending ? "Deleting…" : "Delete"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Users Page ──────────────────────────────────────────────────────────────

export function UsersPage() {
  const [createOpen, setCreateOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deletingUser, setDeletingUser] = useState<User | null>(null);

  const { data: users, isPending, error } = useQuery({
    queryKey: ["users"],
    queryFn: fetchUsers,
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <Navbar />
      <main className="px-6 py-10">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-slate-900">Users</h1>
          <button
            onClick={() => setCreateOpen(true)}
            className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors cursor-pointer"
          >
            Create User
          </button>
        </div>

        {isPending && <p className="text-slate-500">Loading…</p>}

        {error && (
          <p className="text-red-600 bg-red-50 border border-red-200 rounded-md px-4 py-3 text-sm">
            {error.message}
          </p>
        )}

        {users && (
          <div className="rounded-lg border border-slate-200 overflow-hidden bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Email</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Role</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Verified</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-600">Member Since</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-slate-400">
                      No users found.
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-900">{user.name}</td>
                      <td className="px-4 py-3 text-slate-600">{user.email}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${user.role === "ADMIN" ? "bg-orange-100 text-orange-700" : "bg-blue-100 text-blue-700"}`}>
                          {user.role}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${user.emailVerified ? "bg-green-100 text-green-700" : "bg-slate-100 text-slate-500"}`}>
                          {user.emailVerified ? "Verified" : "Unverified"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-500">
                        {new Date(user.createdAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setEditingUser(user)}
                            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                            aria-label={`Edit ${user.name}`}
                          >
                            <Pencil size={14} />
                          </button>
                          {user.role !== "ADMIN" && (
                            <button
                              onClick={() => setDeletingUser(user)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                              aria-label={`Delete ${user.name}`}
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {createOpen && <CreateUserModal onClose={() => setCreateOpen(false)} />}
      {editingUser && <EditUserModal user={editingUser} onClose={() => setEditingUser(null)} />}
      {deletingUser && <DeleteConfirmModal user={deletingUser} onClose={() => setDeletingUser(null)} />}
    </div>
  );
}
