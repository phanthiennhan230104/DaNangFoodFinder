import React, { useState } from "react";
import CrawlHeader from "./CrawlHeader";
import CrawlInput from "./CrawlInput";
import CrawlConsole from "./CrawlConsole";
import CrawlStats from "./CrawlStats";
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
