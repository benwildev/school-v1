import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { logAuditEvent } from '@/lib/audit/logger';
import { TeacherCreateSchema } from '@/lib/validation/teacher';
import { hashPassword } from '@/lib/auth/crypto';
import { randomBytes } from 'crypto';

/**
 * GET /api/school/teachers
 * List all teachers for the authenticated school
 * Required Permission: STAFF_VIEW
 */
export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission(request, {
      permission: 'STAFF_VIEW',
    });

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const status = searchParams.get('status');

    // Build query
    const where: any = { schoolId };
    
    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { fullNameEn: { contains: search, mode: 'insensitive' } },
        { fullNameBn: { contains: search, mode: 'insensitive' } },
        { teacherCode: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { email: { contains: search, mode: 'insensitive' } },
      ];
    }

    const teachers = await prisma.teacher.findMany({
      where,
      include: {
        user: {
          select: {
            id: true,
            status: true,
          }
        },
        campus: {
          select: {
            id: true,
            nameEn: true,
            nameBn: true,
          }
        }
      },
      orderBy: [
        { designation: 'asc' },
        { fullNameEn: 'asc' }
      ]
    });

    return NextResponse.json({ data: teachers });
  } catch (error: any) {
    console.error('Error fetching teachers:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/school/teachers
 * Create a new teacher (and provision underlying User)
 * Required Permission: STAFF_CREATE
 */
export async function POST(request: NextRequest) {
  try {
    const { context, schoolId } = await requirePermission(request, {
      permission: 'STAFF_CREATE',
    });
    const userId = context.userId;

    const body = await request.json();
    const validatedData = TeacherCreateSchema.safeParse(body);

    if (!validatedData.success) {
      return NextResponse.json(
        { error: 'Validation Error', details: validatedData.error.format() },
        { status: 400 }
      );
    }

    const data = validatedData.data;

    // Cross-tenant campus check
    if (data.campusId) {
      const campus = await prisma.campus.findUnique({
        where: { id: data.campusId }
      });
      if (!campus || campus.schoolId !== schoolId) {
        return NextResponse.json(
          { error: 'Invalid Campus or Campus does not belong to this school' },
          { status: 400 }
        );
      }
    }

    // Uniqueness checks
    const existingCode = await prisma.teacher.findUnique({
      where: {
        schoolId_teacherCode: {
          schoolId,
          teacherCode: data.teacherCode
        }
      }
    });

    if (existingCode) {
      return NextResponse.json(
        { error: 'Teacher code already exists in this school' },
        { status: 409 }
      );
    }

    const existingPhone = await prisma.teacher.findUnique({
      where: {
        schoolId_phone: {
          schoolId,
          phone: data.phone
        }
      }
    });

    if (existingPhone) {
      return NextResponse.json(
        { error: 'Phone number already exists in this school' },
        { status: 409 }
      );
    }

    // Execute in transaction to provision User + Teacher
    const newTeacher = await withTenantContext(schoolId, async (tx) => {
      // Create user using a cryptographically secure random temporary credential (not exposed)
      // This enforces that the teacher must go through a proper password setup/reset flow via email/SMS.
      const defaultPassword = randomBytes(32).toString('hex');
      const passwordHash = await hashPassword(defaultPassword);
      
      const user = await tx.user.create({
        data: {
          schoolId,
          fullName: data.fullNameEn,
          phone: data.phone,
          email: data.email || undefined,
          passwordHash,
          status: 'ACTIVE',
        }
      });

      // Now create teacher
      const teacher = await tx.teacher.create({
        data: {
          ...data,
          schoolId,
          userId: user.id
        },
        include: {
          user: true,
          campus: true
        }
      });

      return teacher;
    });

    // Forensic Audit Log
    await logAuditEvent({
      schoolId,
      actorUserId: userId,
      actorName: context.user.fullName || context.user.phone || 'User',
      actorRole: 'ADMIN',
      action: 'INSERT',
      entity: 'Teacher',
      entityId: newTeacher.id,
      afterState: {
        teacherCode: newTeacher.teacherCode,
        name: newTeacher.fullNameEn,
        designation: newTeacher.designation,
      },
      changeSummary: `Created teacher ${newTeacher.fullNameEn} (${newTeacher.teacherCode})`,
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
    });

    return NextResponse.json({ data: newTeacher }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating teacher:', error);
    
    // Catch unique constraint failures on User creation if phone exists there
    if (error.code === 'P2002') {
       return NextResponse.json(
         { error: 'A record with this unique identifier (like phone/email) already exists' },
         { status: 409 }
       );
    }

    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
