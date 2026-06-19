import { useState } from "react";
import { Navigate, useNavigate, Link } from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { authClient } from "../lib/auth-client";

const schema = z.object({
  name: z.string().min(1, "Full name is required"),
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type SignupFormData = z.infer<typeof schema>;

export function SignupPage() {
  const navigate = useNavigate();
  const { data: session, isPending } = authClient.useSession();
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupFormData>({ resolver: zodResolver(schema) });

  if (isPending) return null;
  if (session) return <Navigate to="/" replace />;

  const onSubmit = async (data: SignupFormData) => {
    setServerError(null);
    const { error } = await authClient.signUp.email(data);
    if (error) {
      setServerError(error.message ?? "Failed to create account.");
    } else {
      navigate("/");
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0e1116] px-4">
      <div className="w-full max-w-sm rounded-xl border border-white/10 bg-card p-10 shadow-xl">
        <p className="mb-6 font-heading text-sm font-semibold tracking-wide text-foreground">
          Ticket<span className="text-signal">/</span>Desk
        </p>
        <h1 className="mb-1 font-heading text-2xl font-semibold text-foreground">Create Account</h1>
        <p className="mb-7 text-sm text-muted-foreground">Sign up to get started</p>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
          <div>
            <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-foreground/80">Full Name</label>
            <input
              {...register("name")}
              id="name"
              type="text"
              placeholder="Jane Doe"
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-harbor"
            />
            {errors.name && (
              <p className="mt-1 text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-foreground/80">Email</label>
            <input
              {...register("email")}
              id="email"
              type="email"
              placeholder="you@example.com"
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-harbor"
            />
            {errors.email && (
              <p className="mt-1 text-xs text-destructive">{errors.email.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-foreground/80">Password</label>
            <input
              {...register("password")}
              id="password"
              type="password"
              placeholder="••••••••"
              className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm outline-none focus:border-transparent focus:ring-2 focus:ring-harbor"
            />
            {errors.password && (
              <p className="mt-1 text-xs text-destructive">{errors.password.message}</p>
            )}
          </div>

          {serverError && (
            <p className="rounded-md border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {serverError}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full cursor-pointer rounded-md bg-signal py-2.5 text-sm font-semibold text-signal-foreground transition-colors hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-harbor hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
