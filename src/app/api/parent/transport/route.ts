import { NextRequest, NextResponse } from 'next/server';
import { requireActiveSchool } from '@/lib/authorization/engine';
import { prisma } from '@/lib/db';

/**
 * GET /api/parent/transport
 * Lists transport details for all children linked to the authenticated guardian.
 * IDOR safe: queries strictly through student_guardians relation.
 */
export async function GET(request: NextRequest) {
  try {
    const { context, schoolId } = await requireActiveSchool(request);

    // Find all children linked to this guardian in this school
    const studentGuardians = await prisma.studentGuardian.findMany({
      where: {
        schoolId,
        guardian: {
          userId: context.userId,
          schoolId,
        },
      },
      select: {
        studentId: true,
        student: {
          select: {
            id: true,
            studentCode: true,
            firstNameEn: true,
            lastNameEn: true,
            fullNameEn: true,
            fullNameBn: true,
          },
        },
      },
    });

    if (!studentGuardians || studentGuardians.length === 0) {
      return NextResponse.json({ success: true, data: [] });
    }

    const studentIds = studentGuardians.map((sg) => sg.studentId);

    // Fetch transport assignments for these students
    const assignments = await prisma.studentTransportAssignment.findMany({
      where: {
        schoolId,
        studentId: { in: studentIds },
        status: 'ACTIVE',
      },
      include: {
        student: {
          select: {
            id: true,
            studentCode: true,
            firstNameEn: true,
            lastNameEn: true,
            fullNameEn: true,
            fullNameBn: true,
          },
        },
        route: {
          select: {
            id: true,
            routeCode: true,
            routeName: true,
          },
        },
        pickupStop: {
          select: {
            id: true,
            stopName: true,
            pickupTime: true,
            sequenceNumber: true,
          },
        },
        dropoffStop: {
          select: {
            id: true,
            stopName: true,
            dropoffTime: true,
            sequenceNumber: true,
          },
        },
        vehicle: {
          select: {
            id: true,
            vehicleCode: true,
            registrationNumber: true,
            status: true,
          },
        },
      },
    });

    return NextResponse.json({
      success: true,
      data: assignments,
    });
  } catch (error: any) {
    const status = error.message?.includes('Unauthorized') ? 403 : 500;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}
