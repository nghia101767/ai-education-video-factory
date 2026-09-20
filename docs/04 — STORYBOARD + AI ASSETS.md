Tiếp tục project hiện tại.

Mục tiêu:

Approved Script
→ Storyboard
→ Scenes
→ Asset prompts
→ Asset management

Không render video ở prompt này.

==================================================
1. SCENE MODEL
==================================================

Tạo:

Scene

Fields:

- scriptId
- sceneNumber
- startTime
- endTime
- duration
- narration
- visualDescription
- imagePrompt
- animationPrompt
- subtitleText
- transition
- backgroundMusic
- soundEffect
- status

==================================================
2. STORYBOARD GENERATION
==================================================

AI nhận Script đã approved.

Tạo 5–7 scenes.

Tổng duration phải gần duration script.

Mỗi scene phải có:

- narration
- visual
- image prompt
- subtitle
- duration

==================================================
3. CHARACTER CONSISTENCY
==================================================

Tạo:

CharacterProfile

Fields:

- name
- description
- appearance
- personality
- visualStyle
- referenceAssets

Cho phép một channel/style sử dụng mascot cố định.

Ví dụ:

"Bạn Minh"
- học sinh tiểu học
- thân thiện
- phong cách cartoon education

AI phải giữ mô tả nhất quán.

==================================================
4. STYLE PRESETS
==================================================

Tạo:

StylePreset

Ví dụ:

cute_education
cartoon_primary
whiteboard
minimal_math
science_lab

Fields:

- name
- description
- visualPromptPrefix
- negativePrompt
- aspectRatio
- typography
- subtitleStyle

==================================================
5. ASSET MODEL
==================================================

Asset:

- type
- filename
- storagePath
- mimeType
- sceneId
- prompt
- provider
- metadata
- status

Asset types:

image
audio
video
music
sfx
thumbnail

==================================================
6. IMAGE PROVIDER
==================================================

Tạo abstraction:

ImageProvider

generateImage()

Không hard-code provider.

Cho phép cấu hình AI image provider bằng environment.

Nếu API chưa được cấu hình:

UI vẫn phải hoạt động bằng mock/local development mode rõ ràng.

Không giả vờ rằng ảnh AI đã được tạo nếu API không thực sự chạy.

==================================================
7. STORYBOARD UI
==================================================

Tạo:

/dashboard/scripts/[id]/storyboard

Layout:

Scene list
Scene editor
Visual preview
Narration
Timing
Prompt
Assets

Có:

Add Scene
Delete Scene
Reorder Scene
Edit Scene
Regenerate Scene

==================================================
8. VALIDATION
==================================================

StoryboardValidator:

- scene timing không overlap
- tổng duration
- narration coverage
- sceneNumber liên tục
- image prompt không empty

==================================================
9. API
==================================================

POST /api/scripts/[id]/storyboard
GET /api/scripts/[id]/scenes
PATCH /api/scenes/[id]
DELETE /api/scenes/[id]
POST /api/scenes/[id]/generate-asset

==================================================
10. LOCAL STORAGE
==================================================

Assets phải được lưu:

storage/images/
storage/audio/
storage/videos/

Database chỉ lưu metadata/path.

Không lưu binary lớn trực tiếp trong MongoDB.

Sau khi hoàn thành:

- typecheck
- lint
- build
- test storyboard validation

Báo cáo kết quả.