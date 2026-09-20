# AI Education Video Factory — Quick Start

Hướng dẫn này chạy hệ thống bằng Docker trong khoảng 5–10 phút, sử dụng AI mock. Mock mode chỉ kiểm tra pipeline; hình/giọng/YouTube không phải kết quả production.

Sau khi đăng nhập, có thể mở hướng dẫn tương tác tại [`/dashboard/help`](http://localhost:3000/dashboard/help). Tiến độ được lưu riêng trong trình duyệt.

## 1. Chuẩn bị cấu hình

```bash
cp .env.example .env
```

Mở `.env` và thay ít nhất:

- `MONGO_ROOT_PASSWORD`
- `MONGO_APP_PASSWORD` và password trong `MONGODB_URI` cho khớp
- `SESSION_SECRET`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`

Giữ cấu hình test:

```env
MOCK_AI=true
AI_LLM_PROVIDER=mock
AI_IMAGE_PROVIDER=mock
AI_TTS_PROVIDER=mock
YOUTUBE_PROVIDER=mock
```

## 2. Build và chạy

```bash
docker compose config
docker compose build
docker compose up -d
docker compose ps
```

Không dùng `docker compose down -v`; lệnh đó xóa volume dữ liệu.

## 3. Kiểm tra hệ thống

```bash
curl http://localhost:3000/api/health
docker compose logs --tail=100 web worker mongodb
```

Đợi đến khi MongoDB healthy và health báo `mongodb`, `storage`, `worker` là `ok`.

## 4. Mở trình duyệt và đăng nhập

- `http://localhost:3000/login`
- OrbStack: `https://web.ai-education-video-factory.orb.local/login`

Đăng nhập bằng `ADMIN_EMAIL`/`ADMIN_PASSWORD` trong `.env`. Admin được tạo khi đăng nhập đúng lần đầu.

## 5. Tạo cấu trúc bài học

1. **Subjects** → nhập tên → **Create**.
2. **Grades** → nhập tên và level 1–12 → **Create**.
3. **Textbooks** → chọn subject/grade, nhập tên → **Create**.
4. **Lessons** → chọn subject/grade/textbook, nhập title và summary → **Create**.
5. Chọn tên lesson để mở Lesson Detail.

## 6. Upload tài liệu

Trong Lesson Detail:

1. Chọn file TXT, DOCX hoặc PDF có text layer.
2. Chọn **Upload document**.
3. Chờ status `READY` và số ký tự lớn hơn 0.

Với `MOCK_AI=true`, PNG/JPG tạo nội dung `[MOCK OCR]` để chạy pipeline và không được xem là OCR thật. Ở real mode chưa có OCR provider, trạng thái là `OCR_NOT_CONFIGURED`.

## 7. Chạy pipeline mock

1. **Analyze lesson** → kiểm tra analysis.
2. **Generate script** → kiểm tra thời lượng 25–35 giây.
3. Sửa nếu cần rồi **Approve**.
4. Mở **Storyboard** → **Generate scenes**.
5. **Generate missing images** — tạo SVG có nhãn MOCK.
6. **Generate voice** — tạo tone WAV mock.
7. **Open Video Studio**.

## 8. Render và duyệt

1. Chọn **Render video**.
2. Mở **Render Queue** và chờ `completed`.
3. Quay lại Video Studio; có thể tạo/chỉnh/save SRT, chọn music/SFX đã upload, xem và download MP4.
4. Chọn **Approve** hoặc **Reject**.

Output hiện tại là MP4 1080×1920, 30 fps, H.264/AAC, dài 25–35 giây và có SRT burn-in.

## Giới hạn hiện tại

- OpenAI thật: `NOT_CONFIGURED`.
- YouTube thật: `NOT_CONFIGURED`; mock không upload.
- OCR thật: `NOT_CONFIGURED`; Mock OCR đã kiểm chứng và luôn có nhãn.
- Music/SFX mixing: đã kiểm chứng bằng FFmpeg; hãy nghe lại mức âm thanh trước khi duyệt.
- Batch 3 lessons pause/resume/cancel đã kiểm chứng; hoàn tất cả ba video qua các cổng duyệt vẫn `CHƯA VERIFY`.
- Browser automation: `CHƯA VERIFY`.

Xem hướng dẫn đầy đủ tại [USER_GUIDE.md](USER_GUIDE.md).

## Docker VieNeu-TTS

Để bật giọng tiếng Việt local: đặt `TTS_PROVIDER=vieneu` và `MOCK_AI=false`; worker dùng `VIENEU_TTS_URL=http://tts:8000`. Chạy `docker compose build && docker compose up -d`, xem `docker compose logs tts` và đợi health báo sẵn sàng. Model được giữ trong volume `vieneu-model-cache`; audio dùng bind mount `./storage`. Không xóa volume hoặc reset MongoDB. Quy trình và kết quả xác minh: [tts.md](tts.md).
