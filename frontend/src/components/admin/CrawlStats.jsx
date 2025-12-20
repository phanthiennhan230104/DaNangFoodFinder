import "../../styles/admin/CrawlDashboard.css";

export default function CrawlStats({ logs }) {
  const success = logs.filter((l) => l.type === "success").length;
  const error = logs.filter((l) => l.type === "error").length;

  return (
    <div className="crawl-stats">
      <div className="crawl-stat crawl-stat--success">
        <div className="crawl-stat__number">{success}</div>
        <div className="crawl-stat__label">Success</div>
      </div>
      <div className="crawl-stat crawl-stat--error">
        <div className="crawl-stat__number">{error}</div>
        <div className="crawl-stat__label">Fail</div>
      </div>
      <div className="crawl-stat crawl-stat--total">
        <div className="crawl-stat__number">{success}</div>
        <div className="crawl-stat__label">Total Success Restaurant</div>
      </div>
    </div>
  );
}
