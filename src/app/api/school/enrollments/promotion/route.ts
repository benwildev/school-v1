import { NextRequest, NextResponse } from 'next/server';
import { withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { logAuditEvent } from '@/lib/audit/logger';
import { PromotionBatchCreateSchema } from '@/lib/validation/promotion';
import { Prisma, PromotionAction, EnrollmentType, EnrollmentStatus } from '@prisma/client';

/**
 * POST /api/school/enrollments/promotion
 * Executes single or batch student promotion/repeat transitions atomically.
 * Required Permission: ENROLLMENTS_PROMOTE
 */
export async function POST(request: NextRequest) {
  try {
    const { schoolId, context } = await requirePermission(request, {
      permission: 'ENROLLMENTS_PROMOTE',
    });

    const body = await request.json();
    const validation = PromotionBatchCreateSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'প্রমোশন তথ্যে ত্রুটি রয়েছে।',
          details: validation.error.flatten(),
        },
        { status: 422 }
      );
    }

    const { sourceSessionId, targetSessionId, notes, items } = validation.data;

    const result = await withTenantContext(schoolId, async (tx) => {
      // 1. Verify Sessions
      const [sourceSession, targetSession] = await Promise.all([
        tx.academicSession.findFirst({ where: { id: sourceSessionId, schoolId } }),
        tx.academicSession.findFirst({ where: { id: targetSessionId, schoolId } }),
      ]);

      if (!sourceSession || !targetSession) {
        throw { status: 404, message: 'উৎস বা লক্ষ্য শিক্ষাবর্ষ এই বিদ্যালয়ের অন্তর্ভুক্ত নয়।' };
      }

      // 2. Intra-batch target roll collisions check
      const rollSet = new Set<string>();
      for (const item of items) {
        if (item.targetRollNo) {
          const key = `${item.targetClassId}_${item.targetSectionId}_${item.targetRollNo}`;
          if (rollSet.has(key)) {
            throw {
              status: 409,
              message: `ব্যাচের মধ্যে একই শ্রেণী ও শাখায় একাধিক শিক্ষার্থীর জন্য একই লক্ষ্য রোল (${item.targetRollNo}) নির্ধারিত হয়েছে।`,
            };
          }
          rollSet.add(key);
        }
      }

      // 3. Row-level locks and source verification
      // Serializes concurrent promotions for the same source enrollments
      const sourceEnrollmentIds = items.map((i) => i.sourceEnrollmentId);

      // Lock records via Prisma raw query within transaction
      if (sourceEnrollmentIds.length > 0) {
        await tx.$queryRaw`
          SELECT id FROM enrollments 
          WHERE id IN (${Prisma.join(sourceEnrollmentIds.map((id) => Prisma.raw(`'${id}'::uuid`)))})
          AND school_id = ${schoolId}::uuid
          FOR UPDATE
        `;
      }

      const sourceEnrollments = await tx.enrollment.findMany({
        where: {
          id: { in: sourceEnrollmentIds },
          schoolId,
          academicSessionId: sourceSessionId,
        },
      });

      if (sourceEnrollments.length !== items.length) {
        throw {
          status: 400,
          message: 'এক বা একাধিক মূল এনরোলমেন্ট খুঁজে পাওয়া যায়নি বা সঠিক শিক্ষাবর্ষের অন্তর্ভুক্ত নয়।',
        };
      }

      const sourceMap = new Map(sourceEnrollments.map((e) => [e.id, e]));

      // 4. Validate source statuses and target collisions
      for (const item of items) {
        const source = sourceMap.get(item.sourceEnrollmentId)!;

        // Idempotency / Conflict check: Cannot promote an already PROMOTED, REPEATED, or PASSED_OUT enrollment
        if (
          (
            [
              EnrollmentStatus.PROMOTED,
              EnrollmentStatus.REPEATED,
              EnrollmentStatus.PASSED_OUT,
            ] as EnrollmentStatus[]
          ).includes(source.status)
        ) {
          throw {
            status: 409,
            message: `শিক্ষার্থী (রোল: ${source.rollNo}) ইতিমধ্যে পূর্বেই প্রমোশন বা সমাপ্ত সম্পন্ন করেছে। পুনরায় প্রমোশন সম্ভব নয়।`,
          };
        }

        // Check if student already has ANY enrollment in the target academic session
        const existingTargetEnrollment = await tx.enrollment.findUnique({
          where: {
            schoolId_academicSessionId_studentId: {
              schoolId,
              academicSessionId: targetSessionId,
              studentId: source.studentId,
            },
          },
        });

        if (existingTargetEnrollment) {
          throw {
            status: 409,
            message: `শিক্ষার্থীর লক্ষ্য শিক্ষাবর্ষে ইতিমধ্যে এনরোলমেন্ট বিদ্যমান রয়েছে। ডুপ্লিকেট প্রমোশন বাতিল করা হলো।`,
          };
        }

        // Check target roll collision in target session/class/section
        if (item.targetRollNo) {
          const targetRollCollision = await tx.enrollment.findUnique({
            where: {
              schoolId_academicSessionId_classId_sectionId_rollNo: {
                schoolId,
                academicSessionId: targetSessionId,
                classId: item.targetClassId,
                sectionId: item.targetSectionId,
                rollNo: item.targetRollNo,
              },
            },
          });

          if (targetRollCollision) {
            throw {
              status: 409,
              message: `লক্ষ্য শ্রেণী ও শাখায় রোল ${item.targetRollNo} ইতিমধ্যে দখলকৃত।`,
            };
          }
        }
      }

      // 5. Create PromotionBatch
      const batchNumber = `PB-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      const batch = await tx.promotionBatch.create({
        data: {
          schoolId,
          batchNumber,
          sourceSessionId,
          targetSessionId,
          totalStudents: items.length,
          executedById: context.userId,
          notes: notes || null,
        },
      });

      // 6. Process items and create target placements
      const createdItems = [];

      for (const item of items) {
        const source = sourceMap.get(item.sourceEnrollmentId)!;
        let targetEnrollmentId: string | null = null;

        if (
          item.action === PromotionAction.PROMOTED ||
          item.action === PromotionAction.DOUBLE_PROMOTED
        ) {
          const targetEnrollment = await tx.enrollment.create({
            data: {
              schoolId,
              studentId: source.studentId,
              academicSessionId: targetSessionId,
              classId: item.targetClassId,
              sectionId: item.targetSectionId,
              campusId: item.targetCampusId || source.campusId,
              groupId: item.targetGroupId || source.groupId,
              rollNo: item.targetRollNo!,
              curriculumVersion: source.curriculumVersion,
              enrollmentDate: new Date(),
              enrollmentType: EnrollmentType.PROMOTED,
              status: EnrollmentStatus.ACTIVE,
              remarks: `Promoted from ${sourceSession.name} via batch ${batchNumber}`,
            },
          });
          targetEnrollmentId = targetEnrollment.id;

          // Mark source enrollment as PROMOTED
          await tx.enrollment.update({
            where: { id: source.id },
            data: { status: EnrollmentStatus.PROMOTED },
          });
        } else if (item.action === PromotionAction.RETAINED_REPEATER) {
          const targetEnrollment = await tx.enrollment.create({
            data: {
              schoolId,
              studentId: source.studentId,
              academicSessionId: targetSessionId,
              classId: item.targetClassId,
              sectionId: item.targetSectionId,
              campusId: item.targetCampusId || source.campusId,
              groupId: item.targetGroupId || source.groupId,
              rollNo: item.targetRollNo!,
              curriculumVersion: source.curriculumVersion,
              enrollmentDate: new Date(),
              enrollmentType: EnrollmentType.REPEATER,
              status: EnrollmentStatus.ACTIVE,
              remarks: `Retained / Repeater from ${sourceSession.name} via batch ${batchNumber}`,
            },
          });
          targetEnrollmentId = targetEnrollment.id;

          // Mark source enrollment as REPEATED
          await tx.enrollment.update({
            where: { id: source.id },
            data: { status: EnrollmentStatus.REPEATED },
          });
        } else if (item.action === PromotionAction.PASSED_OUT) {
          await tx.enrollment.update({
            where: { id: source.id },
            data: { status: EnrollmentStatus.PASSED_OUT },
          });
        } else if (item.action === PromotionAction.DROPPED) {
          await tx.enrollment.update({
            where: { id: source.id },
            data: { status: EnrollmentStatus.DROPPED },
          });
        }

        // Create PromotionItem
        const promoItem = await tx.promotionItem.create({
          data: {
            batchId: batch.id,
            schoolId,
            studentId: source.studentId,
            sourceEnrollmentId: source.id,
            targetEnrollmentId,
            sourceClassId: source.classId,
            sourceSectionId: source.sectionId,
            sourceRollNo: source.rollNo,
            targetClassId: item.targetClassId,
            targetSectionId: item.targetSectionId,
            targetRollNo: item.targetRollNo || null,
            promotionAction: item.action,
            meritScore: item.meritScore ? new Prisma.Decimal(item.meritScore) : null,
            remarks: item.remarks || null,
          },
        });

        createdItems.push(promoItem);
      }

      return {
        batch,
        totalProcessed: createdItems.length,
      };
    });

    // 7. Audit Logging
    await logAuditEvent({
      schoolId,
      actorUserId: context.userId,
      actorName: context.user.fullName || context.user.phone || 'Admin',
      actorRole: context.user.isSuperAdmin ? 'SUPER_ADMIN' : 'ADMIN',
      action: 'PROMOTE',
      entity: 'PromotionBatch',
      entityId: result.batch.id,
      changeSummary: 'STUDENT_PROMOTED',
      afterState: {
        batchNumber: result.batch.batchNumber,
        sourceSessionId,
        targetSessionId,
        totalStudents: result.totalProcessed,
      },
    });

    return NextResponse.json({
      success: true,
      message: `${result.totalProcessed} জন শিক্ষার্থীর প্রমোশন সফলভাবে সম্পন্ন হয়েছে।`,
      data: result.batch,
    });
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return NextResponse.json(
          {
            success: false,
            error:
              'লক্ষ্য সেশনে শিক্ষার্থীর এনরোলমেন্ট বা রোল নম্বরে দ্বৈততা তৈরি হয়েছে (Duplicate constraint conflict)।',
          },
          { status: 409 }
        );
      }
    }
    const err = error as { status?: number; message?: string };
    if (err.status) {
      return NextResponse.json({ success: false, error: err.message }, { status: err.status });
    }
    console.error('Error executing promotion batch:', error);
    return NextResponse.json(
      { success: false, error: 'প্রমোশন প্রক্রিয়া সম্পন্ন করতে ব্যর্থ হয়েছে।' },
      { status: 500 }
    );
  }
}
