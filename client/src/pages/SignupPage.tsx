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
    <div className="min-h-screen bg-slate-100 flex items-center justify-center">
      <div className="bg-white rounded-xl shadow-lg p-10 w-full max-w-sm">
        <h1 className="text-2xl font-bold text-slate-900 mb-1">Create Account</h1>
        <p className="text-sm text-slate-500 mb-7">Sign up to get started</p>

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Full Name</label>
            <input
              {...register("name")}
              type="text"
              placeholder="Jane Doe"
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {errors.name && (
              <p className="mt-1 text-xs text-red-600">{errors.name.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
            <input
              {...register("email")}
              type="email"
              placeholder="you@example.com"
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {errors.email && (
              <p className="mt-1 text-xs text-red-600">{errors.email.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Password</label>
            <input
              {...register("password")}
              type="password"
              placeholder="••••••••"
              className="w-full px-3 py-2 border border-slate-300 rounded-md text-sm outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {errors.password && (
              <p className="mt-1 text-xs text-red-600">{errors.password.message}</p>
            )}
          </div>

          {serverError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {serverError}
            </p>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white text-sm font-semibold rounded-md transition-colors cursor-pointer disabled:cursor-not-allowed"
          >
            {isSubmitting ? "Creating account..." : "Create Account"}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-slate-500">
          Already have an account?{" "}
          <Link to="/login" className="text-blue-600 font-medium hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
