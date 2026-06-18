import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiPost } from "../renderer/services/api";
import { useAuth } from "../context/AuthContext";
import { Loader2, Eye, EyeOff } from "lucide-react";
import logo from "../../assets/icon.png";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  const handleSubmit = async (values: LoginValues) => {
    setIsLoading(true);
    setError("");
    try {
      const res = await apiPost("/auth/login", values);

      const token = res?.token || res?.data?.token;
      const user = res?.user || res?.data?.user;

      if (!token || !user) {
        setError("Invalid email or password.");
        setIsLoading(false);
        return;
      }

      login(token, user);
      navigate("/pos");
    } catch (e: any) {
      setError(
        e?.response?.data?.message || e?.message || "Invalid email or password."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "#f5f5f5" }}>
      <div className="w-full max-w-[calc(100vw-2rem)] sm:max-w-xl lg:max-w-3xl bg-white rounded-2xl overflow-hidden flex shadow-2xl">
        {/* LEFT: Green gradient panel */}
        <div
          className="w-[45%] hidden sm:flex flex-col justify-between p-8 relative min-h-[520px]"
          style={{
            background: "linear-gradient(to bottom, #00e060 0%, #00b84a 20%, #007a30 45%, #003a16 70%, #000e05 88%, #000000 100%)",
          }}
        >
          <p className="text-white text-2xl font-bold leading-tight z-10 relative text-left">
            Manage your pharmacy<br />with ease &amp; precision.
          </p>
        </div>

        {/* RIGHT: Form */}
        <div className="flex-1 flex flex-col justify-center px-10 py-10">
          {/* Logo */}
          <div className="mb-5">
            <img src={logo} alt="Pharmacy POS" className="w-[42px] h-[42px]" />
          </div>

          <h1 className="text-3xl font-bold text-gray-900 tracking-tight mb-1">Welcome back</h1>
          <p className="text-sm text-gray-500 mb-6">Sign in to your account to continue</p>

          <div className="h-px bg-gray-200 mb-6" />

          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-5">
            <div>
              <label className="block text-sm text-gray-600 mb-1.5" htmlFor="email">Your email</label>
              <input
                id="email"
                type="email"
                {...form.register("email")}
                className="input-field w-full border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-800 bg-white focus:outline-none focus:border-[#16a34a] focus:shadow-[0_0_0_3px_rgba(22,163,74,0.15)]"
                placeholder="name@pharmacy.com"
              />
              {form.formState.errors.email && (
                <p className="text-xs text-red-500 mt-1">{form.formState.errors.email.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1.5" htmlFor="password">Password</label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  {...form.register("password")}
                  className="input-field w-full border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-800 bg-white pr-10 focus:outline-none focus:border-[#16a34a] focus:shadow-[0_0_0_3px_rgba(22,163,74,0.15)]"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {form.formState.errors.password && (
                <p className="text-xs text-red-500 mt-1">{form.formState.errors.password.message}</p>
              )}
            </div>

            {error && (
              <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="cta-btn w-full bg-[#16a34a] text-white font-semibold text-sm rounded-full py-3.5 mt-1 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ transition: "background-color 0.15s ease, transform 0.1s ease" }}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                "Sign in"
              )}
            </button>

            <div className="flex items-center justify-between text-sm pt-1">
              <p className="text-gray-500">
                Don&apos;t have an account?{" "}
                <Link to="/signup" className="text-gray-800 font-medium underline underline-offset-2 hover:text-[#16a34a] transition-colors">
                  Sign up
                </Link>
              </p>
              <Link to="/forgot-password" className="text-gray-500 hover:text-[#16a34a] transition-colors underline underline-offset-2">
                Forgot password?
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
