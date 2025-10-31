import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

dayjs.extend(relativeTime);

function RecentActivity({activities}) {
 
  const sorted = activities? activities.sort((a, b) => new Date(b.created_date) - new Date(a.created_date)): [];

  return (
    <div className="recent-activity">
      <h3>Recent Activity</h3>
      <ul>
        {sorted && sorted.map((a, i) => (
          <li key={i}>
            {<strong>{dayjs(a.created_date).fromNow()}</strong>}
            {` – A account with email ${a.email} was created.`}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default RecentActivity;
