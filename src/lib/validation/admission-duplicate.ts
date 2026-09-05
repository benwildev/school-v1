import { Prisma } from '@prisma/client';

export interface DuplicateMatch {
  id: string;
  applicationNumber: string;
  applicantNameEn: string;
  applicantNameBn: string;
  status: string;
  createdAt: Date;
  matchReasons: string[];
}

export interface ApplicantIdentityPayload {
  id?: string;
  birthRegistrationNo?: string | null;
  dateOfBirth?: Date;
  applicantNameEn: string;
  applicantNameBn: string;
  fatherPhone: string;
}

/**
 * Detects likely duplicate admission applications based on multi-factor identity signals.
 * Designed as an informational warning system for administrative staff rather than a hard blocker.
 */
export async function detectDuplicateApplications(
  schoolId: string,
  applicant: ApplicantIdentityPayload,
  tx: any
): Promise<DuplicateMatch[]> {
  const orConditions: Prisma.AdmissionApplicationWhereInput[] = [];

  // Signal 1: Matching Birth Registration Number (if present)
  if (applicant.birthRegistrationNo && applicant.birthRegistrationNo.trim().length > 5) {
    orConditions.push({
      birthRegistrationNo: applicant.birthRegistrationNo.trim(),
    });
  }

  // Signal 2: Matching Date of Birth AND Guardian Phone
  if (applicant.dateOfBirth && applicant.fatherPhone) {
    orConditions.push({
      dateOfBirth: applicant.dateOfBirth,
      fatherPhone: applicant.fatherPhone.trim(),
    });
  }

  // Signal 3: Matching Name AND Guardian Phone
  if (applicant.fatherPhone && (applicant.applicantNameEn || applicant.applicantNameBn)) {
    orConditions.push({
      fatherPhone: applicant.fatherPhone.trim(),
      OR: [
        { applicantNameEn: { equals: applicant.applicantNameEn.trim(), mode: 'insensitive' } },
        { applicantNameBn: { equals: applicant.applicantNameBn.trim(), mode: 'insensitive' } },
      ],
    });
  }

  if (orConditions.length === 0) {
    return [];
  }

  const matches = await tx.admissionApplication.findMany({
    where: {
      schoolId,
      ...(applicant.id ? { id: { not: applicant.id } } : {}),
      OR: orConditions,
    },
    select: {
      id: true,
      applicationNumber: true,
      applicantNameEn: true,
      applicantNameBn: true,
      birthRegistrationNo: true,
      dateOfBirth: true,
      fatherPhone: true,
      status: true,
      createdAt: true,
    },
    take: 5,
  });

  return matches.map((m: {
    id: string;
    applicationNumber: string;
    applicantNameEn: string;
    applicantNameBn: string;
    birthRegistrationNo: string | null;
    dateOfBirth: Date;
    fatherPhone: string;
    status: string;
    createdAt: Date;
  }) => {
    const reasons: string[] = [];

    if (
      applicant.birthRegistrationNo &&
      m.birthRegistrationNo &&
      applicant.birthRegistrationNo.trim() === m.birthRegistrationNo.trim()
    ) {
      reasons.push('একই জন্ম নিবন্ধন নম্বর (BRN)');
    }

    if (
      applicant.dateOfBirth &&
      m.dateOfBirth &&
      new Date(applicant.dateOfBirth).toISOString().split('T')[0] ===
        new Date(m.dateOfBirth).toISOString().split('T')[0] &&
      applicant.fatherPhone === m.fatherPhone
    ) {
      reasons.push('একই জন্ম তারিখ ও অভিভাবকের মোবাইল নম্বর');
    }

    if (
      applicant.fatherPhone === m.fatherPhone &&
      (applicant.applicantNameEn.trim().toLowerCase() === m.applicantNameEn.trim().toLowerCase() ||
        applicant.applicantNameBn.trim() === m.applicantNameBn.trim())
    ) {
      reasons.push('একই শিক্ষার্থীর নাম ও অভিভাবকের মোবাইল নম্বর');
    }

    return {
      id: m.id,
      applicationNumber: m.applicationNumber,
      applicantNameEn: m.applicantNameEn,
      applicantNameBn: m.applicantNameBn,
      status: m.status,
      createdAt: m.createdAt,
      matchReasons: reasons.length > 0 ? reasons : ['সম্ভাব্য আবেদন সাদৃশ্য'],
    };
  });
}
