import { NextRequest, NextResponse } from 'next/server';
import { prisma, withTenantContext } from '@/lib/db';
import { requirePermission } from '@/lib/authorization/engine';
import { CreateLibraryBookSchema } from '@/lib/validation/library';
import { validateIsbn } from '@/lib/library/book-engine';

export async function GET(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission(request, { permission: 'LIBRARY_VIEW' });

    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q')?.trim();
    const categoryId = searchParams.get('categoryId') || undefined;
    const authorId = searchParams.get('authorId') || undefined;

    const books = await withTenantContext(schoolId, async () => {
      const whereClause: any = { schoolId };
      if (categoryId) whereClause.categoryId = categoryId;
      if (authorId) whereClause.authorId = authorId;
      if (query) {
        whereClause.OR = [
          { titleEn: { contains: query, mode: 'insensitive' } },
          { titleBn: { contains: query, mode: 'insensitive' } },
          { isbn10: { contains: query, mode: 'insensitive' } },
          { isbn13: { contains: query, mode: 'insensitive' } },
        ];
      }

      return prisma.libraryBook.findMany({
        where: whereClause,
        include: {
          category: { select: { id: true, code: true, nameEn: true, nameBn: true } },
          author: { select: { id: true, nameEn: true, nameBn: true } },
          publisher: { select: { id: true, nameEn: true, nameBn: true } },
          copies: {
            select: { id: true, status: true, condition: true },
          },
          _count: {
            select: {
              copies: true,
              reservations: { where: { status: 'PENDING' } },
            },
          },
        },
        orderBy: { titleEn: 'asc' },
      });
    });

    const enriched = books.map((b) => {
      const totalCopies = b.copies.length;
      const availableCopies = b.copies.filter((c) => c.status === 'AVAILABLE').length;
      const issuedCopies = b.copies.filter((c) => c.status === 'ISSUED').length;
      return {
        ...b,
        totalCopies,
        availableCopies,
        issuedCopies,
      };
    });

    return NextResponse.json({ success: true, data: enriched });
  } catch (error: any) {
    const status = error.message?.includes('Unauthorized') ? 403 : 500;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { schoolId } = await requirePermission(request, { permission: 'LIBRARY_MANAGE_CATALOG' });

    const body = await request.json();
    const parsed = CreateLibraryBookSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.format() },
        { status: 400 }
      );
    }

    const {
      categoryId,
      authorId,
      publisherId,
      titleEn,
      titleBn,
      subtitle,
      isbn10,
      isbn13,
      edition,
      publicationYear,
      language,
      description,
      coverUrl,
    } = parsed.data;

    // Validate ISBNs if provided
    if (isbn10) {
      const isbnCheck = validateIsbn(isbn10);
      if (!isbnCheck.valid) {
        return NextResponse.json({ success: false, error: `Invalid ISBN-10: ${isbnCheck.error}` }, { status: 400 });
      }
    }
    if (isbn13) {
      const isbnCheck = validateIsbn(isbn13);
      if (!isbnCheck.valid) {
        return NextResponse.json({ success: false, error: `Invalid ISBN-13: ${isbnCheck.error}` }, { status: 400 });
      }
    }

    const book = await withTenantContext(schoolId, async () => {
      return prisma.libraryBook.create({
        data: {
          schoolId,
          categoryId: categoryId || null,
          authorId: authorId || null,
          publisherId: publisherId || null,
          titleEn,
          titleBn: titleBn || null,
          subtitle: subtitle || null,
          isbn10: isbn10 || null,
          isbn13: isbn13 || null,
          edition: edition || null,
          publicationYear: publicationYear || null,
          language: language || 'English',
          description: description || null,
          coverUrl: coverUrl || null,
        },
        include: {
          category: true,
          author: true,
          publisher: true,
        },
      });
    });

    return NextResponse.json({ success: true, data: book }, { status: 201 });
  } catch (error: any) {
    const status = error.message?.includes('Unauthorized') ? 403 : 400;
    return NextResponse.json({ success: false, error: error.message }, { status });
  }
}
