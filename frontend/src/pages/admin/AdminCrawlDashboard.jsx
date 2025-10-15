import React, { useState } from "react";
import CrawlHeader from "../../components/admin/CrawlHeader";
import CrawlInput from "../../components/admin/CrawlInput";
import CrawlConsole from "../../components/admin/CrawlConsole";
import CrawlStats from "../../components/admin/CrawlStats";
import "../../styles/CrawlDashboard.css";

export default function AdminCrawlDashboard() {
  const [url, setUrl] = useState("");
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);

  const addLog = (message, type = "info") => {
    const timestamp = new Date().toLocaleTimeString("vi-VN");
    setLogs((prev) => [...prev, { message, type, timestamp, id: Date.now() }]);
  };

  const clearLogs = () => setLogs([]);

  const logCounts = {
    success: logs.filter((l) => l.type === "success").length,
    warning: logs.filter((l) => l.type === "warning").length,
    error: logs.filter((l) => l.type === "error").length,
    total: logs.length,
  };
  
  return (
    <div className="crawl-root">
      <div className="crawl-container">
        <CrawlHeader />
        <div className="crawl-panel">
          <CrawlInput
            url={url}
            setUrl={setUrl}
            isLoading={isLoading}
            setIsLoading={setIsLoading}
            addLog={addLog}
          />
          <CrawlConsole logs={logs} clearLogs={clearLogs} />
        </div>
      </div>
      <CrawlStats logs={logs} />
    </div>
  );
}
