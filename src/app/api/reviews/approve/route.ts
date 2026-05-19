import { NextResponse } from 'next/server';
import { resolveReview } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const { reviewId, approvedResponseIndex } = await request.json();

    if (!reviewId || approvedResponseIndex === undefined) {
      return NextResponse.json({ error: 'reviewId and approvedResponseIndex are required' }, { status: 400 });
    }

    const success = await resolveReview(reviewId);
    
    if (!success) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 });
    }

    // Note: In MVP, we just update the status to Resolved in DB.
    // Pushing the selected response back to Google Maps is out of scope.

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error in /api/reviews/approve:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
