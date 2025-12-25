import React, { useState, useEffect } from "react";
import api from "../../api";

export default function CrawlProgress() {
  const [progressData, setProgressData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [isMinimized, setIsMinimized] = useState(false);

  console.log("CrawlProgress component mounted");

  const fetchProgress = async () => {
    try {
      console.log("Fetching crawl progress...");
      const response = await api.get("/admin/crawl/progress/");
      console.log("Response:", response.data);
      if (response.data.success) {
        setProgressData(response.data.data);
        setLastUpdate(new Date(response.data.timestamp));
        setError(null);
      }
    } catch (err) {
      console.error("Failed to fetch crawl progress:", err);
      setError("Cannot load crawl progress!");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchProgress();

    // Auto-refresh every 5 seconds
    const interval = setInterval(fetchProgress, 5000);

    return () => clearInterval(interval);
  }, []);

  const formatTime = (date) => {
    if (!date) return "";
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "Active":
        return "#10b981"; // green
      case "Reached limit":
        return "#f59e0b"; // orange
      default:
        return "#6b7280"; // gray
    }
  };

  if (loading) {
    return (
      <div className="crawl-progress-container">
        <div className="progress-header">
          <h3>📊 Crawler Processing</h3>
        </div>
        <div className="progress-loading">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="crawl-progress-container">
        <div className="progress-header">
          <h3>📊 Tiến Trình Cào Dữ Liệu</h3>
        </div>
        <div className="progress-error">{error}</div>
      </div>
    );
  }

  return (
    <div className={`crawl-progress-container ${isMinimized ? 'minimized' : ''}`}>
      <div className="progress-header" onClick={() => setIsMinimized(!isMinimized)}>
        <div className="progress-header-left">
          <h3>📊 Crawler Processing</h3>
          {lastUpdate && !isMinimized && (
            <span className="last-update">
              Last update: {formatTime(lastUpdate)}
            </span>
          )}
        </div>
        <button className="minimize-button" type="button">
          {isMinimized ? '▼' : '▲'}
        </button>
      </div>

      {!isMinimized && (
        <div className="progress-list">
        {progressData.length === 0 ? (
          <div className="no-data">No crawl data available</div>
        ) : (
          progressData.map((item, index) => (
            <div key={index} className="progress-item">
              <div className="progress-source">
                <span className="source-name">{item.source}</span>
                <span
                  className="source-status"
                  style={{ color: getStatusColor(item.status) }}
                >
                  {item.status}
                </span>
              </div>

              <div className="progress-details">
                <div className="detail-row">
                  <span className="detail-label">Pages Crawled:</span>
                  <span className="detail-value">
                    {item.max_page > 0 ? `Page ${item.max_page}` : "Not started"}
                  </span>
                </div>
                {item.max_page > 0 && (
                  <div className="detail-row">
                    <span className="detail-label">Latest URL:</span>
                    <span className="detail-value detail-url" title={item.latest_url}>
                      {item.latest_url.length > 50
                        ? `${item.latest_url.substring(0, 50)}...`
                        : item.latest_url}
                    </span>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        </div>
      )}
    </div>
  );
}
