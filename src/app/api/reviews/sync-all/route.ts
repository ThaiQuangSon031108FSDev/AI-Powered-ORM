import { NextResponse } from 'next/server';
import { saveReviews, Review } from '@/lib/db';

// Tăng timeout cho Vercel (loop nhiều trang SerpAPI cần thêm thời gian)
export const maxDuration = 30;

const SERPAPI_DELAY_MS = 300;  // Chờ 300ms giữa mỗi trang để tránh rate limit
const MAX_PAGES = 5;           // Tối đa 5 trang (~50 reviews) để tránh timeout Vercel

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function POST(request: Request) {
  try {
    const { placeId } = await request.json();

    if (!placeId) {
      return NextResponse.json({ error: 'placeId is required' }, { status: 400 });
    }

    const serpApiKey = process.env.SERPAPI_API_KEY;

    // ── Fallback nếu không có API key ──────────────────────
    if (!serpApiKey) {
      console.warn('⚠️  Không có SERPAPI_API_KEY. Trả về Mock data đầy đủ.');
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
        { text: 'Wifi yếu ở tầng cao, hơi bất tiện khi làm việc.', rating: 3 },
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
      return NextResponse.json({ reviews: saved, total: saved.length, pagesScanned: 0, isMock: true });
    }

    // ── Auto-loop qua tất cả trang SerpAPI ─────────────────
    type RawReview = Omit<Review, 'id' | 'status' | 'created_at' | 'generated_responses'>;
    const allReviews: RawReview[] = [];
    let pageToken = '';
    let pageCount = 0;

    console.log(`🔄 Bắt đầu sync tất cả reviews cho [${placeId}]...`);

    do {
      let url = `https://serpapi.com/search.json?engine=google_maps_reviews&place_id=${placeId}&api_key=${serpApiKey}`;
      if (pageToken) url += `&next_page_token=${encodeURIComponent(pageToken)}`;

      console.log(`  📄 Đang lấy trang ${pageCount + 1}...`);
      const response = await fetch(url);
      const data = await response.json();

      // Dừng nếu gặp lỗi (quota hết, Place ID sai, v.v.)
      if (data.error) {
        console.error(`❌ SerpAPI lỗi ở trang ${pageCount + 1}:`, data.error);
        break;
      }

      if (!data.reviews || data.reviews.length === 0) break;

      const pageReviews: RawReview[] = data.reviews.map((r: any) => ({
        place_id: placeId,
        author_name: r.user?.name || 'Ẩn danh',
        rating: r.rating || 0,
        text: r.snippet || r.text || '',
      }));

      allReviews.push(...pageReviews);
      pageToken = data.serpapi_pagination?.next_page_token || '';
      pageCount++;

      // Nghỉ nhỏ giữa các trang tránh bị rate limit
      if (pageToken && pageCount < MAX_PAGES) {
        await sleep(SERPAPI_DELAY_MS);
      }
    } while (pageToken && pageCount < MAX_PAGES);

    console.log(`✅ Sync xong! Tổng: ${allReviews.length} reviews từ ${pageCount} trang.`);

    if (allReviews.length === 0) {
      return NextResponse.json({ error: 'Không tìm thấy review nào.' }, { status: 404 });
    }

    const saved = await saveReviews(allReviews);

    return NextResponse.json({
      reviews: saved,
      total: saved.length,
      pagesScanned: pageCount,
      isMock: false,
    });
  } catch (error: any) {
    console.error('🔥 Error in /api/reviews/sync-all:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
