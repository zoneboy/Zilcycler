import React, { useState, useEffect } from 'react';
import { User, UserRole, PickupTask } from '../types';
import { useApp } from '../context/AppContext';
import { ArrowLeft, Clock, CheckCircle, CircleDashed, Truck, MapPin, Search, ChevronDown, Loader2, X, Phone, Package, ImageIcon } from 'lucide-react';

interface Props {
  user: User;
  onBack: () => void;
}

const BATCH_SIZE = 10;

const PickupHistory: React.FC<Props> = ({ user, onBack }) => {
  const { getPickupsByRole } = useApp();
  const [filter, setFilter] = useState<'All' | 'Pending' | 'Completed'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPickup, setSelectedPickup] = useState<PickupTask | null>(null);
  
  // Real active pickups from Context
  const activePickups = getPickupsByRole(user.role, user.id);

  // Combine logic: Use only real data for live environment
  const rawData = [...activePickups];

  // Pagination State
  const [visibleCount, setVisibleCount] = useState(BATCH_SIZE);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // Reset pagination when filters change
  useEffect(() => {
    setVisibleCount(BATCH_SIZE);
  }, [filter, searchQuery]);

  const filteredData = rawData.filter(item => {
    const matchesFilter = filter === 'All' || item.status === filter || (filter === 'Pending' && (item.status === 'Assigned' || item.status === 'Missed'));
    const matchesSearch = item.items.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const displayedData = filteredData.slice(0, visibleCount);
  const hasMore = visibleCount < filteredData.length;

  const handleLoadMore = () => {
    setIsLoadingMore(true);
    // Simulate network request
    setTimeout(() => {
        setVisibleCount(prev => prev + BATCH_SIZE);
        setIsLoadingMore(false);
    }, 800);
  };

  const getStatusColor = (status: string) => {
    switch(status) {
        case 'Pending': 
        case 'Assigned': return 'bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-700';
        case 'Completed': return 'bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700';
        case 'Missed': return 'bg-red-100 text-red-700 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700';
        default: return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400';
    }
  };

  return (
    <div className="space-y-6 pb-24 animate-fade-in h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2 sticky top-0 bg-gray-50 dark:bg-gray-900 z-10 py-2">
        <button onClick={onBack} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
          <ArrowLeft className="w-6 h-6 text-gray-600 dark:text-gray-300" />
        </button>
        <h1 className="text-xl font-bold text-gray-900 dark:text-white">Pickup History</h1>
      </div>

      {/* Search & Filter */}
      <div className="flex gap-2 mb-2">
        <div className="relative flex-1">
            <Search className="absolute left-3 top-3 text-gray-400 w-4 h-4" />
            <input 
                type="text" 
                placeholder="Search items..." 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm focus:outline-none focus:border-green-500 transition-colors dark:text-white"
            />
        </div>
        <div className="relative">
            <select 
                value={filter} 
                onChange={(e: any) => setFilter(e.target.value)}
                className="appearance-none bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 py-2.5 pl-4 pr-10 rounded-xl text-sm font-bold focus:outline-none focus:border-green-500"
            >
                <option value="All">All Status</option>
                <option value="Pending">Pending</option>
                <option value="Completed">Completed</option>
            </select>
            <ChevronDown className="absolute right-3 top-3 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* List */}
      <div className="space-y-4 flex-1 overflow-y-auto pb-4">
        {displayedData.length > 0 ? (
            <>
                {displayedData.map((pickup) => (
                    <div 
                        key={pickup.id} 
                        onClick={() => setSelectedPickup(pickup)}
                        className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 transition-colors animate-fade-in cursor-pointer hover:shadow-md hover:border-green-200 dark:hover:border-green-800"
                    >
                        <div className="flex justify-between items-start mb-3">
                            <div className="flex items-center gap-3">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${pickup.status === 'Completed' ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' : (pickup.status === 'Missed' ? 'bg-red-100 text-red-600' : 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400')}`}>
                                    {pickup.status === 'Completed' ? <CheckCircle className="w-5 h-5" /> : <Truck className="w-5 h-5" />}
                                </div>
                                <div>
                                    <span className={`inline-block px-2 py-0.5 rounded-md text-[10px] font-bold uppercase mb-1 border ${getStatusColor(pickup.status)}`}>
                                        {pickup.status}
                                    </span>
                                    <h3 className="font-bold text-gray-900 dark:text-white text-sm">{pickup.date}</h3>
                                </div>
                            </div>
                            <span className="text-xs font-mono text-gray-400">#{pickup.id}</span>
                        </div>
                        
                        <div className="space-y-2 pl-[52px]">
                            <div className="flex items-start gap-2">
                                <div className="mt-0.5 min-w-[16px]"><CircleDashed className="w-4 h-4 text-gray-400" /></div>
                                <p className="text-sm text-gray-700 dark:text-gray-300 font-medium">{pickup.items}</p>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                <Clock className="w-3 h-3" /> {pickup.time}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                                <MapPin className="w-3 h-3" /> {pickup.location}
                            </div>
                            {(pickup as any).driver && (
                                <div className="mt-2 pt-2 border-t border-gray-50 dark:border-gray-700 flex items-center gap-2">
                                    <div className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400 font-bold text-[10px]">D</div>
                                    <span className="text-xs text-gray-600 dark:text-gray-400">Assigned to: <span className="font-bold">{(pickup as any).driver}</span></span>
                                </div>
                            )}
                        </div>
                    </div>
                ))}

                {/* Load More Button */}
                {hasMore && (
                    <div className="pt-2 pb-4 text-center">
                        <button 
                            onClick={handleLoadMore}
                            disabled={isLoadingMore}
                            className="w-full py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 font-bold text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
                        >
                            {isLoadingMore ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" /> Loading...
                                </>
                            ) : (
                                'Load More History'
                            )}
                        </button>
                    </div>
                )}
            </>
        ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4 text-gray-400">
                    <Search className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-gray-700 dark:text-gray-300">No pickups found</h3>
                <p className="text-sm text-gray-500">Try adjusting your filters.</p>
            </div>
        )}
      </div>

      {/* Detail Modal - Unified Scroll Structure */}
      {selectedPickup && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setSelectedPickup(null)}></div>
              <div className="bg-white dark:bg-gray-800 rounded-t-3xl sm:rounded-3xl w-full max-w-sm relative z-10 shadow-2xl animate-fade-in-up p-6 max-h-[90vh] overflow-y-auto">
                   <div className="flex justify-between items-center mb-6">
                       <h3 className="font-bold text-gray-900 dark:text-white">Pickup Details</h3>
                       <button onClick={() => setSelectedPickup(null)} className="p-2 bg-gray-100 dark:bg-gray-700 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                           <X className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                       </button>
                   </div>

                   <div className="space-y-6">
                       <div className="flex items-center justify-between">
                           <div>
                               <p className="text-xs text-gray-400 font-bold uppercase mb-1">Status</p>
                               <span className={`px-3 py-1 rounded-full text-sm font-bold border ${getStatusColor(selectedPickup.status)}`}>
                                   {selectedPickup.status}
                               </span>
                           </div>
                           <div className="text-right">
                               <p className="text-xs text-gray-400 font-bold uppercase mb-1">Date</p>
                               <p className="text-lg font-bold text-gray-800 dark:text-white">{selectedPickup.date}</p>
                           </div>
                       </div>

                       {/* Image Section */}
                       {selectedPickup.wasteImage && (
                           <div className="rounded-2xl overflow-hidden border border-gray-200 dark:border-gray-700 relative group">
                               <img src={selectedPickup.wasteImage} alt="Waste" className="w-full h-48 object-cover" />
                               <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-lg backdrop-blur flex items-center gap-1">
                                   <ImageIcon className="w-3 h-3" /> Waste Photo
                               </div>
                           </div>
                       )}

                       <div className="space-y-4">
                           <div className="flex items-start gap-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-2xl border border-gray-100 dark:border-gray-700">
                               <div className="w-10 h-10 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center text-gray-400 shadow-sm shrink-0">
                                   <Package className="w-5 h-5" />
                               </div>
                               <div>
                                   <p className="text-xs text-gray-400 font-bold uppercase">Items</p>
                                   <p className="font-medium text-gray-800 dark:text-white">{selectedPickup.items}</p>
                               </div>
                           </div>
                           <div className="flex items-start gap-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-2xl border border-gray-100 dark:border-gray-700">
                               <div className="w-10 h-10 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center text-gray-400 shadow-sm shrink-0">
                                   <MapPin className="w-5 h-5" />
                               </div>
                               <div>
                                   <p className="text-xs text-gray-400 font-bold uppercase">Location</p>
                                   <p className="font-medium text-gray-800 dark:text-white">{selectedPickup.location}</p>
                               </div>
                           </div>
                           {selectedPickup.phoneNumber && (
                               <div className="flex items-start gap-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-2xl border border-gray-100 dark:border-gray-700">
                                   <div className="w-10 h-10 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center text-gray-400 shadow-sm shrink-0">
                                       <Phone className="w-5 h-5" />
                                   </div>
                                   <div>
                                       <p className="text-xs text-gray-400 font-bold uppercase">Contact</p>
                                       <p className="font-medium text-gray-800 dark:text-white">{selectedPickup.phoneNumber}</p>
                                   </div>
                               </div>
                           )}
                       </div>
                   </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default PickupHistory;