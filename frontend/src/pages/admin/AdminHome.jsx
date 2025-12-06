import { useEffect, useState } from "react";
import AdminLayout from "../../components/admin/AdminLayout";
import RecentActivity from "../../components/admin/RecentActivity";
import StatsGrid from "../../components/admin/StatsGrid";
import WelcomeSection from "../../components/admin/WelcomeSection";
import api from "../../api";
import {
  FaCheckCircle,
  FaCogs,
  FaComments,
  FaHome,
  FaUsers,
} from "react-icons/fa";
import "../../styles/admin/AdminHome.css";

function AdminHome() {
  const [data, setData] = useState([
    { label: "Total Users", value: "Loading", icon: <FaUsers /> },
    { label: "Restaurants", value: "Loading", icon: <FaHome /> },
    { label: "Feedbacks", value: "Loading", icon: <FaComments /> },
  ]);

  const [activities, setActivities] = useState([]);

  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/overview");
        if (res.status === 200) {
          const d = res.data;

          console.log(d);

          setData((pre) => {
            const newData = [...pre];
            newData[0].value = d?.total ?? "Loading";
            newData[1].value = d?.restaurant ?? "Loading";
            newData[2].value = d?.feedback ?? "Loading";
            return newData;
          });
          setActivities(d?.data || []);
        }
      } catch (error) {

        console.log("err: ",error);
        
      }
    })();
  }, []);

  console.log(data);
  

  return (
    <AdminLayout>
      <div className="admin-dashboard">
        <WelcomeSection />
        <StatsGrid data={data} />
        <RecentActivity activities={activities} />
      </div>
    </AdminLayout>
  );
}

export default AdminHome;
