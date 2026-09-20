Đây là prompt hoàn thiện project.

Đọc toàn bộ source code hiện tại.

Không rewrite những module đang hoạt động.

Mục tiêu:

Biến AI EDUCATION VIDEO FACTORY thành hệ thống production-ready để tạo số lượng lớn video giáo dục.

==================================================
1. BATCH PIPELINE
==================================================

Tạo pipeline:

Lesson
→ Analyze
→ Script
→ Approval
→ Storyboard
→ Assets
→ Render
→ Video Approval
→ YouTube

Mỗi bước là một job độc lập.

==================================================
2. JOB QUEUE
==================================================

Tạo generic Job architecture.

Job types:

lesson_analysis
script_generation
storyboard_generation
asset_generation
video_render
youtube_publish

Fields:

- type
- payload
- status
- priority
- attempts
- maxAttempts
- lockedAt
- startedAt
- completedAt
- error

==================================================
3. RETRY
==================================================

Retry với exponential backoff.

Không retry vô hạn.

Default:

maxAttempts = 3

==================================================
4. BATCH GENERATION
==================================================

UI:

Select lessons

Actions:

Analyze
Generate Scripts
Generate Storyboards
Generate Assets
Render Videos
Publish

Hiển thị:

Total
Pending
Processing
Completed
Failed

==================================================
5. SCHEDULING
==================================================

Cho phép đặt:

scheduledAt

cho publishing job.

Không tự động public nếu user chưa bật.

==================================================
6. ANALYTICS
==================================================

Tạo model:

VideoAnalytics

Fields:

- videoId
- youtubeVideoId
- views
- likes
- comments
- watchTime
- averageViewDuration
- retention
- subscribersGained
- fetchedAt

Chuẩn bị service lấy YouTube analytics.

==================================================
7. DASHBOARD
==================================================

Dashboard:

Total Lessons
Total Videos
Rendered
Published
Failed

YouTube:

Views
Likes
Comments
Subscribers

Render:

Queue
Processing
Failed

==================================================
8. BACKUP
==================================================

Tạo scripts:

backup-mongodb
restore-mongodb

Backup:

MongoDB dump
metadata

Tạo:

backups/

Không backup secrets.

==================================================
9. STORAGE MANAGEMENT
==================================================

Tạo utility:

storage statistics

Hiển thị:

Images
Audio
Videos
Documents
Total size

Cho phép tìm orphan files.

Không tự động delete orphan files.

Có:

Scan
Review
Delete selected

==================================================
10. LOGGING
==================================================

Tạo structured logging.

Log:

INFO
WARN
ERROR

Có:

jobId
videoId
lessonId

Không log:

password
OAuth token
API key
secret

==================================================
11. SETTINGS
==================================================

Tạo:

/dashboard/settings

Settings:

AI provider
Image provider
Voice provider
Video defaults
YouTube defaults
Storage
Rendering

Secrets chỉ lấy từ environment/secure storage.

==================================================
12. SYSTEM HEALTH
==================================================

Dashboard health:

MongoDB
Storage
FFmpeg
Worker
AI provider
YouTube provider

Hiển thị:

Healthy
Warning
Error

==================================================
13. SECURITY AUDIT
==================================================

Kiểm tra:

- API authorization
- input validation
- path traversal
- command injection
- upload validation
- file size limits
- MIME validation
- secrets exposure
- OAuth security
- MongoDB injection
- unsafe HTML rendering

Sửa các lỗi phát hiện được.

==================================================
14. PERFORMANCE
==================================================

Kiểm tra:

- MongoDB indexes
- unnecessary queries
- N+1 queries
- large API responses
- file streaming
- worker memory
- render concurrency

==================================================
15. PRODUCTION DOCKER
==================================================

Tạo:

docker-compose.prod.yml

Tách:

development
production

Không expose MongoDB ra internet nếu không cần.

Không expose Mongo Express trong production.

==================================================
16. DOCUMENTATION
==================================================

README hoàn chỉnh:

Architecture
Requirements
Environment
Docker
MongoDB
Local storage
AI providers
FFmpeg
Workers
Rendering
YouTube
Backup
Restore
Troubleshooting

==================================================
17. END-TO-END TEST
==================================================

Thực hiện kiểm tra:

Create Subject
→ Create Grade
→ Create Textbook
→ Create Lesson
→ Analyze
→ Generate Script
→ Approve
→ Generate Storyboard
→ Generate/attach assets
→ Render
→ Preview
→ Approve Video
→ Prepare YouTube Publishing

Nếu credentials thật không có:

dùng mock provider nhưng phải phân biệt rõ mock/real.

==================================================
18. FINAL AUDIT
==================================================

Tìm:

TODO
FIXME
placeholder
fake implementation
console.log không cần thiết
dead code
unused imports
TypeScript any không cần thiết
broken links
broken API
Docker errors

Sửa tất cả lỗi có thể sửa.

Không tuyên bố hoàn thành nếu feature chỉ là UI giả.

Cuối cùng tạo:

PROJECT_STATUS.md

Bao gồm:

- Completed
- Partially completed
- Known limitations
- Environment requirements
- Commands
- Production checklist

Sau đó:

- npm/typecheck
- lint
- tests
- production build
- Docker build
- Docker compose validation

Báo cáo chính xác kết quả.