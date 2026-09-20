
Bạn là senior full-stack engineer.

Hãy xây dựng nền tảng ban đầu cho project:

AI EDUCATION VIDEO FACTORY

Mục tiêu:
Xây dựng hệ thống quản lý và sản xuất YouTube Shorts giáo dục bằng AI. Nội dung tập trung vào các bài học phổ thông, được chuyển thành video giảng dạy khoảng 30 giây.

==================================================
1. TECH STACK
==================================================

Frontend:
- Next.js
- TypeScript
- App Router
- React
- Tailwind CSS

Backend:
- Next.js Route Handlers/API
- TypeScript

Database:
- MongoDB
- Mongoose

Infrastructure:
- Docker
- Docker Compose

Video:
- FFmpeg

Storage:
- Local filesystem

Không sử dụng:
- Firebase
- Supabase
- PostgreSQL
- MySQL
- AWS S3
- Cloud Storage

MongoDB và toàn bộ file media phải được persist bằng Docker volumes/bind mounts.

==================================================
2. DOCKER
==================================================

Tạo:

docker-compose.yml

Services tối thiểu:

- web
- mongodb
- mongo-express
- worker

MongoDB:
- persistent volume
- authentication bằng environment variables
- healthcheck

mongo-express:
- chỉ phục vụ development
- phụ thuộc MongoDB

web:
- chạy Next.js

worker:
- Node.js worker
- có FFmpeg
- chuẩn bị architecture cho video rendering

Tạo:

Dockerfile
Dockerfile.worker
.dockerignore
.env.example

Không hard-code secrets.

==================================================
3. PROJECT STRUCTURE
==================================================

Thiết kế structure rõ ràng:

app/
components/
lib/
models/
services/
repositories/
workers/
types/
config/
storage/
scripts/

Có thể điều chỉnh structure nếu có lý do kỹ thuật rõ ràng.

==================================================
4. LOCAL STORAGE
==================================================

Tạo storage:

storage/
├── textbooks/
├── documents/
├── images/
├── audio/
├── videos/
├── subtitles/
├── thumbnails/
├── temp/
└── logs/

Storage phải nằm ngoài source code logic và được mount vào Docker.

Tạo abstraction:

StorageService

Hỗ trợ:

- save
- read
- delete
- exists
- getPath
- createDirectory

Không hard-code đường dẫn tuyệt đối.

==================================================
5. MONGODB
==================================================

Cấu hình:

MONGODB_URI

Tạo MongoDB connection singleton phù hợp Next.js development.

Tạo Mongoose base configuration.

Chưa cần triển khai toàn bộ business models nhưng chuẩn bị architecture để các prompt sau bổ sung:

- User
- Subject
- Grade
- Textbook
- Lesson
- Script
- Scene
- Asset
- Video
- RenderJob
- YouTubeChannel
- PublishingJob

==================================================
6. AUTHENTICATION
==================================================

Tạo architecture cho admin authentication.

MVP có thể dùng:

- email/password
- session-based authentication

Không cần OAuth ở prompt này.

==================================================
7. ADMIN UI
==================================================

Tạo dashboard cơ bản:

/dashboard

Sidebar:

- Dashboard
- Subjects
- Textbooks
- Lessons
- Scripts
- Storyboards
- Videos
- Render Queue
- YouTube
- Settings

Tạo responsive layout.

==================================================
8. HEALTH CHECK
==================================================

Tạo:

GET /api/health

Kiểm tra:

- application
- MongoDB
- storage
- FFmpeg availability nếu phù hợp

==================================================
9. DEVELOPMENT EXPERIENCE
==================================================

Tạo README.md hướng dẫn:

1. clone project
2. tạo .env
3. docker compose build
4. docker compose up
5. truy cập web
6. truy cập Mongo Express
7. xem logs
8. stop/restart
9. backup MongoDB

==================================================
10. QUALITY
==================================================

Thiết lập:

- ESLint
- TypeScript strict
- error handling
- logging
- environment validation

Không tạo code giả hoặc TODO thay cho implementation quan trọng.

Sau khi hoàn thành:

- chạy typecheck
- chạy lint
- build Docker
- kiểm tra MongoDB connection
- kiểm tra Next.js
- sửa toàn bộ lỗi có thể sửa được.

Cuối cùng báo cáo:

- files đã tạo
- architecture
- commands đã chạy
- lỗi còn lại nếu có