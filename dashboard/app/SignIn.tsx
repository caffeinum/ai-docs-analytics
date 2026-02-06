"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";

export function SignIn() {
  const { signIn } = useAuthActions();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signIn("resend", { email });
      setSent(true);
    } catch (err) {
      console.error("Sign in error:", err);
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-8">
        <div className="bg-zinc-900 rounded-lg p-8 max-w-md w-full text-center">
          <div className="text-4xl mb-4">✉️</div>
          <h2 className="text-xl font-semibold mb-2">check your email</h2>
          <p className="text-zinc-400">
            we sent a magic link to <span className="text-zinc-200">{email}</span>
          </p>
          <p className="text-zinc-500 text-sm mt-4">
            click the link to sign in. you can close this tab.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-8">
      <div className="bg-zinc-900 rounded-lg p-8 max-w-md w-full">
        <h1 className="text-2xl font-bold mb-2">AI Docs Analytics</h1>
        <p className="text-zinc-400 mb-6">
          sign in with your work email to see analytics for your domain
        </p>
        <form onSubmit={handleSubmit}>
          <input
            type="email"
            name="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-3 text-zinc-200 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500 mb-4"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-700 text-white font-medium py-3 rounded-lg transition-colors"
          >
            {loading ? "sending..." : "send magic link"}
          </button>
        </form>
        <p className="text-zinc-500 text-sm mt-6 text-center">
          you'll automatically see data for domains matching your email
        </p>
      </div>
    </div>
  );
}
