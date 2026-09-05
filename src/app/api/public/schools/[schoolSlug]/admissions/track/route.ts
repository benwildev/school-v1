import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { checkTrackingThrottle, recordTrackingFailure, clearTrackingThrottle } from '@/lib/security/tracking-throttle';

/**
 * GET /api/public/schools/[schoolSlug]/admissions/track
 * 
 * Privacy-Hardened Public Admission Tracking Endpoint.
 * 
 * Security Controls:
 * 1. Requires secret high-entropy trackingCode (rejects application-number-only probing).
 * 2. Strict Rate Limiting / Failure Throttling (IP + schoolSlug with 5-attempt lockout).
 * 3. Uniform 404 error responses (zero information leakage about school or application existence).
 * 4. Minimal public payload: Strictly excludes father/mother NID, phones, full addresses,
 *    birth registration number, religion, previous GPA, internal reviewer IDs/notes,
 *    document URLs, and converted student database IDs.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ schoolSlug: string }> }
) {
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0].trim() : '127.0.0.1';

  try {
    const { schoolSlug } = await params;
    const { searchParams } = new URL(request.url);

    // 1. Throttling / Lockout check
    const throttle = await checkTrackingThrottle(ip, schoolSlug);
    if (throttle.isBlocked) {
      return NextResponse.json(
        {
          success: false,
          error: 'অতিরিক্ত অনুরোধের কারণে ট্র্যাকিং সাময়িকভাবে স্থগিত রয়েছে। অনুগ্রহ করে ১৫ মিনিট পর আবার চেষ্টা করুন।',
        },
        { status: 429 }
      );
    }

    const trackingCode = searchParams.get('trackingCode')?.trim();
    const applicationNumber = searchParams.get('applicationNumber')?.trim();

    // Tracking code is required as a secret bearer credential.
    // If only applicationNumber is provided without trackingCode, reject to prevent enumeration probing.
    if (!trackingCode && applicationNumber) {
      await recordTrackingFailure(ip, schoolSlug);
      return NextResponse.json(
        {
          success: false,
          error: 'আবেদনের তথ্যের জন্য গোপন ট্র্যাকিং কোড (TRK-...) আবশ্যক।',
        },
        { status: 400 }
      );
    }

    if (!trackingCode || trackingCode.length < 8) {
      await recordTrackingFailure(ip, schoolSlug);
      return NextResponse.json(
        { success: false, error: 'সঠিক ট্র্যাকিং কোড প্রদান করুন।' },
        { status: 400 }
      );
    }

    // 2. Resolve school by verified slug
    const school = await prisma.school.findFirst({
      where: {
        slug: schoolSlug,
        status: 'ACTIVE',
        deletedAt: null,
      },
      select: { id: true },
    });

    if (!school) {
      // Uniform generic response to prevent school enumeration
      await recordTrackingFailure(ip, schoolSlug);
      return NextResponse.json(
        { success: false, error: 'প্রদত্ত তথ্য অনুযায়ী কোনো আবেদন খুঁজে পাওয়া যায়নি।' },
        { status: 404 }
      );
    }

    // 3. Find matching application within this tenant
    const application = await prisma.admissionApplication.findFirst({
      where: {
        schoolId: school.id,
        trackingCode: trackingCode.toUpperCase(),
        ...(applicationNumber ? { applicationNumber: applicationNumber.toUpperCase() } : {}),
      },
      select: {
        applicationNumber: true,
        status: true,
        applicantNameBn: true,
        applicantNameEn: true,
        appliedShift: true,
        curriculumVersion: true,
        rejectionReason: true,
        createdAt: true,
        updatedAt: true,
        academicSession: {
          select: { name: true },
        },
        appliedClass: {
          select: { nameEn: true, nameBn: true },
        },
        appliedCampus: {
          select: { nameEn: true, nameBn: true },
        },
      },
    });

    if (!application) {
      await recordTrackingFailure(ip, schoolSlug);
      return NextResponse.json(
        { success: false, error: 'প্রদত্ত তথ্য অনুযায়ী কোনো আবেদন খুঁজে পাওয়া যায়নি।' },
        { status: 404 }
      );
    }

    // Clear failure counter on valid lookup
    await clearTrackingThrottle(ip, schoolSlug);

    // 4. Return minimal privacy-hardened response
    return NextResponse.json({
      success: true,
      data: {
        applicationNumber: application.applicationNumber,
        status: application.status,
        applicantName: application.applicantNameBn || application.applicantNameEn,
        appliedClass: application.appliedClass?.nameBn || application.appliedClass?.nameEn || '',
        academicSession: application.academicSession?.name || '',
        appliedCampus: application.appliedCampus?.nameBn || application.appliedCampus?.nameEn || null,
        shift: application.appliedShift,
        curriculum: application.curriculumVersion,
        submittedAt: application.createdAt,
        updatedAt: application.updatedAt,
        rejectionReason: application.status === 'REJECTED' ? application.rejectionReason : null,
      },
    });
  } catch (error: unknown) {
    console.error('Admission Tracking Error:', error);
    return NextResponse.json(
      { success: false, error: 'আবেদনের তথ্য অনুসন্ধানের সময় সার্ভার ত্রুটি ঘটেছে।' },
      { status: 500 }
    );
  }
}
