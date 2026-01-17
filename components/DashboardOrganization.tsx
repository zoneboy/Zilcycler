import React, { useState, useMemo } from 'react';
import { User, Screen, PickupTask } from '../types';
import { useApp } from '../context/AppContext';
import WalletCard from './WalletCard';
import { Truck, FileBadge, BarChart3, Building2, Download, ChevronRight, ArrowLeft } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface Props {
  user: User;
  onNavigate: (screen: Screen) => void;
}

const COLORS = ['#4ade80', '#60a5fa', '#facc15', '#94a3b8', '#fb7185', '#a78bfa'];

const DashboardOrganization: React.FC<Props> = ({ user, onNavigate }) => {
  const { getPickupsByRole, blogPosts } = useApp();
  const [showAnalytics, setShowAnalytics] = useState(false);

  // Dynamic Calculations
  const myPickups = getPickupsByRole(user.role, user.id);
  const completedPickups = myPickups.filter(p => p.status === 'Completed');

  const earnedZoints = completedPickups.reduce((sum, p) => sum + (p.earnedZoints || 0), 0);
  const currentBalance = user.zointsBalance + earnedZoints;
  const totalRecycled = (user.totalRecycledKg || 0) + completedPickups.reduce((sum, p) => sum + (p.weight || 0), 0);

  // Get the latest tip for the dashboard teaser
  const latestTip = blogPosts.length > 0 ? blogPosts[0] : null;

  // Chart Data Calculations
  const { monthlyData, compositionData } = useMemo(() => {
      // 1. Monthly Data
      const monthly: {[key: string]: number} = {};
      completedPickups.forEach(p => {
          const date = new Date(p.date);
          if (!isNaN(date.getTime())) {
              const month = date.toLocaleString('default', { month: 'short' });
              monthly[month] = (monthly[month] || 0) + (p.weight || 0);
          }
      });
      const mData = Object.entries(monthly).map(([name, value]) => ({ name, value }));

      // 2. Composition Data
      const comp: {[key: string]: number} = {};
      completedPickups.forEach(p => {
          if (p.collectionDetails) {
              p.collectionDetails.forEach(d => {
                  comp[d.category] = (comp[d.category] || 0) + d.weight;
              });
          } else {
              // Fallback
              const cat = p.items.split(',')[0].trim() || 'Unsorted';
              comp[cat] = (comp[cat] || 0) + (p.weight || 0);
          }
      });
      const cData = Object.entries(comp).map(([name, value], idx) => ({ 
          name, 
          value, 
          color: COLORS[idx % COLORS.length] 
      }));

      return { monthlyData: mData, compositionData: cData };
  }, [completedPickups]);

  if (showAnalytics) {
      return (
          <div className="space-y-6 pb-24 animate-fade-in">
              <div className="flex items-center gap-2 mb-4">
                  <button onClick={() => setShowAnalytics(false)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
                      <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                  </button>
                  <h1 className="text-xl font-bold text-gray-900 dark:text-white">Impact Analytics</h1>
              </div>

              {/* Total Summary */}
              <div className="bg-purple-900 text-white p-6 rounded-3xl shadow-lg relative overflow-hidden">
                   <div className="absolute top-0 right-0 w-32 h-32 bg-purple-600 rounded-full blur-3xl opacity-50 -mr-10 -mt-10"></div>
                   <div className="relative z-10">
                       <p className="text-purple-200 text-sm font-medium mb-1">Total Recycled Volume</p>
                       <h2 className="text-4xl font-bold mb-4">{totalRecycled.toLocaleString()} kg</h2>
                       <div className="flex gap-4">
                           <div>
                               <span className="text-2xl font-bold block text-green-400">{(totalRecycled * 1.2 / 1000).toFixed(1)}t</span>
                               <span className="text-xs text-purple-200">CO2 Saved</span>
                           </div>
                           <div>
                               <span className="text-2xl font-bold block text-blue-400">{(totalRecycled * 5).toLocaleString()}</span>
                               <span className="text-xs text-purple-200">KwH Energy</span>
                           </div>
                       </div>
                   </div>
              </div>

              {/* Monthly Trend */}
              <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 transition-colors">
                  <div className="flex justify-between items-center mb-6">
                    <h3 className="font-bold text-gray-800 dark:text-white">Monthly Trend</h3>
                  </div>
                  <div className="h-64">
                    {monthlyData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={monthlyData}>
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#9ca3af'}} />
                                <Tooltip 
                                    cursor={{fill: '#f3f4f6'}} 
                                    contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} 
                                    wrapperClassName="dark:!bg-gray-700 dark:!text-white"
                                />
                                <Bar dataKey="value" fill="#8b5cf6" radius={[4, 4, 0, 0]} barSize={32} />
                            </BarChart>
                        </ResponsiveContainer>
                    ) : (
                        <div className="flex h-full items-center justify-center text-gray-400">No data available</div>
                    )}
                  </div>
              </div>

              {/* Composition */}
              <div className="bg-white dark:bg-gray-800 p-6 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 transition-colors">
                  <h3 className="font-bold text-gray-800 dark:text-white mb-2">Waste Composition</h3>
                  <div className="h-64 relative">
                    {compositionData.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie
                                    data={compositionData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={60}
                                    outerRadius={80}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {compositionData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Pie>
                                <Tooltip />
                                <Legend verticalAlign="bottom" height={36} iconType="circle" />
                            </PieChart>
                        </ResponsiveContainer>
                    ) : (
                         <div className="flex h-full items-center justify-center text-gray-400">No data available</div>
                    )}
                     {compositionData.length > 0 && (
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            <div className="text-center">
                                <span className="text-xs text-gray-400 font-bold uppercase">Total</span>
                                <p className="text-xl font-bold text-gray-800 dark:text-white">{totalRecycled}kg</p>
                            </div>
                        </div>
                     )}
                  </div>
              </div>
          </div>
      );
  }

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{user.name}</h1>
          <div className="flex items-center gap-1 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded-md inline-flex mt-1">
             <Building2 className="w-3 h-3" />
             <span className="text-xs font-bold uppercase tracking-wide">Corporate Account</span>
          </div>
        </div>
        {user.avatar ? (
            <img 
              src={user.avatar} 
              alt="Profile" 
              className="w-12 h-12 rounded-lg border-2 border-blue-100 dark:border-blue-900 object-cover"
            />
        ) : (
            <div className="w-12 h-12 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-700 dark:text-blue-400 border-2 border-blue-50 dark:border-blue-800">
                <Building2 className="w-6 h-6" />
            </div>
        )}
      </div>

      {/* Wallet - Organizations earn points too */}
      <WalletCard user={user} balance={currentBalance} />

      {/* Corporate Stats */}
      <div className="grid grid-cols-2 gap-4">
         <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 transition-colors">
             <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-1">Total Recycled</p>
             <span className="text-2xl font-bold text-gray-900 dark:text-white">{totalRecycled.toLocaleString()} kg</span>
         </div>
         <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 transition-colors">
             <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mb-1">ESG Score</p>
             <span className="text-2xl font-bold text-green-600 dark:text-green-500">{user.esgScore || 'N/A'}</span>
         </div>
      </div>

       {/* Pickup Requests Widget */}
       <div className="space-y-3">
        <h3 className="font-bold text-gray-800 dark:text-white text-sm uppercase tracking-wide">Pickup Request History</h3>
        <button 
            onClick={() => onNavigate(Screen.PICKUP_HISTORY)}
            className="w-full bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-between group hover:border-blue-200 dark:hover:border-blue-800 transition-all"
        >
            <div className="flex items-center gap-4">
                 <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                    <Truck className="w-6 h-6" />
                 </div>
                 <div className="text-left">
                     <h3 className="font-bold text-gray-900 dark:text-white">Track Corporate Pickups</h3>
                     <p className="text-xs text-gray-500 dark:text-gray-400">
                        {myPickups.filter(p => p.status !== 'Completed').length} Assigned • {completedPickups.length} Completed
                     </p>
                 </div>
            </div>
            <div className="flex items-center gap-2">
                 <span className="text-xs font-bold text-blue-600 dark:text-blue-400 group-hover:underline">View History</span>
                 <ChevronRight className="w-5 h-5 text-gray-300 dark:text-gray-600 group-hover:text-blue-600" />
            </div>
        </button>
      </div>

      {/* Organization Actions */}
      <div className="space-y-4">
        <h3 className="font-bold text-gray-800 dark:text-white">Business Tools</h3>
        
        <button 
          onClick={() => onNavigate(Screen.SCHEDULE_PICKUP)}
          className="w-full group flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 hover:border-green-200 dark:hover:border-green-800 hover:bg-green-50 dark:hover:bg-green-900/10 transition-all"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 flex items-center justify-center">
              <Truck className="w-6 h-6" />
            </div>
            <div className="text-left">
              <h3 className="font-bold text-gray-800 dark:text-white group-hover:text-green-800 dark:group-hover:text-green-300">Request Bulk Pickup</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Schedule large volume collection</p>
            </div>
          </div>
          <ChevronRight className="text-gray-300 dark:text-gray-600 group-hover:text-green-600 dark:group-hover:text-green-400" />
        </button>

        <button 
          onClick={() => onNavigate(Screen.CERTIFICATES)}
          className="w-full group flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 hover:border-blue-200 dark:hover:border-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-all"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 flex items-center justify-center">
              <FileBadge className="w-6 h-6" />
            </div>
            <div className="text-left">
              <h3 className="font-bold text-gray-800 dark:text-white group-hover:text-blue-800 dark:group-hover:text-blue-300">Sustainability Certificate</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Download monthly ESG reports</p>
            </div>
          </div>
          <ChevronRight className="text-gray-300 dark:text-gray-600 group-hover:text-blue-600 dark:group-hover:text-blue-400 w-5 h-5" />
        </button>

        <button 
           onClick={() => setShowAnalytics(true)}
           className="w-full group flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 hover:border-purple-200 dark:hover:border-purple-800 hover:bg-purple-50 dark:hover:bg-purple-900/10 transition-all"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 flex items-center justify-center">
              <BarChart3 className="w-6 h-6" />
            </div>
            <div className="text-left">
              <h3 className="font-bold text-gray-800 dark:text-white group-hover:text-purple-800 dark:group-hover:text-purple-300">Impact Analytics</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">View detailed waste breakdown</p>
            </div>
          </div>
          <ChevronRight className="text-gray-300 dark:text-gray-600 group-hover:text-purple-600 dark:group-hover:text-purple-400" />
        </button>
      </div>

      {/* Dynamic Educational Content Teaser */}
      {latestTip && (
        <div className="bg-stone-100 dark:bg-gray-800 rounded-3xl p-5 relative overflow-hidden transition-colors">
          <div className="relative z-10">
            <h3 className="font-bold text-gray-800 dark:text-white text-lg mb-2">{latestTip.title}</h3>
            <div className="flex gap-4">
               <img src={latestTip.image} className="w-20 h-20 rounded-xl object-cover" alt="Tip" />
               <div className="flex-1">
                 <p className="text-sm text-gray-600 dark:text-gray-300 mb-3 font-medium line-clamp-2">{latestTip.excerpt}</p>
                 <button 
                  onClick={() => onNavigate(Screen.BLOG)}
                  className="bg-white dark:bg-gray-700 px-4 py-2 rounded-full text-xs font-bold text-gray-800 dark:text-white shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                 >
                   Read More
                 </button>
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardOrganization;