import "../../styles/CrawlDashboard.css";

export default function CrawlConsole({ logs, clearLogs }) {
  const typeClass = (t) =>
    t === "success"
      ? "crawl-log--success"
      : t === "warning"
      ? "crawl-log--warning"
      : t === "error"
      ? "crawl-log--error"
      : "crawl-log--info";

  return (
    <div className="crawl-console">
      <div className="crawl-console__header">
        <span>Console Log</span>
        {logs.length > 0 && (
          <button className="crawl-console__clear" onClick={clearLogs}>
            Xóa log
          </button>
        )}
      </div>
      <div className="crawl-console__body">
        {logs.length === 0 ? (
          <p style={{ color: "#9aa0a6" }}>
            Chưa có log nào. Nhập URL và nhấn "Cào dữ liệu" để bắt đầu.
          </p>
        ) : (
          logs.map((log) => (
            <div key={log.id} className={`crawl-log ${typeClass(log.type)}`}>
              <span className="time">[{log.timestamp}]</span>
              <span>{log.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
