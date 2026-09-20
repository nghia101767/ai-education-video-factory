"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type ProviderName = "analysis" | "script" | "llm" | "image" | "tts" | "youtube";
type GuideStatus = "ready" | "mock" | "developing" | "unavailable" | "openai";
type Provider = { provider: string; configured: boolean; model?: string; voice?: string; runtimeVerified?: boolean };
type StoredProgress = { completed: number[]; skipped: number[] };
type Step = {
  nav: string;
  title: string;
  icon: string;
  intro: string;
  doing: string;
  tasks: string[];
  continueWhen: string;
  tip?: string;
  errors?: string[];
  action?: { href: string; label: string };
  status: GuideStatus;
  provider?: ProviderName;
};

const storageKey = "edu-video-help-progress-v1";

const steps: Step[] = [
  {
    nav: "Bắt đầu", title: "Tạo video giáo dục đầu tiên", icon: "✦", status: "ready",
    intro: "Hướng dẫn này đưa bạn từ một bài học đến video dọc hoàn chỉnh. Pipeline hiện đã được kiểm chứng với AI mock, MongoDB, worker và FFmpeg.",
    doing: "Chuẩn bị cho quy trình tạo video khoảng 10–20 phút, chưa tính thời gian biên tập nội dung.",
    tasks: ["✓ Tạo cấu trúc môn học, khối lớp và sách", "✓ Tạo bài học và tải tài liệu nguồn", "✓ Phân tích, tạo và duyệt kịch bản", "✓ Tạo storyboard, ảnh, audio và phụ đề", "✓ Render, kiểm tra và duyệt video"],
    continueWhen: "Web, MongoDB và worker đang hoạt động; bạn đã đăng nhập vào Dashboard.",
    tip: "YouTube thật chưa được cấu hình trong môi trường hiện tại. Bạn vẫn có thể hoàn thành video MP4 local.",
    errors: ["Nếu không vào được Dashboard, đăng nhập lại.", "Nếu health báo worker unavailable, kiểm tra container worker trước khi bắt đầu."],
  },
  {
    nav: "1. Tạo môn học", title: "Tạo môn học", icon: "◈", status: "ready",
    intro: "Môn học giúp phân loại sách và bài học.", doing: "Tạo một Subject dùng thống nhất cho các nội dung cùng môn.",
    tasks: ["Mở Subjects.", "Nhập tên môn học và mô tả nếu cần.", "Chọn trạng thái active.", "Nhấn Create."],
    continueWhen: "Môn học xuất hiện trong danh sách và có trạng thái active.", tip: "Dùng một cách đặt tên thống nhất, ví dụ “Toán” thay vì tạo cả “Toán học” và “Môn Toán”.",
    errors: ["Tên trống sẽ bị từ chối.", "Nếu danh sách không refresh, kiểm tra thông báo lỗi và thử tải lại trang."], action: { href: "/dashboard/subjects", label: "Mở Subjects" },
  },
  {
    nav: "2. Tạo khối lớp", title: "Tạo khối lớp", icon: "▣", status: "ready",
    intro: "Khối lớp xác định cấp độ của sách và bài học.", doing: "Tạo Grade với tên và level từ 1 đến 12.",
    tasks: ["Mở Grades.", "Nhập tên khối.", "Nhập level nguyên từ 1 đến 12.", "Chọn active và nhấn Create."],
    continueWhen: "Grade xuất hiện trong danh sách. Mỗi level chỉ được tạo một lần.", tip: "Subject và Grade chưa liên kết trực tiếp; chúng được kết nối khi tạo Textbook và Lesson.",
    errors: ["Level ngoài 1–12 bị từ chối.", "Level trùng với Grade đã có sẽ không lưu được."], action: { href: "/dashboard/grades", label: "Mở Grades" },
  },
  {
    nav: "3. Tạo sách giáo khoa", title: "Tạo sách giáo khoa", icon: "☷", status: "ready",
    intro: "Sách giáo khoa liên kết môn học và khối lớp để Lesson dùng đúng ngữ cảnh.", doing: "Tạo Textbook từ Subject và Grade vừa chuẩn bị.",
    tasks: ["Mở Textbooks.", "Nhập tên sách.", "Chọn Subject và Grade.", "Nhập nhà xuất bản, phiên bản hoặc mô tả nếu cần.", "Nhấn Create."],
    continueWhen: "Textbook xuất hiện với đúng Subject, Grade và trạng thái active.", tip: "Không upload tài liệu ở trang Textbooks; source document được gắn vào Lesson.",
    errors: ["Phải tạo Subject và Grade trước.", "Subject/Grade không tồn tại sẽ bị backend từ chối."], action: { href: "/dashboard/textbooks", label: "Mở Textbooks" },
  },
  {
    nav: "4. Tạo bài học", title: "Tạo bài học", icon: "✎", status: "ready",
    intro: "Lesson là nội dung đầu vào trung tâm cho toàn bộ video.", doing: "Tạo Lesson có quan hệ chính xác và đủ dữ liệu để AI phân tích.",
    tasks: ["Mở Lessons.", "Chọn Subject và Grade.", "Chọn Textbook phù hợp.", "Nhập tiêu đề, summary, objectives và key concepts.", "Nhấn Create rồi chọn tên Lesson để mở chi tiết."],
    continueWhen: "Lesson Detail mở được và hiển thị đúng môn, khối, sách.", tip: "Subject và Grade của Lesson phải khớp Textbook. Summary rõ ràng giúp kết quả phân tích tốt hơn.",
    errors: ["Thiếu một trong ba quan hệ sẽ không lưu được.", "Nếu textbook không xuất hiện, kiểm tra bộ Subject/Grade đang chọn."], action: { href: "/dashboard/lessons", label: "Mở Lessons" },
  },
  {
    nav: "5. Upload tài liệu", title: "Upload tài liệu nguồn", icon: "⇧", status: "ready",
    intro: "Tài liệu nguồn cung cấp nội dung thật để phân tích bài học.", doing: "Gắn PDF, DOCX, TXT hoặc ảnh vào Lesson.",
    tasks: ["Mở Lesson Detail hoặc Source Documents.", "Chọn PDF, DOCX, TXT, PNG, JPG hoặc JPEG tối đa 50 MB.", "Nhấn Upload document.", "Chờ upload và trích xuất đồng bộ hoàn tất.", "Xác nhận trạng thái READY và số ký tự lớn hơn 0."],
    continueWhen: "Có ít nhất một tài liệu READY, hoặc Lesson đã có summary/objectives/key concepts đủ dùng.", tip: "Trong MOCK_AI=true, ảnh trả nội dung MOCK OCR được ghi nhãn rõ. Ở chế độ real chưa cấu hình OCR, ảnh trả OCR_NOT_CONFIGURED. PDF scan không có text layer có thể trả FAILED.",
    errors: ["Extension, MIME hoặc chữ ký file không khớp.", "File vượt 50 MB.", "PDF không có text trích xuất được.", "Lesson được chọn không còn tồn tại."], action: { href: "/dashboard/source-documents", label: "Mở Source Documents" },
  },
  {
    nav: "6. Phân tích bài học", title: "AI phân tích bài học", icon: "⌁", status: "unavailable", provider: "analysis",
    intro: "AI đọc Lesson và các tài liệu READY để tìm nội dung quan trọng cho video.", doing: "Tạo Lesson Analysis có tóm tắt, mục tiêu, dữ kiện, định nghĩa, ví dụ và lỗi thường gặp.",
    tasks: ["Mở Lesson Detail.", "Kiểm tra source hoặc summary đã có nội dung.", "Kiểm tra provider, model và budget.", "Nhấn Phân tích bài học.", "Đọc kết quả; Regenerate analysis dùng cache nếu nguồn không đổi. Force regenerate bỏ qua cache có xác nhận."],
    continueWhen: "Lesson Detail hiển thị một analysis version hợp lệ.", tip: "Request giống content/provider/model/prompt/settings sẽ dùng cache và không gọi AI lại.",
    errors: ["AI provider chưa cấu hình hoặc API key sai.", "Lesson không có source/summary/objectives/concepts.", "Daily hoặc monthly budget đã hết.", "Provider timeout hoặc trả structured output sai schema."], action: { href: "/dashboard/lessons", label: "Chọn Lesson để phân tích" },
  },
  {
    nav: "7. Tạo kịch bản", title: "Tạo kịch bản video", icon: "≡", status: "unavailable", provider: "script",
    intro: "AI chuyển Lesson Analysis thành kịch bản ngắn cho video giáo dục.", doing: "Tạo title, hook, narration, mục tiêu và CTA.",
    tasks: ["Trong Lesson Detail, tìm Script Studio.", "Nhấn Generate script.", "Đọc hook, narration và CTA.", "Kiểm tra word count, provider/model và thời lượng.", "Dùng Edit và Save nếu cần chỉnh."],
    continueWhen: "Script hợp lệ, có hook/CTA và narration được ước tính từ 25 đến 35 giây.", tip: "Narration được ước tính theo 2,85 từ/giây. Hãy sửa nội dung trước khi tạo hình và audio.",
    errors: ["Phải có Lesson Analysis trước.", "Narration ngoài 25–35 giây bị validation từ chối.", "AI provider, budget hoặc structured output có lỗi."], action: { href: "/dashboard/lessons", label: "Mở Script Studio trong Lesson" },
  },
  {
    nav: "8. Duyệt kịch bản", title: "Duyệt kịch bản", icon: "✓", status: "ready",
    intro: "Approval gate ngăn hệ thống tạo media từ một kịch bản chưa được kiểm tra.", doing: "Đọc, chỉnh sửa rồi Approve hoặc Reject script.",
    tasks: ["Kiểm tra nội dung có đúng kiến thức.", "Kiểm tra chính tả, hook, narration và CTA.", "Nhấn Edit/Save nếu cần; script trở về review.", "Nhấn Approve khi đã chốt.", "Nếu không đạt, nhấn Reject rồi chỉnh hoặc Regenerate."],
    continueWhen: "Script có badge approved và nút Storyboard xuất hiện.", tip: "Không tạo ảnh hoặc TTS trước khi chốt script để tránh cache miss và chi phí không cần thiết.",
    errors: ["Script ngoài 25–35 giây không thể Approve.", "Sau khi sửa phải kiểm tra lại trước khi Approve."], action: { href: "/dashboard/lessons", label: "Mở Lesson để duyệt script" },
  },
  {
    nav: "9. Tạo Storyboard", title: "Tạo Storyboard", icon: "▦", status: "mock", provider: "llm",
    intro: "Storyboard chia video thành 5–7 cảnh có timing, narration, mô tả hình và subtitle.", doing: "Tạo và kiểm tra chuỗi scene trước khi sinh media.",
    tasks: ["Từ script approved, nhấn Storyboard.", "Nhấn Generate scenes.", "Kiểm tra 5–7 scene không overlap.", "Dùng Edit để sửa timing, narration, visual, image prompt hoặc subtitle.", "Chọn Character Profile/Style Preset nếu cần tính nhất quán.", "Dùng mũi tên để reorder; Regenerate nếu cần."],
    continueWhen: "Mỗi scene có timing hợp lệ, narration, image prompt và tổng duration gần bằng script.", tip: "Character Profile và Style Preset có thể tái sử dụng giữa nhiều scene. Cấu hình này được đưa vào prompt và cache key khi tạo ảnh.",
    errors: ["Script chưa approved.", "Scene timing overlap hoặc duration không khớp.", "Provider trả ít hơn 5 hoặc nhiều hơn 7 scene."], action: { href: "/dashboard/lessons", label: "Chọn script approved" },
  },
  {
    nav: "10. Quản lý Assets", title: "Tạo hoặc tái sử dụng Assets", icon: "◇", status: "mock", provider: "image",
    intro: "Asset là image, audio, video, music, SFX hoặc thumbnail dùng trong video.", doing: "Ưu tiên reuse asset có sẵn; chỉ generate image còn thiếu.",
    tasks: ["Trong Storyboard, kiểm tra scene chưa có ảnh.", "Tìm và gán thủ công ảnh có sẵn nếu phù hợp.", "Nếu còn thiếu, nhấn Generate image hoặc Generate missing images.", "Hệ thống tự tìm cache/matching trước khi gọi provider.", "Mở Asset Library để search, filter, preview hoặc upload asset local.", "Không xóa asset đang được scene sử dụng."],
    continueWhen: "Mỗi scene có đúng một image asset preview được.", tip: "Reuse và gán asset có sẵn giúp giảm chi phí và giữ hình ảnh nhất quán. Bạn cũng có thể quản lý Character Profile và Style Preset từ navigation.",
    errors: ["Image provider chưa cấu hình.", "Budget đã hết.", "File upload sai type/MIME/signature hoặc vượt 100 MB."], action: { href: "/dashboard/assets", label: "Mở Asset Library" },
  },
  {
    nav: "11. Tạo giọng đọc", title: "Tạo giọng đọc TTS", icon: "♪", status: "mock", provider: "tts",
    intro: "TTS chuyển narration của từng scene thành audio.", doing: "Generate và preview một audio asset cho mỗi scene.",
    tasks: ["Chốt narration của tất cả scene.", "Nhấn Generate voice trong Storyboard.", "Preview audio bên dưới từng scene.", "Kiểm tra thời lượng và phát âm.", "Dùng Force regenerate khi thật sự cần gọi lại provider; thao tác thường sẽ reuse cache."],
    continueWhen: "Mỗi scene có audio preview hoạt động.", tip: "Với VieNeu-TTS, chọn preset trong mục Voice ở Storyboard hoặc Video Studio. Generate/reuse voice tạo job chạy nền và ưu tiên cache; Regenerate voice tạo lại audio. Mock TTS chỉ tạo tone WAV, không phải giọng production.",
    errors: ["Storyboard chưa tồn tại.", "TTS provider/key/model/voice sai.", "Budget đã hết hoặc provider timeout."], action: { href: "/dashboard/lessons", label: "Mở Storyboard để tạo voice" },
  },
  {
    nav: "12. Tạo phụ đề", title: "Kiểm tra phụ đề", icon: "CC", status: "ready",
    intro: "SRT được tạo từ subtitle text và timing của scene; Video Studio cho phép xem và sửa nội dung trước khi render lại.", doing: "Tạo, kiểm tra và lưu nội dung subtitle trước khi burn vào video.",
    tasks: ["Trong Storyboard, Edit từng scene nếu subtitleText cần sửa.", "Mở Video Studio và nhấn Generate subtitles.", "Kiểm tra chính tả/timing rồi sửa nội dung trong Subtitle editor.", "Nhấn Save subtitles.", "Render video để worker burn SRT.", "Xem video trên khung màn hình điện thoại để kiểm tra khả năng đọc."],
    continueWhen: "Subtitle đã lưu đúng nội dung/timing và được burn rõ trên bản render.", tip: "Phiên bản hiện tại hỗ trợ SRT UTF-8. ASS, tùy chỉnh style và preview overlay trước render chưa có.",
    errors: ["Subtitle trống sẽ lấy narration của scene.", "Timing scene sai làm timing SRT sai.", "Font/subtitle burn lỗi sẽ xuất hiện trong Render Queue logs."], action: { href: "/dashboard/lessons", label: "Mở Storyboard để kiểm tra subtitle" },
  },
  {
    nav: "13. Render video", title: "Render video bằng FFmpeg", icon: "▶", status: "ready",
    intro: "Worker ghép scene images, voices, music/SFX và SRT thành MP4 dọc.", doing: "Chọn âm thanh, tạo Render Job và theo dõi progress thật từ backend.",
    tasks: ["Từ Storyboard, nhấn Open Video Studio.", "Xác nhận mọi scene có image và voice.", "Chọn background music và SFX theo scene nếu cần.", "Nhấn Render video.", "Mở Render Queue.", "Theo dõi queued → processing → completed; xem logs nếu failed."],
    continueWhen: "Render Job đạt completed, progress 100% và Video có MP4/SRT.", tip: "Mặc định: 1080×1920, 30 fps, H.264, AAC, 25–35 giây. Kích thước/FPS/subtitle margin có thể đổi trong Settings; hãy nghe lại mức music/SFX trước khi duyệt.",
    errors: ["Scene thiếu image hoặc voice.", "Storyboard không đủ 5–7 scene hoặc duration ngoài 25–35 giây.", "Worker/FFmpeg không chạy.", "Media hỏng hoặc storage path không hợp lệ."], action: { href: "/dashboard/render-queue", label: "Mở Render Queue" },
  },
  {
    nav: "14. Kiểm tra video", title: "Kiểm tra và duyệt video", icon: "◎", status: "ready",
    intro: "Video chỉ được phép publish sau khi người dùng kiểm tra và Approve.", doing: "Mở Video Studio, xem MP4/SRT và quyết định Approve hoặc Reject.",
    tasks: ["Từ Render Queue hoặc Videos, nhấn Open video.", "☐ Nội dung chính xác và không sai chính tả.", "☐ Audio rõ; SRT đúng nội dung và timing.", "☐ Hình phù hợp, không bị cắt hoặc có frame lỗi.", "☐ Thời lượng phù hợp và video đúng tỷ lệ 9:16.", "Nhấn Approve hoặc Reject. Nếu Reject, sửa và Render again.", "Dùng Download để lưu bản MP4 đã render."],
    continueWhen: "Video có trạng thái approved. Nếu rejected, phải render lại trước khi duyệt lần nữa.", tip: "Đừng chỉ xem thumbnail; hãy phát toàn bộ video từ đầu đến cuối.",
    errors: ["Chỉ video ready_for_review có output mới Approve được.", "Nếu preview không tải, kiểm tra output path và media endpoint.", "Nếu render failed, xem logs và dùng Retry."], action: { href: "/dashboard/render-queue", label: "Mở video từ Render Queue" },
  },
  {
    nav: "15. Upload YouTube", title: "Xuất bản lên YouTube", icon: "▷", status: "unavailable", provider: "youtube",
    intro: "YouTube thật hiện chưa được cấu hình/kiểm chứng trong môi trường này.", doing: "Kiểm tra trạng thái provider; không dùng mock như một upload thật.",
    tasks: ["Đảm bảo video đã approved.", "Mở YouTube và kiểm tra provider status.", "Khi production đã cấu hình, kết nối channel bằng OAuth.", "Chọn private cho lần kiểm tra đầu tiên.", "Chỉ chọn public khi chủ động tick xác nhận."],
    continueWhen: "Hiện tại hãy bỏ qua bước này sau khi đã lưu MP4 local. Chỉ coi là hoàn thành khi real provider trả published và có YouTube video ID.", tip: "Mock publish luôn trả published:false và giữ video ở trạng thái approved. UI có title/description/tags/privacy; thumbnail upload chưa được triển khai.",
    errors: ["YouTube credentials NOT_CONFIGURED.", "OAuth callback/state hoặc channel không hợp lệ.", "Video chưa approved hoặc thiếu output.", "Authentication, permission hoặc quota error."], action: { href: "/dashboard/youtube", label: "Xem trạng thái YouTube" },
  },
  {
    nav: "Hoàn thành", title: "Bạn đã đi hết hướng dẫn", icon: "★", status: "ready",
    intro: "Kiểm tra lại các bước đã hoàn thành và các bước đã bỏ qua trước khi dùng video.", doing: "Xác nhận MP4 local đã được render và duyệt; YouTube chỉ được tính khi upload thật thành công.",
    tasks: ["Lesson và source đã sẵn sàng", "Analysis và script đã được kiểm tra", "Script đã approved", "Storyboard có image, voice và subtitle", "Render completed và video đã approved"],
    continueWhen: "Video local đã approved. Bước YouTube có thể vẫn là cảnh báo nếu môi trường chưa cấu hình.", tip: "Bạn có thể tạo video khác từ Lessons hoặc quay về Dashboard để xem số liệu.",
  },
];

const statusText: Record<GuideStatus, string> = {
  openai: "✨ OpenAI",
  ready: "Sẵn sàng",
  mock: "🧪 Mock",
  developing: "⚠️ Đang phát triển",
  unavailable: "⚠️ Chưa khả dụng",
};

function stepStatus(step: Step, providers: Record<string, Provider> | null): GuideStatus {
  if (!step.provider || !providers) return step.status;
  const provider = providers[step.provider];
  if (!provider) return step.status;
  if (step.provider === "youtube") return provider.configured && provider.provider !== "mock" ? "developing" : "unavailable";
  if (provider.provider === "mock") return "mock";
  if (step.provider === "analysis" && provider.configured && provider.runtimeVerified) return "openai";
  if (step.provider === "script" && provider.configured && provider.runtimeVerified) return "openai";
  return provider.configured ? "developing" : "unavailable";
}

export function HelpGuide() {
  const [current, setCurrent] = useState(0);
  const [completed, setCompleted] = useState<number[]>([]);
  const [skipped, setSkipped] = useState<number[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [providers, setProviders] = useState<Record<string, Provider> | null>(null);
  const [providerError, setProviderError] = useState("");

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(storageKey) || "null") as StoredProgress | null;
      if (stored) {
        setCompleted(Array.isArray(stored.completed) ? stored.completed.filter((value) => Number.isInteger(value) && value >= 1 && value <= 15) : []);
        setSkipped(Array.isArray(stored.skipped) ? stored.skipped.filter((value) => Number.isInteger(value) && value >= 1 && value <= 15) : []);
      }
    } catch { localStorage.removeItem(storageKey); }
    setLoaded(true);
    void fetch("/api/settings").then(async (response) => {
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Không tải được trạng thái provider");
      const analysisResponse = await fetch("/api/health/analysis");
      const analysis = analysisResponse.ok ? await analysisResponse.json() : null;
      const scriptResponse = await fetch("/api/health/script");
      const script = scriptResponse.ok ? await scriptResponse.json() : null;
      setProviders({ ...body.providers, ...(analysis ? { analysis } : {}), ...(script ? { script } : {}) });
    }).catch((error) => setProviderError(error instanceof Error ? error.message : "Không tải được trạng thái provider"));
  }, []);

  useEffect(() => {
    if (loaded) localStorage.setItem(storageKey, JSON.stringify({ completed, skipped } satisfies StoredProgress));
  }, [completed, loaded, skipped]);

  const handled = useMemo(() => new Set([...completed, ...skipped]).size, [completed, skipped]);
  const percent = Math.round(handled / 15 * 100);
  const step = steps[current];
  const availability = stepStatus(step, providers);
  const isWorkflowStep = current >= 1 && current <= 15;
  const finish = (kind: "complete" | "skip") => {
    if (!isWorkflowStep) return;
    if (kind === "complete") {
      setCompleted((items) => [...new Set([...items, current])]);
      setSkipped((items) => items.filter((item) => item !== current));
    } else {
      setSkipped((items) => [...new Set([...items, current])]);
      setCompleted((items) => items.filter((item) => item !== current));
    }
    setCurrent(Math.min(16, current + 1));
  };
  const reset = () => { setCompleted([]); setSkipped([]); setCurrent(0); };

  return <main className="content help-page">
    <Link className="link help-back" href="/dashboard">← Dashboard / Hướng dẫn sử dụng</Link>
    <header className="help-header">
      <div><p className="eyebrow">INTERACTIVE GUIDE</p><h1>Tạo video giáo dục đầu tiên</h1><p className="muted">Làm theo từng bước; tiến độ chỉ được lưu trên trình duyệt này.</p></div>
      <button type="button" onClick={reset}>Đặt lại tiến độ</button>
    </header>
    <div className="help-progress-summary">
      <div><b>{isWorkflowStep ? `Bước ${current} / 15` : current === 0 ? "Bắt đầu" : "Tổng kết"}</b><span>{handled}/15 bước đã xử lý · {percent}%</span></div>
      <div className="help-progress" role="progressbar" aria-label="Tiến độ hướng dẫn" aria-valuemin={0} aria-valuemax={100} aria-valuenow={percent}><i style={{ width: `${percent}%` }} /></div>
      <small className="help-progress-note">Đây là checklist cá nhân; trạng thái thật vẫn nằm trong Lesson, Script, Render Queue và Video Studio.</small>
    </div>
    {providerError && <p className="panel help-provider-warning" role="status">⚠️ Không đọc được trạng thái provider: {providerError}. Các nhãn bên dưới dùng kết quả audit gần nhất.</p>}

    <div className="help-layout">
      <nav className="help-step-nav" aria-label="Các bước hướng dẫn">
        {steps.map((item, index) => {
          const done = completed.includes(index); const omitted = skipped.includes(index); const selected = current === index; const state = done ? "completed" : omitted ? "warning" : selected ? "current" : "pending";
          return <button type="button" key={item.nav} className={`help-step-link ${state}`} aria-current={selected ? "step" : undefined} onClick={() => setCurrent(index)}><span aria-hidden="true">{done ? "✓" : omitted ? "!" : index === 0 ? "●" : index === 16 ? "★" : index}</span><span><b>{item.nav}</b><small>{done ? "Hoàn thành" : omitted ? "Đã bỏ qua" : selected ? "Đang xem" : statusText[stepStatus(item, providers)]}</small></span></button>;
        })}
      </nav>

      <section className="panel help-card" aria-labelledby="help-step-title">
        <div className="help-card-head"><span className="help-icon" aria-hidden="true">{step.icon}</span><div><p className="eyebrow">{isWorkflowStep ? `BƯỚC ${current}` : current === 0 ? "BẮT ĐẦU" : "HOÀN THÀNH"}</p><h2 id="help-step-title">{step.title}</h2></div><span className={`help-status ${availability}`}>{statusText[availability]}</span></div>
        <p className="help-intro">{step.intro}</p>

        {current === 0 && <div className="help-estimate"><div><span>Thời gian dự kiến</span><b>10–20 phút</b></div><div><span>Kết quả</span><b>MP4 dọc đã duyệt</b></div></div>}

        <div className="help-context-grid">
          <article><h3>Bạn đang làm gì?</h3><p>{step.doing}</p></article>
          <article><h3>Bạn cần làm gì?</h3><ol>{step.tasks.map((task) => <li key={task}>{task}</li>)}</ol></article>
          <article><h3>Khi nào được tiếp tục?</h3><p>{step.continueWhen}</p></article>
        </div>

        {step.tip && <div className="help-tip"><b>💡 Mẹo</b><p>{step.tip}</p></div>}
        {availability === "mock" && <div className="help-notice mock"><b>🧪 Đang dùng Mock</b><p>Kết quả giúp kiểm tra pipeline, không phải nội dung AI production.</p></div>}
        {availability === "unavailable" && <div className="help-notice unavailable"><b>⚠️ Chưa khả dụng</b><p>Không đánh dấu bước này là hoàn thành thật. Bạn có thể bỏ qua để hoàn tất video local.</p></div>}
        {availability === "developing" && <div className="help-notice developing"><b>⚠️ Đang phát triển</b><p>Provider có cấu hình nhưng luồng real chưa được xác minh end-to-end trong bản audit hiện tại.</p></div>}

        {step.errors?.length ? <details className="help-errors"><summary>Không thể tiếp tục? Xem cách xử lý lỗi</summary><ul>{step.errors.map((error) => <li key={error}>{error}</li>)}</ul></details> : null}

        {current === 16 && <div className="help-finish-list" aria-label="Tổng kết tiến độ">{steps.slice(1, 16).map((item, index) => { const number = index + 1; const done = completed.includes(number); const omitted = skipped.includes(number); return <div key={item.nav} className={done ? "done" : "warning"}><span>{done ? "✓" : omitted ? "!" : "○"}</span><span><b>{item.nav}</b><small>{done ? "Đã hoàn thành" : omitted ? "Đã bỏ qua / chưa khả dụng" : "Chưa xác nhận"}</small></span></div>; })}</div>}

        <div className="help-actions">
          {current > 0 && <button type="button" onClick={() => setCurrent(current - 1)}>← Quay lại</button>}
          {step.action && <Link className="help-feature-link" href={step.action.href}>🚀 {step.action.label} →</Link>}
          <span className="help-action-spacer" />
          {current === 0 && <button className="primary" type="button" onClick={() => setCurrent(1)}>Bắt đầu →</button>}
          {isWorkflowStep && <button type="button" onClick={() => finish("skip")}>{availability === "unavailable" ? "Bỏ qua bước chưa khả dụng" : "Bỏ qua"}</button>}
          {isWorkflowStep && availability !== "unavailable" && <button className="primary" type="button" onClick={() => finish("complete")}>Đã hoàn thành →</button>}
          {current === 16 && <><Link href="/dashboard/render-queue">Mở Render Queue</Link><Link href="/dashboard/lessons">Tạo video khác</Link><Link className="primary" href="/dashboard">Về Dashboard</Link></>}
        </div>
      </section>
    </div>
  </main>;
}
