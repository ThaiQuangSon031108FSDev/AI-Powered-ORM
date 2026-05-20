import { NextResponse } from 'next/server';
import { saveReviews, Review } from '@/lib/db';

// ============================================================
// IN-MEMORY CACHE (12h TTL) — tránh gọi SerpAPI lặp lại
// ============================================================
interface CacheEntry {
  reviews: Omit<Review, 'id' | 'status' | 'created_at' | 'generated_responses'>[];
  nextPageToken: string | null;
  cachedAt: number;
}
const reviewCache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 tiếng

function getCacheKey(placeId: string, pageToken: string) {
  return `${placeId}::${pageToken}`;
}

export async function POST(request: Request) {
  try {
    const { placeId, pageToken = '' } = await request.json();

    if (!placeId) {
      return NextResponse.json({ error: 'placeId is required' }, { status: 400 });
    }

    const cacheKey = getCacheKey(placeId, pageToken);

    // ── Kiểm tra Cache ──────────────────────────────────────
    const cached = reviewCache.get(cacheKey);
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
      console.log(`✅ Cache HIT cho [${cacheKey}] — bỏ qua API call`);
      const saved = await saveReviews(cached.reviews);
      return NextResponse.json({
        reviews: saved,
        nextPageToken: cached.nextPageToken,
        fromCache: true,
      });
    }

    const googleApiKey = process.env.GOOGLE_PLACES_API_KEY;
    const serpApiKey = process.env.SERPAPI_API_KEY;

    let fetchedReviews: Omit<Review, 'id' | 'status' | 'created_at' | 'generated_responses'>[] = [];
    let nextPageToken: string | null = null;

    // ── 1. SerpAPI (Ưu tiên) ────────────────────────────────
    if (serpApiKey) {
      // num=20: lấy 20 reviews mỗi trang thay vì mặc định 10
      let url = `https://serpapi.com/search.json?engine=google_maps_reviews&place_id=${placeId}&num=20&api_key=${serpApiKey}`;
      if (pageToken) url += `&next_page_token=${encodeURIComponent(pageToken)}`;

      console.log(`🌐 Gọi SerpAPI cho [${placeId}] — trang: ${pageToken || 'đầu tiên'}`);
      const response = await fetch(url);

      if (!response.ok) {
        console.error('SerpAPI trả về lỗi HTTP:', response.status);
      } else {
        const data = await response.json();

        if (data.reviews && data.reviews.length > 0) {
          fetchedReviews = data.reviews.map((r: any) => ({
            place_id: placeId,
            author_name: r.user?.name || 'Ẩn danh',
            rating: r.rating || 0,
            text: r.snippet || r.text || '',
          }));

          // Lấy token trang tiếp theo (nếu có)
          nextPageToken = data.serpapi_pagination?.next_page_token || null;
        }

        // Ghi vào Cache
        reviewCache.set(cacheKey, {
          reviews: fetchedReviews,
          nextPageToken,
          cachedAt: Date.now(),
        });
      }
    }
    // ── 2. Google Places API (Dự phòng) ─────────────────────
    else if (googleApiKey && !pageToken) {
      const url = `https://places.googleapis.com/v1/places/${placeId}?fields=reviews&key=${googleApiKey}`;
      const response = await fetch(url);

      if (response.ok) {
        const data = await response.json();
        if (data.reviews && data.reviews.length > 0) {
          fetchedReviews = data.reviews.map((r: any) => ({
            place_id: placeId,
            author_name: r.authorAttribution?.displayName || 'Ẩn danh',
            rating: r.rating || 0,
            text: r.text?.text || r.originalText?.text || '',
          }));
        }
      }
    }

    // ── 3. Mock Fallback (nếu không có API key hoặc API lỗi) ─
    if (fetchedReviews.length === 0 && !pageToken) {
      console.warn('⚠️  Không có API key hoặc không có dữ liệu. Dùng Mock Reviews.');
      const mockTexts = [
        'Phòng sạch sẽ, nhân viên thân thiện. Sẽ quay lại!',
        'Vị trí đẹp, tiện đi lại. Đồ ăn sáng hơi ít món.',
        'Khách sạn cũ, cần nâng cấp. Máy lạnh kêu to.',
        'Dịch vụ tuyệt vời, trên cả kỳ vọng của tôi.',
        'Giá cả hợp lý, phù hợp đi công tác ngắn ngày.',
        'View đẹp nhưng thang máy hay bị chờ lâu.',
        'Nhân viên lễ tân nhiệt tình, check-in rất nhanh.',
        'Bữa sáng đa dạng, phòng yên tĩnh, ngủ rất ngon.',
      ];
      fetchedReviews = Array.from({ length: 8 }).map((_, i) => ({
        place_id: placeId,
        author_name: `Khách hàng ${Math.floor(Math.random() * 900) + 100}`,
        rating: Math.floor(Math.random() * 5) + 1,
        text: mockTexts[i % mockTexts.length],
      }));
    }

    // ── Lưu vào DB và trả về ────────────────────────────────
    const saved = await saveReviews(fetchedReviews);

    return NextResponse.json({
      reviews: saved,
      nextPageToken,      // Client dùng để gọi trang tiếp theo
      fromCache: false,
    });
  } catch (error: any) {
    console.error('🔥 Error in /api/reviews/fetch:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
