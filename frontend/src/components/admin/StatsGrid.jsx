import { FaCheckCircle, FaCogs, FaDatabase, FaUsers } from "react-icons/fa";
import "../../styles/admin/StatGrid.css";


function StatsGrid({data}) {

  return (
    <div className="stats-grid" data-no-translate>
      {data.map((s, idx) => (
        <div key={idx} style={{cursor:"default"}} className="stat-card minimal">
          <div className="stat-icon">{s.icon}</div>
          <p style={{marginTop:"10px"}} className="stat-value">{s.value}</p>
          <span className="stat-label">{s.label}</span>
        </div>
      ))}
    </div>
  );
}

export default StatsGrid;
