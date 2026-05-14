import { useState, useEffect } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { Eye, EyeOff, ShieldCheck } from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import Label from "../form/Label";
import Input from "../form/input/InputField";

export default function SignInForm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams.get("expired") === "true") {
      setInfoMessage("Your session has expired due to inactivity. Please sign in again.");
    }
  }, [searchParams]);

  async function handleForgotPassword() {
    setInfoMessage(null);
    setErrorMessage(null);

    if (!email.trim()) {
      setErrorMessage("Enter your official email first to reset your password.");
      return;
    }

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/signin`,
    });

    if (error) {
      setErrorMessage("Unable to send reset email right now. Try again later.");
      return;
    }

    setInfoMessage("Password reset email sent. Check your official inbox.");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setInfoMessage(null);
    setErrorMessage(null);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (error) {
        setErrorMessage("Invalid email or password");
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setErrorMessage("Invalid email or password");
        return;
      }

      navigate("/", { replace: true });
    } catch (err) {
      console.error(err);
      setErrorMessage("Invalid email or password");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-center">
      <div className="mb-8 flex flex-col items-center text-center">
        <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-[#16a34a] shadow-sm ring-1 ring-emerald-100">
          <ShieldCheck className="h-8 w-8" />
        </div>
        <h1 className="text-3xl font-semibold tracking-tight text-gray-900 sm:text-4xl">
          PayGuard AI
        </h1>
        <p className="mt-2 text-sm text-gray-600 sm:text-base">
          Government Payroll Verification System
        </p>
      </div>

      <div className="w-full rounded-3xl border border-gray-200 bg-white p-6 shadow-[0_10px_40px_rgba(15,23,42,0.08)] sm:p-8">
        <div className="mb-6 text-center sm:text-left">
          <h2 className="text-2xl font-semibold text-gray-900">Sign in</h2>
          <p className="mt-1 text-sm text-gray-600">
            Use your official government email to access the dashboard.
          </p>
        </div>

        {errorMessage ? (
          <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        ) : null}

        {infoMessage ? (
          <div className="mb-5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {infoMessage}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <Label htmlFor="signin-email">
              Official Email <span className="text-error-500">*</span>
            </Label>
            <Input
              id="signin-email"
              type="email"
              name="email"
              placeholder="name@ministry.gov.ng"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="signin-password">
              Password <span className="text-error-500">*</span>
            </Label>
            <div className="relative">
              <Input
                id="signin-password"
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="Enter your password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="pr-12"
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 transition-colors hover:text-gray-700"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>

          <div className="flex items-center justify-end">
            <button
              type="button"
              onClick={handleForgotPassword}
              className="text-sm font-medium text-[#16a34a] transition-colors hover:text-[#15803d]"
            >
              Forgot password?
            </button>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full items-center justify-center rounded-xl bg-[#16a34a] px-4 py-3.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#15803d] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-gray-600">
          New agency?{" "}
          <Link
            to="/signup"
            className="font-medium text-[#16a34a] transition-colors hover:text-[#15803d]"
          >
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
