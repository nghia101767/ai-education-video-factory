Tiếp tục project hiện tại.

Mục tiêu:

Tạo giao diện Video Studio để người dùng có thể đi từ:

Lesson
→ Analysis
→ Script
→ Storyboard
→ Assets
→ Render
→ Preview
→ Approve

==================================================
1. VIDEO STUDIO
==================================================

Route:

/dashboard/videos/[id]

Layout:

LEFT:
Scene timeline/list

CENTER:
Video preview

RIGHT:
Properties

BOTTOM:
Render controls

==================================================
2. SCENE TIMELINE
==================================================

Hiển thị:

Scene 1
Scene 2
Scene 3
...

Mỗi scene:

- thumbnail
- duration
- narration
- status

Cho phép:

drag/reorder
edit duration
edit narration
replace asset

==================================================
3. VIDEO PREVIEW
==================================================

HTML5 video player.

Hỗ trợ:

play
pause
seek
fullscreen
volume

Không cần realtime rendering.

Preview sử dụng video đã render.

==================================================
4. SCRIPT PANEL
==================================================

Hiển thị:

- title
- hook
- narration
- duration
- word count

Có Edit.

==================================================
5. STORYBOARD PANEL
==================================================

Hiển thị:

- scene description
- image
- narration
- timing

==================================================
6. ASSET MANAGER
==================================================

Cho phép:

upload local asset
replace asset
delete asset
preview asset

Storage:

storage/images
storage/audio
storage/videos

==================================================
7. RENDER
==================================================

Nút:

Render Video

Hiển thị:

Queued
Processing
Progress
Completed
Failed

Không reload toàn trang liên tục.

Dùng polling hoặc SSE nếu phù hợp.

==================================================
8. VIDEO APPROVAL
==================================================

Status:

draft
rendering
ready_for_review
approved
rejected
published

Chỉ video approved mới được phép chuyển sang publishing module.

==================================================
9. BATCH
==================================================

Tạo batch action:

Select multiple lessons
→ Generate scripts
→ Generate storyboard
→ Queue render

Không chạy đồng thời vô hạn.

Dùng queue.

==================================================
10. DASHBOARD
==================================================

Dashboard hiển thị:

Lessons
Scripts
Videos
Render Queue
Published Videos
Failed Jobs

==================================================
11. ERROR UX
==================================================

Có:

loading
empty
error
retry
confirmation dialog

Không dùng alert() đơn giản cho UX chính.

==================================================
12. RESPONSIVE
==================================================

Desktop-first nhưng responsive.

==================================================
13. QUALITY
==================================================

Tái sử dụng components.

Không duplicate logic API.

Không phá các module trước.

Sau khi hoàn thành:

- typecheck
- lint
- build
- test workflow:

Lesson
→ Script
→ Storyboard
→ Render
→ Preview

Báo cáo nếu có phần nào chưa thực sự hoạt động.