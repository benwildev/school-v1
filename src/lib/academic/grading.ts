/**
 * EduSmart BD — Bangladesh / NCTB Academic Grading Engine
 * 
 * Formal implementation of the 7-tier NCTB Secondary and Higher Secondary
 * grading scale, subject grade resolution, cumulative GPA calculation,
 * failed subject penalty rules, and merit ranking.
 */

export interface GradeRuleDefinition {
  minPercentage: number;
  maxPercentage: number;
  letterGrade: string;
  gradePoint: number;
  remarksEn: string;
  remarksBn: string;
  isPassingGrade: boolean;
}

export const NCTB_GRADE_RULES: GradeRuleDefinition[] = [
  { minPercentage: 80.0, maxPercentage: 100.0, letterGrade: 'A+', gradePoint: 5.0, remarksEn: 'Outstanding', remarksBn: 'অসাধারণ', isPassingGrade: true },
  { minPercentage: 70.0, maxPercentage: 79.99, letterGrade: 'A',  gradePoint: 4.0, remarksEn: 'Excellent',   remarksBn: 'চমৎকার',   isPassingGrade: true },
  { minPercentage: 60.0, maxPercentage: 69.99, letterGrade: 'A-', gradePoint: 3.5, remarksEn: 'Very Good',   remarksBn: 'খুব ভালো', isPassingGrade: true },
  { minPercentage: 50.0, maxPercentage: 59.99, letterGrade: 'B',  gradePoint: 3.0, remarksEn: 'Good',        remarksBn: 'ভালো',     isPassingGrade: true },
  { minPercentage: 40.0, maxPercentage: 49.99, letterGrade: 'C',  gradePoint: 2.0, remarksEn: 'Satisfactory', remarksBn: 'সন্তোষজনক', isPassingGrade: true },
  { minPercentage: 33.0, maxPercentage: 39.99, letterGrade: 'D',  gradePoint: 1.0, remarksEn: 'Pass',        remarksBn: 'উত্তীর্ণ',   isPassingGrade: true },
  { minPercentage: 0.0,  maxPercentage: 32.99, letterGrade: 'F',  gradePoint: 0.0, remarksEn: 'Fail',        remarksBn: 'অনুত্তীর্ণ', isPassingGrade: false },
];

export interface SubjectGradeResult {
  letterGrade: string;
  gradePoint: number;
  percentage: number;
  remarksEn: string;
  remarksBn: string;
  isPassingGrade: boolean;
}

/**
 * Calculates subject grade and grade point from obtained marks and full marks.
 */
export function calculateSubjectGrade(
  totalObtained: number,
  fullMarks: number,
  passMarks?: number,
  isAbsent?: boolean
): SubjectGradeResult {
  if (isAbsent) {
    return {
      letterGrade: 'F',
      gradePoint: 0.0,
      percentage: 0.0,
      remarksEn: 'Absent',
      remarksBn: 'অনুপস্থিত',
      isPassingGrade: false,
    };
  }

  if (fullMarks <= 0) {
    throw new Error('Full marks must be greater than zero.');
  }

  const percentage = Math.min(100.0, Math.max(0.0, (totalObtained / fullMarks) * 100.0));

  // Explicit pass marks gate
  if (passMarks !== undefined && totalObtained < passMarks) {
    return {
      letterGrade: 'F',
      gradePoint: 0.0,
      percentage: Number(percentage.toFixed(2)),
      remarksEn: 'Fail',
      remarksBn: 'অনুত্তীর্ণ',
      isPassingGrade: false,
    };
  }

  for (const rule of NCTB_GRADE_RULES) {
    if (percentage >= rule.minPercentage && percentage <= rule.maxPercentage) {
      return {
        letterGrade: rule.letterGrade,
        gradePoint: rule.gradePoint,
        percentage: Number(percentage.toFixed(2)),
        remarksEn: rule.remarksEn,
        remarksBn: rule.remarksBn,
        isPassingGrade: rule.isPassingGrade,
      };
    }
  }

  // Fallback if percentage is edge case < 0 or invalid
  return {
    letterGrade: 'F',
    gradePoint: 0.0,
    percentage: 0.0,
    remarksEn: 'Fail',
    remarksBn: 'অনুত্তীর্ণ',
    isPassingGrade: false,
  };
}

export interface SubjectScoreInput {
  subjectId?: string;
  subjectCode?: string;
  subjectName?: string;
  gradePoint?: number;
  letterGrade?: string;
  obtainedMarks?: number;
  totalObtained?: number;
  fullMarks: number;
  passMarks?: number;
  isAbsent?: boolean;
  isOptional?: boolean;
  isOptionalFourth?: boolean;
}

export interface ExamOverallResult {
  gpa: number;
  calculatedGpa: number;
  finalGrade: string;
  isPassed: boolean;
  failedSubjectsCount: number;
  totalMarksObtained: number;
  totalFullMarks: number;
}

/**
 * Computes overall GPA and Final Grade across an array of subject evaluations.
 * In the NCTB system:
 * - Any failed mandatory subject forces GPA = 0.00 and Final Grade = 'F'.
 * - If all mandatory subjects are passed, GPA is the average of grade points (max 5.00).
 */
export function calculateOverallGpa(
  subjects: SubjectScoreInput[]
): ExamOverallResult {
  if (!subjects || subjects.length === 0) {
    return {
      gpa: 0.0,
      calculatedGpa: 0.0,
      finalGrade: 'F',
      isPassed: false,
      failedSubjectsCount: 0,
      totalMarksObtained: 0,
      totalFullMarks: 0,
    };
  }

  let totalMarksObtained = 0;
  let totalFullMarks = 0;
  let failedCount = 0;
  let mandatoryPointsSum = 0;
  let mandatorySubjectCount = 0;

  for (const sub of subjects) {
    const obtained = sub.obtainedMarks !== undefined ? sub.obtainedMarks : (sub.totalObtained !== undefined ? sub.totalObtained : 0);
    const full = sub.fullMarks;
    totalMarksObtained += obtained;
    totalFullMarks += full;

    let gp = sub.gradePoint;
    let lg = sub.letterGrade;
    if (gp === undefined || lg === undefined) {
      const g = calculateSubjectGrade(obtained, full, sub.passMarks || 33, sub.isAbsent || false);
      gp = g.gradePoint;
      lg = g.letterGrade;
    }

    const isOpt = sub.isOptional || sub.isOptionalFourth || false;

    if (!isOpt) {
      mandatorySubjectCount += 1;
      mandatoryPointsSum += gp;
      if (lg === 'F' || gp === 0) {
        failedCount += 1;
      }
    } else {
      // Optional / 4th subject handling in NCTB:
      // Points above 2.00 (e.g. 5.0 - 2.0 = 3.0 bonus points) can be added to the sum
      // without failing the overall result if 4th subject fails.
      if (gp > 2.0) {
        mandatoryPointsSum += gp - 2.0;
      }
    }
  }

  if (failedCount > 0) {
    return {
      gpa: 0.0,
      calculatedGpa: 0.0,
      finalGrade: 'F',
      isPassed: false,
      failedSubjectsCount: failedCount,
      totalMarksObtained: Number(totalMarksObtained.toFixed(2)),
      totalFullMarks: Number(totalFullMarks.toFixed(2)),
    };
  }

  const rawGpa = mandatorySubjectCount > 0 ? mandatoryPointsSum / mandatorySubjectCount : 0.0;
  const clampedGpa = Math.min(5.0, Number(rawGpa.toFixed(2)));
  const finalGrade = mapGpaToFinalGrade(clampedGpa);

  return {
    gpa: clampedGpa,
    calculatedGpa: clampedGpa,
    finalGrade,
    isPassed: true,
    failedSubjectsCount: 0,
    totalMarksObtained: Number(totalMarksObtained.toFixed(2)),
    totalFullMarks: Number(totalFullMarks.toFixed(2)),
  };
}

/**
 * Maps a calculated numeric GPA (0.00 - 5.00) to its corresponding NCTB Letter Grade.
 */
export function mapGpaToFinalGrade(gpa: number): string {
  if (gpa >= 5.0) return 'A+';
  if (gpa >= 4.0) return 'A';
  if (gpa >= 3.5) return 'A-';
  if (gpa >= 3.0) return 'B';
  if (gpa >= 2.0) return 'C';
  if (gpa >= 1.0) return 'D';
  return 'F';
}

export interface StudentRankCandidate {
  enrollmentId: string;
  sectionId: string;
  calculatedGpa: number;
  totalMarksObtained: number;
}

export interface StudentRankedResult {
  enrollmentId: string;
  classPosition: number;
  sectionPosition: number;
}

/**
 * Computes class and section merit positions.
 * Sorting order:
 * 1. calculatedGpa DESC
 * 2. totalMarksObtained DESC
 */
export function rankStudentResults<T extends StudentRankCandidate>(candidates: T[]): Array<T & StudentRankedResult> {
  // Sort class-wide
  const sortedClass = [...candidates].sort((a, b) => {
    if (b.calculatedGpa !== a.calculatedGpa) {
      return b.calculatedGpa - a.calculatedGpa;
    }
    return b.totalMarksObtained - a.totalMarksObtained;
  });

  const classPositions = new Map<string, number>();
  sortedClass.forEach((item, index) => {
    classPositions.set(item.enrollmentId, index + 1);
  });

  // Group and sort by section
  const sectionGroups = new Map<string, T[]>();
  for (const item of candidates) {
    const list = sectionGroups.get(item.sectionId) || [];
    list.push(item);
    sectionGroups.set(item.sectionId, list);
  }

  const sectionPositions = new Map<string, number>();
  for (const [, sectionItems] of sectionGroups.entries()) {
    sectionItems.sort((a, b) => {
      if (b.calculatedGpa !== a.calculatedGpa) {
        return b.calculatedGpa - a.calculatedGpa;
      }
      return b.totalMarksObtained - a.totalMarksObtained;
    });
    sectionItems.forEach((item, index) => {
      sectionPositions.set(item.enrollmentId, index + 1);
    });
  }

  return candidates.map((item) => ({
    ...item,
    classPosition: classPositions.get(item.enrollmentId) || 0,
    sectionPosition: sectionPositions.get(item.enrollmentId) || 0,
  }));
}
