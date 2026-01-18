import React, { useState } from 'react';
import { User, Screen, RecycledBreakdown } from '../types';
import { useApp } from '../context/AppContext';
import WalletCard from './WalletCard';
import { Truck, MapPin, ChevronRight, Scale, Leaf, X, Clock, User as UserIcon } from 'lucide-react';

interface Props {
  user: User;
  onNavigate: (screen: Screen) => void;
}

const DashboardHousehold: React.FC<Props> = ({ user, onNavigate }) => {
  const { getPickupsByRole, blogPosts, wasteRates } = useApp();
  const [showBreakdown, setShowBreakdown] = useState(false);

  // Get real pickup counts and derive stats
  const myPickups = getPickupsByRole(user.role, user.id);
  const activeCount = myPickups.filter(p => p.status === 'Pending' || p.status === 'Assigned').length;
  const completedCount = myPickups.filter(p => p.status === 'Completed').length;
  
  const completedPickups = myPickups.filter(p => p.status === 'Completed');
  const sessionRecycledKg = completedPickups.reduce((acc, curr) => acc + (curr.weight || 0), 0);
  
  // NOTE: user.zointsBalance comes from the database which is already updated when pickups complete.
  // We do NOT need to add session earnings to it again.
  const displayZoints = user.zointsBalance;

  // For Recycled Kg, the backend currently does not aggregate this in the users table automatically on pickup complete,
  // so we calculate it from the pickups list. Assuming user.totalRecycledKg is 0 or historical data.
  const displayRecycled = (user.totalRecycledKg || 0) + sessionRecycledKg;

  // Calculate Dynamic CO2 Saved
  const calculateTotalCO2 = () => {
      let co2 = 0;
      
      // 1. Calculate from detailed current session pickups
      completedPickups.forEach(p => {
          if (p.collectionDetails) {
              p.collectionDetails.forEach(d => {
                  const rate = wasteRates[d.category]?.co2 || 0.5; // Default 0.5 if not found
                  co2 += d.weight * rate;
              });
          } else if (p.weight) {
              // Fallback for simple pickups (estimate using 'Other' or average)
              const cat = p.items.split(',')[0].trim();
              const matchedKey = Object.keys(wasteRates).find(k => cat.includes(k));
              const rate = matchedKey ? wasteRates[matchedKey].co2 : 0.5;
              co2 += p.weight * rate;
          }
      });

      // 2. Add historical data estimate
      if (user.recycledBreakdown) {
          user.recycledBreakdown.forEach(item => {
              const rate = wasteRates[item.category]?.co2 || 0.5;
              co2 += item.weight * rate;
          });
      } else {
          // If no breakdown, assume a blended average (e.g. 1.0)
          co2 += (user.totalRecycledKg || 0) * 1.0; 
      }

      return co2;
  };

  const totalCO2Saved = calculateTotalCO2();

  // Get the latest tip for the dashboard teaser
  const latestTip = blogPosts.length > 0 ? blogPosts[0] : null;

  // Calculate Dynamic Breakdown for Modal
  const getAggregatedBreakdown = (): RecycledBreakdown[] => {
      // 1. Start with user's historical breakdown map
      const breakdownMap = new Map<string, number>();
      user.recycledBreakdown?.forEach(item => {
          breakdownMap.set(item.category, item.weight);
      });

      // 2. Add current session detailed items
      completedPickups.forEach(p => {
          if (p.collectionDetails) {
              p.collectionDetails.forEach(detail => {
                  const current = breakdownMap.get(detail.category) || 0;
                  breakdownMap.set(detail.category, current + detail.weight);
              });
          } else if (p.weight) {
               // Fallback if no details but weight exists (legacy data or simple entry)
               const cat = p.items.split(',')[0].trim() || 'Other'; 
               const current = breakdownMap.get(cat) || 0;
               breakdownMap.set(cat, current + p.weight);
          }
      });

      // 3. Convert back to array
      return Array.from(breakdownMap.entries()).map(([category, weight]) => ({ category, weight }));
  };

  const currentBreakdown = getAggregatedBreakdown();

  return (
    <div className="space-y-6 pb-24">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Welcome, {user.name.split(' ')[0]}!</h1>
          <p className="text-gray-500 text-sm dark:text-gray-400">Let's make the world cleaner.</p>
        </div>
        {user.avatar ? (
            <img 
              src={user.avatar} 
              alt="Profile" 
              className="w-12 h-12 rounded-full border-2 border-green-100 dark:border-green-900 object-cover"
            />
        ) : (
            <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-700 dark:text-green-400 border-2 border-green-50 dark:border-green-800">
                <UserIcon className="w-6 h-6" />
            </div>
        )}
      </div>

      {/* Wallet - Now reactive */}
      <WalletCard user={user} balance={displayZoints} />

      {/* Impact Stats - Now reactive */}
      <div className="grid grid-cols-2 gap-4">
        <div 
          onClick={() => setShowBreakdown(true)}
          className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col justify-center cursor-pointer active:scale-95 transition-all hover:border-green-200 dark:hover:border-green-800"
        >
             <div className="flex items-center gap-2 mb-2 text-green-700 dark:text-green-400">
                <Scale className="w-5 h-5" />
                <span className="text-xs font-bold uppercase tracking-wide">Recycled</span>
             </div>
             <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-gray-900 dark:text-white">{displayRecycled.toFixed(1)}</span>
                <span className="text-sm font-medium text-gray-400">kg</span>
             </div>
             <p className="text-[10px] text-green-600 dark:text-green-500 mt-1 font-medium">Tap for details</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex flex-col justify-center transition-colors">
             <div className="flex items-center gap-2 mb-2 text-teal-600 dark:text-teal-400">
                <Leaf className="w-5 h-5" />
                <span className="text-xs font-bold uppercase tracking-wide">CO₂ Saved</span>
             </div>
             <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-gray-900 dark:text-white">{totalCO2Saved.toFixed(1)}</span>
                <span className="text-sm font-medium text-gray-400">kg</span>
             </div>
        </div>
      </div>

      {/* Pickup Requests Widget */}
      <div className="space-y-3">
        <h3 className="font-bold text-gray-800 dark:text-white text-sm uppercase tracking-wide">Pickup Requests</h3>
        <button 
            onClick={() => onNavigate(Screen.PICKUP_HISTORY)}
            className="w-full bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 flex items-center justify-between group hover:border-green-200 dark:hover:border-green-800 transition-all"
        >
            <div className="flex items-center gap-4">
                 <div className="w-12 h-12 rounded-xl bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 flex items-center justify-center">
                    <Clock className="w-6 h-6" />
                 </div>
                 <div className="text-left">
                     <h3 className="font-bold text-gray-900 dark:text-white">Track Requests</h3>
                     <p className="text-xs text-gray-500 dark:text-gray-400">{activeCount} Active • {completedCount} Completed</p>
                 </div>
            </div>
            <div className="flex items-center gap-2">
                 <span className="text-xs font-bold text-green-600 dark:text-green-400 group-hover:underline">View All</span>
                 <ChevronRight className="w-5 h-5 text-gray-300 dark:text-gray-600 group-hover:text-green-600" />
            </div>
        </button>
      </div>

      {/* Actions */}
      <div className="grid gap-4">
        <button 
          onClick={() => onNavigate(Screen.SCHEDULE_PICKUP)}
          className="group flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 hover:border-green-200 dark:hover:border-green-800 hover:bg-green-50 dark:hover:bg-green-900/10 transition-all"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 flex items-center justify-center">
              <Truck className="w-6 h-6" />
            </div>
            <div className="text-left">
              <h3 className="font-bold text-gray-800 dark:text-white group-hover:text-green-800 dark:group-hover:text-green-300">Schedule Pickup</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">We collect from your door</p>
            </div>
          </div>
          <ChevronRight className="text-gray-300 dark:text-gray-600 group-hover:text-green-600 dark:group-hover:text-green-400" />
        </button>

        <button 
          onClick={() => onNavigate(Screen.DROP_OFF)}
          className="group flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 hover:border-green-200 dark:hover:border-green-800 hover:bg-green-50 dark:hover:bg-green-900/10 transition-all"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 flex items-center justify-center">
              <MapPin className="w-6 h-6" />
            </div>
            <div className="text-left">
              <h3 className="font-bold text-gray-800 dark:text-white group-hover:text-teal-800 dark:group-hover:text-teal-300">Find Drop-Off</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400">Locate nearby centers</p>
            </div>
          </div>
          <ChevronRight className="text-gray-300 dark:text-gray-600 group-hover:text-teal-600 dark:group-hover:text-teal-400" />
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

      {/* Breakdown Modal */}
      {showBreakdown && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
           {/* Backdrop */}
           <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setShowBreakdown(false)}></div>
           
           {/* Content */}
           <div className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-xs p-6 relative z-10 shadow-2xl animate-fade-in-up transition-colors max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6">
                 <h2 className="text-xl font-bold text-gray-800 dark:text-white">Your Impact</h2>
                 <button onClick={() => setShowBreakdown(false)} className="p-2 bg-gray-100 dark:bg-gray-800 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">
                    <X className="w-5 h-5 text-gray-600 dark:text-gray-400" />
                 </button>
              </div>

              <div className="space-y-3">
                 {currentBreakdown.map((item) => (
                    <div key={item.category} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700">
                        <span className="text-gray-600 dark:text-gray-300 font-medium">{item.category}</span>
                        <span className="text-green-700 dark:text-green-400 font-bold">{item.weight.toFixed(1)} kg</span>
                    </div>
                 ))}
                 
                 <div className="flex justify-between items-center p-3 mt-4 bg-green-50 dark:bg-green-900/20 rounded-xl border border-green-100 dark:border-green-900/30">
                    <span className="text-green-800 dark:text-green-300 font-bold">Total Recycled</span>
                    <span className="text-green-800 dark:text-green-300 font-bold text-lg">{displayRecycled.toFixed(1)} kg</span>
                 </div>
              </div>
           </div>
        </div>
      )}

    </div>
  );
};

export default DashboardHousehold;