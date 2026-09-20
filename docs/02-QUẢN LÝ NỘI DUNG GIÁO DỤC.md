Tiếp tục project AI EDUCATION VIDEO FACTORY hiện tại.

ĐỌC toàn bộ code hiện có trước khi sửa.

Không rewrite lại project.
Không thay đổi Docker architecture nếu không cần thiết.
Giữ MongoDB + Mongoose + local storage.

==================================================
MỤC TIÊU
==================================================

Xây dựng module quản lý:

- Môn học
- Khối lớp
- Bộ sách
- Bài học
- Tài liệu nguồn

==================================================
1. MONGOOSE MODELS
==================================================

Implement đầy đủ:

Subject
Grade
Textbook
Lesson
SourceDocument

Subject:

- name
- slug
- description
- icon
- order
- status

Grade:

- name
- level
- description
- order

Textbook:

- name
- publisher
- gradeId
- subjectId
- description
- status

Lesson:

- textbookId
- subjectId
- gradeId
- title
- slug
- chapter
- lessonNumber
- objectives
- summary
- keyConcepts
- sourceDocumentIds
- status

SourceDocument:

- filename
- originalName
- mimeType
- size
- storagePath
- metadata
- createdAt

Tạo indexes hợp lý.

==================================================
2. CRUD API
==================================================

Tạo API cho:

Subjects
Grades
Textbooks
Lessons
SourceDocuments

Hỗ trợ:

GET
POST
PUT/PATCH
DELETE

Validation rõ ràng.

Không cho phép xóa dữ liệu đang được reference nếu gây orphan data.

==================================================
3. ADMIN UI
==================================================

Tạo:

/dashboard/subjects
/dashboard/grades
/dashboard/textbooks
/dashboard/lessons

Có:

- table
- search
- filter
- pagination
- create
- edit
- delete
- empty state
- loading state
- error state

==================================================
4. LESSON DETAIL
==================================================

Tạo:

/dashboard/lessons/[id]

Hiển thị:

Thông tin bài học
Mục tiêu
Khái niệm chính
Tài liệu nguồn
Trạng thái
Script
Storyboard
Video

Chuẩn bị navigation cho các module sau.

==================================================
5. UPLOAD DOCUMENT
==================================================

Cho phép upload tài liệu nguồn vào:

storage/documents/

Hỗ trợ architecture cho:

PDF
DOCX
TXT
Images

Chưa cần AI processing.

Lưu metadata vào MongoDB.

==================================================
6. STATUS
==================================================

Lesson:

draft
processing
ready
archived

==================================================
7. QUALITY
==================================================

Không duplicate API logic.

Dùng:

repository/service pattern nếu phù hợp.

Tạo reusable components.

Sau khi hoàn thành:

- typecheck
- lint
- build
- test API chính
- kiểm tra MongoDB
- kiểm tra upload local storage

Sửa lỗi phát sinh.

Báo cáo cuối cùng các phần đã hoàn thành.