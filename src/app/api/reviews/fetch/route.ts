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
    // Chỉ dùng khi không có dữ liệu thật. nextPageToken luôn = null
    // để nút "Tải thêm" KHÔNG bao giờ xuất hiện khi đang dùng mock data.
    if (fetchedReviews.length === 0) {
      console.warn('⚠️  Không có API key hoặc không có dữ liệu. Dùng Mock Reviews.');
      const mockPool = [
        { text: 'Phòng sạch sẽ, nhân viên thân thiện. Sẽ quay lại!', rating: 5 },
        { text: 'Vị trí đẹp, tiện đi lại. Đồ ăn sáng hơi ít món.', rating: 4 },
        { text: 'Khách sạn cũ, cần nâng cấp. Máy lạnh kêu to.', rating: 2 },
        { text: 'Dịch vụ tuyệt vời, trên cả kỳ vọng của tôi.', rating: 5 },
        { text: 'Giá cả hợp lý, phù hợp đi công tác ngắn ngày.', rating: 4 },
        { text: 'View đẹp nhưng thang máy hay bị chờ lâu.', rating: 3 },
        { text: 'Nhân viên lễ tân nhiệt tình, check-in rất nhanh.', rating: 5 },
        { text: 'Bữa sáng đa dạng, phòng yên tĩnh, ngủ rất ngon.', rating: 4 },
        { text: 'Phòng nhỏ hơn ảnh quảng cáo, hơi thất vọng.', rating: 2 },
        { text: 'Sẽ giới thiệu cho bạn bè, trải nghiệm tuyệt vời!', rating: 5 },
      ];
      fetchedReviews = Array.from({ length: 10 }).map((_, i) => ({
        place_id: placeId,
        author_name: `Khách hàng ${Math.floor(Math.random() * 900) + 100}`,
        rating: mockPool[i % mockPool.length].rating,
        text: mockPool[i % mockPool.length].text,
      }));
      // nextPageToken giữ nguyên = null → nút "Tải thêm" sẽ KHÔNG hiện
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
