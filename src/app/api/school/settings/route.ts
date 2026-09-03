import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, authorize } from '@/lib/authorization/engine';
import { withTenantContext } from '@/lib/db';
import { logAuditEvent } from '@/lib/audit/logger';
import { SchoolSettingsUpdateSchema } from '@/lib/validation/school-settings';

/**
 * GET /api/school/settings
 * Retrieves the institutional profile, contact, address, and branding settings
 * for the authenticated user's active school.
 * 
 * Required Permission: SETTINGS_VIEW
 */
export async function GET(req: NextRequest) {
  try {
    const { context, schoolId } = await requirePermission(req, {
      permission: 'SETTINGS_VIEW',
    });

    const result = await withTenantContext(schoolId, async (tx) => {
      // 1. Fetch School Entity
      const school = await tx.school.findUnique({
        where: { id: schoolId },
        select: {
          id: true,
          slug: true,
          nameEn: true,
          nameBn: true,
          eiin: true,
          boardCode: true,
          registrationNo: true,
          establishedYear: true,
          email: true,
          phone: true,
          alternatePhone: true,
          website: true,
          currency: true,
          locale: true,
          status: true,
        },
      });

      if (!school) {
        return null;
      }

      // 2. Fetch or Default Branding
      const branding = await tx.schoolBranding.findUnique({
        where: { schoolId },
        select: {
          id: true,
          logoUrl: true,
          faviconUrl: true,
          monogramUrl: true,
          officialSealUrl: true,
          principalSignatureUrl: true,
          headmasterSignatureUrl: true,
          primaryColor: true,
          secondaryColor: true,
          accentColor: true,
          idCardTemplate: true,
          reportCardTemplate: true,
        },
      });

      // 3. Fetch Primary Address
      const address = await tx.schoolAddress.findFirst({
        where: { schoolId, isPrimary: true },
        select: {
          id: true,
          addressLine1: true,
          addressLine2: true,
          postOffice: true,
          postCode: true,
          thana: true,
          district: true,
          division: true,
          country: true,
          isPrimary: true,
        },
      });

      // 4. Fetch System Settings
      const settings = await tx.schoolSettings.findUnique({
        where: { schoolId },
        select: {
          id: true,
          timezone: true,
          financialYearStart: true,
          attendanceType: true,
          receiptHeaderBn: true,
          receiptHeaderEn: true,
          receiptFooterNote: true,
        },
      });

      return { school, branding, address, settings };
    });

    if (!result || !result.school) {
      return NextResponse.json(
        { success: false, error: 'School entity not found.' },
        { status: 404 }
      );
    }

    // Check if user also has edit privileges
    const editCheck = await authorize({
      userId: context.userId,
      schoolId,
      permission: 'SETTINGS_UPDATE',
    });

    return NextResponse.json({
      success: true,
      data: {
        school: result.school,
        branding: result.branding || {
          logoUrl: null,
          faviconUrl: null,
          monogramUrl: null,
          officialSealUrl: null,
          principalSignatureUrl: null,
          headmasterSignatureUrl: null,
          primaryColor: '#166534',
          secondaryColor: '#0f172a',
          accentColor: '#eab308',
          idCardTemplate: 'CLASSIC_CLEAN',
          reportCardTemplate: 'BANGLADESH_STANDARD',
        },
        address: result.address || null,
        settings: result.settings || null,
        canEdit: editCheck.authorized,
      },
    });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message?.startsWith('UNAUTHORIZED')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (err.message?.startsWith('FORBIDDEN')) {
      return NextResponse.json({ success: false, error: err.message.replace('FORBIDDEN: ', '') }, { status: 403 });
    }

    console.error('GET /api/school/settings error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve school settings.' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/school/settings
 * Performs partial or full updates to school profile, contact, address, and branding.
 * 
 * Required Permission: SETTINGS_UPDATE
 */
export async function PATCH(req: NextRequest) {
  try {
    const { context, schoolId } = await requirePermission(req, {
      permission: 'SETTINGS_UPDATE',
    });

    const bodyJson = await req.json();
    const parseResult = SchoolSettingsUpdateSchema.safeParse(bodyJson);

    if (!parseResult.success) {
      const issueMessages = parseResult.error.issues.map((i) => i.message).join(', ');
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed: ' + issueMessages,
          details: parseResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const { profile, address, branding } = parseResult.data;

    if (!profile && !address && !branding) {
      return NextResponse.json(
        { success: false, error: 'No update payload provided.' },
        { status: 400 }
      );
    }

    const clientIp = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'Unknown';

    const changeSummaries: string[] = [];

    const updatedData = await withTenantContext(schoolId, async (tx) => {
      // Fetch Before State for Forensic Audit Logging
      const beforeSchool = await tx.school.findUnique({
        where: { id: schoolId },
      });
      const beforeBranding = await tx.schoolBranding.findUnique({
        where: { schoolId },
      });
      const beforeAddress = await tx.schoolAddress.findFirst({
        where: { schoolId, isPrimary: true },
      });

      const beforeState: Record<string, unknown> = {
        school: beforeSchool,
        branding: beforeBranding,
        address: beforeAddress,
      };

      // 1. Update School Profile & Contact
      if (profile && Object.keys(profile).length > 0) {
        const updatePayload: Record<string, unknown> = {};
        if (profile.nameBn !== undefined) updatePayload.nameBn = profile.nameBn;
        if (profile.nameEn !== undefined) updatePayload.nameEn = profile.nameEn;
        if (profile.eiin !== undefined) updatePayload.eiin = profile.eiin || null;
        if (profile.boardCode !== undefined) updatePayload.boardCode = profile.boardCode || null;
        if (profile.registrationNo !== undefined) updatePayload.registrationNo = profile.registrationNo || null;
        if (profile.establishedYear !== undefined) updatePayload.establishedYear = profile.establishedYear || null;
        if (profile.phone !== undefined) updatePayload.phone = profile.phone;
        if (profile.alternatePhone !== undefined) updatePayload.alternatePhone = profile.alternatePhone || null;
        if (profile.email !== undefined) updatePayload.email = profile.email;
        if (profile.website !== undefined) updatePayload.website = profile.website || null;

        await tx.school.update({
          where: { id: schoolId },
          data: updatePayload,
        });

        changeSummaries.push(`Updated school profile fields: ${Object.keys(updatePayload).join(', ')}`);
      }

      // 2. Upsert Institutional Address
      if (address && Object.keys(address).length > 0) {
        if (beforeAddress) {
          await tx.schoolAddress.update({
            where: { id: beforeAddress.id },
            data: {
              addressLine1: address.addressLine1 !== undefined ? address.addressLine1 : beforeAddress.addressLine1,
              addressLine2: address.addressLine2 !== undefined ? (address.addressLine2 || null) : beforeAddress.addressLine2,
              postOffice: address.postOffice !== undefined ? address.postOffice : beforeAddress.postOffice,
              postCode: address.postCode !== undefined ? address.postCode : beforeAddress.postCode,
              thana: address.thana !== undefined ? address.thana : beforeAddress.thana,
              district: address.district !== undefined ? address.district : beforeAddress.district,
              division: address.division !== undefined ? address.division : beforeAddress.division,
              country: address.country !== undefined ? address.country : beforeAddress.country,
              isPrimary: true,
            },
          });
          changeSummaries.push(`Updated primary address: ${address.district || beforeAddress.district}, ${address.division || beforeAddress.division}`);
        } else {
          await tx.schoolAddress.create({
            data: {
              schoolId,
              addressLine1: address.addressLine1 || 'N/A',
              addressLine2: address.addressLine2 || null,
              postOffice: address.postOffice || 'N/A',
              postCode: address.postCode || 'N/A',
              thana: address.thana || 'N/A',
              district: address.district || 'N/A',
              division: address.division || 'DHAKA',
              country: address.country || 'Bangladesh',
              isPrimary: true,
            },
          });
          changeSummaries.push('Created primary institutional address');
        }
      }

      // 3. Upsert School Branding
      if (branding && Object.keys(branding).length > 0) {
        const brandingData: Record<string, unknown> = {};
        if (branding.logoUrl !== undefined) brandingData.logoUrl = branding.logoUrl || null;
        if (branding.faviconUrl !== undefined) brandingData.faviconUrl = branding.faviconUrl || null;
        if (branding.monogramUrl !== undefined) brandingData.monogramUrl = branding.monogramUrl || null;
        if (branding.officialSealUrl !== undefined) brandingData.officialSealUrl = branding.officialSealUrl || null;
        if (branding.principalSignatureUrl !== undefined) brandingData.principalSignatureUrl = branding.principalSignatureUrl || null;
        if (branding.headmasterSignatureUrl !== undefined) brandingData.headmasterSignatureUrl = branding.headmasterSignatureUrl || null;
        if (branding.primaryColor !== undefined) brandingData.primaryColor = branding.primaryColor;
        if (branding.secondaryColor !== undefined) brandingData.secondaryColor = branding.secondaryColor;
        if (branding.accentColor !== undefined) brandingData.accentColor = branding.accentColor;
        if (branding.idCardTemplate !== undefined) brandingData.idCardTemplate = branding.idCardTemplate;
        if (branding.reportCardTemplate !== undefined) brandingData.reportCardTemplate = branding.reportCardTemplate;

        await tx.schoolBranding.upsert({
          where: { schoolId },
          update: brandingData,
          create: {
            schoolId,
            primaryColor: branding.primaryColor || '#166534',
            secondaryColor: branding.secondaryColor || '#0f172a',
            accentColor: branding.accentColor || '#eab308',
            idCardTemplate: branding.idCardTemplate || 'CLASSIC_CLEAN',
            reportCardTemplate: branding.reportCardTemplate || 'BANGLADESH_STANDARD',
            ...brandingData,
          },
        });

        changeSummaries.push(`Updated school branding assets: ${Object.keys(brandingData).join(', ')}`);
      }

      // Fetch After State
      const updatedSchool = await tx.school.findUnique({
        where: { id: schoolId },
        select: {
          id: true,
          slug: true,
          nameEn: true,
          nameBn: true,
          eiin: true,
          boardCode: true,
          registrationNo: true,
          establishedYear: true,
          email: true,
          phone: true,
          alternatePhone: true,
          website: true,
          currency: true,
          locale: true,
          status: true,
        },
      });

      const updatedBranding = await tx.schoolBranding.findUnique({
        where: { schoolId },
      });

      const updatedAddress = await tx.schoolAddress.findFirst({
        where: { schoolId, isPrimary: true },
      });

      const afterState: Record<string, unknown> = {
        school: updatedSchool,
        branding: updatedBranding,
        address: updatedAddress,
      };

      // Record Forensic Audit Log
      await logAuditEvent({
        schoolId,
        actorUserId: context.userId,
        actorName: context.user.fullName,
        actorRole: 'ADMIN',
        action: 'UPDATE',
        entity: 'School',
        entityId: schoolId,
        beforeState,
        afterState,
        changeSummary: changeSummaries.join('; '),
        ipAddress: clientIp,
        userAgent,
      });

      return {
        school: updatedSchool,
        branding: updatedBranding,
        address: updatedAddress,
      };
    });

    return NextResponse.json({
      success: true,
      message: 'বিদ্যালয়ের তথ্য সফলভাবে হালনাগাদ করা হয়েছে।',
      data: updatedData,
    });
  } catch (error: unknown) {
    const err = error as Error;
    if (err.message?.startsWith('UNAUTHORIZED')) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }
    if (err.message?.startsWith('FORBIDDEN')) {
      return NextResponse.json({ success: false, error: err.message.replace('FORBIDDEN: ', '') }, { status: 403 });
    }

    console.error('PATCH /api/school/settings error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update school settings.' },
      { status: 500 }
    );
  }
}
