import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'EduSmart BD — লগইন | ডিজিটাল স্কুল ম্যানেজমেন্ট প্ল্যাটফর্ম',
  description:
    'এডুস্মার্ট বিডি প্রাতিষ্ঠানিক পোর্টালে লগইন করুন। অধ্যক্ষ, শিক্ষক, শিক্ষার্থী ও অভিভাবকদের জন্য সুরক্ষিত ক্লাউড ড্যাশবোর্ড।',
};

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
