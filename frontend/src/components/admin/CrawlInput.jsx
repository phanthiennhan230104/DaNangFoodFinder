import { useState, useEffect } from "react";
import "../../styles/admin/CrawlDashboard.css";
import { ACCESS_TOKEN } from "../../constants";

export default function CrawlInput({ url, setUrl, isLoading, setIsLoading, addLog }) {
  const [placeType, setPlaceType] = useState("restaurant");
  const [pageNumber, setPageNumber] = useState("1");

  const placeTypeConfig = {
    // Foody sources
    restaurant: {
      label: "Restaurant",
      fullLabel: "Foody - Restaurant",
      source: "Foody",
      path: "/nha-hang"
    },
    junkfood: {
      label: "Junk Food",
      fullLabel: "Foody - Junk Food",
      source: "Foody",
      path: "/an-vat-via-he"
    },
    eating: {
      label: "Eating",
      fullLabel: "Foody - Eating",
      source: "Foody",
      path: "/quan-an"
    },
    drink: {
      label: "Drink",
      fullLabel: "Foody - Drink",
      source: "Foody",
      path: "/cafe"
    },
    // Restaurant Guru source
    restaurantguru: {
      label: "Restaurant Guru",
      fullLabel: "Restaurant Guru - Da Nang",
      source: "RestaurantGuru",
      customUrl: "https://restaurantguru.com/Da-Nang"
    }
  };

  // Auto generate URL when type or page changes
  useEffect(() => {
    const config = placeTypeConfig[placeType];
    if (config) {
      if (config.customUrl) {
        // For Restaurant Guru - pagination is /Da-Nang/2, /Da-Nang/3, etc.
        if (pageNumber > 1) {
          setUrl(`${config.customUrl}/${pageNumber}`);
        } else {
          setUrl(config.customUrl);
        }
      } else {
        // For Foody
        const generatedUrl = `https://www.foody.vn/da-nang/food${config.path}?page=${pageNumber}`;
        setUrl(generatedUrl);
      }
    }
  }, [placeType, pageNumber]);

  // Kiểm tra xem log có phải là về nhà hàng không
  const isRestaurantLog = (line) => {
    return /\[RESTAURANT_SUCCESS\]|\[RESTAURANT_FAIL\]/i.test(line);
  };

  // Xác định loại log
  const getLogType = (line) => {
    if (/\[RESTAURANT_SUCCESS\]/i.test(line)) return "success";
    if (/\[RESTAURANT_FAIL\]/i.test(line)) return "error";
    return "info";
  };

  // Format tên nhà hàng từ log
  const formatRestaurantLog = (line) => {
    const successMatch = line.match(/\[RESTAURANT_SUCCESS\]\s*(.+)/i);
    const failMatch = line.match(/\[RESTAURANT_FAIL\]\s*(.+)/i);
    
    if (successMatch) return `✅ ${successMatch[1]}`;
    if (failMatch) return `❌ ${failMatch[1]}`;
    return line;
  };

  const simulateCrawl = async () => {
    if (!url.trim()) {
      addLog("⚠️ Please enter a valid URL", "warning");
      return;
    }

    setIsLoading(true);
    addLog(`🔗 Sending crawl request for URL: ${url}`, "info");

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
        addLog("❌ Unauthorized: please log in again.", "error");
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
          // Chỉ hiển thị log về nhà hàng
          if (!isRestaurantLog(line)) return;
          const type = getLogType(line);
          const formattedMessage = formatRestaurantLog(line);
          addLog(formattedMessage, type);
        });
      }
    } catch (err) {
      addLog(`❌ Error calling API: ${err.message}`, "error");
    }

    setIsLoading(false);
  };

  return (
    <div>
      <div className="crawl-titlebar">Configure Crawl Settings</div>
      
      {/* Place Type Selector */}
      <div className="crawl-config-section">
        <label className="crawl-config-label">Place Type:</label>
        <select
          value={placeType}
          onChange={(e) => setPlaceType(e.target.value)}
          disabled={isLoading}
          className="crawl-select-input"
        >
          {Object.entries(placeTypeConfig).map(([key, config]) => (
            <option key={key} value={key}>
              {config.fullLabel}
            </option>
          ))}
        </select>
      </div>

      {/* Page Number Input */}
      <div className="crawl-config-section">
        <label className="crawl-config-label">Page Number:</label>
        <input
          type="number"
          min="1"
          value={pageNumber}
          onChange={(e) => setPageNumber(e.target.value)}
          placeholder="Enter page number"
          className="crawl-page-input"
          disabled={isLoading}
        />
      </div>

      {/* Generated URL Display */}
      <div className="crawl-config-section">
        <label className="crawl-config-label">Generated URL:</label>
        <div className="crawl-input">
          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="URL will be generated automatically..."
            className="crawl-input__control"
            disabled={isLoading}
          />
          <button
            onClick={simulateCrawl}
            disabled={isLoading}
            className="crawl-btn crawl-btn--primary"
          >
            {isLoading ? "Crawling..." : "Start Crawl"}
          </button>
        </div>
      </div>
    </div>
  );
}
