'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  ShieldCheck,
  Lock,
  CheckCircle2,
  AlertCircle,
  Loader2,
  KeyRound,
  GraduationCap,
  Users,
  ArrowRight,
} from 'lucide-react';

interface VerificationData {
  targetType: 'GUARDIAN' | 'STUDENT';
  targetName: string;
  recipientPhone: string;
  expiresAt: string;
  schoolNameEn: string;
  schoolNameBn: string;
}

export default function PublicInvitationAcceptPage({
  params,
}: {
  params: Promise<{ schoolSlug: string }>;
}) {
  const resolvedParams = use(params);
  const schoolSlug = resolvedParams.schoolSlug;
  const searchParams = useSearchParams();

  const [token, setToken] = useState(searchParams.get('token') || '');
  const [verifying, setVerifying] = useState(false);
  const [invitationData, setInvitationData] = useState<VerificationData | null>(null);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  // Form State
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const urlToken = searchParams.get('token');
    if (urlToken && urlToken.trim().length >= 8) {
      handleVerify(urlToken.trim());
    }
  }, [searchParams]);

  const handleVerify = async (tokenToVerify: string) => {
    setVerifying(true);
    setVerifyError(null);
    setInvitationData(null);
    setSubmitError(null);

    try {
      const res = await fetch(
        `/api/public/schools/${schoolSlug}/invitations/verify?token=${encodeURIComponent(tokenToVerify)}`
      );
      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || 'আমন্ত্রণ কোডটি সঠিক নয় বা মেয়াদ শেষ হয়ে গেছে।');
      }

      setInvitationData(json.data);
    } catch (err: any) {
      setVerifyError(err.message || 'আমন্ত্রণ যাচাই করতে ব্যর্থ হয়েছে।');
    } finally {
      setVerifying(false);
    }
  };

  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (password.length < 8) {
      setSubmitError('পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে।');
      return;
    }

    if (password !== confirmPassword) {
      setSubmitError('পাসওয়ার্ড দুটি মিলছে না। অনুগ্রহ করে যাচাই করুন।');
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch(`/api/public/schools/${schoolSlug}/invitations/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          password,
        }),
      });

      const json = await res.json();

      if (!res.ok || !json.success) {
        throw new Error(json.error || 'অ্যাকাউন্ট সক্রিয় করতে ব্যর্থ হয়েছে।');
      }

      setSuccess(true);
    } catch (err: any) {
      setSubmitError(err.message || 'একটি ত্রুটি ঘটেছে।');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md text-center px-4">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-emerald-600 text-white shadow-md mb-4">
          <ShieldCheck className="w-8 h-8" />
        </div>
        <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">
          পোর্টাল অ্যাকাউন্ট সক্রিয়করণ
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          EduSmart BD — নিরাপদ মাল্টি-টেন্যান্ট শিক্ষাপ্রতিষ্ঠান প্ল্যাটফর্ম
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4">
        <div className="bg-white py-8 px-6 shadow-sm border border-gray-200 sm:rounded-2xl sm:px-10">
          {success ? (
            <div className="text-center space-y-4 py-4">
              <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">অ্যাকাউন্ট সক্রিয় সম্পন্ন হয়েছে!</h3>
              <p className="text-sm text-gray-600">
                আপনার পাসওয়ার্ড সফলভাবে সংরক্ষিত হয়েছে। আপনি এখন আপনার মোবাইল নম্বর ও পাসওয়ার্ড দিয়ে লগইন করতে পারবেন।
              </p>
              <div className="pt-4">
                <Link
                  href="/"
                  className="w-full inline-flex justify-center items-center gap-2 py-2.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 transition"
                >
                  লগইন পেজে যান <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          ) : !invitationData ? (
            /* Step 1: Token Verification */
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (token.trim()) handleVerify(token.trim());
              }}
              className="space-y-5"
            >
              <div>
                <label htmlFor="token" className="block text-sm font-semibold text-gray-700">
                  আমন্ত্রণ কোড (Invitation Token)
                </label>
                <div className="mt-1.5 relative">
                  <input
                    id="token"
                    type="text"
                    required
                    value={token}
                    onChange={(e) => setToken(e.target.value.toUpperCase())}
                    placeholder="যেমন: INV-XXXXXXXXXXXX"
                    className="appearance-none block w-full px-3.5 py-2.5 border border-gray-300 rounded-xl shadow-sm font-mono text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1.5">
                  বিদ্যালয় প্রশাসন থেকে প্রাপ্ত আমন্ত্রণ কোডটি এখানে লিখুন।
                </p>
              </div>

              {verifyError && (
                <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{verifyError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={verifying || !token.trim()}
                className="w-full flex justify-center items-center gap-2 py-2.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 transition"
              >
                {verifying ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> কোড যাচাই হচ্ছে...
                  </>
                ) : (
                  <>
                    <KeyRound className="w-4 h-4" /> আমন্ত্রণ যাচাই করুন
                  </>
                )}
              </button>
            </form>
          ) : (
            /* Step 2: Set Password */
            <form onSubmit={handleAccept} className="space-y-5">
              {/* Recipient Card */}
              <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-emerald-800">
                  {invitationData.targetType === 'GUARDIAN' ? (
                    <Users className="w-4 h-4 text-emerald-600" />
                  ) : (
                    <GraduationCap className="w-4 h-4 text-emerald-600" />
                  )}
                  <span>
                    {invitationData.targetType === 'GUARDIAN'
                      ? 'অভিভাবক অ্যাকাউন্ট'
                      : 'শিক্ষার্থী অ্যাকাউন্ট'}
                  </span>
                </div>
                <p className="text-base font-bold text-gray-900">{invitationData.targetName}</p>
                <div className="flex items-center justify-between text-xs text-gray-600 font-mono pt-1 border-t border-emerald-200/60">
                  <span>ফোন: {invitationData.recipientPhone}</span>
                  <span>{invitationData.schoolNameBn}</span>
                </div>
              </div>

              <div>
                <label htmlFor="pass" className="block text-sm font-semibold text-gray-700">
                  নতুন পাসওয়ার্ড নির্ধারণ করুন
                </label>
                <div className="mt-1.5 relative">
                  <input
                    id="pass"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="কমপক্ষে ৮ অক্ষর"
                    className="appearance-none block w-full px-3.5 py-2.5 border border-gray-300 rounded-xl shadow-sm text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="confirmPass" className="block text-sm font-semibold text-gray-700">
                  পাসওয়ার্ড নিশ্চিত করুন
                </label>
                <div className="mt-1.5 relative">
                  <input
                    id="confirmPass"
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="পুনরায় পাসওয়ার্ড লিখুন"
                    className="appearance-none block w-full px-3.5 py-2.5 border border-gray-300 rounded-xl shadow-sm text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  />
                </div>
              </div>

              {submitError && (
                <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setInvitationData(null)}
                  className="w-1/3 py-2.5 px-3 border border-gray-300 rounded-xl text-xs font-semibold text-gray-700 hover:bg-gray-50 transition"
                >
                  কোড পরিবর্তন
                </button>
                <button
                  type="submit"
                  disabled={submitting || !password || !confirmPassword}
                  className="w-2/3 flex justify-center items-center gap-2 py-2.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 transition"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" /> সক্রিয় হচ্ছে...
                    </>
                  ) : (
                    <>
                      <Lock className="w-4 h-4" /> অ্যাকাউন্ট সক্রিয় করুন
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
