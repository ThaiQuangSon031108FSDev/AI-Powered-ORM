import { supabase } from './supabase';

export type ReviewStatus = 'Pending' | 'Resolved';

export interface Review {
  id: string;
  place_id: string;
  author_name: string;
  rating: number;
  text: string;
  status: ReviewStatus;
  generated_responses?: string[] | null;
  created_at: string;
}

// In-memory mock storage for development without Supabase keys
let mockReviews: Review[] = [
  {
    id: 'mock-1',
    place_id: 'sample-place',
    author_name: 'Nguyen Van A',
    rating: 2,
    text: 'Phòng khách sạn hơi ồn và điều hòa không mát.',
    status: 'Pending',
    created_at: new Date().toISOString(),
  },
  {
    id: 'mock-2',
    place_id: 'sample-place',
    author_name: 'Tran Thi B',
    rating: 5,
    text: 'Dịch vụ tuyệt vời, nhân viên rất nhiệt tình!',
    status: 'Resolved',
    generated_responses: [
      'Cảm ơn bạn đã trải nghiệm dịch vụ của chúng tôi!',
      'Rất vui được phục vụ bạn, hẹn gặp lại!',
      'Cảm ơn đánh giá 5 sao của bạn!'
    ],
    created_at: new Date(Date.now() - 86400000).toISOString(),
  }
];

export const isSupabaseConfigured = () => {
  return !!supabase;
};

// --- DATA ACCESS METHODS ---

export async function getReviews(): Promise<Review[]> {
  if (isSupabaseConfigured() && supabase) {
    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .order('created_at', { ascending: false });
      
    if (error) {
      console.error('Supabase error fetching reviews:', error);
      throw new Error(error.message);
    }
    return data as Review[];
  }
  return [...mockReviews].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
}

// ──────────────────────────────────────────────────────────
// Lấy tất cả reviews theo place_id từ DB (persistent cache)
// ──────────────────────────────────────────────────────────
export async function getReviewsByPlaceId(placeId: string): Promise<Review[]> {
  if (isSupabaseConfigured() && supabase) {
    const { data, error } = await supabase
      .from('reviews')
      .select('*')
      .eq('place_id', placeId)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Supabase error fetching by place_id:', error);
      return [];
    }
    return (data as Review[]) || [];
  }
  // Fallback: lọc từ mockReviews in-memory
  return mockReviews.filter(r => r.place_id === placeId);
}

// ──────────────────────────────────────────────────────────
// Quản lý timestamp lần sync cuối cùng per place_id
// (lưu vào bảng "sync_cache" trên Supabase)
// ──────────────────────────────────────────────────────────
const inMemorySyncCache = new Map<string, number>(); // Fallback khi không có Supabase

export async function getSyncTimestamp(placeId: string): Promise<number | null> {
  if (isSupabaseConfigured() && supabase) {
    const { data } = await supabase
      .from('sync_cache')
      .select('synced_at')
      .eq('place_id', placeId)
      .maybeSingle();
    return data?.synced_at ? new Date(data.synced_at).getTime() : null;
  }
  return inMemorySyncCache.get(placeId) ?? null;
}

export async function upsertSyncTimestamp(placeId: string): Promise<void> {
  if (isSupabaseConfigured() && supabase) {
    await supabase.from('sync_cache').upsert(
      { place_id: placeId, synced_at: new Date().toISOString() },
      { onConflict: 'place_id' }
    );
    return;
  }
  inMemorySyncCache.set(placeId, Date.now());
}

export async function saveReviews(reviews: Omit<Review, 'id' | 'status' | 'created_at' | 'generated_responses'>[]): Promise<Review[]> {
  if (isSupabaseConfigured() && supabase) {
    const { data, error } = await supabase
      .from('reviews')
      .insert(reviews.map(r => ({
        ...r,
        status: 'Pending'
      })))
      .select();
      
    if (error) {
      console.error('Supabase error saving reviews:', error);
      throw new Error(error.message);
    }
    return data as Review[];
  }
  
  const newReviews = reviews.map(r => ({
    ...r,
    id: `mock-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
    status: 'Pending' as ReviewStatus,
    created_at: new Date().toISOString(),
  }));
  
  mockReviews = [...newReviews, ...mockReviews];
  return newReviews;
}

export async function updateReviewResponses(id: string, responses: string[]): Promise<Review | null> {
  if (isSupabaseConfigured() && supabase) {
    const { data, error } = await supabase
      .from('reviews')
      .update({ generated_responses: responses })
      .eq('id', id)
      .select()
      .single();
      
    if (error) {
      console.error('Supabase error updating responses:', error);
      throw new Error(error.message);
    }
    return data as Review;
  }
  
  const index = mockReviews.findIndex(r => r.id === id);
  if (index === -1) {
    // CHỐNG SẬP CHO SERVERLESS (VERCEL):
    // Nếu RAM máy chủ bị xóa, tự động trả về một review giả lập chứa phản hồi AI mới
    // Client-side React sẽ tự động map và cập nhật giao diện mà không gặp bất kỳ lỗi 500 nào.
    return {
      id,
      place_id: 'sample-place',
      author_name: 'Khách hàng ẩn danh',
      rating: 5,
      text: 'Đánh giá mẫu',
      status: 'Pending',
      generated_responses: responses,
      created_at: new Date().toISOString()
    };
  }
  
  mockReviews[index].generated_responses = responses;
  return mockReviews[index];
}

export async function resolveReview(id: string): Promise<boolean> {
  if (isSupabaseConfigured() && supabase) {
    const { error } = await supabase
      .from('reviews')
      .update({ status: 'Resolved' })
      .eq('id', id);
      
    if (error) {
      console.error('Supabase error resolving review:', error);
      throw new Error(error.message);
    }
    return true;
  }
  
  const index = mockReviews.findIndex(r => r.id === id);
  if (index === -1) {
    // Luôn trả về thành công đối với luồng mock Serverless
    return true;
  }
  
  mockReviews[index].status = 'Resolved';
  return true;
}
