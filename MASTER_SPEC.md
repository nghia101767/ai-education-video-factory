# FULL PROMPT — AI EDUCATION VIDEO FACTORY

## Local-first + MongoDB + Docker + FFmpeg + Cost Optimized AI

Bạn là Senior Full-Stack Engineer + AI Video Pipeline Engineer.

Hãy xây dựng hoàn chỉnh một hệ thống có tên:

# AI EDUCATION VIDEO FACTORY

Mục tiêu của hệ thống:

* Quản lý nội dung bài học.
* Nhập tài liệu/bài học từ sách giáo khoa hoặc tài liệu được phép sử dụng.
* AI phân tích kiến thức.
* AI viết lại thành nội dung giảng dạy ngắn khoảng 30 giây.
* AI tạo storyboard.
* Tái sử dụng asset để giảm chi phí.
* Tạo hình AI khi thực sự cần.
* Tạo giọng đọc AI.
* Tạo subtitle.
* FFmpeg dựng video.
* Quản lý video.
* Duyệt video.
* Upload YouTube.
* Theo dõi chi phí AI.
* Batch generate hàng loạt video.
* Toàn bộ dữ liệu chính được lưu local.
* MongoDB là database chính.
* Tất cả service chạy bằng Docker.

==================================================

# 1. NGUYÊN TẮC KIẾN TRÚC

==================================================

Bắt buộc:

* Next.js
* TypeScript
* App Router
* MongoDB
* Mongoose
* Docker
* Docker Compose
* FFmpeg
* Local filesystem storage

Không dùng:

* Firebase
* Firestore
* Supabase
* PostgreSQL
* MySQL
* AWS S3
* Cloud Storage làm storage chính

Kiến trúc phải:

* local-first
* modular
* provider-independent
* cost optimized
* queue-based
* có thể mở rộng sau này

Không tạo mock implementation cho feature production nếu chưa được yêu cầu.

Nếu provider AI chưa được cấu hình thì phải có development/mock mode rõ ràng và UI phải thể hiện đó là mock.

Không được giả vờ rằng AI/image/TTS/YouTube đã thực hiện thành công nếu API thực tế chưa chạy.

==================================================

# 2. MỤC TIÊU VIDEO

==================================================

Video mục tiêu:

* YouTube Shorts
* 9:16
* 1080x1920
* 30fps
* H.264
* AAC
* khoảng 25–35 giây

Mục tiêu nội dung:

* dễ hiểu
* ngắn
* chính xác
* phù hợp học sinh
* có ví dụ
* có hook
* có kết luận
* không đọc lại nguyên văn toàn bộ sách giáo khoa
* ưu tiên diễn giải bằng ngôn ngữ mới
* có visual minh họa

==================================================

# 3. COST OPTIMIZATION

==================================================

Đây là yêu cầu quan trọng nhất.

Thiết kế pipeline để giảm tối đa số lần gọi API AI.

Không tạo ảnh AI mới cho mọi scene nếu có thể tái sử dụng asset.

Ưu tiên:

1. Cache
2. Asset Library
3. Template
4. Local processing
5. AI generation cuối cùng

Pipeline:

Lesson
→ AI analysis
→ AI script
→ AI storyboard
→ Asset matching
→ Generate missing assets
→ TTS
→ Subtitle
→ FFmpeg

Không dùng AI cho:

* subtitle timing đơn giản nếu có thể xử lý local
* video rendering
* image transitions
* zoom/pan
* compositing
* audio mixing
* file conversion
* thumbnail composition đơn giản
* metadata calculations

Những phần trên phải dùng local code/FFmpeg.

==================================================

# 4. PROVIDER ABSTRACTION

==================================================

Không hard-code một AI vendor.

Tạo interfaces:

LLMProvider

ImageProvider

TTSProvider

YouTubeProvider

Ví dụ:

LLMProvider:

* analyzeLesson()
* generateScript()
* validateScript()
* generateStoryboard()
* generateMetadata()

ImageProvider:

* generateImage()

TTSProvider:

* generateSpeech()

YouTubeProvider:

* authenticate()
* getChannel()
* uploadVideo()
* uploadThumbnail()
* publishVideo()
* getVideoAnalytics()

Cho phép thay provider bằng environment variables.

Ví dụ:

AI_LLM_PROVIDER

AI_IMAGE_PROVIDER

AI_TTS_PROVIDER

YOUTUBE_PROVIDER

==================================================

# 5. PROJECT STRUCTURE

==================================================

Tạo structure rõ ràng:

app/
components/
features/
lib/
models/
services/
repositories/
providers/
workers/
jobs/
validators/
types/
config/
scripts/
public/
storage/
tests/
docs/

Có thể thay đổi structure nếu có lý do kỹ thuật rõ ràng nhưng phải giữ separation of concerns.

==================================================

# 6. DOCKER

==================================================

Tạo:

Dockerfile
Dockerfile.worker
docker-compose.yml
docker-compose.prod.yml
.dockerignore
.env.example

Services:

web
mongodb
mongo-express
worker

Development:

docker compose up -d

Production:

docker compose -f docker-compose.prod.yml up -d

MongoDB phải persistent.

Không expose MongoDB public trong production.

Mongo Express chỉ development.

Worker phải có FFmpeg.

==================================================

# 7. LOCAL STORAGE

==================================================

Tạo:

storage/
├── documents/
├── textbooks/
├── images/
├── audio/
├── videos/
├── subtitles/
├── thumbnails/
├── temp/
├── cache/
├── exports/
├── backups/
└── logs/

Database chỉ lưu:

* path
* metadata
* hash
* size
* MIME
* timestamps

Không lưu video/image/audio lớn trực tiếp vào MongoDB.

==================================================

# 8. STORAGE SERVICE

==================================================

Tạo:

StorageService

Methods:

save()
read()
delete()
exists()
getPath()
getPublicPath()
getSize()
getStats()
calculateHash()
scan()
findOrphans()

Có path validation.

Chống:

* path traversal
* ../
* absolute path injection

Giới hạn upload size.

Kiểm tra MIME type.

==================================================

# 9. DATABASE MODELS

==================================================

Tạo Mongoose models:

User
Subject
Grade
Textbook
SourceDocument
Lesson
LessonAnalysis
Script
Scene
CharacterProfile
StylePreset
Asset
AssetUsage
Video
RenderJob
AIUsage
YouTubeChannel
PublishingJob
VideoAnalytics
SystemSetting

==================================================

# 10. SUBJECT

==================================================

Subject:

name
slug
description
icon
order
status
createdAt
updatedAt

==================================================

# 11. GRADE

==================================================

Grade:

name
level
description
order
status

==================================================

# 12. TEXTBOOK

==================================================

Textbook:

name
publisher
subjectId
gradeId
description
edition
status
createdAt
updatedAt

==================================================

# 13. SOURCE DOCUMENT

==================================================

SourceDocument:

filename
originalName
mimeType
size
storagePath
hash
metadata
processingStatus
createdAt
updatedAt

Hỗ trợ architecture cho:

PDF
DOCX
TXT
PNG
JPG
JPEG

==================================================

# 14. LESSON

==================================================

Lesson:

textbookId
subjectId
gradeId
title
slug
chapter
lessonNumber
description
objectives
summary
keyConcepts
sourceDocumentIds
status
createdAt
updatedAt

Status:

draft
processing
ready
archived

==================================================

# 15. LESSON ANALYSIS

==================================================

LessonAnalysis:

lessonId
sourceSummary
learningObjectives
keyFacts
definitions
formulas
examples
commonMistakes
keywords
difficulty
sourceReferences
provider
model
promptVersion
contentHash
status
createdAt

AI phải ưu tiên thông tin từ source.

Nếu không đủ dữ liệu:

không tự bịa.

Phải đánh dấu:

insufficient_source

==================================================

# 16. SCRIPT

==================================================

Script:

lessonId
analysisId
title
hook
narration
duration
wordCount
targetAudience
educationalGoal
callToAction
provider
model
promptVersion
contentHash
validation
status
version
createdAt
updatedAt

Status:

draft
generated
review
approved
rejected
archived

==================================================

# 17. 30 SECOND SCRIPT ENGINE

==================================================

Cấu trúc mặc định:

0–3s:

HOOK

3–8s:

INTRO

8–20s:

EXPLANATION

20–27s:

EXAMPLE

27–30s:

SUMMARY

Không bắt buộc tuyệt đối nếu nội dung yêu cầu khác.

Tính:

wordCount

estimatedDuration

targetDuration

Nếu quá dài:

AI phải tự rút gọn.

Không được cắt mất kiến thức cốt lõi.

==================================================

# 18. SCRIPT VALIDATOR

==================================================

Tạo:

ScriptValidator

Kiểm tra:

* word count
* duration
* hook
* explanation
* example
* conclusion
* empty text
* unsupported claims
* unsafe content
* duplicate content

Trả về:

valid
warnings[]
errors[]

==================================================

# 19. SCRIPT CACHE

==================================================

Đây là yêu cầu quan trọng.

Tạo content hash:

lesson content
+
prompt version
+
model
+
generation settings

→ SHA-256

Nếu hash giống:

KHÔNG gọi AI lần nữa.

Dùng cached result.

Nếu promptVersion/model thay đổi:

có thể generate version mới.

==================================================

# 20. AI USAGE TRACKING

==================================================

Tạo model:

AIUsage

Fields:

provider
service
model
operation
requestId
lessonId
scriptId
sceneId
inputTokens
outputTokens
imageCount
audioSeconds
estimatedCost
currency
cached
durationMs
status
error
createdAt

Service:

AIUsageService

Methods:

record()
estimateCost()
getDailyCost()
getMonthlyCost()
getAverageCostPerVideo()
getCostByProvider()
getCostByModel()

==================================================

# 21. COST DASHBOARD

==================================================

Dashboard phải hiển thị:

Today's AI cost

This month

Average cost/video

LLM cost

Image cost

TTS cost

Cached requests

Avoided API calls

Estimated next batch cost

Ví dụ:

Today:
$0.82

This month:
$14.37

Average:
$0.0018/video

Không hard-code giá.

Tạo pricing configuration.

==================================================

# 22. PRICING CONFIGURATION

==================================================

Tạo config:

AI pricing

Ví dụ:

LLM:

input price
output price

Image:

price per image

TTS:

price per character
hoặc
price per minute

Pricing phải có version.

Không hard-code trong business logic.

==================================================

# 23. ASSET LIBRARY

==================================================

Đây là thành phần giúp giảm chi phí.

Asset:

type
filename
storagePath
hash
prompt
provider
model
stylePresetId
characterProfileId
metadata
tags
status
createdAt

Types:

image
audio
video
music
sfx
thumbnail

==================================================

# 24. ASSET MATCHING

==================================================

Trước khi gọi ImageProvider:

search Asset Library.

Match theo:

* semantic tags
* lesson
* subject
* style
* character
* visual category
* hash/prompt similarity

Nếu có asset phù hợp:

reuse.

Không generate mới.

Lưu:

AssetUsage

assetId
sceneId
videoId
usageType

==================================================

# 25. ASSET LIBRARY DEFAULT

==================================================

Tạo seed data cho:

Characters:

* student-boy
* student-girl
* teacher
* robot-mascot

Backgrounds:

* classroom
* home
* school
* laboratory
* outdoor
* whiteboard

Objects:

* book
* pencil
* ruler
* calculator
* apple
* pizza
* globe
* computer

Chỉ tạo metadata/placeholder hợp lệ nếu chưa có ảnh thật.

Không giả vờ placeholder là AI-generated asset.

==================================================

# 26. CHARACTER PROFILE

==================================================

CharacterProfile:

name
description
appearance
personality
visualStyle
promptPrefix
negativePrompt
referenceAssetIds
status

AI image prompt phải sử dụng character profile để giữ consistency.

==================================================

# 27. STYLE PRESET

==================================================

Tạo:

cute_education
cartoon_primary
whiteboard
minimal_math
science_lab
3d_kids

Fields:

name
description
visualPromptPrefix
negativePrompt
aspectRatio
font
subtitleStyle
transitionStyle

==================================================

# 28. STORYBOARD

==================================================

Script approved:

→ generate storyboard

Tạo 5–7 scenes.

Scene:

scriptId
sceneNumber
startTime
endTime
duration
narration
visualDescription
imagePrompt
animationPrompt
subtitleText
transition
backgroundMusic
soundEffect
assetIds
status

==================================================

# 29. STORYBOARD CACHE

==================================================

Storyboard generation cũng phải cache.

Hash:

script content
+
style
+
character
+
prompt version

Nếu hash giống:

reuse.

==================================================

# 30. IMAGE GENERATION

==================================================

Chỉ generate image nếu:

Asset Library không có asset phù hợp.

Image prompt phải bao gồm:

style
character
visual description
aspect ratio
composition
negative prompt

Lưu cost vào AIUsage.

Sau khi tạo:

hash image

→ đưa vào Asset Library.

==================================================

# 31. TTS

==================================================

TTS chỉ chạy khi:

* narration thay đổi
* voice thay đổi
* script version thay đổi

Hash:

narration
+
voice
+
provider
+
model

Nếu hash tồn tại:

reuse audio.

Lưu audio:

storage/audio/

Lưu metadata vào Asset.

==================================================

# 32. SUBTITLE

==================================================

Không cần AI nếu có thể tính local.

Tạo:

SRT
ASS

Timing dựa trên:

scene timing
narration duration

Subtitle phải:

* dễ đọc
* tiếng Việt
* mobile friendly
* safe area

==================================================

# 33. VIDEO

==================================================

Video:

lessonId
scriptId
title
description
duration
width
height
fps
outputPath
thumbnailPath
status
version
createdAt
updatedAt

Status:

draft
rendering
ready_for_review
approved
rejected
published

==================================================

# 34. RENDER JOB

==================================================

RenderJob:

videoId
status
progress
currentStep
inputAssets
outputPath
error
retryCount
maxAttempts
lockedAt
startedAt
completedAt
createdAt

==================================================

# 35. WORKER

==================================================

Worker riêng:

Node.js + FFmpeg.

Không render trong Next.js API request.

Worker lấy jobs từ MongoDB.

Lock job bằng atomic update.

MVP:

concurrency = 1

Có architecture để tăng sau.

==================================================

# 36. RENDER PIPELINE

==================================================

Render:

Prepare assets
↓
Prepare audio
↓
Prepare subtitles
↓
Create scene videos
↓
Compose scenes
↓
Mix audio
↓
Burn subtitles
↓
Encode
↓
Generate thumbnail
↓
Finalize

Output:

1080x1920
30fps
H.264
AAC
MP4

==================================================

# 37. ANIMATION

==================================================

Không cần AI video generation cho MVP.

Dùng FFmpeg:

* zoom in
* zoom out
* pan
* fade
* slide
* scale
* crossfade
* text animation

Mục tiêu:

ảnh tĩnh nhưng video vẫn có cảm giác chuyển động.

==================================================

# 38. AUDIO MIX

==================================================

Voice:

primary

Music:

low volume

SFX:

short

Có:

* normalization
* fade in
* fade out
* volume control
* clipping protection

==================================================

# 39. THUMBNAIL

==================================================

Tạo thumbnail từ asset/scene.

Không bắt buộc gọi AI.

Có template:

Title
Mascot
Visual
Subject/Grade

==================================================

# 40. VIDEO STUDIO

==================================================

Route:

/dashboard/videos/[id]

Layout:

LEFT:
scene list

CENTER:
video preview

RIGHT:
properties

BOTTOM:
render controls

Hiển thị:

Script
Storyboard
Assets
Render
Preview

==================================================

# 41. LESSON MANAGEMENT UI

==================================================

Routes:

/dashboard/subjects
/dashboard/grades
/dashboard/textbooks
/dashboard/lessons

Có:

* CRUD
* search
* filter
* pagination
* status
* upload document

==================================================

# 42. SCRIPT STUDIO UI

==================================================

Route:

/dashboard/lessons/[id]/script

Có:

Generate Script

Regenerate

Edit

Approve

Reject

Hiển thị:

word count
estimated duration
AI cost
cache status
source summary

==================================================

# 43. STORYBOARD UI

==================================================

Route:

/dashboard/scripts/[id]/storyboard

Có:

* scene list
* reorder
* edit timing
* edit narration
* edit visual
* regenerate scene
* replace asset
* preview asset

==================================================

# 44. ASSET LIBRARY UI

==================================================

Route:

/dashboard/assets

Filter:

type
subject
style
character
provider

Search.

Preview.

Reuse.

Delete.

Không cho delete asset đang được sử dụng nếu gây broken references.

==================================================

# 45. RENDER QUEUE UI

==================================================

Route:

/dashboard/render-queue

Hiển thị:

Queued
Processing
Completed
Failed

Progress.

Current step.

Retry.

Cancel.

==================================================

# 46. YOUTUBE

==================================================

Tạo:

YouTubeChannel
PublishingJob
VideoAnalytics

OAuth.

Không lưu YouTube password.

Không expose tokens frontend.

Default privacy:

private

User phải chủ động chuyển public.

==================================================

# 47. YOUTUBE METADATA

==================================================

AI tạo:

title
description
tags
hashtags

Title phải:

* rõ nội dung
* có môn/lớp nếu phù hợp
* không clickbait quá mức
* phù hợp educational content

==================================================

# 48. PUBLISHING

==================================================

Chỉ publish:

video.status = approved

Flow:

Approved
↓
Publishing Queue
↓
Upload
↓
YouTube Video ID
↓
Published

Nếu upload thất bại:

retry.

Không block render worker.

==================================================

# 49. YOUTUBE ANALYTICS

==================================================

Lấy:

views
likes
comments
watch time
average view duration
retention
subscribers gained

Lưu snapshot theo thời gian.

Dashboard có:

daily
weekly
monthly

==================================================

# 50. BATCH GENERATION

==================================================

Cho phép chọn nhiều Lesson.

Actions:

Analyze

Generate Script

Generate Storyboard

Generate Assets

Render

Publish

Không tạo hàng nghìn job cùng lúc mà không kiểm soát.

Dùng queue.

==================================================

# 51. BATCH COST ESTIMATION

==================================================

Trước khi chạy batch:

Ví dụ:

100 lessons

Estimated:

LLM: $X

Images: $Y

TTS: $Z

Total: $N

Cached savings: $M

Hiển thị confirmation:

Estimated cost:
$N

[Cancel]

[Continue]

Nếu provider không cung cấp pricing:

hiển thị:

Cost unavailable

không tự bịa giá.

==================================================

# 52. QUEUE SYSTEM

==================================================

Job types:

lesson_analysis
script_generation
storyboard_generation
asset_generation
tts_generation
video_render
youtube_publish
analytics_sync

Fields:

type
payload
status
priority
attempts
maxAttempts
lockedAt
startedAt
completedAt
error

Retry:

maximum 3 lần.

Exponential backoff.

==================================================

# 53. IDEMPOTENCY

==================================================

Job phải idempotent.

Nếu cùng:

lessonId
operation
contentHash

đã hoàn thành:

không chạy lại.

Điều này đặc biệt quan trọng để tránh mất tiền AI.

==================================================

# 54. API

==================================================

Tạo API:

GET /api/health

Subjects CRUD

Grades CRUD

Textbooks CRUD

Lessons CRUD

Documents upload

POST /api/lessons/[id]/analyze

POST /api/lessons/[id]/scripts/generate

GET /api/lessons/[id]/scripts

PATCH /api/scripts/[id]

POST /api/scripts/[id]/approve

POST /api/scripts/[id]/reject

POST /api/scripts/[id]/storyboard

GET /api/scripts/[id]/scenes

PATCH /api/scenes/[id]

DELETE /api/scenes/[id]

POST /api/scenes/[id]/generate-asset

POST /api/videos/[id]/render

GET /api/render-jobs

GET /api/render-jobs/[id]

POST /api/render-jobs/[id]/retry

POST /api/render-jobs/[id]/cancel

POST /api/videos/[id]/approve

POST /api/videos/[id]/reject

YouTube APIs

Analytics APIs

Cost APIs

==================================================

# 55. AUTHENTICATION

==================================================

MVP:

Admin authentication.

Session based.

Password hashed.

Không lưu plaintext password.

Authorization middleware.

Tất cả admin APIs phải yêu cầu authentication ngoại trừ health check.

==================================================

# 56. SECURITY

==================================================

Audit:

* MongoDB injection
* path traversal
* command injection
* upload validation
* MIME validation
* file size
* API authorization
* OAuth state
* secret exposure
* SSRF
* unsafe HTML
* XSS
* CSRF nếu phù hợp
* rate limiting cho expensive endpoints

Đặc biệt:

Không build FFmpeg command bằng input string không kiểm soát.

==================================================

# 57. ERROR HANDLING

==================================================

Tạo standardized error:

code
message
details
requestId

Không expose:

stack trace
API keys
tokens
filesystem internals

Production response phải an toàn.

==================================================

# 58. LOGGING

==================================================

Structured logs.

Fields:

timestamp
level
requestId
jobId
lessonId
videoId
message

Không log:

password
access token
refresh token
API key
secret

==================================================

# 59. SYSTEM SETTINGS

==================================================

Route:

/dashboard/settings

Settings:

AI providers
Image providers
TTS
YouTube
Video defaults
Storage
Rendering
Pricing

Secrets phải lấy từ environment hoặc encrypted storage.

==================================================

# 60. SYSTEM HEALTH

==================================================

Dashboard:

MongoDB
Storage
Worker
FFmpeg
LLM provider
Image provider
TTS provider
YouTube provider

Status:

Healthy
Warning
Error

==================================================

# 61. STORAGE MANAGEMENT

==================================================

Hiển thị:

Documents size
Images size
Audio size
Videos size
Thumbnails size
Total size

Có:

Scan orphan files

Không tự động xóa.

User phải review trước.

==================================================

# 62. BACKUP

==================================================

Tạo:

scripts/backup-mongodb

scripts/restore-mongodb

MongoDB dump:

backups/mongodb/

Có documentation.

Backup local storage metadata.

Không backup:

.env
secrets
OAuth tokens nếu không được mã hóa

==================================================

# 63. EXPORT

==================================================

Cho phép export metadata:

JSON

CSV nếu phù hợp.

Có thể export:

Lessons
Scripts
Videos
AI Usage
Analytics

Không export binary video mặc định.

==================================================

# 64. DESIGN SYSTEM

==================================================

UI:

modern
clean
professional
education-focused

Desktop-first.

Responsive.

Có:

sidebar
topbar
cards
tables
dialogs
drawers
tabs
badges
progress bars
toast
empty state
loading skeleton
error state

Không dùng alert() cho UX chính.

==================================================

# 65. DASHBOARD

==================================================

Dashboard chính:

Lessons

Scripts

Videos

Published

Render Queue

AI Cost

Storage

YouTube Analytics

Ví dụ:

┌─────────────────────────────────────────────┐
│ AI EDUCATION VIDEO FACTORY                  │
├──────────┬──────────┬──────────┬────────────┤
│ Lessons  │ Scripts  │ Videos   │ Published  │
│  245     │  180     │  132     │  87        │
├──────────┴──────────┴──────────┴────────────┤
│ AI COST                                     │
│ Today: $0.82                                │
│ Month: $14.37                               │
│ Avg/video: $0.0018                          │
├─────────────────────────────────────────────┤
│ RENDER QUEUE                                │
│ Video A      Rendering       72%            │
│ Video B      Completed                       │
│ Video C      Waiting                         │
└─────────────────────────────────────────────┘

==================================================

# 66. CONTENT COMPLIANCE

==================================================

Đây là hệ thống giáo dục nên phải tránh biến nội dung thành bản sao nguyên văn sách.

Source document chỉ là nguồn tham khảo.

Pipeline:

Source
↓
Extract knowledge
↓
Facts
↓
Educational explanation
↓
Original example
↓
Original visual
↓
Original narration

Không tự động sao chép nguyên văn nội dung dài từ sách.

Lưu source references.

Lesson phải có:

sourceDocumentIds

LessonAnalysis phải có:

sourceReferences

==================================================

# 67. CONTENT QUALITY

==================================================

AI phải kiểm tra:

Accuracy

Age appropriateness

Language clarity

Duration

Educational usefulness

Unsupported claims

Repetition

Không tạo nội dung:

* nguy hiểm
* sai kiến thức
* không phù hợp trẻ em
* clickbait quá mức

==================================================

# 68. PROMPT VERSIONING

==================================================

Mọi AI prompt phải version.

Ví dụ:

lesson-analysis-v1

script-generation-v1

storyboard-v1

metadata-v1

Lưu:

promptVersion

Nếu prompt thay đổi:

có thể invalidate cache có kiểm soát.

==================================================

# 69. MODEL VERSIONING

==================================================

Lưu:

provider
model

cho mọi AI generation.

Ví dụ:

provider:
xxx

model:
xxx

Điều này giúp:

* audit
* cost tracking
* reproduce
* compare quality

==================================================

# 70. AI GENERATION HISTORY

==================================================

Không overwrite mất lịch sử.

Mỗi regeneration tạo version.

Ví dụ:

Script v1
Script v2
Script v3

User có thể:

compare
restore
approve

==================================================

# 71. CONTENT PIPELINE STATUS

==================================================

Lesson detail hiển thị:

1. Source
2. Analysis
3. Script
4. Storyboard
5. Assets
6. Audio
7. Render
8. Review
9. YouTube

Mỗi bước:

pending
processing
completed
failed

==================================================

# 72. MOCK DEVELOPMENT MODE

==================================================

Tạo:

MOCK_AI=true

Khi bật:

LLM trả dữ liệu deterministic.

Image provider tạo placeholder hợp lệ.

TTS tạo sample audio nếu có fixture.

YouTube mock không upload thật.

UI phải hiển thị:

MOCK MODE

Không bao giờ ghi mock data như production success.

==================================================

# 73. ENVIRONMENT

==================================================

Tạo .env.example:

NODE_ENV

MONGODB_URI

MONGODB_DATABASE

STORAGE_ROOT

AI_LLM_PROVIDER

AI_IMAGE_PROVIDER

AI_TTS_PROVIDER

AI_API_KEY

YOUTUBE_CLIENT_ID

YOUTUBE_CLIENT_SECRET

YOUTUBE_REDIRECT_URI

MOCK_AI

WORKER_CONCURRENCY

MAX_UPLOAD_SIZE

Không commit .env.

==================================================

# 74. TESTING

==================================================

Tạo tests:

unit
integration

Test:

MongoDB connection

Storage

Hash

Cache

Cost calculation

Script validation

Storyboard validation

Path validation

Job locking

Retry

Idempotency

Subtitle

Render command generation

API authorization

==================================================

# 75. END TO END

==================================================

Test flow:

Create Subject
↓
Create Grade
↓
Create Textbook
↓
Create Lesson
↓
Upload Source
↓
Analyze
↓
Generate Script
↓
Approve
↓
Generate Storyboard
↓
Match Asset Library
↓
Generate missing assets
↓
Generate TTS
↓
Generate Subtitle
↓
Create Render Job
↓
Worker
↓
FFmpeg
↓
Video
↓
Review
↓
Approve
↓
YouTube Publish
↓
Analytics

==================================================

# 76. COST TEST

==================================================

Test:

Generate same lesson twice.

Lần đầu:

AI request.

Lần hai:

Cache hit.

Không được phát sinh AI cost lần 2 nếu content hash/model/prompt version giống.

Test TTS tương tự.

Test Image asset reuse.

==================================================

# 77. PERFORMANCE

==================================================

Audit:

MongoDB indexes

N+1 query

large response

memory usage

worker memory

file streaming

render concurrency

API response size

Không load binary lớn vào memory nếu không cần.

==================================================

# 78. PRODUCTION DOCKER

==================================================

Production:

* web
* mongodb
* worker

Không expose:

MongoDB
Mongo Express

ra internet.

Storage persistent.

Restart policy phù hợp.

Healthchecks.

==================================================

# 79. DOCUMENTATION

==================================================

Tạo:

README.md

docs/
├── architecture.md
├── database.md
├── api.md
├── ai-pipeline.md
├── cost-optimization.md
├── asset-library.md
├── video-rendering.md
├── youtube.md
├── deployment.md
├── backup.md
├── troubleshooting.md
└── development.md

==================================================

# 80. CODING RULES

==================================================

Không:

* duplicate logic
* giant component
* giant API route
* any không cần thiết
* hardcoded secrets
* fake implementation
* silent errors
* unhandled promises
* unsafe shell commands

Ưu tiên:

* small services
* typed interfaces
* validation
* repository/service separation
* reusable UI
* clear naming
* comments cho logic phức tạp

==================================================

# 81. DEVELOPMENT WORKFLOW

==================================================

Trước khi code:

1. inspect filesystem
2. inspect existing code
3. determine current state
4. preserve existing working functionality

Sau mỗi module:

* typecheck
* lint
* test
* build nếu phù hợp

Không chờ đến cuối mới phát hiện lỗi.

==================================================

# 82. FINAL AUDIT

==================================================

Sau khi hoàn thành:

Tìm:

TODO

FIXME

placeholder

fake implementation

unused imports

dead code

console.log

unsafe shell

hardcoded secrets

broken API

broken route

Docker errors

TypeScript errors

ESLint errors

Sửa tất cả lỗi có thể sửa.

==================================================

# 83. PROJECT STATUS

==================================================

Tạo:

PROJECT_STATUS.md

Bao gồm:

Completed

Partially completed

Known limitations

Mock features

Real integrations

Environment requirements

Commands

Production checklist

==================================================

# 84. FINAL COMMANDS

==================================================

Chạy:

typecheck

lint

tests

production build

Docker build

Docker Compose validation

Kiểm tra worker.

Kiểm tra MongoDB.

Kiểm tra FFmpeg.

Kiểm tra local storage.

==================================================

# 85. QUY TẮC QUAN TRỌNG NHẤT

==================================================

Không tuyên bố feature hoàn thành nếu chỉ tạo UI.

Một feature chỉ được xem là completed khi:

* UI hoạt động
* API hoạt động
* database hoạt động
* service hoạt động
* error handling có
* test hoặc manual verification có
* Docker hoạt động nếu liên quan

Nếu một external API chưa có credential:

được phép dùng provider abstraction + mock development mode.

Nhưng phải ghi rõ:

MOCK

và không tuyên bố production integration đã hoàn thành.

==================================================

# 86. MỤC TIÊU CUỐI CÙNG

==================================================

Hệ thống phải cho phép người dùng:

1. Tạo bài học.
2. Nhập tài liệu nguồn.
3. Phân tích bài học bằng AI.
4. Tạo script khoảng 30 giây.
5. Chỉnh sửa/duyệt script.
6. Tạo storyboard.
7. Tìm asset có sẵn.
8. Chỉ tạo asset AI nếu thiếu.
9. Tạo voice.
10. Tạo subtitle.
11. Render bằng FFmpeg local.
12. Preview video.
13. Duyệt video.
14. Upload YouTube.
15. Theo dõi analytics.
16. Theo dõi chi phí AI.
17. Batch generate nhiều bài.
18. Cache để tránh gọi AI trùng.
19. Backup MongoDB.
20. Quản lý toàn bộ dữ liệu local.

==================================================

# 87. BẮT ĐẦU IMPLEMENTATION

==================================================

Nếu project đang ở thư mục rỗng:

hãy tạo toàn bộ project từ đầu.

Nếu project đã có code:

hãy đọc và giữ nguyên những phần đang hoạt động.

Không hỏi lại những thứ đã được đặc tả ở trên.

Nếu có quyết định kỹ thuật chưa được quy định:

chọn phương án đơn giản, ổn định, dễ bảo trì và phù hợp Docker/local-first.

Ưu tiên MVP hoạt động thực sự hơn là over-engineering.

Bắt đầu bằng:

1. Project foundation
2. Docker
3. MongoDB
4. Local storage
5. Authentication
6. Admin dashboard
7. Content management

Sau đó tiếp tục lần lượt:

8. AI analysis
9. Script
10. Storyboard
11. Asset Library
12. TTS
13. Subtitle
14. FFmpeg Worker
15. Video Studio
16. YouTube
17. Analytics
18. Cost tracking
19. Batch queue
20. Backup
21. Final audit

Không dừng lại ở việc tạo skeleton.

Hãy implement đến mức project có thể chạy được.

Cuối cùng xuất báo cáo:

* Implementation summary
* Files created/changed
* Docker services
* Database collections
* API routes
* AI providers
* Cost optimization mechanisms
* Test results
* Build results
* Known limitations
* Commands to run the project
