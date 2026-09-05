import { z } from 'zod';
import { PromotionAction } from '@prisma/client';

export const PromotionItemSchema = z.object({
  sourceEnrollmentId: z.string().uuid({ message: 'বৈধ মূল এনরোলমেন্ট আইডি (UUID) প্রদান করুন।' }),
  targetClassId: z.string().uuid({ message: 'বৈধ লক্ষ্য শ্রেণী আইডি প্রদান করুন।' }),
  targetSectionId: z.string().uuid({ message: 'বৈধ লক্ষ্য শাখা আইডি প্রদান করুন।' }),
  targetRollNo: z.coerce.number().int().positive({ message: 'লক্ষ্য রোল নম্বর অবশ্যই ধনাত্মক পূর্ণসংখ্যা হতে হবে।' }).optional().nullable(),
  targetCampusId: z.string().uuid().optional().nullable(),
  targetGroupId: z.string().uuid().optional().nullable(),
  action: z.nativeEnum(PromotionAction, { message: 'বৈধ প্রমোশন অ্যাকশন নির্বাচন করুন।' }),
  meritScore: z.coerce.number().min(0).max(100).optional().nullable(),
  remarks: z.string().max(500).optional().nullable(),
}).refine(
  (data) => {
    // If promoting or repeating, targetRollNo is mandatory
    if (
      (
        [
          PromotionAction.PROMOTED,
          PromotionAction.DOUBLE_PROMOTED,
          PromotionAction.RETAINED_REPEATER,
        ] as PromotionAction[]
      ).includes(data.action)
    ) {
      return typeof data.targetRollNo === 'number' && data.targetRollNo > 0;
    }
    return true;
  },
  {
    message: 'প্রমোশন বা পুনরাবৃত্তির জন্য লক্ষ্য রোল নম্বর প্রদান আবশ্যক।',
    path: ['targetRollNo'],
  }
);

export type PromotionItemInput = z.infer<typeof PromotionItemSchema>;

export const PromotionBatchCreateSchema = z.object({
  sourceSessionId: z.string().uuid({ message: 'বৈধ উৎস শিক্ষাবর্ষ আইডি প্রদান করুন।' }),
  targetSessionId: z.string().uuid({ message: 'বৈধ লক্ষ্য শিক্ষাবর্ষ আইডি প্রদান করুন।' }),
  notes: z.string().max(1000).optional().nullable(),
  items: z.array(PromotionItemSchema).min(1, { message: 'অন্তত একজন শিক্ষার্থীর প্রমোশন তথ্য প্রদান আবশ্যক।' }),
}).refine(
  (data) => data.sourceSessionId !== data.targetSessionId,
  {
    message: 'উৎস ও লক্ষ্য শিক্ষাবর্ষ একই হতে পারে না।',
    path: ['targetSessionId'],
  }
);

export type PromotionBatchCreateInput = z.infer<typeof PromotionBatchCreateSchema>;
