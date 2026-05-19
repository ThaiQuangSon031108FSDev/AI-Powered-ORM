import { NextResponse } from 'next/server';
import { saveReviews, Review } from '@/lib/db';

export async function POST(request: Request) {
  try {
    const { placeId } = await request.json();

    if (!placeId) {
      return NextResponse.json({ error: 'placeId is required' }, { status: 400 });
    }

    const googleApiKey = process.env.GOOGLE_PLACES_API_KEY;
    const serpApiKey = process.env.SERPAPI_API_KEY;
    
    let fetchedReviews: Omit<Review, 'id' | 'status' | 'created_at' | 'generated_responses'>[] = [];

    // 1. Ưu tiên sử dụng SerpAPI nếu có key
    if (serpApiKey) {
      const url = `https://serpapi.com/search.json?engine=google_maps_reviews&place_id=${placeId}&api_key=${serpApiKey}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        console.error('Failed to fetch from SerpAPI');
      } else {
        const data = await response.json();
        if (data.reviews && data.reviews.length > 0) {
          // Lấy tối đa 5 review để xử lý nhanh cho MVP
          fetchedReviews = data.reviews.slice(0, 5).map((r: any) => ({
            place_id: placeId,
            author_name: r.user?.name || 'Unknown Author',
            rating: r.rating || 0,
            text: r.snippet || r.text || '(Không có nội dung)',
          }));
        }
      }
    } 
    // 2. Dự phòng bằng Google Places API nếu có key
    else if (googleApiKey) {
      const url = `https://places.googleapis.com/v1/places/${placeId}?fields=reviews&key=${googleApiKey}`;
      const response = await fetch(url);
      
      if (response.ok) {
        const data = await response.json();
        if (data.reviews && data.reviews.length > 0) {
          fetchedReviews = data.reviews.map((r: any) => ({
            place_id: placeId,
            author_name: r.authorAttribution?.displayName || 'Unknown Author',
            rating: r.rating || 0,
            text: r.text?.text || r.originalText?.text || '',
          }));
        }
      }
    }

    // 3. Fallback to mock data if no API keys working or no reviews found
    if (fetchedReviews.length === 0) {
      console.warn('No active API keys working or no reviews found. Generating mock reviews for placeId:', placeId);
      fetchedReviews = Array.from({ length: 5 }).map((_, i) => ({
        place_id: placeId,
        author_name: `Guest User ${Math.floor(Math.random() * 1000)}`,
        rating: Math.floor(Math.random() * 5) + 1,
        text: [
          'Phòng ốc sạch sẽ, nhân viên thân thiện. Sẽ quay lại!',
          'Vị trí rất đẹp, tiện đi lại. Đồ ăn sáng hơi ít món.',
          'Khách sạn cũ, cần nâng cấp. Máy lạnh kêu to.',
          'Dịch vụ tuyệt vời, trên cả kỳ vọng.',
          'Giá cả hợp lý, phù hợp đi công tác.'
        ][i % 5],
      }));
    }

    // Save to Database (or mock DB)
    const saved = await saveReviews(fetchedReviews);

    return NextResponse.json({ reviews: saved });
  } catch (error: any) {
    console.error('Error in /api/reviews/fetch:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
