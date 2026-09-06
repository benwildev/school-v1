'use client';

import React, { useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  School,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  CheckCircle2,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  Lock,
  Mail,
  GraduationCap,
  Users,
  CreditCard,
  Sparkles,
  HelpCircle,
  Check,
  ChevronRight,
  BookOpen,
} from 'lucide-react';

interface RolePreset {
  id: string;
  roleBn: string;
  roleEn: string;
  identifier: string;
  badge: string;
  icon: React.ElementType;
}

const DEMO_ROLES: RolePreset[] = [
  {
    id: 'admin',
    roleBn: 'অধ্যক্ষ / অ্যাডমিন',
    roleEn: 'Admin',
    identifier: 'admin@dhaka-ideal.bd',
    badge: 'পূর্ণ নিয়ন্ত্রণ',
    icon: School,
  },
  {
    id: 'teacher',
    roleBn: 'শিক্ষক',
    roleEn: 'Teacher',
    identifier: 'teacher@dhaka-ideal.bd',
    badge: 'ক্লাস ও গ্রেডিং',
    icon: GraduationCap,
  },
  {
    id: 'accountant',
    roleBn: 'হিসাবরক্ষক',
    roleEn: 'Finance',
    identifier: 'accountant@dhaka-ideal.bd',
    badge: 'ফি ও ব্যাংকিং',
    icon: CreditCard,
  },
  {
    id: 'student',
    roleBn: 'শিক্ষার্থী',
    roleEn: 'Student',
    identifier: 'student@dhaka-ideal.bd',
    badge: 'ফলাফল ও রুটিন',
    icon: BookOpen,
  },
  {
    id: 'parent',
    roleBn: 'অভিভাবক',
    roleEn: 'Parent',
    identifier: 'parent@dhaka-ideal.bd',
    badge: 'হাজিরা ও প্রগ্রেস',
    icon: Users,
  },
];

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const rawRedirect = searchParams.get('redirect');
  const redirect = !rawRedirect || rawRedirect === '/' ? '/dashboard' : rawRedirect;

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeRole, setActiveRole] = useState<string | null>(null);
  const [showForgotHelp, setShowForgotHelp] = useState(false);

  function handleSelectRole(preset: RolePreset) {
    setIdentifier(preset.identifier);
    setPassword('Pass123!@#');
    setActiveRole(preset.id);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const trimmedIdentifier = identifier.trim();
    if (!trimmedIdentifier) {
      setError('দয়া করে আপনার ইমেইল বা মোবাইল নম্বর দিন (Please enter your email or phone).');
      return;
    }
    if (!password) {
      setError('দয়া করে আপনার পাসওয়ার্ড দিন (Please enter your password).');
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

      let data: any = null;
      try {
        data = await res.json();
      } catch {
        // Non-JSON response
      }

      if (!res.ok || !data?.success) {
        if (res.status === 429) {
          setError(
            'অতিরিক্ত ভুল চেষ্টার কারণে একাউন্ট সাময়িকভাবে লক করা হয়েছে। ১৫ মিনিট পর আবার চেষ্টা করুন। (Too many attempts. Locked for 15 minutes.)'
          );
        } else {
          setError(
            data?.error || 'ভুল ইমেইল/ফোন অথবা পাসওয়ার্ড। আবার চেষ্টা করুন। (Invalid credentials)'
          );
        }
        return;
      }

      setSuccess('লগইন সফল হয়েছে! ড্যাশবোর্ডে প্রবেশ করা হচ্ছে... (Login successful!)');
      setTimeout(() => {
        router.push(redirect);
        router.refresh();
      }, 500);
    } catch (err) {
      console.error('Login submit error:', err);
      setError(
        'সার্ভারে যোগাযোগ করতে সমস্যা হচ্ছে। ইন্টারনেট সংযোগ পরীক্ষা করে পুনরায় চেষ্টা করুন। (Connection error)'
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="w-full max-w-lg bg-white/95 backdrop-blur-md rounded-3xl shadow-2xl shadow-emerald-950/10 border border-slate-200/80 p-6 sm:p-10 transition-all">
      {/* Mobile-Only Header Brand */}
      <div className="lg:hidden flex items-center justify-between pb-6 mb-6 border-b border-slate-100">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-700 to-teal-500 text-white flex items-center justify-center shadow-md shadow-emerald-600/20">
            <School className="w-5 h-5" />
          </div>
          <div>
            <span className="font-bold text-slate-900 text-base leading-tight block">
              এডুস্মার্ট বিডি
            </span>
            <span className="text-[11px] text-slate-500 font-medium">EduSmart BD ERP</span>
          </div>
        </Link>
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 hover:text-emerald-800 transition"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> হোমপেজ
        </Link>
      </div>

      {/* Form Header */}
      <div className="mb-6">
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200/60 text-emerald-800 text-xs font-semibold mb-3">
          <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
          <span>নিরাপদ প্রাতিষ্ঠানিক এক্সেস</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
          স্বাগতম! সাইন ইন করুন
        </h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1.5 leading-relaxed">
          আপনার শিক্ষাপ্রতিষ্ঠানের একাউন্ট ক্রেডেনশিয়াল দিয়ে প্রবেশ করুন।
        </p>
      </div>

      {/* Quick Demo Role Selector */}
      <div className="mb-6 p-3.5 sm:p-4 rounded-2xl bg-gradient-to-b from-slate-50 to-emerald-50/30 border border-slate-200/70">
        <div className="flex items-center justify-between mb-2.5">
          <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <GraduationCap className="w-3.5 h-3.5 text-emerald-600" />
            দ্রুত ডেমো রোল নির্বাচন (Quick Fill):
          </span>
          <span className="text-[11px] font-medium text-slate-400">১-ক্লিকে টেস্ট</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
          {DEMO_ROLES.map((role) => {
            const isSelected = activeRole === role.id;
            return (
              <button
                key={role.id}
                type="button"
                onClick={() => handleSelectRole(role)}
                className={`text-left px-2.5 py-2 rounded-xl text-xs font-semibold transition-all flex items-center justify-between border cursor-pointer ${
                  isSelected
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/50'
                }`}
              >
                <div className="truncate">
                  <div className="font-bold truncate text-[11px] sm:text-xs">{role.roleBn}</div>
                  <div
                    className={`text-[10px] font-normal truncate ${
                      isSelected ? 'text-emerald-100' : 'text-slate-400'
                    }`}
                  >
                    {role.roleEn}
                  </div>
                </div>
                {isSelected && <Check className="w-3.5 h-3.5 shrink-0 ml-1" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Alert Messages */}
      {error && (
        <div
          id="login-error-alert"
          role="alert"
          className="mb-5 flex items-start gap-3 p-3.5 bg-red-50/90 border border-red-200 text-red-800 rounded-2xl text-xs sm:text-sm animate-in fade-in duration-200 shadow-sm"
        >
          <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
          <div className="leading-relaxed font-medium">{error}</div>
        </div>
      )}

      {success && (
        <div
          id="login-success-alert"
          role="status"
          className="mb-5 flex items-start gap-3 p-3.5 bg-emerald-50/90 border border-emerald-200 text-emerald-800 rounded-2xl text-xs sm:text-sm animate-in fade-in duration-200 shadow-sm"
        >
          <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
          <div className="leading-relaxed font-medium">{success}</div>
        </div>
      )}

      {/* Login Form */}
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        {/* Identifier Field */}
        <div>
          <label
            htmlFor="identifier"
            className="block text-xs font-bold text-slate-700 mb-1.5 tracking-wide"
          >
            ইমেইল বা মোবাইল নম্বর{' '}
            <span className="text-slate-400 font-normal">(Email or Mobile)</span>
          </label>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Mail className="w-4 h-4" />
            </div>
            <input
              id="identifier"
              name="identifier"
              type="text"
              autoComplete="username"
              autoFocus
              required
              value={identifier}
              onChange={(e) => {
                setIdentifier(e.target.value);
                if (activeRole) setActiveRole(null);
              }}
              placeholder="admin@dhaka-ideal.bd বা 017xxxxxxxx"
              disabled={loading}
              className="w-full pl-10 pr-3.5 py-3 bg-slate-50/80 border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 focus:bg-white transition-all shadow-inner"
            />
          </div>
        </div>

        {/* Password Field */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label
              htmlFor="password"
              className="block text-xs font-bold text-slate-700 tracking-wide"
            >
              পাসওয়ার্ড <span className="text-slate-400 font-normal">(Password)</span>
            </label>
            <button
              type="button"
              onClick={() => setShowForgotHelp(!showForgotHelp)}
              className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 transition cursor-pointer"
            >
              পাসওয়ার্ড ভুলে গেছেন?
            </button>
          </div>
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
              <Lock className="w-4 h-4" />
            </div>
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                if (activeRole) setActiveRole(null);
              }}
              placeholder="••••••••"
              disabled={loading}
              className="w-full pl-10 pr-11 py-3 bg-slate-50/80 border border-slate-300 rounded-xl text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-600 focus:border-emerald-600 focus:bg-white transition-all shadow-inner"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-700 rounded-lg transition cursor-pointer"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {/* Forgot Password Helper Box */}
        {showForgotHelp && (
          <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200 text-amber-900 text-xs leading-relaxed space-y-1 animate-in fade-in">
            <div className="font-bold flex items-center gap-1.5">
              <HelpCircle className="w-3.5 h-3.5 text-amber-700" />
              পাসওয়ার্ড রিসেট নির্দেশনা:
            </div>
            <p>
              শিক্ষক, শিক্ষার্থী ও অভিভাবকগণ আপনার প্রতিষ্ঠানের অ্যাডমিন অফিস অথবা আইটি শাখার সাথে
              যোগাযোগ করুন। ডেমো টেস্ট পাসওয়ার্ড:{' '}
              <code className="bg-amber-100 px-1 py-0.5 rounded font-mono font-bold">
                Pass123!@#
              </code>
            </p>
          </div>
        )}

        {/* Remember Me Checkbox */}
        <div className="flex items-center justify-between pt-1">
          <label className="flex items-center gap-2 text-xs font-medium text-slate-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
            />
            <span>আমাকে মনে রাখুন (Remember me)</span>
          </label>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          id="login-submit-button"
          disabled={loading}
          className="w-full mt-3 py-3.5 px-6 rounded-xl bg-gradient-to-r from-emerald-600 via-emerald-700 to-teal-700 hover:from-emerald-700 hover:via-emerald-800 hover:to-teal-800 text-white font-bold text-sm shadow-lg shadow-emerald-700/25 hover:shadow-xl hover:shadow-emerald-700/30 active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>যাচাই করা হচ্ছে...</span>
            </>
          ) : (
            <>
              <span>লগইন করুন (Sign In)</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      {/* Online Admission Portal Direct Link */}
      <div className="mt-6 pt-5 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-2.5 text-xs text-slate-500">
        <span className="font-medium">নতুন ভর্তিচ্ছু শিক্ষার্থী?</span>
        <Link
          href="/admissions/dhaka-ideal"
          className="font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 hover:underline transition"
        >
          অনলাইন ভর্তি আবেদন করুন <ChevronRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Security Footer */}
      <div className="mt-4 pt-3 flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
        <span>256-Bit SSL এনক্রিপশন • মাল্টি-টেন্যান্ট ডেটা সুরক্ষা</span>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <main className="min-h-screen flex flex-col lg:flex-row bg-slate-900 text-slate-900 selection:bg-emerald-500 selection:text-white">
      {/* Left Column: Brand Showcase Panel (Desktop) */}
      <div className="hidden lg:flex lg:w-1/2 xl:w-5/12 flex-col justify-between p-10 xl:p-14 bg-gradient-to-br from-slate-950 via-emerald-950 to-slate-900 text-white relative overflow-hidden border-r border-emerald-900/30">
        {/* Ambient Glowing Orbs */}
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-emerald-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-teal-500/15 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#05966908_1px,transparent_1px),linear-gradient(to_bottom,#05966908_1px,transparent_1px)] bg-[size:28px_28px] pointer-events-none" />

        {/* Top Branding */}
        <div className="relative z-10">
          <Link href="/" className="inline-flex items-center gap-3.5 group">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-emerald-500 to-teal-400 text-slate-950 flex items-center justify-center shadow-lg shadow-emerald-500/30 group-hover:scale-105 transition">
              <School className="w-6 h-6 text-slate-950" />
            </div>
            <div>
              <span className="text-2xl font-bold tracking-tight text-white block">
                এডুস্মার্ট বিডি
              </span>
              <span className="text-xs text-emerald-400 font-medium tracking-wide">
                EduSmart BD — Digital School Platform
              </span>
            </div>
          </Link>
        </div>

        {/* Center Value Proposition */}
        <div className="relative z-10 my-auto py-8 space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs font-semibold backdrop-blur-sm">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>বাংলাদেশের আধুনিকতম স্কুল ইআরপি প্ল্যাটফর্ম</span>
          </div>

          <h2 className="text-3xl xl:text-4xl font-extrabold text-white tracking-tight leading-snug">
            স্মার্ট শিক্ষাপ্রতিষ্ঠান পরিচালনার একীভূত ক্লাউড সমাধান।
          </h2>

          <p className="text-sm text-slate-300 leading-relaxed max-w-md">
            অধ্যক্ষ, শিক্ষক, অভিভাবক ও শিক্ষার্থীদের জন্য তৈরি এক সমন্বিত ডিজিটাল প্ল্যাটফর্ম। উপস্থিতি,
            ফলাফল, ফি কালেকশন ও অনলাইন ভর্তি এখন এক ঠিকানায়।
          </p>

          {/* Core Feature Badges */}
          <div className="grid grid-cols-2 gap-3 pt-2 max-w-md">
            <div className="p-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
              <GraduationCap className="w-5 h-5 text-emerald-400 mb-1.5" />
              <h3 className="text-xs font-bold text-white">স্মার্ট অ্যাকাডেমিক</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">ফলাফল ও গ্রেডশিট প্রস্তুতি</p>
            </div>
            <div className="p-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
              <CreditCard className="w-5 h-5 text-emerald-400 mb-1.5" />
              <h3 className="text-xs font-bold text-white">স্বয়ংক্রিয় ফি</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">অনলাইন পেমেন্ট ও ইনভয়েস</p>
            </div>
            <div className="p-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
              <Users className="w-5 h-5 text-emerald-400 mb-1.5" />
              <h3 className="text-xs font-bold text-white">মাল্টি-ইউজার পোর্টাল</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">অভিভাবক ও শিক্ষক ড্যাশবোর্ড</p>
            </div>
            <div className="p-3 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md">
              <ShieldCheck className="w-5 h-5 text-emerald-400 mb-1.5" />
              <h3 className="text-xs font-bold text-white">সম্পূর্ণ ডাটা সুরক্ষা</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">রোল-বেসড সিকিউরিটি</p>
            </div>
          </div>
        </div>

        {/* Bottom Panel Navigation */}
        <div className="relative z-10 pt-6 border-t border-emerald-900/40 flex items-center justify-between text-xs text-slate-400">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 transition font-semibold"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> মূল ওয়েবসাইটে ফিরে যান
          </Link>
          <span>© ২০২৬ EduSmart BD</span>
        </div>
      </div>

      {/* Right Column: Authentication Form Panel */}
      <div className="flex-1 flex flex-col justify-center items-center p-4 sm:p-8 lg:p-12 bg-slate-100/90 relative">
        <div className="w-full flex items-center justify-center">
          <Suspense
            fallback={
              <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl border border-slate-200 p-12 flex flex-col items-center justify-center gap-3">
                <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
                <p className="text-xs text-slate-500 font-medium">লগইন পোর্টাল লোড হচ্ছে...</p>
              </div>
            }
          >
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </main>
  );
}
