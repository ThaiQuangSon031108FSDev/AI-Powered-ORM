# AI-Powered Customer Review Management Platform (ORM) 🚀

Một ứng dụng Dashboard quản trị phản hồi khách hàng thông minh (Online Reputation Management - ORM) được xây dựng bằng **Next.js (App Router)**, **Tailwind CSS**, tích hợp hệ thống **AI Gemini 2.5 Flash** và **SerpAPI**.

Sản phẩm được tối ưu hóa như một bản thử nghiệm rút gọn (Proof of Concept) hoàn thành chỉ trong vòng chưa đầy **1 ngày** (so với thời gian ước lượng 7 ngày) với cấu trúc mã nguồn tối giản, hiệu năng cao và khả năng phục hồi lỗi vượt trội.

---

## ✨ Các Tính Năng Nổi Bật

1. **🔄 Data Pipeline Tự Động (SerpAPI / Google Places API)**
   - Cho phép nhập **Place ID** của bất kỳ khách sạn/địa điểm kinh doanh nào trên Google Maps.
   - Tự động cào và trích xuất dữ liệu của 5 bài đánh giá (Reviews) mới nhất từ Google Maps trong thời gian thực.
   - **Cơ chế Dự phòng (Fallback)**: Tự động giả lập 5 đánh giá chân thực để chạy thử ngay cả khi không nạp API Key.

2. **🧠 AI Engine Phân Tích & Phản Hồi (Gemini 2.5 Flash)**
   - Tự động phân tích đánh giá của khách hàng và đề xuất đồng thời **3 kịch bản phản hồi** bằng Tiếng Việt dựa trên các tông giọng:
     - **Tiêu chuẩn (Standard)**: Lịch sự, chuyên nghiệp.
     - **Thân thiện (Friendly)**: Ấm áp, gần gũi, tạo thiện cảm.
     - **Khắc phục lỗi (Error-recovery)**: Nhún nhường, xoa dịu khách hàng khi họ đánh giá thấp.
   - **Tự động quét mô hình (Dynamic Model Detection)**: Gửi lệnh API kiểm tra và chọn model Flash tối ưu nhất trong tài khoản của bạn để tránh lỗi quá tải 503.

3. **📊 Web Dashboard Tập Trung & Đẹp Mắt**
   - Thiết kế giao diện cao cấp với phong cách **Glassmorphism**, hiệu ứng chuyển động mượt mà và tối ưu hóa trải nghiệm trên mọi kích thước màn hình.
   - Luồng duyệt phản hồi (Approve) thông minh giúp chuyển trạng thái từ **Chờ xử lý (Pending)** sang **Đã xử lý (Resolved)**.

---

## 🛠️ Công Nghệ Sử Dụng

- **Core**: [Next.js 15+ (App Router)](https://nextjs.org/) & [TypeScript](https://www.typescriptlang.org/)
- **Style**: [Tailwind CSS](https://tailwindcss.com/)
- **AI Integrations**: [@google/generative-ai (Gemini 2.5 Flash)](https://ai.google.dev/)
- **Data Scraper**: [SerpAPI](https://serpapi.com/) (Google Maps Reviews Engine)
- **Database**: Lớp trừu tượng hóa dữ liệu (In-Memory Database & Supabase Ready Client)

---

## ⚙️ Hướng Dẫn Cài Đặt & Chạy Thử

### 1. Chuẩn bị biến môi trường
Tạo tệp `.env.local` ở thư mục gốc của dự án và điền các API Key của bạn:

```env
GEMINI_API_KEY=your_gemini_api_key
SERPAPI_API_KEY=your_serpapi_api_key
```

### 2. Cài đặt các gói phụ thuộc
```bash
npm install
```

### 3. Chạy Server phát triển
```bash
npm run dev
```
Mở trình duyệt và truy cập: [http://localhost:3000](http://localhost:3000) để trải nghiệm.

### 4. Cách chạy thử
1. Trên giao diện, nhập Place ID ví dụ của trụ sở Google ở Sydney: `ChIJN1t_tDeuEmsRUsoyG83frY4`.
2. Bấm nút **Fetch** để tải đánh giá thật về Dashboard.
3. Bấm **Tạo gợi ý phản hồi (AI)** để xem Gemini sinh 3 kịch bản trả lời xuất sắc.
4. Chọn câu trả lời ưng ý và bấm **Duyệt phản hồi này**.

---

## 📂 Cấu Trúc Mã Nguồn

```text
├── src/
│   ├── app/
│   │   ├── api/
│   │   │   ├── ai/generate/route.ts       # API kết nối Gemini sinh 3 tông giọng
│   │   │   ├── reviews/approve/route.ts   # API phê duyệt phản hồi review
│   │   │   └── reviews/fetch/route.ts     # API cào review thực tế từ SerpAPI
│   │   ├── layout.tsx
│   │   └── page.tsx                       # Dashboard chính (Tailwind Glassmorphism UI)
│   ├── lib/
│   │   ├── db.ts                          # Tầng truy xuất dữ liệu (In-memory Fallback & Supabase)
│   │   └── supabase.ts                    # Khởi tạo Supabase client
```

---

*Phát triển bởi **ThaiQuangSon031108FSDev** - 2026.*
