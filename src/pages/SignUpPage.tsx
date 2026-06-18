import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiPost } from "../renderer/services/api";
import { useAuth } from "../context/AuthContext";
import { Loader2, Eye, EyeOff } from "lucide-react";
import logo from "../../assets/icon.png";

const SECURITY_QUESTIONS = [
  "What is your pet's name?",
  "What city were you born in?",
  "What is your mother's maiden name?",
  "What was the name of your first school?",
  "What is your favorite book?",
  "What is your favorite movie?",
  "What was the model of your first car?",
  "What is your favorite food?",
];

const signupSchema = z
  .object({
    shop_name: z.string().min(1, "Shop name is required"),
    name: z.string().min(1, "Name is required"),
    email: z.string().email("Enter a valid email address"),
    password: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string().min(1, "Please confirm your password"),
    security_question: z.string().min(1, "Please select a security question"),
    security_answer: z.string().min(1, "Please provide an answer"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

type SignupValues = z.infer<typeof signupSchema>;

export default function SignupPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const form = useForm<SignupValues>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      shop_name: "",
      name: "",
      email: "",
      password: "",
      confirmPassword: "",
      security_question: "",
      security_answer: "",
    },
  });

  const handleSubmit = async (values: SignupValues) => {
    setIsLoading(true);
    setError("");
    try {
      const res = await apiPost("/auth/register", {
        shop_name: values.shop_name,
        name: values.name,
        email: values.email,
        password: values.password,
        security_question: values.security_question,
        security_answer: values.security_answer,
      });

      const token = res?.token || res?.data?.token;
      const user = res?.user || res?.data?.user;

      if (!token || !user) {
        setError("Signup response invalid. Please try again.");
        setIsLoading(false);
        return;
      }

      login(token, user);
      navigate("/pos");
    } catch (e: any) {
      setError(
        e?.response?.data?.message ||
          e?.response?.data?.error ||
          e?.message ||
          "Signup failed. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "#f5f5f5" }}>
      <div className="w-full max-w-[calc(100vw-2rem)] lg:max-w-4xl xl:max-w-6xl bg-white rounded-2xl overflow-hidden flex shadow-2xl">
        {/* LEFT: Green gradient panel */}
        <div
          className="w-[45%] hidden sm:flex flex-col justify-between p-8 relative min-h-[560px]"
          style={{
            background: "linear-gradient(to bottom, #00e060 0%, #00b84a 20%, #007a30 45%, #003a16 70%, #000e05 88%, #000000 100%)",
          }}
        >
          <p className="text-white text-4xl font-bold leading-tight z-10 relative text-left">
            Manage your pharmacy<br />with ease &amp; precision.
          </p>
        </div>

        {/* RIGHT: Form */}
        <div className="flex-1 flex flex-col justify-center px-10 py-10">
          {/* Logo */}
          <div className="mb-5">
            <img src={logo} alt="Pharmacy POS" className="w-[42px] h-[42px]" />
          </div>

          <h1 className="text-3xl font-bold text-gray-900 tracking-tight mb-1">Get Started</h1>
          <p className="text-sm text-gray-500 mb-6">Welcome to Pharmacy POS — Let's get started</p>

          <div className="h-px bg-gray-200 mb-6" />

          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1.5" htmlFor="shop_name">Shop Name</label>
                <input
                  id="shop_name"
                  type="text"
                  {...form.register("shop_name")}
                  className="input-field w-full border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-800 bg-white focus:outline-none focus:border-[#16a34a] focus:shadow-[0_0_0_3px_rgba(22,163,74,0.15)]"
                  placeholder="Your pharmacy name"
                />
                {form.formState.errors.shop_name && (
                  <p className="text-xs text-red-500 mt-1">{form.formState.errors.shop_name.message}</p>
                )}
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1.5" htmlFor="name">Your Name</label>
                <input
                  id="name"
                  type="text"
                  {...form.register("name")}
                  className="input-field w-full border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-800 bg-white focus:outline-none focus:border-[#16a34a] focus:shadow-[0_0_0_3px_rgba(22,163,74,0.15)]"
                  placeholder="Admin name"
                />
                {form.formState.errors.name && (
                  <p className="text-xs text-red-500 mt-1">{form.formState.errors.name.message}</p>
                )}
              </div>
            </div>

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
              <label className="block text-sm text-gray-600 mb-1.5" htmlFor="password">Create new password</label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  {...form.register("password")}
                  className="input-field w-full border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-800 bg-white pr-10 focus:outline-none focus:border-[#16a34a] focus:shadow-[0_0_0_3px_rgba(22,163,74,0.15)]"
                  placeholder="At least 6 characters"
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

            <div>
              <label className="block text-sm text-gray-600 mb-1.5" htmlFor="confirmPassword">Confirm password</label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? "text" : "password"}
                  {...form.register("confirmPassword")}
                  className="input-field w-full border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-800 bg-white pr-10 focus:outline-none focus:border-[#16a34a] focus:shadow-[0_0_0_3px_rgba(22,163,74,0.15)]"
                  placeholder="Confirm your password"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                >
                  {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {form.formState.errors.confirmPassword && (
                <p className="text-xs text-red-500 mt-1">{form.formState.errors.confirmPassword.message}</p>
              )}
            </div>

            <div className="border-t border-gray-100 pt-4 mt-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Security Question (for password reset)</p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1.5" htmlFor="security_question">Choose a question</label>
                  <div className="relative">
                    <select
                      id="security_question"
                      {...form.register("security_question")}
                      className="h-11 w-full appearance-none rounded-xl border border-gray-200 bg-white pl-4 pr-10 text-sm text-gray-800 shadow-sm transition-all outline-none hover:border-gray-300 focus:border-[#16a34a] focus:shadow-[0_0_0_3px_rgba(22,163,74,0.15)] cursor-pointer"
                    >
                      <option value="" disabled>Select a security question</option>
                      {SECURITY_QUESTIONS.map((q) => (
                        <option key={q} value={q}>{q}</option>
                      ))}
                    </select>
                    <svg className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                    </svg>
                  </div>
                  {form.formState.errors.security_question && (
                    <p className="text-xs text-red-500 mt-1">{form.formState.errors.security_question.message}</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1.5" htmlFor="security_answer">Your answer</label>
                  <input
                    id="security_answer"
                    type="text"
                    {...form.register("security_answer")}
                    className="input-field w-full border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-800 bg-white focus:outline-none focus:border-[#16a34a] focus:shadow-[0_0_0_3px_rgba(22,163,74,0.15)]"
                    placeholder="Enter your answer"
                  />
                  {form.formState.errors.security_answer && (
                    <p className="text-xs text-red-500 mt-1">{form.formState.errors.security_answer.message}</p>
                  )}
                </div>
              </div>
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
                  Creating account...
                </>
              ) : (
                "Create new account"
              )}
            </button>

            <p className="text-center text-sm text-gray-500 pt-1">
              Already have an account?{" "}
              <Link to="/login" className="text-gray-800 font-medium underline underline-offset-2 hover:text-[#16a34a] transition-colors">
                Sign in
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
