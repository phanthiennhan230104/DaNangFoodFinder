import "../../styles/CrawlDashboard.css";
import { ACCESS_TOKEN } from "../../constants";

export default function CrawlInput({ url, setUrl, isLoading, setIsLoading, addLog }) {

  // Phân loại log theo nội dung (Việt + Anh + emoji)
  const getLogType = (line) => {
    const successRules = [
      /^\s*\[OK\]/i,
      /\bSUCCESS\b/i,
      /đã cào thành công/i,
      /hoàn tất|completed|done/i,
      /scraped and saved/i,
      /updated .* with detail/i,
      /saved html/i,
      /✅|✨/,
    ];
    const warningRules = [
      /\bWARNING\b/i,
      /⚠/u,
      /cảnh báo/i,
      /không có .* cần crawl/i,
      /\bskip(ped)?\b/i,
    ];
    const errorRules = [
      /\bERROR\b/i,
      /❌/u,
      /traceback/i,
      /exception/i,
      /unicodeencodeerror/i,
      /unauthorized/i,
      /modulenotfounderror/i,
      /timeout|timed out/i,
      /\bfailed\b/i,
    ];

    if (successRules.some((r) => r.test(line))) return "success";
    if (warningRules.some((r) => r.test(line))) return "warning";
    if (errorRules.some((r) => r.test(line))) return "error";
    return "info";
  };

  const simulateCrawl = async () => {
    if (!url.trim()) {
      addLog("⚠️ Vui lòng nhập URL hợp lệ", "warning");
      return;
    }

    setIsLoading(true);
    addLog(`🔗 Gửi request crawl với URL: ${url}`, "info");

    try {
      const token = localStorage.getItem(ACCESS_TOKEN);

      const response = await fetch("http://localhost:8000/api/admin/crawl/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": token ? `Bearer ${token}` : "",
        },
        body: JSON.stringify({ url }),
      });

      if (!response.ok && response.status === 401) {
        addLog("❌ Unauthorized: vui lòng đăng nhập lại.", "error");
        setIsLoading(false);
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder("utf-8");

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        chunk.split(/\r?\n/).forEach((raw) => {
          const line = raw.trim();
          if (!line) return;
          const type = getLogType(line);
          addLog(line, type);
        });
      }
    } catch (err) {
      addLog(`❌ Lỗi khi gọi API: ${err.message}`, "error");
    }

    setIsLoading(false);
  };

  return (
    <div>
      <div className="crawl-titlebar">Nhập URL cần cào dữ liệu</div>
      <div className="crawl-input">
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Ví dụ: https://www.foody.vn/da-nang/dia-diem..."
          className="crawl-input__control"
          disabled={isLoading}
        />
        <button
          onClick={simulateCrawl}
          disabled={isLoading}
          className="crawl-btn crawl-btn--primary"
        >
          {isLoading ? "Đang cào..." : "Cào dữ liệu"}
        </button>
      </div>
    </div>
  );
}
