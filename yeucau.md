**PRODUCT REQUIREMENT DOCUMENT** 

- **Sản phẩm:** AI-Powered ORM  là nền tảng quản trị đánh giá khách hàng bằng AI. 
- **Mục tiêu MVP 0:** Bản thử nghiệm rút gọn (Proof of Concept) triển khai trong 7 ngày nhằm đánh giá năng lực tích hợp Full-stack và AI của đối tác Outsource/Freelancer. 
- **Luồng tính năng cốt lõi:** Lấy review thực tế từ Google Maps (thông qua Place ID) ➔ AI (OpenAI) tự động phân tích và sinh 3 gợi ý trả lời ➔user kiểm tra và duyệt (Approve) trên một Web Dashboard tập trung duy nhất. 
- **Người phụ trách (Product Owner):** UCTalent Labs 
1. **ĐỊNH NGHĨA HOÀN THÀNH (DEFINITION OF DONE)** 
- [ ] Source code được lưu trên GitHub (Commit rõ ràng từng ngày). 
- [ ] Ứng dụng chạy thực tế trên Vercel, không bị lỗi khi click thao tác. 
- [ ] Luồng nhập Place ID -> Lấy Review -> Sinh AI -> Đổi trạng thái (Approve) hoạt động mượt mà. 
- [ ] Hoàn thành trong đúng 7 ngày lịch. 

**Note:** 

- Nếu việc lấy dữ liệu review khó khăn thì có thể bỏ qua và tạo sample data trong DB. 
- Bạn vẫn được khuyến khích nộp bài nếu không hoàn thành hết các mục trên, chúng tôi đánh giá cách tiếp cận vấn đề nhiều hơn là coding. 
2. **YÊU CẦU KỸ THUẬT CỐT LÕI** 
- **Tech stack gợi ý:** Next.js (có thể dùng API Routes làm backend luôn để tiết kiệm thời gian) + Tailwind CSS. 
- **Database:** có thể dùng Supabase hoặc Firebase để Setup nhanh. 
- **AI: Gemini API,** OpenAI API (GPT-4o-mini). 

**Note:** Bạn có thể đề xuất tech stack hợp lý và có lý giải cho lựa chọn của mình. 

3. **CORE EPICS & USER STORIES** 

**Epic 1: Lấy dữ liệu (Data Pipeline)** 



|**Mã** |**User Story** |**Tiêu chí nghiệm thu (Acceptance Criteria)** |
| - | - | - |
|**DP-01** |Là người sử dụng, tôi muốn nhập Place ID của khách sạn để tự động lấy review Google Maps. |Dùng Google Places API. Giao diện có ô nhập Place ID -> Bấm "Fetch" -> Lưu và hiển thị 5 review mới nhất vào Database. |

**Epic 2: Xử lý AI (AI Engine)** 



|**Mã** |**User Story** |**Tiêu chí nghiệm thu (Acceptance Criteria)** |
| - | - | - |
|**AI-0 1** |Là  người sử dụng, tôi muốn AI tự động viết câu trả lời cho review được chọn. |Bấm nút "Generate AI" dưới review -> Gọi OpenAI sinh 3 câu trả lời (Tiêu chuẩn, Thân thiện, Khắc phục  lỗi) định dạng JSON -> Hiển thị lên UI. Tốc độ < 5s. |

**Epic 3: Giao diện (Dashboard)** 

|**Mã** |**User Story** |**Tiêu chí nghiệm thu (Acceptance Criteria)** |
| - | - | - |
|**UI-0 1** |Là  người sử dụng, tôi muốn quản lý review trên một màn hình duy nhất. |Chỉ cần 1 màn hình Dashboard. Có danh sách review. Trạng thái: Pending / Resolved. |
|**UI-0 2** |Là người sử dụng, tôi muốn duyệt câu trả lời của AI. |người sử dụng chọn 1 trong 3 câu trả lời của AI -> Bấm "Approve" -> Cập nhật trạng thái review thành "Resolved" trong Database (Không cần đẩy ngược  lên Google ở bản này). |

