import React, { useState, useEffect } from 'react';
import { User, PickupTask, UserRole, CollectionItem } from '../types';
import { useApp } from '../context/AppContext';
import { Map, List, CheckCircle, Clock, Navigation, LogOut, ChevronRight, X, Phone, User as UserIcon, Package, MapPin, Scale, Coins, Plus, Trash2, ImageIcon } from 'lucide-react';

interface Props {
  user: User;
  onLogout: () => void;
}

const DashboardCollector: React.FC<Props> = ({ user, onLogout }) => {
  const { getPickupsByRole, updatePickup, wasteRates } = useApp(); // Access dynamic rates
  const [activeTab, setActiveTab] = useState<'routes' | 'collections'>('collections');
  const [selectedTask, setSelectedTask] = useState<PickupTask | null>(null);
  
  // Completion State
  const [isCompleting, setIsCompleting] = useState(false);
  const [collectionItems, setCollectionItems] = useState<CollectionItem[]>([]);

  // Fetch all potential collector tasks
  const allTasks = getPickupsByRole(UserRole.COLLECTOR);
  
  // Filter only tasks assigned to THIS collector (by name) OR completed by them
  const myTasks = allTasks.filter(t => t.driver === user.name || (t.status === 'Completed' && t.driver === user.name));

  const completedCount = myTasks.filter(t => t.status === 'Completed').length;
  const pendingCount = myTasks.filter(t => t.status === 'Assigned').length;

  // Reset completion form when task changes
  useEffect(() => {
    if (selectedTask && !selectedTask.collectionDetails) {
        // Pre-fill categories based on the requested items string
        const categories = selectedTask.items.split(',').map(s => s.trim().replace(/\s*\(.*?\)\s*/g, '')); // Remove details like (10kg)
        const initialItems: CollectionItem[] = categories.map(cat => {
            // Match partial string to known categories in the dynamic rate list
            const matchedKey = Object.keys(wasteRates).find(k => cat.includes(k)) || 'Other';
            const rate = wasteRates[matchedKey]?.rate || 10;
            return {
                category: cat,
                weight: 0,
                rate: rate,
                earned: 0
            };
        });
        setCollectionItems(initialItems);
    }
  }, [selectedTask, wasteRates]);

  const initiateCompletion = () => {
    setIsCompleting(true);
  };

  const handleWeightChange = (index: number, val: string) => {
      const weight = parseFloat(val) || 0;
      const newItems = [...collectionItems];
      newItems[index].weight = weight;
      newItems[index].earned = Math.floor(weight * newItems[index].rate);
      setCollectionItems(newItems);
  };

  const addNewItemRow = () => {
      // Default new item to 'Other' rate or first available
      const defaultRate = wasteRates['Other']?.rate || 10;
      setCollectionItems([...collectionItems, { category: 'Other', weight: 0, rate: defaultRate, earned: 0 }]);
  };

  const removeItemRow = (index: number) => {
      setCollectionItems(collectionItems.filter((_, i) => i !== index));
  };

  const confirmCompletion = () => {
      if (!selectedTask) return;

      const totalWeight = collectionItems.reduce((sum, item) => sum + item.weight, 0);
      const totalEarned = collectionItems.reduce((sum, item) => sum + item.earned, 0);

      if (totalWeight <= 0) {
          alert("Total weight must be greater than 0.");
          return;
      }

      updatePickup(selectedTask.id, { 
          status: 'Completed',
          weight: totalWeight,
          earnedZoints: totalEarned,
          collectionDetails: collectionItems
      });

      setIsCompleting(false);
      setSelectedTask(null);
  };

  const closeModal = () => {
      setSelectedTask(null);
      setIsCompleting(false);
  };

  const renderContent = () => {
    if (activeTab === 'routes') {
        const activeRoutes = myTasks.filter(t => t.status === 'Assigned');
        return (
            <div className="space-y-4">
                <div className="bg-gray-200 rounded-2xl h-64 flex items-center justify-center relative overflow-hidden shadow-inner border border-gray-300">
                    <Map className="w-12 h-12 text-gray-400" />
                    <div className="absolute inset-0 bg-[url('https://upload.wikimedia.org/wikipedia/commons/e/ec/OpenStreetMap_Mapnik_example.png')] bg-cover opacity-40"></div>
                </div>
                <h3 className="font-bold text-gray-800">My Route</h3>
                <ol className="space-y-4 relative border-l-2 border-green-100 ml-3">
                    {activeRoutes.length === 0 ? (
                        <p className="ml-6 text-sm text-gray-500">No active assigned routes.</p>
                    ) : (
                        activeRoutes.map((task, idx) => (
                        <li key={task.id} className="ml-6 relative cursor-pointer group" onClick={() => setSelectedTask(task)}>
                            <span className="absolute -left-[31px] flex items-center justify-center w-8 h-8 bg-green-100 rounded-full text-green-700 font-bold text-xs ring-4 ring-white group-hover:bg-green-200 transition-colors">
                                {idx + 1}
                            </span>
                            <div className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm group-hover:border-green-300 transition-colors">
                                <h4 className="font-bold text-sm text-gray-900">{task.location}</h4>
                                <p className="text-xs text-gray-500">{task.time}</p>
                            </div>
                        </li>
                    )))}
                </ol>
            </div>
        );
    }

    return (
        <div className="space-y-4">
          <h2 className="font-bold text-gray-800 mb-2 text-lg">My Assignments</h2>
          {myTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 text-gray-400 bg-white rounded-2xl border border-dashed border-gray-200">
                  <CheckCircle className="w-12 h-12 mb-3 opacity-20" />
                  <p className="text-sm font-medium">No tasks assigned to you yet.</p>
              </div>
          ) : (
              myTasks.map((pickup) => (
                <div 
                    key={pickup.id} 
                    onClick={() => setSelectedTask(pickup)}
                    className={`p-4 rounded-2xl shadow-sm border flex items-center gap-4 transition-all cursor-pointer hover:shadow-md ${pickup.status === 'Completed' ? 'bg-green-50 border-green-100 opacity-75' : 'bg-white border-gray-100 hover:border-green-300'}`}
                >
                    <div className="flex flex-col items-center min-w-[60px]">
                        <span className="text-xs font-bold text-gray-400 uppercase">Time</span>
                        <span className={`font-bold ${pickup.status === 'Completed' ? 'text-green-800 line-through' : 'text-green-700'}`}>{pickup.time}</span>
                    </div>
                    
                    <div className="flex-1">
                        <div className="flex justify-between items-center mb-1">
                            <h3 className={`font-bold text-sm ${pickup.status === 'Completed' ? 'text-gray-500 line-through' : 'text-gray-900'}`}>{pickup.location}</h3>
                        </div>
                        <p className="text-xs text-gray-500">{pickup.items}</p>
                        <div className="flex items-center gap-2 mt-2">
                             <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                 pickup.status === 'Assigned' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                             }`}>
                                 {pickup.status}
                             </span>
                        </div>
                    </div>
                    
                    <ChevronRight className="w-5 h-5 text-gray-300" />
                </div>
            ))
          )}
        </div>
    );
  };

  const getTotalStats = () => {
      const weight = collectionItems.reduce((sum, i) => sum + i.weight, 0);
      const earned = collectionItems.reduce((sum, i) => sum + i.earned, 0);
      return { weight, earned };
  };

  return (
    <div className="space-y-6 h-full flex flex-col relative">
      {/* Header */}
      <div className="flex justify-between items-center shrink-0">
        <h1 className="text-2xl font-bold text-gray-900">Collector Dashboard</h1>
        <div className="flex items-center gap-3">
             <button 
                onClick={onLogout}
                className="p-2 bg-gray-50 hover:bg-red-50 text-gray-600 hover:text-red-600 rounded-full transition-colors"
                title="Log Out"
             >
                 <LogOut className="w-5 h-5" />
             </button>
            <div className="relative">
              <div className="w-3 h-3 bg-red-500 rounded-full absolute top-0 right-0 border-2 border-white"></div>
              <img 
                src={user.avatar} 
                alt="Profile" 
                className="w-10 h-10 rounded-full border-2 border-gray-100 object-cover"
              />
            </div>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="flex gap-4 shrink-0">
        <div className="flex-1 bg-blue-800 text-white p-4 rounded-2xl flex items-center justify-between shadow-lg">
           <div>
             <span className="text-3xl font-bold block">{pendingCount}</span>
             <span className="text-xs opacity-80 uppercase tracking-wide">Assigned</span>
           </div>
           <Clock className="opacity-50 w-8 h-8" />
        </div>
        <div className="flex-1 bg-teal-600 text-white p-4 rounded-2xl flex items-center justify-between shadow-lg">
           <div>
             <span className="text-3xl font-bold block">{completedCount}</span>
             <span className="text-xs opacity-80 uppercase tracking-wide">Done</span>
           </div>
           <CheckCircle className="opacity-50 w-8 h-8" />
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto pb-24">
        {renderContent()}
      </div>

      {/* Bottom Nav for Collector */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-6 py-4 flex justify-around items-center z-50">
        <button 
          onClick={() => setActiveTab('routes')}
          className={`flex flex-col items-center gap-1 ${activeTab === 'routes' ? 'text-green-700' : 'text-gray-400'}`}
        >
          <Navigation className="w-6 h-6" />
          <span className="text-[10px] font-bold">Routes</span>
        </button>
        <button 
          onClick={() => setActiveTab('collections')}
          className={`flex flex-col items-center gap-1 ${activeTab === 'collections' ? 'text-green-700' : 'text-gray-400'}`}
        >
          <List className="w-6 h-6" />
          <span className="text-[10px] font-bold">Collections</span>
        </button>
      </div>

      {/* Detail Modal - Unified Scroll Structure */}
      {selectedTask && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
           <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={closeModal}></div>
           <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-sm relative z-10 shadow-2xl animate-fade-in-up flex flex-col max-h-[90vh] overflow-y-auto">
               
               {/* Header Content Inside Scroll Area */}
               <div className="h-40 bg-gray-200 relative overflow-hidden shrink-0">
                    <div className="absolute inset-0 bg-[url('https://upload.wikimedia.org/wikipedia/commons/e/ec/OpenStreetMap_Mapnik_example.png')] bg-cover opacity-50"></div>
                    <button 
                        onClick={closeModal}
                        className="absolute top-4 right-4 bg-white p-2 rounded-full shadow-md z-20 hover:bg-gray-100"
                    >
                        <X className="w-5 h-5 text-gray-800" />
                    </button>
                    <div className="absolute bottom-4 left-4 right-4">
                        <span className="bg-white/90 backdrop-blur px-3 py-1 rounded-full text-xs font-bold text-gray-800 shadow-sm flex items-center gap-1 w-fit">
                            <MapPin className="w-3 h-3 text-red-500" /> {selectedTask.location}
                        </span>
                    </div>
               </div>

               <div className="p-6 space-y-6">
                   <div className="flex items-center justify-between">
                       <div>
                           <p className="text-xs text-gray-400 font-bold uppercase mb-1">Status</p>
                           <span className={`px-3 py-1 rounded-full text-sm font-bold ${
                               selectedTask.status === 'Completed' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                           }`}>
                               {selectedTask.status}
                           </span>
                       </div>
                       <div className="text-right">
                           <p className="text-xs text-gray-400 font-bold uppercase mb-1">Scheduled Time</p>
                           <p className="text-lg font-bold text-gray-800">{selectedTask.time}</p>
                       </div>
                   </div>

                   {/* Customer & Item Info */}
                   {!isCompleting && (
                    <div className="space-y-4">
                         {/* Image Section */}
                       {selectedTask.wasteImage && (
                           <div className="rounded-2xl overflow-hidden border border-gray-200 relative group">
                               <img src={selectedTask.wasteImage} alt="Waste" className="w-full h-48 object-cover" />
                               <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded-lg backdrop-blur flex items-center gap-1">
                                   <ImageIcon className="w-3 h-3" /> Shared Photo
                               </div>
                           </div>
                       )}

                        <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-gray-400 shadow-sm">
                                <UserIcon className="w-5 h-5" />
                            </div>
                            <div className="flex-1">
                                <p className="text-xs text-gray-400 font-bold uppercase">Customer</p>
                                <p className="font-bold text-gray-800">{selectedTask.contact}</p>
                                {selectedTask.phoneNumber && (
                                    <a href={`tel:${selectedTask.phoneNumber}`} className="text-green-600 text-xs font-bold flex items-center gap-1 mt-1 hover:underline">
                                        <Phone className="w-3 h-3" /> Call Customer
                                    </a>
                                )}
                            </div>
                        </div>

                        <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-2xl border border-gray-100">
                            <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-gray-400 shadow-sm">
                                <Package className="w-5 h-5" />
                            </div>
                            <div>
                                <p className="text-xs text-gray-400 font-bold uppercase">Waste Items</p>
                                <p className="font-medium text-gray-800">{selectedTask.items}</p>
                            </div>
                        </div>
                    </div>
                   )}

                   {/* Completion Workflow */}
                   {selectedTask.status !== 'Completed' ? (
                       !isCompleting ? (
                           <button 
                               onClick={initiateCompletion}
                               className="w-full bg-green-700 text-white py-4 rounded-2xl font-bold shadow-lg hover:bg-green-800 transition-transform active:scale-95 flex items-center justify-center gap-2"
                           >
                               <CheckCircle className="w-5 h-5" /> Complete Pickup
                           </button>
                       ) : (
                           <div className="animate-fade-in-up space-y-4">
                               <div className="flex justify-between items-center">
                                   <h4 className="font-bold text-gray-800">Record Weights</h4>
                                   <div className="text-xs text-gray-500">
                                       Rates per kg are set by Admin
                                   </div>
                               </div>

                               <div className="space-y-3">
                                   {collectionItems.map((item, idx) => (
                                       <div key={idx} className="flex gap-2 items-center">
                                           <div className="flex-1 bg-gray-50 rounded-xl px-3 py-2 border border-gray-200">
                                               <p className="text-xs font-bold text-gray-500 uppercase">{item.category}</p>
                                               <p className="text-xs text-green-600">{item.rate} Z/kg</p>
                                           </div>
                                           <div className="relative w-24">
                                               <input 
                                                  type="number"
                                                  placeholder="0"
                                                  value={item.weight || ''}
                                                  onChange={(e) => handleWeightChange(idx, e.target.value)}
                                                  className="w-full p-2 pr-8 rounded-xl border border-gray-300 focus:outline-none focus:border-green-500 text-right font-bold"
                                               />
                                               <span className="absolute right-3 top-2.5 text-xs text-gray-400">kg</span>
                                           </div>
                                           <button onClick={() => removeItemRow(idx)} className="p-2 text-red-400 hover:text-red-600">
                                               <Trash2 className="w-4 h-4" />
                                           </button>
                                       </div>
                                   ))}
                                   
                                   <button onClick={addNewItemRow} className="text-xs font-bold text-green-600 flex items-center gap-1 hover:underline">
                                       <Plus className="w-3 h-3" /> Add Item
                                   </button>
                               </div>

                               <div className="bg-green-50 p-4 rounded-2xl border border-green-200 flex justify-between items-center">
                                   <div>
                                       <p className="text-xs font-bold text-green-800 uppercase">Total Earned</p>
                                       <p className="text-2xl font-bold text-green-700">{getTotalStats().earned} Z</p>
                                   </div>
                                   <div className="text-right">
                                       <p className="text-xs font-bold text-green-800 uppercase">Total Weight</p>
                                       <p className="text-lg font-bold text-green-700">{getTotalStats().weight} kg</p>
                                   </div>
                               </div>

                               <button 
                                   onClick={confirmCompletion}
                                   className="w-full bg-green-700 text-white py-3 rounded-xl font-bold shadow-md hover:bg-green-800 transition-colors flex items-center justify-center gap-2"
                               >
                                   <Coins className="w-4 h-4" /> Confirm Collection
                               </button>
                           </div>
                       )
                   ) : (
                       <div className="w-full bg-gray-100 text-gray-500 py-4 rounded-2xl text-center space-y-3">
                           <div className="flex items-center justify-center gap-2 font-bold">
                               <CheckCircle className="w-5 h-5" /> Pickup Completed
                           </div>
                           
                           {/* Breakdown Summary for Completed Task */}
                           {selectedTask.collectionDetails && (
                               <div className="px-4 text-xs">
                                   <div className="grid grid-cols-2 gap-2 text-left mb-2">
                                       {selectedTask.collectionDetails.map((item, i) => (
                                           <div key={i} className="flex justify-between border-b border-gray-200 pb-1">
                                               <span>{item.category}</span>
                                               <span className="font-bold">{item.weight} kg</span>
                                           </div>
                                       ))}
                                   </div>
                                   <div className="flex justify-between pt-2 font-bold text-gray-700 border-t border-gray-300">
                                       <span>Total: {selectedTask.weight} kg</span>
                                       <span className="text-green-600">+{selectedTask.earnedZoints} Z</span>
                                   </div>
                               </div>
                           )}
                       </div>
                   )}
               </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default DashboardCollector;