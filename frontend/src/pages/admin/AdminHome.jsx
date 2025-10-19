import { useEffect, useState } from "react";
import AdminLayout from "../../components/admin/AdminLayout";
import QuickActions from "../../components/admin/QuickActions";
import RecentActivity from "../../components/admin/RecentActivity";
import StatsGrid from "../../components/admin/StatsGrid";
import WelcomeSection from "../../components/admin/WelcomeSection";
import "../../styles/admin/AdminHome.css";
import api from "../../api";
import { FaCheckCircle, FaCogs, FaUsers } from "react-icons/fa";

function AdminHome() {

  const [data,setData] = useState([
    { label: "Total Users", value: "Loading", icon: <FaUsers /> },
    { label: "Verified Accounts", value: "Loading", icon: <FaCheckCircle /> },
    { label: "Active Crawlers", value: "Loading", icon: <FaCogs /> },
  ])

  const [activities,setActivities] = useState([])

  useEffect(()=>{
    (async()=>{
      const res = await api.get("/overview")
      if(res.status === 200){
        const d = res.data
        setData(pre=>{
          const newData = [...pre]
          newData[0].value = d?.total ?? "Loading"
          newData[1].value =d?.active ?? "Loading"
          newData[2].value = d?.crawled ?? "Loading"
          return newData
        })
        setActivities(d?.data || [])
        
      }
      
    })()
  },[])

  return (
    <AdminLayout>
      <div className="admin-dashboard">
        <WelcomeSection />
        <StatsGrid data={data} />
        {/* <QuickActions /> */}
        <RecentActivity activities={activities} />
      </div>
    </AdminLayout>
  );
}

export default AdminHome;
