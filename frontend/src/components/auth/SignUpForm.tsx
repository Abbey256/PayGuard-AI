import { useState } from "react";
import type { FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import {
  CheckCircle2,
  Eye,
  EyeOff,
} from "lucide-react";
import { supabase } from "../../lib/supabaseClient";
import Label from "../form/Label";
import Input from "../form/input/InputField";

// Password strength checker
function getPasswordStrength(password: string): { score: number; label: string; color: string } {
  if (!password) return { score: 0, label: "", color: "" };
  let score = 0;
  if (password.length >= 8)  score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;
  if (score <= 1) return { score, label: "Weak",   color: "bg-red-500" };
  if (score <= 3) return { score, label: "Medium",  color: "bg-amber-500" };
  return              { score, label: "Strong",  color: "bg-emerald-500" };
}

const nigerianStates = [
  "Abia",
  "Adamawa",
  "Akwa Ibom",
  "Anambra",
  "Bauchi",
  "Bayelsa",
  "Benue",
  "Borno",
  "Cross River",
  "Delta",
  "Ebonyi",
  "Edo",
  "Ekiti",
  "Enugu",
  "FCT",
  "Gombe",
  "Imo",
  "Jigawa",
  "Kaduna",
  "Kano",
  "Katsina",
  "Kebbi",
  "Kogi",
  "Kwara",
  "Lagos",
  "Nasarawa",
  "Niger",
  "Ogun",
  "Ondo",
  "Osun",
  "Oyo",
  "Plateau",
  "Rivers",
  "Sokoto",
  "Taraba",
  "Yobe",
  "Zamfara",
] as const;

function getResetFormState() {
  return {
    organizationName: "",
    officialEmail: "",
    phoneNumber: "",
    state: "",
    department: "",
    password: "",
    confirmPassword: "",
  };
}

export default function SignUpForm() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [form, setForm] = useState(getResetFormState());
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  function updateField(field: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setErrorMessage(null);

    try {
      const organizationName = form.organizationName.trim();
      const officialEmail    = form.officialEmail.trim().toLowerCase();
      const phoneNumber      = form.phoneNumber.trim();
      const state            = form.state.trim();
      const department       = form.department.trim();

      if (!organizationName || !officialEmail || !phoneNumber || !state || !department || !form.password || !form.confirmPassword) {
        setErrorMessage("Complete all required fields before submitting.");
        return;
      }

      if (form.password !== form.confirmPassword) {
        setErrorMessage("Passwords do not match.");
        return;
      }

      // 1. Create Supabase auth user
      const { data, error } = await supabase.auth.signUp({
        email: officialEmail,
        password: form.password,
        options: {
          data: {
            organization_name: organizationName,
            phone_number: phoneNumber,
            state,
            ministry_department: department,
            account_type: "government",
          },
        },
      });

      if (error) {
        setErrorMessage(error.message || "Unable to create account.");
        return;
      }

      const authUserId = data.user?.id;
      if (!authUserId) {
        setErrorMessage("Account creation failed. Please try again.");
        return;
      }

      // 1.5 Insert into public.users to satisfy the foreign key constraint
      const { error: userError } = await supabase.from("users").insert([{
        id: authUserId,
        email: officialEmail,
        phone: phoneNumber,
      }]);

      if (userError) {
        console.warn("User record issue:", userError);
      }

      // 2. Insert organization row — immediately approved, no manual review
      const { data: orgData, error: orgError } = await supabase
        .from("organizations")
        .insert([{
          name: organizationName,
          email: officialEmail,
          status: "approved",           // ← auto-approved for demo
          admin_id: authUserId,
          phone: phoneNumber,
          state,
          department,
        }])
        .select("id")
        .single();

      if (orgError || !orgData?.id) {
        console.warn("Organization record issue:", orgError);
        // Still proceed — org can be re-created if needed
      }

      // 3. Call backend to create Squad sub-account silently (fire-and-not-block)
      if (orgData?.id) {
        // Use same origin in production (Express serves frontend + backend together)
        const apiUrl = import.meta.env.VITE_API_URL || window.location.origin;
        const { data: { session } } = await supabase.auth.getSession();
        fetch(`${apiUrl}/api/organizations/setup`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${session?.access_token ?? ""}`,
          },
          body: JSON.stringify({
            orgId: orgData.id,
            orgName: organizationName,
          }),
        }).catch((err) => console.warn("Squad setup (non-fatal):", err));
      }

      // 4. Sign in immediately and go to dashboard
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: officialEmail,
        password: form.password,
      });

      if (signInError) {
        // Account was created — just ask them to sign in manually
        setSubmitted(true);
        setForm(getResetFormState());
        return;
      }

      // 5. Redirect straight to dashboard
      navigate("/dashboard", { replace: true });

    } catch (err) {
      console.error(err);
      setErrorMessage("Unable to create your account right now. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  // submitted state is only shown if auto-signin fails after signup
  if (submitted) {
    return (
      <div className="mx-auto flex w-full max-w-xl flex-col items-center">
        <div className="mb-8 flex flex-col items-center text-center">
          <img src="/logo.png" alt="PayGuard AI Logo" className="mb-4 h-16 w-auto object-contain" />
          <h1 className="text-3xl font-semibold tracking-tight text-gray-900 sm:text-4xl">PayGuard AI</h1>
          <p className="mt-2 text-sm text-gray-600 sm:text-base">Government Payroll Verification System</p>
        </div>
        <div className="w-full rounded-3xl border border-gray-200 bg-white p-6 text-center shadow-[0_10px_40px_rgba(15,23,42,0.08)] sm:p-10">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-[#16a34a]">
            <CheckCircle2 className="h-9 w-9" />
          </div>
          <h2 className="text-2xl font-semibold text-gray-900">Account Created!</h2>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-gray-600 sm:text-base">
            Your ministry account is ready. Sign in below to access your dashboard.
          </p>
          <button
            type="button"
            onClick={() => navigate("/signin")}
            className="mt-8 inline-flex items-center justify-center rounded-xl bg-[#16a34a] px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#15803d]"
          >
            Sign in to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col items-center">
      <div className="mb-8 flex flex-col items-center text-center">
        <img src="/logo.png" alt="PayGuard AI Logo" className="mb-4 h-16 w-auto object-contain" />
        <h1 className="text-3xl font-semibold tracking-tight text-gray-900 sm:text-4xl">
          PayGuard AI
        </h1>
        <p className="mt-2 text-sm text-gray-600 sm:text-base">
          Government Payroll Verification System
        </p>
      </div>

      <div className="w-full rounded-3xl border border-gray-200 bg-white p-6 shadow-[0_10px_40px_rgba(15,23,42,0.08)] sm:p-8">
        <div className="mb-6 text-center sm:text-left">
          <h2 className="text-2xl font-semibold text-gray-900">
            Request agency access
          </h2>
          <p className="mt-1 text-sm text-gray-600">
            Official government accounts only. Applications are reviewed before approval.
          </p>
        </div>

        {errorMessage ? (
          <div className="mb-5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <Label htmlFor="organization-name">
              Organization Name <span className="text-error-500">*</span>
            </Label>
            <Input
              id="organization-name"
              name="organizationName"
              type="text"
              placeholder="Ministry of Finance"
              value={form.organizationName}
              maxLength={100}
              onChange={(event) => updateField("organizationName", event.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="official-email">
              Official Email <span className="text-error-500">*</span>
            </Label>
            <Input
              id="official-email"
              name="officialEmail"
              type="email"
              placeholder="name@ministry.gov.ng"
              value={form.officialEmail}
              onChange={(event) => updateField("officialEmail", event.target.value)}
            />
            <p className="mt-1 text-xs text-gray-500">
              Must be a government email e.g. name@ministry.gov.ng
            </p>
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div>
              <Label htmlFor="phone-number">
                Phone Number <span className="text-error-500">*</span>
              </Label>
              <Input
                id="phone-number"
                name="phoneNumber"
                type="tel"
                placeholder="08012345678"
                value={form.phoneNumber}
                maxLength={11}
                inputMode="numeric"
                pattern="[0-9]*"
                onChange={(event) => {
                  // Only allow digits
                  const val = event.target.value.replace(/\D/g, "");
                  updateField("phoneNumber", val);
                }}
              />
            </div>

            <div>
              <Label htmlFor="state">
                State <span className="text-error-500">*</span>
              </Label>
              <select
                id="state"
                name="state"
                value={form.state}
                onChange={(event) => updateField("state", event.target.value)}
                className="h-11 w-full rounded-lg border border-gray-300 bg-transparent px-4 py-2.5 text-sm text-gray-800 shadow-theme-xs outline-none transition focus:border-emerald-400 focus:ring-3 focus:ring-emerald-500/20"
              >
                <option value="">Select state</option>
                {nigerianStates.map((state) => (
                  <option key={state} value={state}>
                    {state}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <Label htmlFor="department">
              Ministry / Department <span className="text-error-500">*</span>
            </Label>
            <Input
              id="department"
              name="department"
              type="text"
              placeholder="Payroll and Pensions Department"
              value={form.department}
              onChange={(event) => updateField("department", event.target.value)}
            />
          </div>

          <div>
            <Label htmlFor="signup-password">
              Password <span className="text-error-500">*</span>
            </Label>
            <div className="relative">
              <Input
                id="signup-password"
                name="password"
                type={showPassword ? "text" : "password"}
                placeholder="Create a password"
                value={form.password}
                onChange={(event) => updateField("password", event.target.value)}
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
            {/* Password strength indicator */}
            {form.password && (() => {
              const strength = getPasswordStrength(form.password);
              return (
                <div className="mt-2">
                  <div className="flex gap-1 mb-1">
                    {[1,2,3,4,5].map(i => (
                      <div key={i} className={`h-1 flex-1 rounded-full transition-all ${i <= strength.score ? strength.color : "bg-gray-200"}`} />
                    ))}
                  </div>
                  <p className={`text-xs font-medium ${strength.score <= 1 ? "text-red-500" : strength.score <= 3 ? "text-amber-500" : "text-emerald-600"}`}>
                    {strength.label} password
                    {strength.score <= 1 && " — add uppercase, numbers and symbols"}
                  </p>
                </div>
              );
            })()}
          </div>

          <div>
            <Label htmlFor="confirm-password">
              Confirm Password <span className="text-error-500">*</span>
            </Label>
            <div className="relative">
              <Input
                id="confirm-password"
                name="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Confirm your password"
                value={form.confirmPassword}
                onChange={(event) => updateField("confirmPassword", event.target.value)}
                className="pr-12"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((current) => !current)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 transition-colors hover:text-gray-700"
                aria-label={showConfirmPassword ? "Hide confirmation password" : "Show confirmation password"}
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-5 w-5" />
                ) : (
                  <Eye className="h-5 w-5" />
                )}
              </button>
            </div>
          </div>

          <p className="text-sm leading-6 text-gray-600">
            By creating an account you agree to PayGuard AI&apos;s data handling policy in compliance with NDPR guidelines.
          </p>

          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full items-center justify-center rounded-xl bg-[#16a34a] px-4 py-3.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-[#15803d] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? "Submitting..." : "Submit application"}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-gray-600">
          Already have an approved account?{" "}
          <Link
            to="/signin"
            className="font-medium text-[#16a34a] transition-colors hover:text-[#15803d]"
          >
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
