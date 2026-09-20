Tiếp tục project hiện tại.

Đây là module quan trọng nhất.

Mục tiêu:

Scenes + Assets + Voice + Subtitle
→ FFmpeg
→ MP4 1080x1920
→ storage/videos/

==================================================
1. RENDER JOB
==================================================

Tạo model:

RenderJob

Fields:

- videoId
- status
- progress
- currentStep
- inputAssets
- outputPath
- error
- startedAt
- completedAt
- retryCount

Status:

queued
processing
completed
failed
cancelled

==================================================
2. VIDEO MODEL
==================================================

Video:

- lessonId
- scriptId
- title
- description
- duration
- width
- height
- fps
- outputPath
- thumbnailPath
- status

==================================================
3. WORKER
==================================================

Worker chạy Docker container riêng.

Không render trong Next.js request.

Worker:

- lấy RenderJob
- lock job
- xử lý
- update progress
- release job

==================================================
4. FFMPEG
==================================================

Output:

1080x1920
9:16
30fps
H.264
AAC

Có:

- image scenes
- zoom/pan nhẹ
- transitions
- voice
- background music
- sound effects
- subtitles
- intro/outro

==================================================
5. AUDIO
==================================================

Mix:

Voice
+
Background music
+
SFX

Voice phải rõ hơn background music.

Có normalize volume.

Không để clipping.

==================================================
6. SUBTITLE
==================================================

Tạo SRT hoặc ASS.

Subtitle:

- tiếng Việt
- dễ đọc trên mobile
- timing theo narration
- nằm trong safe area

Render subtitle vào video.

==================================================
7. SAFE AREA
==================================================

Video YouTube Shorts:

1080x1920

Nội dung quan trọng không được sát:

- top
- bottom
- left
- right

Subtitle phải tránh UI overlay của YouTube.

==================================================
8. THUMBNAIL
==================================================

Tạo thumbnail từ scene phù hợp.

Lưu:

storage/thumbnails/

==================================================
9. RENDER QUEUE
==================================================

API:

POST /api/videos/[id]/render
GET /api/render-jobs
GET /api/render-jobs/[id]
POST /api/render-jobs/[id]/cancel
POST /api/render-jobs/[id]/retry

==================================================
10. PROGRESS
==================================================

UI hiển thị:

0–100%

Current step:

Preparing
Generating audio
Preparing scenes
Rendering
Encoding
Finalizing

==================================================
11. CONCURRENCY
==================================================

MVP:

1 render job tại một thời điểm.

Architecture phải cho phép tăng lên sau này.

==================================================
12. SECURITY
==================================================

FFmpeg command phải tránh command injection.

Không dùng shell string không kiểm soát.

Validate mọi input path.

==================================================
13. UI
==================================================

Video Studio:

- scene preview
- render button
- render progress
- output video
- play preview
- download/local file reference

==================================================
14. TEST
==================================================

Tạo test cho:

- duration
- path validation
- render job state
- subtitle generation

Sau khi hoàn thành:

- build Docker worker
- verify ffmpeg
- test render một video mẫu
- typecheck
- lint

Nếu render mẫu thất bại, tự debug và sửa.

Báo cáo chính xác video mẫu có render thành công hay không.