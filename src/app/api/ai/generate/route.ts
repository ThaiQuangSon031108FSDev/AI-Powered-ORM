import { NextResponse } from 'next/server';
import { updateReviewResponses } from '@/lib/db';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(request: Request) {
  try {
    const { reviewId, reviewText, authorName, rating } = await request.json();

    if (!reviewId || !reviewText) {
      return NextResponse.json({ error: 'reviewId and reviewText are required' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    let responses: string[] = [];

    if (apiKey) {
      const genAI = new GoogleGenerativeAI(apiKey);
      
      // Giá trị mặc định an toàn là gemini-1.5-flash
      let modelName = "gemini-1.5-flash"; 

      try {
        // Tự động quét tất cả model hỗ trợ trong API Key của bạn qua Google REST API
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        if (res.ok) {
          const data = await res.json();
          const activeFlashModel = data.models?.find((m: any) => 
            m.name.includes("flash") && m.supportedGenerationMethods.includes("generateContent")
          );
          
          if (activeFlashModel) {
            // Lấy tên model sạch (bỏ phần "models/")
            modelName = activeFlashModel.name.replace("models/", "");
            console.log(`🤖 Auto-detected active Flash model: ${modelName}`);
          }
        } else {
          console.warn("Không thể lấy danh sách model từ Google API, chuyển về model mặc định.");
        }
      } catch (listError) {
        console.warn("Lỗi khi quét danh sách model tự động, sử dụng gemini-1.5-flash.");
      }

      console.log(`🚀 Initializing Gemini with model: ${modelName}`);
      const model = genAI.getGenerativeModel({ model: modelName });

      const prompt = `
      You are a professional customer service representative.
      A customer named "${authorName}" left a ${rating}-star review:
      "${reviewText}"
      
      Generate 3 distinct responses to this review in Vietnamese.
      Response 1: Standard professional tone.
      Response 2: Warm and friendly tone.
      Response 3: Error-recovery and empathetic tone.
      
      Return ONLY a valid JSON object with this exact structure:
      {
        "responses": [
          "string1",
          "string2",
          "string3"
        ]
      }`;

      // Gọi Gemini API và ép kiểu trả về dạng JSON
      const result = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
        },
      });

      const responseText = result.response.text();
      let parsed;
      try {
        parsed = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Gemini returned invalid JSON:', responseText);
        throw new Error('Gemini API did not return valid JSON.');
      }
      
      if (!parsed.responses || !Array.isArray(parsed.responses)) {
        console.error('Gemini returned JSON without a valid "responses" array:', parsed);
        throw new Error('Invalid JSON structure returned from Gemini');
      }
      
      responses = parsed.responses;
    } else {
      // Mock logic if no API key is provided
      console.warn('GEMINI_API_KEY missing. Using mock AI responses.');
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      responses = [
        `Cảm ơn ${authorName} đã dành thời gian đánh giá. Chúng tôi ghi nhận ý kiến của bạn và sẽ cải thiện hơn nữa.`,
        `Tuyệt vời quá! Rất vui vì ${authorName} đã có trải nghiệm tốt. Hẹn gặp lại bạn sớm nhé!`,
        `Thành thật xin lỗi ${authorName} vì những điểm chưa hoàn thiện. Chúng tôi đang kiểm tra lại quy trình để khắc phục sự cố này.`
      ];
    }

    // Save the generated responses to the database
    const updatedReview = await updateReviewResponses(reviewId, responses);
    
    if (!updatedReview) {
      return NextResponse.json({ error: 'Review not found in DB' }, { status: 404 });
    }

    return NextResponse.json({ responses, updatedReview });
  } catch (error: any) {
    console.error('🔥 Error in /api/ai/generate:', error);
    // Add extra context if it's a JSON parse error or API error
    if (error.message.includes('JSON')) {
      console.error('The response from Gemini was not a valid JSON.');
    }
    return NextResponse.json({ error: error.message || 'Lỗi không xác định từ AI' }, { status: 500 });
  }
}
