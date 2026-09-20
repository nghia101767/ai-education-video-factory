Tiếp tục project hiện tại.

Đọc architecture và code trước khi thực hiện.

Mục tiêu:

Lesson
→ AI phân tích kiến thức
→ tạo script giáo dục khoảng 30 giây
→ validation
→ human approval

==================================================
1. LESSON ANALYSIS
==================================================

Tạo model:

LessonAnalysis

Fields:

- lessonId
- sourceSummary
- learningObjectives
- keyFacts
- definitions
- formulas
- examples
- commonMistakes
- keywords
- difficulty
- generatedBy
- status
- version

AI phải ưu tiên thông tin từ SourceDocument/Lesson.

Không được tự bịa kiến thức khi source có thông tin rõ ràng.

==================================================
2. SCRIPT MODEL
==================================================

Tạo:

Script

Fields:

- lessonId
- analysisId
- title
- hook
- narration
- duration
- wordCount
- targetAudience
- educationalGoal
- callToAction
- status
- version
- validation
- createdAt

Status:

draft
generated
review
approved
rejected
archived

==================================================
3. 30 SECOND RULE
==================================================

Video mục tiêu:

25–35 giây.

Tốc độ đọc tiếng Việt khoảng 2.5–3.2 từ/giây.

AI phải tính:

estimatedDuration

Nếu vượt giới hạn:

- tự rút gọn
- vẫn giữ kiến thức quan trọng.

==================================================
4. SCRIPT STRUCTURE
==================================================

Script mặc định:

0–3s:
HOOK

3–8s:
INTRO / PROBLEM

8–20s:
EXPLANATION

20–27s:
EXAMPLE

27–30s:
SUMMARY / CTA

Không bắt buộc chính xác từng giây nếu nội dung cần điều chỉnh.

==================================================
5. AI PROVIDER ABSTRACTION
==================================================

Không hard-code một AI provider.

Tạo:

AIProvider interface

Ví dụ:

generateText()
analyzeLesson()
generateScript()

Cho phép sau này thay đổi:

OpenAI
Gemini
Anthropic
Local model

Provider được cấu hình bằng environment.

==================================================
6. PROMPT TEMPLATE
==================================================

Tạo prompt templates trong:

lib/ai/prompts/

Ví dụ:

lesson-analysis.ts
script-generation.ts
script-validation.ts

Prompt phải yêu cầu:

- tiếng Việt tự nhiên
- phù hợp học sinh
- không dài dòng
- không xuyên tạc kiến thức
- không copy nguyên văn dài từ SGK
- giải thích bằng ví dụ dễ hiểu
- tạo nội dung mới dựa trên kiến thức nguồn

==================================================
7. VALIDATION
==================================================

Tạo:

ScriptValidator

Kiểm tra:

- duration
- word count
- empty content
- missing hook
- missing conclusion
- unsafe content
- unsupported claims nếu có metadata source

==================================================
8. UI
==================================================

Lesson Detail thêm:

[Analyze Lesson]

[Generate Script]

Script Studio:

- source analysis
- generated script
- word count
- estimated duration
- regenerate
- edit
- approve
- reject

Cho phép chỉnh sửa script trước khi render.

==================================================
9. API
==================================================

Implement:

POST /api/lessons/[id]/analyze
POST /api/lessons/[id]/scripts/generate
GET /api/lessons/[id]/scripts
PATCH /api/scripts/[id]
POST /api/scripts/[id]/approve
POST /api/scripts/[id]/reject

==================================================
10. ERROR HANDLING
==================================================

AI timeout
API error
invalid response
malformed JSON
rate limit

phải được xử lý.

Không để UI bị crash.

Sau khi hoàn thành:

- typecheck
- lint
- build
- test validation
- test duration calculation

Báo cáo implementation.