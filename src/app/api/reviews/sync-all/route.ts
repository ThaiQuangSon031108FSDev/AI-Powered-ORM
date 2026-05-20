import { NextResponse } from 'next/server';
import {
  saveReviews,
  getReviewsByPlaceId,
  getSyncTimestamp,
  upsertSyncTimestamp,
  Review,
} from '@/lib/db';

export const maxDuration = 30;

const CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 tiếng
const SERPAPI_DELAY_MS = 100;
const MAX_PAGES = 30;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(request: Request) {
  try {
    const { placeId, forceRefresh = false } = await request.json();

    if (!placeId) {
      return NextResponse.json({ error: 'placeId is required' }, { status: 400 });
    }

    // ── Tầng 2: Kiểm tra Persistent Cache (Supabase) ────────
    // Đây là trái tim của tối ưu hóa: nếu DB đã có data còn tươi
    // → trả về ngay lập tức, 0 API call dù Vercel có spin up bao nhiêu instance
    if (!forceRefresh) {
      const lastSync = await getSyncTimestamp(placeId);
      if (lastSync && Date.now() - lastSync < CACHE_TTL_MS) {
        const cachedReviews = await getReviewsByPlaceId(placeId);
        if (cachedReviews.length > 0) {
          console.log(`✅ DB Cache HIT cho [${placeId}] — ${cachedReviews.length} reviews, 0 API call`);
          return NextResponse.json({
            reviews: cachedReviews,
            total: cachedReviews.length,
            pagesScanned: 0,
            isMock: false,
            fromCache: true,
            cachedAgo: Math.round((Date.now() - lastSync) / 60000), // phút
          });
        }
      }
    }

    const serpApiKey = process.env.SERPAPI_API_KEY;

    // ── Fallback nếu không có API key ──────────────────────
    if (!serpApiKey) {
      console.warn('⚠️  Không có SERPAPI_API_KEY. Trả về Mock data.');
      const mockPool = [
        { text: 'Phòng sạch sẽ, nhân viên thân thiện. Sẽ quay lại!', rating: 5 },
        { text: 'Vị trí đẹp, tiện đi lại. Đồ ăn sáng hơi ít món.', rating: 4 },
        { text: 'Khách sạn cũ, cần nâng cấp. Máy lạnh kêu to.', rating: 2 },
        { text: 'Dịch vụ tuyệt vời, trên cả kỳ vọng.', rating: 5 },
        { text: 'Giá cả hợp lý, phù hợp đi công tác.', rating: 4 },
        { text: 'View đẹp nhưng thang máy hay chờ lâu.', rating: 3 },
        { text: 'Nhân viên lễ tân nhiệt tình, check-in nhanh.', rating: 5 },
        { text: 'Bữa sáng đa dạng, phòng yên tĩnh, ngủ ngon.', rating: 4 },
        { text: 'Phòng nhỏ hơn ảnh quảng cáo.', rating: 2 },
        { text: 'Sẽ giới thiệu cho bạn bè!', rating: 5 },
        { text: 'Dịch vụ spa tuyệt vời, thư giãn hoàn toàn.', rating: 5 },
        { text: 'Bãi đậu xe hơi chật, cần cải thiện.', rating: 3 },
        { text: 'Wifi yếu ở tầng cao, hơi bất tiện.', rating: 3 },
        { text: 'Hồ bơi sạch, view đẹp, nhân viên chuyên nghiệp.', rating: 5 },
        { text: 'Check-out hơi chậm nhưng nhân viên dễ thương.', rating: 4 },
      ];
      const allMock = Array.from({ length: 15 }, (_, i) => ({
        place_id: placeId,
        author_name: `Khách hàng ${Math.floor(Math.random() * 900) + 100}`,
        rating: mockPool[i % mockPool.length].rating,
        text: mockPool[i % mockPool.length].text,
      }));
      const saved = await saveReviews(allMock);
      return NextResponse.json({ reviews: saved, total: saved.length, pagesScanned: 0, isMock: true, fromCache: false });
    }

    // ── Tầng 1: Gọi SerpAPI và loop tất cả trang ────────────
    type RawReview = Omit<Review, 'id' | 'status' | 'created_at' | 'generated_responses'>;
    const allReviews: RawReview[] = [];
    let pageToken = '';
    let pageCount = 0;

    console.log(`🔄 Sync tất cả reviews cho [${placeId}]...`);

    do {
      let url = `https://serpapi.com/search.json?engine=google_maps_reviews&place_id=${placeId}&api_key=${serpApiKey}`;
      if (pageToken) url += `&next_page_token=${encodeURIComponent(pageToken)}`;

      console.log(`  📄 Trang ${pageCount + 1}...`);
      const response = await fetch(url);
      const data = await response.json();

      if (data.error) {
        console.error(`❌ SerpAPI lỗi trang ${pageCount + 1}:`, data.error);
        break;
      }
      if (!data.reviews || data.reviews.length === 0) break;

      allReviews.push(...data.reviews.map((r: any) => ({
        place_id: placeId,
        author_name: r.user?.name || 'Ẩn danh',
        rating: r.rating || 0,
        text: r.snippet || r.text || '',
      })));

      pageToken = data.serpapi_pagination?.next_page_token || '';
      pageCount++;

      if (pageToken && pageCount < MAX_PAGES) await sleep(SERPAPI_DELAY_MS);
    } while (pageToken && pageCount < MAX_PAGES);

    if (allReviews.length === 0) {
      return NextResponse.json({ error: 'Không tìm thấy review nào.' }, { status: 404 });
    }

    // ── Lưu vào DB (Supabase) + cập nhật timestamp sync ────
    const saved = await saveReviews(allReviews);
    await upsertSyncTimestamp(placeId); // Đánh dấu đã sync, 12h sau mới gọi API lại

    console.log(`✅ Sync xong! ${saved.length} reviews từ ${pageCount} trang. Đã lưu vào DB.`);

    return NextResponse.json({
      reviews: saved,
      total: saved.length,
      pagesScanned: pageCount,
      isMock: false,
      fromCache: false,
    });
  } catch (error: any) {
    console.error('🔥 Error in /api/reviews/sync-all:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
