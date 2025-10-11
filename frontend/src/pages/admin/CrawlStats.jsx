import "../../styles/CrawlDashboard.css";

export default function CrawlStats({ logs }) {
  const success = logs.filter((l) => l.type === "success").length;
  const warn = logs.filter((l) => l.type === "warning").length;
  const error = logs.filter((l) => l.type === "error").length;
  const total = logs.length;

  return (
    <div className="crawl-stats">
      <div className="crawl-stat crawl-stat--success">
        <div className="crawl-stat__number">{success}</div>
        <div className="crawl-stat__label">Thành công</div>
      </div>
      <div className="crawl-stat crawl-stat--warning">
        <div className="crawl-stat__number">{warn}</div>
        <div className="crawl-stat__label">Cảnh báo</div>
      </div>
      <div className="crawl-stat crawl-stat--error">
        <div className="crawl-stat__number">{error}</div>
        <div className="crawl-stat__label">Lỗi</div>
      </div>
      <div className="crawl-stat crawl-stat--total">
        <div className="crawl-stat__number">{total}</div>
        <div className="crawl-stat__label">Tổng log</div>
      </div>
    </div>
  );
}
