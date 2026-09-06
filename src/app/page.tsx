import { cookies } from "next/headers";
import { LandingView } from "@/components/public/landing-view";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "EduSmart BD (এডুস্মার্ট বিডি) — ডিজিটাল স্কুল ম্যানেজমেন্ট প্ল্যাটফর্ম",
  description:
    "বাংলাদেশের প্রাথমিক, মাধ্যমিক ও উচ্চ মাধ্যমিক শিক্ষাপ্রতিষ্ঠানের জন্য ক্লাউড-বেসড আধুনিক স্কুল ম্যানেজমেন্ট, ফলাফল, ডিজিটাল হাজিরা ও অনলাইন ভর্তি সিস্টেম।",
};

export default async function HomePage() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("__edusmart_session")?.value;
  const isAuthenticated = Boolean(sessionToken);

  return <LandingView isAuthenticated={isAuthenticated} />;
}
