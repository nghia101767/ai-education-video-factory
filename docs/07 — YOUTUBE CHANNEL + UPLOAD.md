Tiếp tục project AI EDUCATION VIDEO FACTORY.

Mục tiêu:

Quản lý YouTube channel và upload video đã approved.

==================================================
1. YOUTUBE CHANNEL
==================================================

Tạo model:

YouTubeChannel

Fields:

- channelId
- channelName
- accessToken
- refreshToken
- tokenExpiry
- status
- metadata
- createdAt
- updatedAt

KHÔNG lưu secret/token plaintext nếu có thể tránh.

Chuẩn bị encryption cho credential storage.

==================================================
2. OAUTH
==================================================

Implement YouTube OAuth architecture.

Flow:

Connect YouTube
→ OAuth
→ callback
→ store credential
→ verify channel

Không yêu cầu user nhập password YouTube vào app.

==================================================
3. VIDEO PUBLISHING
==================================================

Tạo:

PublishingJob

Fields:

- videoId
- channelId
- title
- description
- tags
- category
- privacyStatus
- scheduledAt
- youtubeVideoId
- status
- error
- createdAt

Status:

queued
uploading
published
failed
cancelled

==================================================
4. METADATA AI
==================================================

Tạo AI service:

generateYouTubeMetadata()

Input:

Lesson
Script
Video

Output:

title
description
tags
hashtags

Title ưu tiên:

- dễ hiểu
- phù hợp học sinh
- không clickbait quá mức
- có từ khóa môn/lớp/bài

==================================================
5. UPLOAD
==================================================

Chỉ cho phép:

video.status = approved

Sau đó:

Upload → YouTube

Video:

1080x1920
MP4

==================================================
6. PRIVACY
==================================================

Cho phép:

private
unlisted
public

Default:

private

Không tự động public khi chưa được bật rõ ràng.

==================================================
7. THUMBNAIL
==================================================

Upload thumbnail nếu YouTube API hỗ trợ phù hợp.

==================================================
8. UI
==================================================

/dashboard/youtube

Hiển thị:

Connected channels
Connect
Disconnect
Channel info

/dashboards/videos/[id]/publish

Hiển thị:

Title
Description
Tags
Privacy
Thumbnail
Publish

==================================================
9. PUBLISH QUEUE
==================================================

Render worker và YouTube publishing phải độc lập.

Không để upload YouTube làm block video rendering.

==================================================
10. RETRY
==================================================

Xử lý:

network error
quota error
expired token
upload interrupted

Có retry có kiểm soát.

==================================================
11. SECURITY
==================================================

Không expose access token cho frontend.

OAuth callback phải validate state.

API phải kiểm tra authorization.

==================================================
12. TEST
==================================================

Nếu không có YouTube credentials:

tạo mock provider cho development.

Không giả vờ upload thành công.

Test:

- metadata generation
- publishing state
- OAuth state validation
- permission checks

Sau khi hoàn thành:

- typecheck
- lint
- build
- test.

Báo cáo rõ phần OAuth/upload thật và phần mock.