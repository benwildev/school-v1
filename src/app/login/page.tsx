'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { School, Eye, EyeOff, Loader2, AlertCircle, CheckCircle2, Shield } from 'lucide-react';
function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawRedirect = searchParams.get('redirect');
  const redirect = !rawRedirect || rawRedirect === '/' ? '/dashboard' : rawRedirect;

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const trimmedIdentifier = identifier.trim();
    if (!trimmedIdentifier) {
      setError('দয়া করে আপনার ইমেইল বা মোবাইল নম্বর দিন (Please enter your email or phone).');
      return;
    }
    if (!password) {
      setError('দয়া করে আপনার পাসওয়ার্ড দিন (Please enter your password).');
      return;
    }

    try {
      setLoading(true);
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: trimmedIdentifier,
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        if (res.status === 429) {
          setError('অতিরিক্ত ভুল চেষ্টার কারণে একাউন্ট সাময়িকভাবে লক করা হয়েছে। ১৫ মিনিট পর আবার চেষ্টা করুন। (Too many attempts. Locked for 15 minutes.)');
        } else {
          setError(data.error || 'ভুল ইমেইল/ফোন অথবা পাসওয়ার্ড। আবার চেষ্টা করুন। (Invalid credentials)');
        }
        return;
      }

      setSuccess('লগইন সফল হয়েছে! ড্যাশবোর্ডে প্রবেশ করা হচ্ছে... (Login successful!)');
      setTimeout(() => {
        router.push(redirect);
        router.refresh();
      }, 500);
    } catch (err) {
      console.error('Login submit error:', err);
      setError('সার্ভারে যোগাযোগ করতে সমস্যা হচ্ছে। ইন্টারনেট সংযোগ পরীক্ষা করে পুনরায় চেষ্টা করুন। (Connection error)');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 p-6 sm:p-8">
      {/* Brand Header */}
      <div className="flex flex-col items-center text-center mb-6">
        <div className="size-14 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shadow-md mb-3">
          <School className="size-8" />
        </div>
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">এডুস্মার্ট বিডি</h1>
        <p className="text-xs text-slate-500 font-medium mt-0.5">EduSmart BD — School Management System</p>
        <p className="text-sm text-slate-600 mt-2">আপনার প্রাতিষ্ঠানিক অ্যাকাউন্টে সাইন ইন করুন</p>
      </div>

      {/* Alert Messages */}
      {error && (
        <div
          id="login-error-alert"
          role="alert"
          className="mb-5 flex items-start gap-3 p-3.5 bg-red-50 border border-red-200 text-red-800 rounded-xl text-xs sm:text-sm"
        >
          <AlertCircle className="size-5 text-red-600 shrink-0 mt-0.5" />
          <div className="leading-relaxed font-medium">{error}</div>
        </div>
      )}

      {success && (
        <div
          role="status"
          className="mb-5 flex items-start gap-3 p-3.5 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs sm:text-sm"
        >
          <CheckCircle2 className="size-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="leading-relaxed font-medium">{success}</div>
        </div>
      )}

      {/* Login Form */}
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {/* Identifier Field */}
        <div>
          <label
            htmlFor="identifier"
            className="block text-xs font-semibold text-slate-700 mb-1.5"
          >
            ইমেইল বা মোবাইল নম্বর <span className="text-slate-400 font-normal">(Email or Mobile)</span>
          </label>
          <input
            id="identifier"
            name="identifier"
            type="text"
            autoComplete="username"
            autoFocus
            required
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            placeholder="admin@school.com বা 017xxxxxxxx"
            disabled={loading}
            className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:bg-white transition"
          />
        </div>

        {/* Password Field */}
        <div>
          <label
            htmlFor="password"
            className="block text-xs font-semibold text-slate-700 mb-1.5"
          >
            পাসওয়ার্ড <span className="text-slate-400 font-normal">(Password)</span>
          </label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              disabled={loading}
              className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 focus:bg-white transition pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'পাসওয়ার্ড লুকান (Hide password)' : 'পাসওয়ার্ড দেখুন (Show password)'}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-lg transition"
            >
              {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
          </div>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          id="login-submit-button"
          disabled={loading}
          className="w-full mt-2 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm shadow-md hover:shadow-lg transition disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
        >
          {loading ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              <span>যাচাই করা হচ্ছে...</span>
            </>
          ) : (
            <span>লগইন করুন (Sign In)</span>
          )}
        </button>
      </form>

      {/* Security Footer */}
      <div className="mt-6 pt-5 border-t border-slate-100 flex items-center justify-center gap-1.5 text-xs text-slate-400">
        <Shield className="size-3.5 text-emerald-600" />
        <span>নিরাপদ ও এনক্রিপ্টযুক্ত প্রাতিষ্ঠানিক ডাটা অ্যাক্সেস</span>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-slate-100 flex items-center justify-center p-4 sm:p-6">
      <Suspense
        fallback={
          <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-slate-200 p-8 flex items-center justify-center">
            <Loader2 className="size-6 animate-spin text-emerald-600" />
          </div>
        }
      >
        <LoginForm />
      </Suspense>
    </main>
  );
}
