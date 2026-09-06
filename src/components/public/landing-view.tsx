'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  School,
  GraduationCap,
  Users,
  BookOpen,
  Award,
  Calendar,
  CreditCard,
  Bell,
  Bus,
  Library,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Sparkles,
  Phone,
  Mail,
  MapPin,
  ChevronDown,
  ExternalLink,
  FileText,
  Layers,
  Menu,
  X,
  Lock,
  UserCheck,
  TrendingUp,
} from 'lucide-react';

interface LandingViewProps {
  isAuthenticated: boolean;
}

export function LandingView({ isAuthenticated }: LandingViewProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeRoleTab, setActiveRoleTab] = useState<'admin' | 'teacher' | 'student' | 'parent' | 'admission'>('admin');
  const [openFaqIndex, setOpenFaqIndex] = useState<number | null>(0);

  const roleTabs = [
    {
      id: 'admin' as const,
      titleBn: 'অধ্যক্ষ ও অ্যাডমিন',
      titleEn: 'Admin & Principal',
      icon: School,
      badge: 'কেন্দ্রীয় নিয়ন্ত্রণ',
      description: 'সম্পূর্ণ একাডেমিক, অর্থনৈতিক ও প্রশাসনিক ব্যবস্থাপনার একীভূত ড্যাশবোর্ড। রিয়েল-টাইম উপস্থিতি, শিক্ষক পর্যবেক্ষণ ও অডিট রিপোর্ট।',
      features: [
        'সকল ক্যাম্পাস ও শিফটের কেন্দ্রীভূত পর্যবেক্ষণ',
        'ফি কালেকশন, ব্যাংক রিকনসিলিয়েশন ও ভাউচার জেনারেশন',
        'স্টাফ ও শিক্ষকদের উপস্থিতি, লিভ ও স্যালারি প্রসেসিং',
        'নিরাপদ ডেটা এনক্রিপশন ও রোল-বেসড এক্সেস কন্ট্রোল',
      ],
      ctaText: 'অ্যাডমিন লগইন',
      ctaHref: '/login',
    },
    {
      id: 'teacher' as const,
      titleBn: 'শিক্ষক ও শিক্ষিকা',
      titleEn: 'Teacher Portal',
      icon: BookOpen,
      badge: 'স্মার্ট ক্লাসরুম',
      description: 'মোবাইল বা ল্যাপটপ থেকে সরাসরি ক্লাস ও সেকশনের হাজিরা গ্রহণ, পরীক্ষার নম্বর এন্ট্রি, লেসন প্ল্যান ও শিক্ষার্থীদের অগ্রগতি মূল্যায়ন।',
      features: [
        'এক ক্লিকে ক্লাসের ডিজিটাল হাজিরা ও অভিভাবককে নোটিফিকেশন',
        'টার্ম ও সেমিস্টার পরীক্ষার নম্বর সরাসরি সাবমিশন',
        'ক্লাস রুটিন, সাপ্তাহিক সিলেবাস ও ছুটির তালিকা',
        'শিক্ষার্থীদের আচরণগত মূল্যায়ন ও পার্সোনাল কমেন্টস',
      ],
      ctaText: 'শিক্ষক লগইন',
      ctaHref: '/login',
    },
    {
      id: 'student' as const,
      titleBn: 'শিক্ষার্থী পোর্টাল',
      titleEn: 'Student Portal',
      icon: GraduationCap,
      badge: 'ডিজিটাল লার্নিং',
      description: 'পরীক্ষার ফলাফল, ডিজিটাল প্রগ্রেস রিপোর্ট কার্ড, ক্লাসের সময়সূচি ও নোটিশ বোর্ড সবকিছু হাতের মুঠোয়।',
      features: [
        'জিপিএ ও সাবজেক্ট-ভিত্তিক মার্কশিট ও গ্রেড পয়েন্ট',
        'দৈনিক ক্লাস রুটিন ও পরীক্ষার সময়সূচী ডাউনলোড',
        'ডিজিটাল লাইব্রেরি বইয়ের তালিকা ও ইস্যু স্ট্যাটাস',
        'স্কুল নোটিশ ও গুরুত্বপূর্ণ ইভেন্ট ক্যালেন্ডার',
      ],
      ctaText: 'শিক্ষার্থী লগইন',
      ctaHref: '/login',
    },
    {
      id: 'parent' as const,
      titleBn: 'অভিভাবক পোর্টাল',
      titleEn: 'Parent Portal',
      icon: Users,
      badge: 'নিরাপদ অভিভাবকত্ব',
      description: 'সন্তানের উপস্থিতি, পরীক্ষার ফলাফল ও বকেয়া ফি পর্যবেক্ষণ। বিকাশ ও নগদের মাধ্যমে বাড়ি বসেই নিরাপদে টিউশন ফি পরিশোধ।',
      features: [
        'সন্তান স্কুলে পৌঁছামাত্র উপস্থিতির এসএমএস নিশ্চিতকরণ',
        'বিকাশ, নগদ ও কার্ড দিয়ে এক ক্লিকে ফি পেমেন্ট ও ডিজিটাল রসিদ',
        'টার্মভিত্তিক প্রগ্রেস রিপোর্ট কার্ড ও শিক্ষকের মন্তব্য',
        'ছুটির আবেদন ও সরাসরি স্কুল কর্তৃপক্ষের সাথে যোগাযোগ',
      ],
      ctaText: 'অভিভাবক লগইন',
      ctaHref: '/login',
    },
    {
      id: 'admission' as const,
      titleBn: 'অনলাইন ভর্তি',
      titleEn: 'Online Admission',
      icon: FileText,
      badge: 'ভর্তি কার্যক্রম ২০২৬',
      description: 'নতুন সেশনে প্রাথমিক ও মাধ্যমিক শ্রেণীতে ভর্তি আবেদন সরাসরি অনলাইনে। অ্যাপ্লিকেশন আইডি দিয়ে রিয়েল-টাইম স্ট্যাটাস ট্র্যাকিং।',
      features: [
        'সহজ ৪-ধাপের ডিজিটাল ভর্তি আবেদন ফরম',
        'জন্ম নিবন্ধন ও পূর্ববর্তী ক্লাসের ট্রান্সক্রিপ্ট আপলোড',
        'অনলাইন অ্যাডমিট কার্ড জেনারেশন ও রোল নম্বর বরাদ্দ',
        'আবেদন ট্র্যাকিং ও স্ক্রিনিং স্ট্যাটাস সরাসরি যাচাই',
      ],
      ctaText: 'ভর্তি আবেদন করুন',
      ctaHref: '/admissions/dhaka-ideal',
    },
  ];

  const currentTab = roleTabs.find((t) => t.id === activeRoleTab) || roleTabs[0];

  const faqs = [
    {
      q: 'এডুস্মার্ট বিডি ব্যবহারের জন্য কি প্রতিষ্ঠানে কোনো সার্ভার বা সফটওয়্যার ইন্সটল করতে হবে?',
      a: 'না, এডুস্মার্ট বিডি সম্পূর্ণ ক্লাউড-বেসড আর্কিটেকচারে তৈরি। আপনার যেকোনো কম্পিউটার, ল্যাপটপ, ট্যাবলেট বা স্মার্টফোনের ব্রাউজার থেকে সরাসরি এটি চালানো যায়। কোনো ভারী সার্ভার বা আইটি রক্ষণাবেক্ষণের প্রয়োজন নেই।',
    },
    {
      q: 'অভিভাবকরা কীভাবে সন্তানের উপস্থিতি ও ফলাফল দেখতে পারবেন?',
      a: 'অভিভাবকরা তাঁদের নিবন্ধিত মোবাইল নম্বর ব্যবহার করে সহজেই অভিভাবক পোর্টালে সাইন-ইন করতে পারেন। এছাড়া শিক্ষার্থী স্কুলে প্রবেশ করা মাত্র স্বয়ংক্রিয় এসএমএসের মাধ্যমে উপস্থিতির তথ্য অভিভাবকদের জানানো হয়।',
    },
    {
      q: 'টিউশন ফি ও অন্যান্য স্কুলের চার্জ কীভাবে পরিশোধ করা যায়?',
      a: 'এডুস্মার্ট বিডিতে বিকাশ (bKash), নগদ (Nagad), রকেট ও অনলাইন ব্যাংকিং গেটওয়ে সমন্বিত রয়েছে। অভিভাবকগণ ঘরে বসেই ফি পরিশোধ করে তাৎক্ষণিক ডিজিটাল রসিদ ডাউনলোড করতে পারেন।',
    },
    {
      q: 'একটি প্রতিষ্ঠানে একাধিক শিফট (মর্নিং/ডে) ও ভার্সন (বাংলা/ইংরেজি) থাকলে কি সাপোর্ট করবে?',
      a: 'হ্যাঁ, এটি সম্পূর্ণ মাল্টি-শিফট (Morning / Day) ও মাল্টি-কারিকুলাম (Bangla Medium / English Version) সমর্থন করে। প্রতিটি শিফট ও ভার্সনের জন্য আলাদা ক্লাস, সেকশন ও রুটিন ব্যবস্থাপনা সম্ভব।',
    },
    {
      q: 'আমাদের প্রাতিষ্ঠানিক তথ্যের নিরাপত্তা ও ব্যাকআপ কীভাবে সংরক্ষিত হয়?',
      a: 'সকল তথ্য ক্লাউডে ব্যাংক-লেভেল এনক্রিপশন (SSL & AES) দ্বারা সুরক্ষিত। প্রতিদিন স্বয়ংক্রিয়ভাবে ক্লাউড ব্যাকআপ সংরক্ষিত হয় এবং রোল-বেসড এক্সেস কন্ট্রোলের মাধ্যমে অননুমোদিত প্রবেশ সম্পূর্ণ নিষিদ্ধ রাখা হয়েছে।',
    },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 selection:bg-emerald-500 selection:text-white font-sans antialiased">
      {/* 1. Top Global Announcement Bar */}
      <div className="bg-gradient-to-r from-emerald-800 via-teal-800 to-slate-900 text-white text-xs sm:text-sm py-2 px-4 shadow-inner">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
              ভর্তি বিজ্ঞপ্তি ২০২৬
            </span>
            <span className="hidden sm:inline text-emerald-100/90 font-medium">
              নতুন শিক্ষাবর্ষে সকল শ্রেণীতে ডিজিটাল ভর্তি আবেদন ও নিবন্ধন কার্যক্রম চালু রয়েছে।
            </span>
            <span className="sm:hidden text-emerald-100 font-medium">
              ২০২৬ শিক্ষাবর্ষে ভর্তি আবেদন চলছে!
            </span>
          </div>
          <div className="flex items-center gap-3 font-medium">
            <Link
              href="/admissions/dhaka-ideal"
              className="inline-flex items-center gap-1 text-emerald-300 hover:text-emerald-200 transition-colors underline-offset-4 hover:underline"
            >
              <span>অনলাইনে আবেদন করুন</span>
              <ArrowRight className="size-3.5" />
            </Link>
            <span className="text-emerald-400/40">|</span>
            <Link
              href="/admissions/dhaka-ideal/track"
              className="text-slate-300 hover:text-white transition-colors"
            >
              আবেদন ট্র্যাকিং
            </Link>
          </div>
        </div>
      </div>

      {/* 2. Primary Navigation Header */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-slate-200 shadow-xs transition-all">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          {/* Brand Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="size-11 sm:size-12 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-700 text-white flex items-center justify-center shadow-md shadow-emerald-700/20 group-hover:scale-105 transition-transform duration-200">
              <School className="size-6 sm:size-7" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">এডুস্মার্ট বিডি</span>
                <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-sm">SaaS</span>
              </div>
              <p className="text-xs text-slate-500 font-medium tracking-wide">EduSmart BD — Digital School Platform</p>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
            <a href="#features" className="hover:text-emerald-700 transition-colors">
              সুবিধাসমূহ
            </a>
            <a href="#portals" className="hover:text-emerald-700 transition-colors">
              পোর্টালসমূহ
            </a>
            <a href="#modules" className="hover:text-emerald-700 transition-colors">
              মডিউলসমূহ
            </a>
            <a href="#admissions" className="hover:text-emerald-700 transition-colors">
              অনলাইন ভর্তি
            </a>
            <a href="#faq" className="hover:text-emerald-700 transition-colors">
              প্রশ্নোত্তর
            </a>
          </nav>

          {/* Desktop Header Action Buttons */}
          <div className="hidden sm:flex items-center gap-3">
            {isAuthenticated ? (
              <Link
                href="/dashboard"
                id="header-dashboard-button"
                className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm shadow-md shadow-emerald-700/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <span>ড্যাশবোর্ডে যান</span>
                <ArrowRight className="size-4" />
              </Link>
            ) : (
              <>
                <Link
                  href="/admissions/dhaka-ideal"
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl border border-slate-300 hover:border-emerald-500 bg-white hover:bg-emerald-50/60 text-slate-700 hover:text-emerald-800 font-medium text-sm transition-all"
                >
                  <FileText className="size-4 text-emerald-600" />
                  <span>ভর্তি আবেদন</span>
                </Link>
                <Link
                  href="/login"
                  id="header-login-button"
                  className="inline-flex items-center justify-center gap-1.5 px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-emerald-700 text-white font-semibold text-sm shadow-sm transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Lock className="size-4 text-emerald-400" />
                  <span>লগইন করুন</span>
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Toggle Button */}
          <div className="flex sm:hidden">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors"
              aria-label="Toggle Menu"
            >
              {mobileMenuOpen ? <X className="size-6" /> : <Menu className="size-6" />}
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-b border-slate-200 bg-white px-4 pt-3 pb-6 space-y-3 animate-in slide-in-from-top-2 duration-150">
            <nav className="flex flex-col space-y-2 text-sm font-medium text-slate-700">
              <a
                href="#features"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors"
              >
                সুবিধাসমূহ
              </a>
              <a
                href="#portals"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors"
              >
                পোর্টালসমূহ
              </a>
              <a
                href="#modules"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors"
              >
                মডিউলসমূহ
              </a>
              <a
                href="#admissions"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors"
              >
                অনলাইন ভর্তি
              </a>
              <a
                href="#faq"
                onClick={() => setMobileMenuOpen(false)}
                className="px-3 py-2 rounded-lg hover:bg-slate-100 transition-colors"
              >
                প্রশ্নোত্তর
              </a>
            </nav>
            <div className="pt-3 border-t border-slate-100 flex flex-col gap-2">
              {isAuthenticated ? (
                <Link
                  href="/dashboard"
                  onClick={() => setMobileMenuOpen(false)}
                  className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 text-white font-semibold text-sm shadow-sm"
                >
                  <span>ড্যাশবোর্ডে যান</span>
                  <ArrowRight className="size-4" />
                </Link>
              ) : (
                <>
                  <Link
                    href="/admissions/dhaka-ideal"
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl border border-slate-300 text-slate-800 font-medium text-sm"
                  >
                    <FileText className="size-4 text-emerald-600" />
                    <span>ভর্তি আবেদন ফরম</span>
                  </Link>
                  <Link
                    href="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-xl bg-slate-900 text-white font-semibold text-sm shadow-sm"
                  >
                    <Lock className="size-4 text-emerald-400" />
                    <span>লগইন করুন</span>
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      {/* 3. Hero Section */}
      <section className="relative overflow-hidden pt-12 pb-20 lg:pt-20 lg:pb-28 bg-gradient-to-b from-white via-emerald-50/30 to-slate-50 border-b border-slate-200/80">
        {/* Decorative background glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[1000px] h-[450px] bg-gradient-to-tr from-emerald-200/40 via-teal-100/30 to-blue-200/20 rounded-full blur-3xl -z-10 pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            {/* Left Hero Content */}
            <div className="lg:col-span-7 flex flex-col items-center lg:items-start text-center lg:text-left">
              {/* Trust Badge */}
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-100/80 border border-emerald-300 text-emerald-900 text-xs sm:text-sm font-semibold mb-6 shadow-xs">
                <Sparkles className="size-4 text-emerald-600 shrink-0" />
                <span>বাংলাদেশের সর্বাধুনিক ক্লাউড স্কুল ম্যানেজমেন্ট প্ল্যাটফর্ম</span>
              </div>

              {/* Main Headline */}
              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-950 leading-[1.15] mb-6">
                স্মার্ট স্কুলের ডিজিটাল রূপান্তর —{' '}
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-600">
                  এক প্ল্যাটফর্মেই সব সমাধান
                </span>
              </h1>

              {/* Subtitle */}
              <p className="text-base sm:text-lg text-slate-600 max-w-2xl leading-relaxed mb-8">
                হাজিরা, পরীক্ষার ফলাফল, অনলাইন ফি কালেকশন, ডিজিটাল ভর্তি ও স্বয়ংক্রিয় এসএমএস নোটিফিকেশন — 
                বাংলাদেশের স্কুল, কলেজ ও মাদ্রাসার জন্য সম্পূর্ণ স্বয়ংক্রিয় ও নিরাপদ ক্লাউড সফটওয়্যার।
              </p>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-center gap-3.5 w-full sm:w-auto mb-10">
                {isAuthenticated ? (
                  <Link
                    href="/dashboard"
                    className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-8 py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-base shadow-lg shadow-emerald-700/25 transition-all hover:scale-[1.02] active:scale-[0.98]"
                  >
                    <span>আপনার ড্যাশবোর্ডে প্রবেশ করুন</span>
                    <ArrowRight className="size-5" />
                  </Link>
                ) : (
                  <>
                    <Link
                      href="/login"
                      id="hero-login-button"
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2.5 px-7 py-3.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-base shadow-lg shadow-slate-900/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                    >
                      <Lock className="size-5 text-emerald-400" />
                      <span>পোর্টাল সাইন ইন করুন</span>
                    </Link>
                    <Link
                      href="/admissions/dhaka-ideal"
                      id="hero-admissions-button"
                      className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl border border-emerald-600/30 hover:border-emerald-600 bg-white hover:bg-emerald-50 text-emerald-800 font-bold text-base shadow-xs transition-all hover:scale-[1.02] active:scale-[0.98]"
                    >
                      <FileText className="size-5 text-emerald-600" />
                      <span>অনলাইন ভর্তি আবেদন</span>
                    </Link>
                  </>
                )}
                <Link
                  href="/admissions/dhaka-ideal/track"
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-5 py-3.5 rounded-xl text-slate-700 hover:text-slate-950 font-semibold text-sm hover:bg-slate-100 transition-colors"
                >
                  <span>আবেদন স্ট্যাটাস চেক</span>
                  <ExternalLink className="size-4 text-slate-400" />
                </Link>
              </div>

              {/* Feature Highlights / Trust Metrics */}
              <div className="grid grid-cols-3 gap-4 sm:gap-8 pt-6 border-t border-slate-200/80 w-full max-w-lg">
                <div>
                  <div className="text-2xl sm:text-3xl font-bold text-slate-900">১০০+</div>
                  <div className="text-xs text-slate-500 font-medium">শিক্ষাপ্রতিষ্ঠান যুক্ত</div>
                </div>
                <div>
                  <div className="text-2xl sm:text-3xl font-bold text-emerald-700">৫০,০০০+</div>
                  <div className="text-xs text-slate-500 font-medium">শিক্ষার্থী ও অভিভাবক</div>
                </div>
                <div>
                  <div className="text-2xl sm:text-3xl font-bold text-teal-700">৯৯.৯%</div>
                  <div className="text-xs text-slate-500 font-medium">ক্লাউড সিস্টেম আপটাইম</div>
                </div>
              </div>
            </div>

            {/* Right Hero Visual Showcase: Interactive Live Dashboard Mockup */}
            <div className="lg:col-span-5 w-full">
              <div className="relative mx-auto max-w-md lg:max-w-none">
                {/* Floating Badge */}
                <div className="absolute -top-4 -left-4 z-20 bg-white/95 backdrop-blur-md rounded-2xl p-3 border border-emerald-200 shadow-xl shadow-emerald-900/10 flex items-center gap-3 animate-bounce duration-1000">
                  <div className="size-10 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0">
                    <CheckCircle2 className="size-6" />
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-900">আজকের ডিজিটাল হাজিরা</div>
                    <div className="text-[11px] font-semibold text-emerald-600">৯৮.৫% শিক্ষার্থী উপস্থিত</div>
                  </div>
                </div>

                {/* Main Glass Card */}
                <div className="rounded-3xl bg-white/90 backdrop-blur-xl border border-slate-200/90 p-6 sm:p-7 shadow-2xl shadow-slate-200/60 transition-all">
                  <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
                    <div className="flex items-center gap-2.5">
                      <div className="size-3.5 rounded-full bg-emerald-500 ring-4 ring-emerald-100 animate-pulse" />
                      <span className="text-xs font-bold uppercase tracking-wider text-slate-700">ঢাকা আইডিয়াল স্কুল — লাইভ ড্যাশবোর্ড</span>
                    </div>
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">২০২৬ সেশন</span>
                  </div>

                  {/* Stat Cards Mini Grid */}
                  <div className="grid grid-cols-2 gap-3 mb-5">
                    <div className="p-3.5 rounded-2xl bg-emerald-50/60 border border-emerald-100">
                      <div className="flex items-center justify-between text-emerald-800 text-xs font-semibold mb-1">
                        <span>মোট শিক্ষার্থী</span>
                        <GraduationCap className="size-4" />
                      </div>
                      <div className="text-xl font-extrabold text-slate-900">১,৪৫০ জন</div>
                      <div className="text-[10px] text-emerald-700 font-medium">বাংলা ও ইংলিশ ভার্সন</div>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-teal-50/60 border border-teal-100">
                      <div className="flex items-center justify-between text-teal-800 text-xs font-semibold mb-1">
                        <span>অনলাইন ফি কালেকশন</span>
                        <CreditCard className="size-4" />
                      </div>
                      <div className="text-xl font-extrabold text-slate-900">৯২.৪%</div>
                      <div className="text-[10px] text-teal-700 font-medium">bKash, Nagad, ব্যাংক</div>
                    </div>
                  </div>

                  {/* Live Activity Feed */}
                  <div className="space-y-2.5">
                    <div className="text-xs font-bold text-slate-700 flex items-center justify-between">
                      <span>সাম্প্রতিক কার্যক্রম</span>
                      <span className="text-[10px] text-slate-400">স্বয়ংক্রিয় রিয়েল-টাইম</span>
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                      <div className="flex items-center gap-2.5">
                        <div className="size-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                          <Bell className="size-3.5" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800">অনুপস্থিতি সতর্কতা এসএমএস</p>
                          <p className="text-[10px] text-slate-500">২২ জন অভিভাবকের কাছে পাঠানো হয়েছে</p>
                        </div>
                      </div>
                      <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded">সফল</span>
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                      <div className="flex items-center gap-2.5">
                        <div className="size-7 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center">
                          <Award className="size-3.5" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800">টার্ম পরীক্ষার ফলাফল প্রকাশ</p>
                          <p className="text-[10px] text-slate-500">শ্রেণী ১০ — জিপিএ ৫.০ গ্রেডিং</p>
                        </div>
                      </div>
                      <span className="text-[10px] font-semibold text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded">প্রকাশিত</span>
                    </div>

                    <div className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-xs">
                      <div className="flex items-center gap-2.5">
                        <div className="size-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center">
                          <FileText className="size-3.5" />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-800">নতুন ভর্তি আবেদন গৃহীত</p>
                          <p className="text-[10px] text-slate-500">শ্রেণী ৬ (ডে শিফট) — অনলাইন পোর্টাল</p>
                        </div>
                      </div>
                      <span className="text-[10px] font-semibold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">যাচাইকৃত</span>
                    </div>
                  </div>

                  {/* Bottom Instant Access */}
                  <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
                      <ShieldCheck className="size-4 text-emerald-600" />
                      <span>রোল-বেসড সিকিউরিটি অ্যাক্টিভ</span>
                    </div>
                    <Link
                      href="/login"
                      className="text-xs font-bold text-emerald-700 hover:text-emerald-800 inline-flex items-center gap-1 hover:underline"
                    >
                      <span>লগইন করুন</span>
                      <ArrowRight className="size-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4. Institutional Portals (Role Hub) */}
      <section id="portals" className="py-16 sm:py-24 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold mb-3 uppercase tracking-wider">
              <Layers className="size-3.5 text-emerald-600" />
              <span>একীভূত প্রাতিষ্ঠানিক পোর্টাল</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-4">
              প্রত্যেক স্টেকহোল্ডারের জন্য পৃথক ও সুরক্ষিত পোর্টাল
            </h2>
            <p className="text-slate-600 text-base sm:text-lg">
              অধ্যক্ষ, শিক্ষক, শিক্ষার্থী ও অভিভাবক — সবার জন্য প্রস্তুত করা হয়েছে আলাদা ও নিবেদিত ইউজার ইন্টারফেস।
            </p>
          </div>

          {/* Role Selector Tabs */}
          <div className="flex items-center justify-start sm:justify-center gap-2 overflow-x-auto pb-4 mb-8 scrollbar-none">
            {roleTabs.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeRoleTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveRoleTab(tab.id)}
                  className={`inline-flex items-center gap-2 px-4 py-3 rounded-2xl text-sm font-bold whitespace-nowrap transition-all ${
                    isActive
                      ? 'bg-emerald-600 text-white shadow-md shadow-emerald-700/25 scale-105'
                      : 'bg-slate-100 hover:bg-slate-200/80 text-slate-700'
                  }`}
                >
                  <Icon className={`size-4 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                  <span>{tab.titleBn}</span>
                </button>
              );
            })}
          </div>

          {/* Active Role Content Card */}
          <div className="max-w-4xl mx-auto bg-gradient-to-br from-slate-900 via-slate-900 to-emerald-950 text-white rounded-3xl p-6 sm:p-10 shadow-xl border border-slate-800">
            <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
              <div className="md:col-span-7">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 text-xs font-bold mb-4 border border-emerald-500/30">
                  <Sparkles className="size-3.5" />
                  <span>{currentTab.badge}</span>
                </div>
                <h3 className="text-2xl sm:text-3xl font-extrabold text-white mb-2">
                  {currentTab.titleBn} ({currentTab.titleEn})
                </h3>
                <p className="text-slate-300 text-sm sm:text-base leading-relaxed mb-6">
                  {currentTab.description}
                </p>

                <div className="space-y-2.5 mb-8">
                  {currentTab.features.map((feature, idx) => (
                    <div key={idx} className="flex items-start gap-2.5 text-xs sm:text-sm text-slate-200">
                      <CheckCircle2 className="size-4 text-emerald-400 shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>

                <Link
                  href={currentTab.ctaHref}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm shadow-md transition-all hover:scale-105"
                >
                  <span>{currentTab.ctaText}</span>
                  <ArrowRight className="size-4" />
                </Link>
              </div>

              <div className="md:col-span-5 flex flex-col items-center justify-center p-6 rounded-2xl bg-white/5 border border-white/10 text-center">
                <div className="size-20 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white flex items-center justify-center shadow-lg mb-4">
                  <currentTab.icon className="size-10" />
                </div>
                <h4 className="text-lg font-bold text-white mb-1">{currentTab.titleBn} এক্সেস</h4>
                <p className="text-xs text-slate-400 mb-5">
                  সুরক্ষিত টু-ফ্যাক্টর ও পাসওয়ার্ড এনক্রিপশন সিস্টেম
                </p>
                <div className="w-full space-y-2 text-xs">
                  <div className="p-2.5 rounded-lg bg-white/5 text-slate-300 border border-white/5 flex items-center justify-between">
                    <span>প্রবেশ মাধ্যম</span>
                    <span className="font-semibold text-emerald-300">ইমেইল / মোবাইল নম্বর</span>
                  </div>
                  <div className="p-2.5 rounded-lg bg-white/5 text-slate-300 border border-white/5 flex items-center justify-between">
                    <span>প্ল্যাটফর্ম সাপোর্ট</span>
                    <span className="font-semibold text-emerald-300">মোবাইল, ট্যাবলেট, পিসি</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 5. Core Features & Capabilities Grid */}
      <section id="features" className="py-16 sm:py-24 bg-slate-50 border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-100 text-emerald-800 text-xs font-bold mb-3 uppercase tracking-wider">
              <Sparkles className="size-3.5 text-emerald-600" />
              <span>মূল সুবিধাসমূহ</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-4">
              আধুনিক শিক্ষাপ্রতিষ্ঠান পরিচালনার পূর্ণাঙ্গ সুবিধা
            </h2>
            <p className="text-slate-600 text-base sm:text-lg">
              এডুস্মার্ট বিডি দেশের জাতীয় শিক্ষাক্রম ও প্রতিষ্ঠানিক চাহিদার সাথে শতভাগ সামঞ্জস্য রেখে নির্মিত।
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {/* Feature 1: Attendance */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs hover:shadow-xl hover:border-emerald-200 transition-all group">
              <div className="size-13 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center mb-5 group-hover:scale-110 group-hover:bg-emerald-600 group-hover:text-white transition-all">
                <Calendar className="size-7" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">রিয়েল-টাইম হাজিরা ও এসএমএস</h3>
              <p className="text-slate-600 text-sm leading-relaxed mb-4">
                স্মার্ট কার্ড, বায়োমেট্রিক ডিভাইস বা শিক্ষকের অ্যাপ থেকে চোখের পলকে হাজিরা। অনুপস্থিত শিক্ষার্থীদের অভিভাবকদের তাৎক্ষণিক বাংলা এসএমএস নিশ্চিতকরণ।
              </p>
              <ul className="text-xs text-slate-500 space-y-1.5 font-medium">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="size-3.5 text-emerald-600" />
                  <span>ডিভাইস ও ম্যানুয়াল ডুয়াল মোড</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="size-3.5 text-emerald-600" />
                  <span>স্বয়ংক্রিয় টেলিকম এসএমএস গেটওয়ে</span>
                </li>
              </ul>
            </div>

            {/* Feature 2: Exams & Grading */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs hover:shadow-xl hover:border-emerald-200 transition-all group">
              <div className="size-13 rounded-2xl bg-teal-50 text-teal-700 flex items-center justify-center mb-5 group-hover:scale-110 group-hover:bg-teal-600 group-hover:text-white transition-all">
                <Award className="size-7" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">পরীক্ষা ও জিপিএ ৫.০ গ্রেডিং</h3>
              <p className="text-slate-600 text-sm leading-relaxed mb-4">
                শিক্ষা বোর্ডের সর্বশেষ নিয়ম অনুযায়ী পরীক্ষা মূল্যায়ন, প্রগ্রেস রিপোর্ট কার্ড তৈরি, সম্মিলিত মেধা তালিকা ও ট্রান্সক্রিপ্ট স্বয়ংক্রিয়ভাবে প্রস্তুত।
              </p>
              <ul className="text-xs text-slate-500 space-y-1.5 font-medium">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="size-3.5 text-emerald-600" />
                  <span>সিঙ্গেল ক্লিকে রেজাল্ট পাবলিকেশন</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="size-3.5 text-emerald-600" />
                  <span>প্রিন্ট-রেডি কাস্টম মার্কশিট</span>
                </li>
              </ul>
            </div>

            {/* Feature 3: Fees & Online Payments */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs hover:shadow-xl hover:border-emerald-200 transition-all group">
              <div className="size-13 rounded-2xl bg-blue-50 text-blue-700 flex items-center justify-center mb-5 group-hover:scale-110 group-hover:bg-blue-600 group-hover:text-white transition-all">
                <CreditCard className="size-7" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">ফি কালেকশন ও মোবাইল ব্যাংকিং</h3>
              <p className="text-slate-600 text-sm leading-relaxed mb-4">
                বিকাশ, নগদ, রকেট এবং ব্যাংক ড্রাফটের সমন্বয়ে স্বয়ংক্রিয় ফি গ্রহণ। অভিভাবকদের বকেয়া রিমাইন্ডার এবং শিক্ষার্থীদের জন্য ডিজিটাল কিউআর রসিদ।
              </p>
              <ul className="text-xs text-slate-500 space-y-1.5 font-medium">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="size-3.5 text-emerald-600" />
                  <span>ইনস্ট্যান্ট bKash & Nagad গেটওয়ে</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="size-3.5 text-emerald-600" />
                  <span>দৈনিক ও মাসিক ক্যাশ কালেকশন অডিট</span>
                </li>
              </ul>
            </div>

            {/* Feature 4: Online Admissions */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs hover:shadow-xl hover:border-emerald-200 transition-all group">
              <div className="size-13 rounded-2xl bg-indigo-50 text-indigo-700 flex items-center justify-center mb-5 group-hover:scale-110 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                <FileText className="size-7" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">ডিজিটাল ভর্তি ও স্ক্রিনিং</h3>
              <p className="text-slate-600 text-sm leading-relaxed mb-4">
                কাগজপত্রের ঝামেলা ছাড়াই অনলাইনেই ভর্তির আবেদন ফরম পূরণ, প্রয়োজনীয় ডকুমেন্টস আপলোড, পেমেন্ট ও এডমিট কার্ড সরবরাহ।
              </p>
              <ul className="text-xs text-slate-500 space-y-1.5 font-medium">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="size-3.5 text-emerald-600" />
                  <span>আবেদনকারীর লাইভ ট্র্যাকিং সিস্টেম</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="size-3.5 text-emerald-600" />
                  <span>অটোমেটিক রোল ও সেকশন অ্যালটমেন্ট</span>
                </li>
              </ul>
            </div>

            {/* Feature 5: Multi-Campus & Shift */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs hover:shadow-xl hover:border-emerald-200 transition-all group">
              <div className="size-13 rounded-2xl bg-purple-50 text-purple-700 flex items-center justify-center mb-5 group-hover:scale-110 group-hover:bg-purple-600 group-hover:text-white transition-all">
                <School className="size-7" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">মাল্টি-ক্যাম্পাস ও শিফট নিয়ন্ত্রণ</h3>
              <p className="text-slate-600 text-sm leading-relaxed mb-4">
                একাধিক শাখা বা ক্যাম্পাস, প্রভাতী ও দিবা শিফট (Morning/Day) এবং বাংলা ও ইংলিশ ভার্সনের জন্য একই প্ল্যাটফর্মে সেন্ট্রালাইজড ম্যানেজমেন্ট।
              </p>
              <ul className="text-xs text-slate-500 space-y-1.5 font-medium">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="size-3.5 text-emerald-600" />
                  <span>ক্যাম্পাস-ভিত্তিক ডেটা ফিল্টারিং</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="size-3.5 text-emerald-600" />
                  <span>শিফট অনুসারে ক্লাস রুটিন ও শিক্ষক বণ্টন</span>
                </li>
              </ul>
            </div>

            {/* Feature 6: Transport & Library */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs hover:shadow-xl hover:border-emerald-200 transition-all group">
              <div className="size-13 rounded-2xl bg-amber-50 text-amber-700 flex items-center justify-center mb-5 group-hover:scale-110 group-hover:bg-amber-600 group-hover:text-white transition-all">
                <Bus className="size-7" />
              </div>
              <h3 className="text-xl font-bold text-slate-900 mb-2">পরিবহন ও লাইব্রেরি ট্র্যাকিং</h3>
              <p className="text-slate-600 text-sm leading-relaxed mb-4">
                স্কুল বাস/ভ্যানের রুট ও স্টপেজ পর্যবেক্ষণ এবং লাইব্রেরির বইয়ের ক্যাটালগিং, বারকোড স্ক্যানিং ও লেট-ফি স্বয়ংক্রিয় হিসাব।
              </p>
              <ul className="text-xs text-slate-500 space-y-1.5 font-medium">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="size-3.5 text-emerald-600" />
                  <span>বাস রুট ও ড্রাইভার প্রোফাইল</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="size-3.5 text-emerald-600" />
                  <span>ডিজিটাল বই ইস্যু ও রিটার্ন ট্র্যাকিং</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Online Admissions Direct Action Banner */}
      <section id="admissions" className="py-16 bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-950 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="rounded-3xl bg-white/5 border border-white/10 p-8 sm:p-12 backdrop-blur-md">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              <div className="lg:col-span-8">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-xs font-bold mb-4 border border-emerald-500/30">
                  <Sparkles className="size-3.5" />
                  <span>ভর্তি ২০২৬ ওপেন</span>
                </div>
                <h2 className="text-2xl sm:text-4xl font-extrabold text-white mb-3 tracking-tight">
                  নতুন শিক্ষাবর্ষে অনলাইনে ভর্তি আবেদন সম্পন্ন করুন
                </h2>
                <p className="text-slate-300 text-sm sm:text-base leading-relaxed max-w-2xl">
                  ঢাকা আইডিয়াল স্কুল ও কলেজসহ আমাদের সহযোগী শিক্ষাপ্রতিষ্ঠানসমূহে নার্সারি থেকে দশম শ্রেণী পর্যন্ত ডিজিটাল ভর্তি আবেদন গ্রহণ চলছে। আপনার সন্তানের শিক্ষাজীবন শুরু হোক আধুনিক প্রযুক্তির ছোঁয়ায়।
                </p>
              </div>

              <div className="lg:col-span-4 flex flex-col sm:flex-row lg:flex-col gap-3.5">
                <Link
                  href="/admissions/dhaka-ideal"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-sm shadow-lg shadow-emerald-500/20 transition-all hover:scale-105"
                >
                  <FileText className="size-4" />
                  <span>নতুন আবেদন ফরম পূরণ</span>
                </Link>
                <Link
                  href="/admissions/dhaka-ideal/track"
                  className="inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-white/10 hover:bg-white/20 text-white font-semibold text-sm border border-white/15 transition-all"
                >
                  <span>আবেদনের বর্তমান অবস্থা যাচাই</span>
                  <ExternalLink className="size-4 text-slate-300" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 7. Frequently Asked Questions (Accordion) */}
      <section id="faq" className="py-16 sm:py-24 bg-white border-b border-slate-200">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold mb-3 uppercase tracking-wider">
              <span>সাধারণ জিজ্ঞাসা</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight mb-3">
              সচরাচর জিজ্ঞাসিত প্রশ্নোত্তর (FAQ)
            </h2>
            <p className="text-slate-600 text-sm sm:text-base">
              এডুস্মার্ট বিডি প্ল্যাটফর্ম ও এর কার্যপদ্ধতি সম্পর্কে প্রয়োজনীয় তথ্য জেনে নিন
            </p>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, index) => {
              const isOpen = openFaqIndex === index;
              return (
                <div
                  key={index}
                  className="rounded-2xl border border-slate-200/90 overflow-hidden transition-all bg-slate-50/50 hover:bg-slate-50"
                >
                  <button
                    type="button"
                    onClick={() => setOpenFaqIndex(isOpen ? null : index)}
                    className="w-full flex items-center justify-between p-5 text-left font-bold text-slate-900 text-sm sm:text-base gap-4"
                    aria-expanded={isOpen}
                  >
                    <span>{faq.q}</span>
                    <ChevronDown
                      className={`size-5 text-slate-400 shrink-0 transition-transform duration-200 ${
                        isOpen ? 'rotate-180 text-emerald-600' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-5 text-sm text-slate-600 leading-relaxed border-t border-slate-100 pt-3">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 8. Institutional Footer */}
      <footer className="bg-slate-950 text-slate-400 pt-16 pb-12 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10 pb-12 border-b border-slate-800">
            {/* Col 1: Brand & Bio */}
            <div className="lg:col-span-2 space-y-4">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-md">
                  <School className="size-6" />
                </div>
                <div>
                  <span className="text-xl font-bold text-white tracking-tight">এডুস্মার্ট বিডি</span>
                  <p className="text-[11px] text-slate-400">EduSmart BD — Digital Education SaaS</p>
                </div>
              </div>
              <p className="text-xs sm:text-sm text-slate-400 leading-relaxed max-w-sm">
                বাংলাদেশের প্রাথমিক, মাধ্যমিক ও উচ্চ মাধ্যমিক শিক্ষাপ্রতিষ্ঠানসমূহের জন্য বিশ্বস্ত ও পূর্ণাঙ্গ ডিজিটাল স্কুল ম্যানেজমেন্ট সিস্টেম।
              </p>
              <div className="flex items-center gap-3 pt-2 text-xs text-slate-300">
                <span className="inline-flex items-center gap-1.5 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800">
                  <ShieldCheck className="size-4 text-emerald-400" />
                  <span>SSL এনক্রিপ্টেড ও সুরক্ষিত</span>
                </span>
                <span className="inline-flex items-center gap-1.5 bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800">
                  <Sparkles className="size-4 text-teal-400" />
                  <span>২০২৬ রেডি ক্লাউড</span>
                </span>
              </div>
            </div>

            {/* Col 2: Fast Portals */}
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-white uppercase tracking-wider">পোর্টাল এক্সেস</h4>
              <ul className="space-y-2 text-xs sm:text-sm">
                <li>
                  <Link href="/login" className="hover:text-white transition-colors">
                    অধ্যক্ষ ও অ্যাডমিন লগইন
                  </Link>
                </li>
                <li>
                  <Link href="/login" className="hover:text-white transition-colors">
                    শিক্ষক ও শিক্ষিকা পোর্টাল
                  </Link>
                </li>
                <li>
                  <Link href="/login" className="hover:text-white transition-colors">
                    শিক্ষার্থী পোর্টাল
                  </Link>
                </li>
                <li>
                  <Link href="/login" className="hover:text-white transition-colors">
                    অভিভাবক পোর্টাল
                  </Link>
                </li>
              </ul>
            </div>

            {/* Col 3: Public Services */}
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-white uppercase tracking-wider">পাবলিক সেবা</h4>
              <ul className="space-y-2 text-xs sm:text-sm">
                <li>
                  <Link href="/admissions/dhaka-ideal" className="hover:text-white transition-colors">
                    অনলাইন ভর্তি আবেদন
                  </Link>
                </li>
                <li>
                  <Link href="/admissions/dhaka-ideal/track" className="hover:text-white transition-colors">
                    আবেদনের ফলাফল ও ট্র্যাকিং
                  </Link>
                </li>
                <li>
                  <a href="#features" className="hover:text-white transition-colors">
                    সফটওয়্যার সুবিধাসমূহ
                  </a>
                </li>
                <li>
                  <a href="#faq" className="hover:text-white transition-colors">
                    জিজ্ঞাসিত প্রশ্নোত্তর
                  </a>
                </li>
              </ul>
            </div>

            {/* Col 4: Contact / Helpdesk */}
            <div className="space-y-3">
              <h4 className="text-sm font-bold text-white uppercase tracking-wider">সহায়তা ও যোগাযোগ</h4>
              <ul className="space-y-2.5 text-xs sm:text-sm">
                <li className="flex items-center gap-2">
                  <Phone className="size-4 text-emerald-400 shrink-0" />
                  <span>+৮৮০ ১৭০০-০০০০০০</span>
                </li>
                <li className="flex items-center gap-2">
                  <Mail className="size-4 text-emerald-400 shrink-0" />
                  <span>support@edusmart.bd</span>
                </li>
                <li className="flex items-start gap-2">
                  <MapPin className="size-4 text-emerald-400 shrink-0 mt-0.5" />
                  <span>মতিঝিল, ঢাকা-১০০০, বাংলাদেশ</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-8 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-500 gap-4">
            <p>© ২০২৬ এডুস্মার্ট বিডি (EduSmart BD)। সর্বস্বত্ব সংরক্ষিত।</p>
            <div className="flex items-center gap-5">
              <a href="#faq" className="hover:text-slate-400 transition-colors">গোপনীয়তা নীতি</a>
              <a href="#faq" className="hover:text-slate-400 transition-colors">ব্যবহারের শর্তাবলী</a>
              <Link href="/login" className="hover:text-emerald-400 font-medium transition-colors">সাইন ইন</Link>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
