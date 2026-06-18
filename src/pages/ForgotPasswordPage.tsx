import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { apiPost } from "../renderer/services/api";
import { Loader2, CheckCircle2, ArrowLeft } from "lucide-react";
import logo from "../../assets/icon.png";

type Step = "email" | "answer" | "reset" | "done";

export default function ForgotPasswordPage() {
  const [step, setStep] = useState<Step>("email");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const [email, setEmail] = useState("");
  const [securityQuestion, setSecurityQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const navigate = useNavigate();

  const handleGetQuestion = async () => {
    if (!email) { setError("Please enter your email"); return; }
    setIsLoading(true);
    setError("");
    try {
      const res = await apiPost("/auth/forgot-password", { email });
      const q = res?.security_question || res?.data?.security_question;
      if (!q) { setError("No security question found for this account."); return; }
      setSecurityQuestion(q);
      setStep("answer");
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || "Email not found");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyAnswer = async () => {
    if (!answer) { setError("Please answer the security question"); return; }
    setIsLoading(true);
    setError("");
    try {
      const res = await apiPost("/auth/verify-answer", { email, answer });
      const token = res?.token || res?.data?.token;
      if (!token) { setError("Verification failed. Try again."); return; }
      setResetToken(token);
      setStep("reset");
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || "Incorrect answer");
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) { setError("Password must be at least 6 characters"); return; }
    if (newPassword !== confirmPassword) { setError("Passwords do not match"); return; }
    setIsLoading(true);
    setError("");
    try {
      await apiPost("/auth/reset-password", { token: resetToken, newPassword });
      setStep("done");
    } catch (e: any) {
      setError(e?.response?.data?.error || e?.message || "Reset failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const StepIndicator = () => (
    <div className="flex items-center justify-center gap-2 mb-6">
      {["email", "answer", "reset"].map((s, i) => (
        <div key={s} className="flex items-center gap-2">
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
              step === s || (step === "done" && i <= 2)
                ? "bg-[#16a34a] text-white"
                : step === "answer" && i === 0
                ? "bg-[#16a34a] text-white"
                : step === "reset" && i <= 1
                ? "bg-[#16a34a] text-white"
                : "bg-gray-200 text-gray-500"
            }`}
          >
            {step === "done" && i <= 2 ? <CheckCircle2 className="h-4 w-4" /> : (step === "answer" && i === 0) ? <CheckCircle2 className="h-4 w-4" /> : (step === "reset" && i <= 1) ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
          </div>
          {i < 2 && <div className={`w-8 h-0.5 ${step !== "email" ? "bg-[#16a34a]" : "bg-gray-200"}`} />}
        </div>
      ))}
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: "#f5f5f5" }}>
      <div className="w-full max-w-[calc(100vw-2rem)] sm:max-w-xl lg:max-w-3xl bg-white rounded-2xl overflow-hidden flex shadow-2xl">
        <div
          className="w-[45%] hidden sm:flex flex-col justify-between p-8 relative min-h-[520px]"
          style={{
            background: "linear-gradient(to bottom, #00e060 0%, #00b84a 20%, #007a30 45%, #003a16 70%, #000e05 88%, #000000 100%)",
          }}
        >
          <p className="text-white text-2xl font-bold leading-tight z-10 relative text-left">
            Reset your password<br />securely with your<br />security question.
          </p>
        </div>

        <div className="flex-1 flex flex-col justify-center px-10 py-10">
          <div className="mb-5">
            <img src={logo} alt="Pharmacy POS" className="w-[42px] h-[42px]" />
          </div>

          <h1 className="text-3xl font-bold text-gray-900 tracking-tight mb-1">
            {step === "email" && "Forgot Password"}
            {step === "answer" && "Security Question"}
            {step === "reset" && "Create New Password"}
            {step === "done" && "Password Reset!"}
          </h1>
          <p className="text-sm text-gray-500 mb-6">
            {step === "email" && "Enter your email to get started"}
            {step === "answer" && "Answer your security question"}
            {step === "reset" && "Choose a new password for your account"}
            {step === "done" && "Your password has been reset successfully"}
          </p>

          <div className="h-px bg-gray-200 mb-6" />

          <StepIndicator />

          {step === "email" && (
            <div className="space-y-5">
              <div>
                <label className="block text-sm text-gray-600 mb-1.5" htmlFor="email">Your email</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="input-field w-full border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-800 bg-white focus:outline-none focus:border-[#16a34a] focus:shadow-[0_0_0_3px_rgba(22,163,74,0.15)]"
                  placeholder="name@pharmacy.com"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                  <span>{error}</span>
                </div>
              )}

              <button
                onClick={handleGetQuestion}
                disabled={isLoading}
                className="w-full bg-[#16a34a] text-white font-semibold text-sm rounded-full py-3.5 mt-1 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Verifying...</>
                ) : (
                  "Continue"
                )}
              </button>

              <p className="text-center text-sm text-gray-500 pt-1">
                <Link to="/login" className="text-gray-800 font-medium underline underline-offset-2 hover:text-[#16a34a] transition-colors inline-flex items-center gap-1">
                  <ArrowLeft className="h-3 w-3" /> Back to login
                </Link>
              </p>
            </div>
          )}

          {step === "answer" && (
            <div className="space-y-5">
              <div className="rounded-lg border border-gray-200 bg-gray-50 px-4 py-3">
                <p className="text-xs text-gray-500 mb-1">Security Question</p>
                <p className="text-sm font-medium text-gray-800">{securityQuestion}</p>
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1.5" htmlFor="answer">Your answer</label>
                <input
                  id="answer"
                  type="text"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  className="input-field w-full border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-800 bg-white focus:outline-none focus:border-[#16a34a] focus:shadow-[0_0_0_3px_rgba(22,163,74,0.15)]"
                  placeholder="Enter your answer"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                  <span>{error}</span>
                </div>
              )}

              <button
                onClick={handleVerifyAnswer}
                disabled={isLoading}
                className="w-full bg-[#16a34a] text-white font-semibold text-sm rounded-full py-3.5 mt-1 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Verifying...</>
                ) : (
                  "Verify Answer"
                )}
              </button>

              <p className="text-center text-sm text-gray-500 pt-1">
                <button onClick={() => { setStep("email"); setError(""); }} className="text-gray-800 font-medium underline underline-offset-2 hover:text-[#16a34a] transition-colors inline-flex items-center gap-1">
                  <ArrowLeft className="h-3 w-3" /> Try a different email
                </button>
              </p>
            </div>
          )}

          {step === "reset" && (
            <div className="space-y-5">
              <div>
                <label className="block text-sm text-gray-600 mb-1.5" htmlFor="newPassword">New password</label>
                <input
                  id="newPassword"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="input-field w-full border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-800 bg-white focus:outline-none focus:border-[#16a34a] focus:shadow-[0_0_0_3px_rgba(22,163,74,0.15)]"
                  placeholder="At least 6 characters"
                />
              </div>

              <div>
                <label className="block text-sm text-gray-600 mb-1.5" htmlFor="confirmPassword">Confirm password</label>
                <input
                  id="confirmPassword"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="input-field w-full border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-800 bg-white focus:outline-none focus:border-[#16a34a] focus:shadow-[0_0_0_3px_rgba(22,163,74,0.15)]"
                  placeholder="Confirm your password"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                  <span>{error}</span>
                </div>
              )}

              <button
                onClick={handleResetPassword}
                disabled={isLoading}
                className="w-full bg-[#16a34a] text-white font-semibold text-sm rounded-full py-3.5 mt-1 flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Resetting...</>
                ) : (
                  "Reset Password"
                )}
              </button>
            </div>
          )}

          {step === "done" && (
            <div className="space-y-5">
              <div className="flex flex-col items-center py-4">
                <CheckCircle2 className="h-16 w-16 text-[#16a34a] mb-3" />
                <p className="text-center text-sm text-gray-600">
                  You can now sign in with your new password.
                </p>
              </div>

              <button
                onClick={() => navigate("/login")}
                className="w-full bg-[#16a34a] text-white font-semibold text-sm rounded-full py-3.5 mt-1 flex items-center justify-center gap-2"
              >
                Sign in with new password
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
