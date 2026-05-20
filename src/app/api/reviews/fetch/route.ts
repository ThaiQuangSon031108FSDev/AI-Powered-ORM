import { NextResponse } from 'next/server';
import { saveReviews, getReviewsByPlaceId, getSyncTimestamp, Review } from '@/lib/db';

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

    // ── Tầng 0: Supabase Persistent Cache (sống qua cold starts) ──
    // Nếu user đã từng "Sync tất cả" cho place này và data còn tươi
    // → trả về từ DB ngay, không tốn 1 API call nào
    if (!pageToken) {
      const lastSync = await getSyncTimestamp(placeId);
      if (lastSync && Date.now() - lastSync < CACHE_TTL_MS) {
        const dbReviews = await getReviewsByPlaceId(placeId);
        if (dbReviews.length > 0) {
          console.log(`✅ Supabase Cache HIT [${placeId}] — ${dbReviews.length} reviews, 0 API call`);
          return NextResponse.json({ reviews: dbReviews, nextPageToken: null, fromCache: true });
        }
      }
    }

    // ── Tầng 1: In-memory Cache (nhanh nhất, trong cùng instance) ─
    const cached = reviewCache.get(cacheKey);
    if (cached && Date.now() - cached.cachedAt < CACHE_TTL_MS) {
      console.log(`✅ Memory Cache HIT [${cacheKey}] — bỏ qua API call`);
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
      // google_maps_reviews engine không hỗ trợ tham số "num"
      let url = `https://serpapi.com/search.json?engine=google_maps_reviews&place_id=${placeId}&api_key=${serpApiKey}`;
      if (pageToken) url += `&next_page_token=${encodeURIComponent(pageToken)}`;

      console.log(`🌐 Gọi SerpAPI cho [${placeId}] — trang: ${pageToken || 'đầu tiên'}`);
      const response = await fetch(url);

      if (!response.ok) {
        console.error('SerpAPI trả về lỗi HTTP:', response.status);
      } else {
        const data = await response.json();

        // SerpAPI quota hết → trả về HTTP 200 nhưng body có trường "error"
        if (data.error) {
          console.error('❌ SerpAPI lỗi:', data.error);
        } else if (data.reviews && data.reviews.length > 0) {
          fetchedReviews = data.reviews.map((r: any) => ({
            place_id: placeId,
            author_name: r.user?.name || 'Ẩn danh',
            rating: r.rating || 0,
            text: r.snippet || r.text || '',
          }));

          // Lấy token trang tiếp theo (nếu có)
          nextPageToken = data.serpapi_pagination?.next_page_token || null;

          // Ghi vào Cache chỉ khi có data thật
          reviewCache.set(cacheKey, {
            reviews: fetchedReviews,
            nextPageToken,
            cachedAt: Date.now(),
          });
        }
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
