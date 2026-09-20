# AI Education Video Factory

Nền tảng quản lý và sản xuất YouTube Shorts giáo dục bằng Next.js, MongoDB và FFmpeg.

## User Guide

Xem [hướng dẫn sử dụng đầy đủ](docs/USER_GUIDE.md), [Quick Start 5–10 phút](docs/QUICK_START.md), hoặc mở `/dashboard/help` sau khi đăng nhập để dùng hướng dẫn tương tác.

## Chạy local bằng Docker

1. Clone project và copy `.env.example` thành `.env`.
2. Đổi các giá trị password trong `.env` trước khi dùng ngoài máy cá nhân.
3. Build và chạy: `docker compose build && docker compose up -d`.
4. Mở web tại [http://localhost:3000](http://localhost:3000) hoặc OrbStack `https://web.ai-education-video-factory.orb.local`. Mongo Express vẫn expose cổng development `8081` khi cần.
5. Xem logs: `docker compose logs -f web worker mongodb`.
6. Dừng/khởi động lại: `docker compose down` / `docker compose restart`.

Health check: `curl http://localhost:3000/api/health`.

OrbStack development uses `APP_URL=https://web.ai-education-video-factory.orb.local`. Containers use `mongodb:27017` for MongoDB; the browser domain is only for browser-facing traffic.

## Backup MongoDB

```bash
scripts/backup-mongodb.sh
```

Chỉ restore vào database kiểm tra riêng bằng `scripts/restore-mongodb.sh`; xem [hướng dẫn Backup & Restore](docs/USER_GUIDE.md#30-backup--restore). Script từ chối ghi đè database đang hoạt động.

## Development

```bash
npm install
npm run dev
npm run typecheck
npm run lint
npm run build
```

Media được lưu trong `storage/` và bind-mount vào web/worker. MongoDB dùng named volume `mongo_data`. `StorageService` cung cấp `save`, `read`, `delete`, `exists`, `getPath` và `createDirectory`.

## Vietnamese TTS

Project hỗ trợ VieNeu-TTS làm local Vietnamese TTS provider trong Docker, giao tiếp HTTP nội bộ giữa worker và service `tts`. Xem [docs/tts.md](docs/tts.md) để cấu hình, kiểm tra và xem trạng thái xác minh thực tế.
