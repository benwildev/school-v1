'use client';

import React, { useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Search,
  XCircle,
  AlertCircle,
  ArrowLeft,
  Loader2,
} from 'lucide-react';
import { AdmissionStatus } from '@prisma/client';

interface TrackResult {
  applicationNumber: string;
  trackingCode: string;
  status: AdmissionStatus;
  applicantName: string;
  className: string;
  sessionName: string;
  createdAt: string;
  reviewedAt?: string | null;
  rejectionReason?: string | null;
  isEnrolled: boolean;
}

export default function PublicAdmissionTrackPage({
  params,
}: {
  params: Promise<{ schoolSlug: string }>;
}) {
  const resolvedParams = use(params);
  const schoolSlug = resolvedParams.schoolSlug;
  const searchParams = useSearchParams();

  const [inputCode, setInputCode] = useState(searchParams.get('trackingCode') || '');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<TrackResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleTrack = async (codeToSearch?: string) => {
    const code = (codeToSearch || inputCode).trim();
    if (!code) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const isTrackingPin = code.startsWith('TRK-');
      const paramName = isTrackingPin ? 'trackingCode' : 'applicationNumber';
      const res = await fetch(
        `/api/public/schools/${schoolSlug}/admissions/track?${paramName}=${encodeURIComponent(code)}`
      );
      let json: any = null;
      try {
        json = await res.json();
      } catch {
        // Non-JSON response
      }

      if (!res.ok || !json?.success) {
        throw new Error(json?.error || 'আবেদনের তথ্য খুঁজে পাওয়া যায়নি। ডাটাবেজ বা সার্ভার সংযোগ পরীক্ষা করুন।');
      }

      setResult(json.data);
    } catch (err: unknown) {
      const e = err as Error;
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initialCode = searchParams.get('trackingCode');
    if (initialCode) {
      handleTrack(initialCode);
    }
  }, [searchParams]);

  const renderStatusStepper = (status: AdmissionStatus) => {
    const steps = [
      { key: 'SUBMITTED', label: 'দাখিলকৃত' },
      { key: 'UNDER_REVIEW', label: 'পর্যালোচনাধীন' },
      { key: 'APPROVED', label: 'অনুমোদিত' },
      { key: 'ENROLLED', label: 'ভর্তি সম্পন্ন' },
    ];

    let activeIndex = 0;
    if (status === AdmissionStatus.UNDER_REVIEW || status === AdmissionStatus.SHORTLISTED) {
      activeIndex = 1;
    } else if (status === AdmissionStatus.APPROVED) {
      activeIndex = 2;
    } else if (status === AdmissionStatus.ENROLLED) {
      activeIndex = 3;
    }

    if (status === AdmissionStatus.REJECTED) {
      return (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs">
          <div className="flex items-center gap-2 font-bold text-sm text-rose-700">
            <XCircle className="w-5 h-5 text-rose-600" /> দুঃখিত, আবেদনটি প্রত্যাখ্যাত হয়েছে
          </div>
          {result?.rejectionReason && (
            <p className="mt-2 text-rose-900">কারণ: {result.rejectionReason}</p>
          )}
        </div>
      );
    }

    return (
      <div className="py-4">
        <div className="flex items-center justify-between relative">
          {steps.map((step, idx) => {
            const isCompleted = idx <= activeIndex;
            const isCurrent = idx === activeIndex;

            return (
              <div key={step.key} className="flex flex-col items-center z-10 flex-1">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                    isCompleted
                      ? 'bg-indigo-600 text-white shadow'
                      : 'bg-gray-100 text-gray-400 border border-gray-300'
                  }`}
                >
                  {idx + 1}
                </div>
                <span
                  className={`text-xs mt-2 font-medium ${
                    isCurrent ? 'text-indigo-600 font-bold' : 'text-gray-500'
                  }`}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 sm:px-6">
      <div className="max-w-xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <Link
            href={`/admissions/${schoolSlug}`}
            className="inline-flex items-center gap-2 text-xs font-semibold text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-4 h-4" /> আবেদন পোর্টালে ফিরুন
          </Link>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-4">
          <div className="text-center space-y-1">
            <h1 className="text-xl font-bold text-gray-900">ভর্তি আবেদনের অবস্থা জানুন</h1>
            <p className="text-xs text-gray-500">
              আপনার আবেদনের ট্র্যাকিং পিন (TRK-XXXXXXXX) বা আবেদন নম্বর প্রবেশ করান
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleTrack();
            }}
            className="flex gap-2"
          >
            <input
              type="text"
              required
              value={inputCode}
              onChange={(e) => setInputCode(e.target.value)}
              placeholder="e.g. TRK-8ABC1234 or ADM-2026-00001"
              className="flex-1 px-4 py-2.5 text-sm border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:outline-none uppercase font-mono"
            />
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2.5 bg-indigo-600 text-white rounded-xl text-xs font-semibold hover:bg-indigo-700 transition flex items-center gap-2 disabled:opacity-50 shadow-sm"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              খুঁজুন
            </button>
          </form>

          {error && (
            <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Result Card */}
        {result && (
          <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm space-y-5">
            <div className="border-b border-gray-100 pb-3 flex items-center justify-between">
              <div>
                <span className="text-xs text-gray-500">শিক্ষার্থীর নাম:</span>
                <h2 className="text-base font-bold text-gray-900">{result.applicantName}</h2>
              </div>
              <div className="text-right">
                <span className="text-xs text-gray-500">আবেদন নম্বর:</span>
                <p className="font-mono text-xs font-bold text-indigo-600">{result.applicationNumber}</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs bg-gray-50 p-3 rounded-xl">
              <div>
                <span className="text-gray-500">আবেদনকৃত শ্রেণী:</span>
                <p className="font-semibold text-gray-800 mt-0.5">{result.className}</p>
              </div>
              <div>
                <span className="text-gray-500">শিক্ষাবর্ষ:</span>
                <p className="font-semibold text-gray-800 mt-0.5">{result.sessionName}</p>
              </div>
            </div>

            {/* Stepper */}
            <div>
              <h3 className="text-xs font-semibold text-gray-700 mb-2">আবেদনের অগ্রগতি:</h3>
              {renderStatusStepper(result.status)}
            </div>

            {result.isEnrolled && (
              <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl text-purple-900 text-xs text-center font-medium">
                🎉 শিক্ষার্থীকে আনুষ্ঠানিকভাবে ভর্তি করা হয়েছে! নির্ধারিত তারিখ ও সময়ে শ্রেণীকক্ষে উপস্থিত থাকার জন্য অনুরোধ করা হচ্ছে।
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
