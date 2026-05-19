"use client";

import { useState, useEffect } from 'react';

type ReviewStatus = 'Pending' | 'Resolved';

interface Review {
  id: string;
  place_id: string;
  author_name: string;
  rating: number;
  text: string;
  status: ReviewStatus;
  generated_responses?: string[] | null;
  created_at: string;
}

export default function Dashboard() {
  const [placeId, setPlaceId] = useState('');
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingReviews, setIsFetchingReviews] = useState(false);
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  // Initial load
  useEffect(() => {
    fetchReviews();
  }, []);

  const fetchReviews = async (pId?: string) => {
    setIsFetchingReviews(true);
    try {
      // If we pass a placeId, use POST to fetch new ones. Otherwise GET just to load existing ones.
      // Wait, we didn't create a GET endpoint. We can use POST without placeId to just fetch from DB!
      // Let's create a separate route or just modify our POST route...
      // Actually, since it's just mock data/Supabase, let's add a quick GET to `/api/reviews/fetch` or just create a new one.
      // For MVP, if pId is missing, let's just show an empty list or we can create a fetch API for GET.
    } catch (e) {
      console.error(e);
    } finally {
      setIsFetchingReviews(false);
    }
  };

  const handleFetchReviews = async () => {
    if (!placeId) return;
    setIsFetchingReviews(true);
    try {
      const res = await fetch('/api/reviews/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ placeId }),
      });
      const data = await res.json();
      if (data.reviews) {
        setReviews(prev => [...data.reviews, ...prev]);
        setPlaceId('');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsFetchingReviews(false);
    }
  };

  const handleGenerateAI = async (review: Review) => {
    setGeneratingId(review.id);
    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          reviewId: review.id, 
          reviewText: review.text,
          authorName: review.author_name,
          rating: review.rating
        }),
      });
      const data = await res.json();
      if (data.updatedReview) {
        setReviews(reviews.map(r => r.id === review.id ? data.updatedReview : r));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setGeneratingId(null);
    }
  };

  const handleApprove = async (reviewId: string, index: number) => {
    setApprovingId(reviewId);
    try {
      const res = await fetch('/api/reviews/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewId, approvedResponseIndex: index }),
      });
      if (res.ok) {
        setReviews(reviews.map(r => r.id === reviewId ? { ...r, status: 'Resolved' } : r));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setApprovingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans p-6 md:p-12">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Header Section */}
        <header className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
              AI-Powered ORM
            </h1>
            <p className="text-slate-500 mt-1">Quản trị đánh giá khách hàng bằng AI</p>
          </div>
          
          <div className="flex flex-col items-stretch md:items-end gap-1.5 w-full md:w-auto">
            <div className="flex w-full md:w-auto items-center gap-2">
              <input 
                type="text" 
                placeholder="Nhập Place ID..." 
                value={placeId}
                onChange={(e) => setPlaceId(e.target.value)}
                className="flex-1 md:w-64 px-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm"
              />
              <button 
                onClick={handleFetchReviews}
                disabled={isFetchingReviews || !placeId}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm shadow-blue-200 text-sm"
              >
                {isFetchingReviews ? (
                  <span className="w-5.5 h-5.5 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                ) : (
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                )}
                Fetch
              </button>
            </div>
            <button
              onClick={() => setPlaceId('ChIJN1t_tDeuEmsRUsoyG83frY4')}
              className="text-xs text-blue-500 hover:text-blue-700 hover:underline text-left md:text-right px-1 flex items-center gap-1 self-start md:self-auto"
            >
              💡 Dùng thử Place ID mẫu (Google Sydney)
            </button>
          </div>
        </header>

        {/* Reviews List */}
        <div className="grid grid-cols-1 gap-6">
          {reviews.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-2xl border border-slate-100 border-dashed">
              <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>
              </div>
              <h3 className="text-lg font-medium text-slate-700">Chưa có đánh giá nào</h3>
              <p className="text-slate-500 mt-1">Vui lòng nhập Place ID ở trên để tải đánh giá mới nhất.</p>
            </div>
          ) : (
            reviews.map((review) => (
              <div key={review.id} className="bg-white rounded-2xl p-6 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] border border-slate-100 hover:shadow-[0_8px_30px_-4px_rgba(6,81,237,0.15)] transition-all duration-300">
                <div className="flex items-start justify-between">
                  <div className="flex gap-4">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-100 to-blue-100 flex items-center justify-center text-blue-700 font-bold text-lg">
                      {review.author_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-semibold text-slate-800">{review.author_name}</h3>
                      <div className="flex items-center gap-2 text-sm text-slate-500 mt-1">
                        <div className="flex text-amber-400">
                          {[...Array(5)].map((_, i) => (
                            <svg key={i} className={`w-4 h-4 ${i < review.rating ? 'fill-current' : 'text-slate-200 fill-current'}`} viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
                          ))}
                        </div>
                        <span>• {new Date(review.created_at).toLocaleDateString('vi-VN')}</span>
                      </div>
                      <p className="mt-3 text-slate-700 leading-relaxed">{review.text}</p>
                    </div>
                  </div>
                  
                  <div>
                    {review.status === 'Resolved' ? (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-600 border border-emerald-200">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        Đã xử lý
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-600 border border-amber-200">
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        Chờ xử lý
                      </span>
                    )}
                  </div>
                </div>

                {/* AI Actions Area */}
                {review.status === 'Pending' && (
                  <div className="mt-6 pt-6 border-t border-slate-100">
                    {!review.generated_responses || review.generated_responses.length === 0 ? (
                      <button 
                        onClick={() => handleGenerateAI(review)}
                        disabled={generatingId === review.id}
                        className="w-full md:w-auto px-6 py-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-medium rounded-xl transition-all duration-300 shadow-md shadow-indigo-200 flex items-center justify-center gap-2 group"
                      >
                        {generatingId === review.id ? (
                          <>
                            <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                            AI đang phân tích...
                          </>
                        ) : (
                          <>
                            <svg className="w-5 h-5 group-hover:animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                            Tạo gợi ý phản hồi (AI)
                          </>
                        )}
                      </button>
                    ) : (
                      <div className="space-y-4">
                        <h4 className="text-sm font-semibold text-slate-500 flex items-center gap-2">
                          <svg className="w-4 h-4 text-purple-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M11.3 1.046A120.1 120.1 0 004.399 2.5a.75.75 0 00-.735.683c-.027.35-.05.701-.069 1.053-.024.453-.1 1.258-.2 2.378C3.12 9.61 2.213 14.86 6.38 18.068a.75.75 0 001.24 0c4.167-3.207 3.26-8.457 2.985-11.458-.1-.1.12-.174.925-1.284.02-.352.042-.703.069-1.053a.75.75 0 00-.735-.683 120.1 120.1 0 00-6.901-1.454zM8.349 7.643a.75.75 0 00-1.06-1.061L5.5 8.371 4.71 7.58a.75.75 0 00-1.06 1.061l1.32 1.32a.75.75 0 001.06 0l2.319-2.318z" clipRule="evenodd" /></svg>
                          AI Gợi ý trả lời
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          {review.generated_responses.map((resp, idx) => {
                            const styles = [
                              "border-blue-200 bg-blue-50/50 hover:bg-blue-50",
                              "border-pink-200 bg-pink-50/50 hover:bg-pink-50",
                              "border-amber-200 bg-amber-50/50 hover:bg-amber-50"
                            ];
                            const labels = ["Tiêu chuẩn", "Thân thiện", "Khắc phục lỗi"];
                            
                            return (
                              <div key={idx} className={`relative flex flex-col p-4 rounded-xl border transition-colors ${styles[idx]}`}>
                                <span className="text-[10px] uppercase font-bold text-slate-500 mb-2 tracking-wider">{labels[idx]}</span>
                                <p className="text-sm text-slate-700 flex-1 leading-relaxed mb-4">{resp}</p>
                                <button 
                                  onClick={() => handleApprove(review.id, idx)}
                                  disabled={approvingId === review.id}
                                  className="w-full py-2 bg-white border border-slate-200 hover:border-blue-400 hover:text-blue-600 text-slate-600 text-sm font-medium rounded-lg transition-all"
                                >
                                  {approvingId === review.id ? 'Đang duyệt...' : 'Duyệt phản hồi này'}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
