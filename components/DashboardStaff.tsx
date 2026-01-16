import React, { useState } from 'react';
import { User, PickupTask, UserRole } from '../types';
import { useApp } from '../context/AppContext';
import { AlertTriangle, Calendar, Clock, MapPin, Truck, CheckCircle, LogOut, RotateCcw, UserPlus, X, User as UserIcon } from 'lucide-react';

interface Props {
  user: User;
  onLogout: () => void;
}

const DashboardStaff: React.FC<Props> = ({ user, onLogout }) => {
  const { getPickupsByRole, updatePickup, users } = useApp();
  const [filter, setFilter] = useState<'all' | 'today' | 'pending' | 'issues'>('all');
  
  // Modal State
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // Get all data relevant to staff
  const tasks = getPickupsByRole(UserRole.STAFF);

  // Get Available Drivers (Real Users with Collector Role)
  const drivers = users.filter(u => u.role === UserRole.COLLECTOR && u.isActive);

  // Helper to check if a date string is Today
  const isToday = (dateString: string) => {
      const today = new Date();
      const taskDate = new Date(dateString);
      return taskDate.getDate() === today.getDate() &&
             taskDate.getMonth() === today.getMonth() &&
             taskDate.getFullYear() === today.getFullYear();
  };

  // --- ACTIONS ---

  const handleReschedule = (id: string) => {
    if (window.confirm("Reschedule this pickup? It will be moved to the Pending queue.")) {
        updatePickup(id, { status: 'Pending', driver: undefined });
    }
  };

  const openAssignModal = (id: string) => {
      setSelectedTaskId(id);
      setAssignModalOpen(true);
  };

  const confirmAssignment = (driverName: string) => {
      if (selectedTaskId) {
          updatePickup(selectedTaskId, { status: 'Assigned', driver: driverName });
          setAssignModalOpen(false);
          setSelectedTaskId(null);
      }
  };

  // --- FILTERING LOGIC ---

  const filteredTasks = tasks.filter(t => {
      if (filter === 'all') return t.status !== 'Completed'; // Show everything active
      if (filter === 'today') return isToday(t.date) && t.status !== 'Completed';
      if (filter === 'pending') return t.status === 'Pending';
      if (filter === 'issues') return t.status === 'Missed';
      return true;
  });

  // Global Stats (Always show total count regardless of filter)
  const totalActive = tasks.filter(p => p.status === 'Pending' || p.status === 'Assigned').length;
  const totalIssues = tasks.filter(p => p.status === 'Missed').length;

  return (
    <div className="space-y-6 pb-24 h-full relative">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
            <h1 className="text-xl font-bold text-gray-900">Supervisor Dashboard</h1>
            <p className="text-xs text-gray-500">Zone: Lagos Central</p>
        </div>
        <div className="flex items-center gap-3">
             <div className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                Live
            </div>
             <button 
                onClick={onLogout}
                className="p-2 bg-gray-50 hover:bg-red-50 text-gray-600 hover:text-red-600 rounded-full transition-colors"
                title="Log Out"
             >
                 <LogOut className="w-5 h-5" />
             </button>
        </div>
      </div>

      {/* Operations Overview Cards */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100">
        <h2 className="text-gray-500 text-sm font-medium mb-4 uppercase tracking-wider">System Status</h2>
        <div className="grid grid-cols-2 gap-4">
          <div 
            onClick={() => setFilter('all')}
            className={`p-4 rounded-xl cursor-pointer transition-all border ${filter === 'all' || filter === 'pending' ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-100'}`}
          >
             <span className="text-3xl font-bold text-blue-700 block mb-1">{totalActive}</span>
             <p className="text-xs text-blue-600 font-bold uppercase">Active Pickups</p>
          </div>
          <div 
             onClick={() => setFilter('issues')}
             className={`p-4 rounded-xl cursor-pointer transition-all border ${filter === 'issues' ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-100'}`}
          >
             <div className="flex items-center gap-2 mb-1">
                <span className="text-3xl font-bold text-red-700">{totalIssues}</span>
                {totalIssues > 0 && <AlertTriangle className="w-5 h-5 text-red-500 animate-bounce" />}
             </div>
             <p className="text-xs text-red-600 font-bold uppercase">Critical Issues</p>
          </div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 overflow-x-auto py-1 no-scrollbar sticky top-0 bg-gray-50 z-10 pb-2">
        <button 
           onClick={() => setFilter('all')}
           className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-colors ${filter === 'all' ? 'bg-gray-800 text-white shadow-md' : 'bg-white border border-gray-200 text-gray-600'}`}
        >
          <MapPin className="w-4 h-4" /> All Active
        </button>
        <button 
          onClick={() => setFilter('today')}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-colors ${filter === 'today' ? 'bg-green-700 text-white shadow-md' : 'bg-white border border-gray-200 text-gray-600'}`}
        >
          <Calendar className="w-4 h-4" /> Due Today
        </button>
        <button 
          onClick={() => setFilter('pending')}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-colors ${filter === 'pending' ? 'bg-yellow-600 text-white shadow-md' : 'bg-white border border-gray-200 text-gray-600'}`}
        >
          <Clock className="w-4 h-4" /> Unassigned
        </button>
        <button 
          onClick={() => setFilter('issues')}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold whitespace-nowrap transition-colors ${filter === 'issues' ? 'bg-red-600 text-white shadow-md' : 'bg-white border border-gray-200 text-gray-600'}`}
        >
          <AlertTriangle className="w-4 h-4" /> Issues
        </button>
      </div>

      {/* Tasks List */}
      <div className="space-y-3">
        {filteredTasks.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-gray-400 bg-white rounded-3xl border border-dashed border-gray-200">
                <CheckCircle className="w-10 h-10 mb-2 opacity-20" />
                <p className="text-sm font-medium">All clear! No tasks match this filter.</p>
            </div>
        ) : (
            filteredTasks.map(pickup => (
            <div key={pickup.id} className={`p-4 rounded-2xl shadow-sm border transition-all animate-fade-in ${pickup.status === 'Missed' ? 'bg-white border-red-200 ring-1 ring-red-100' : 'bg-white border-gray-100'}`}>
                {/* Header Row */}
                <div className="flex justify-between items-start mb-3">
                     <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${
                            pickup.status === 'Missed' ? 'bg-red-100 text-red-700 border-red-200' :
                            pickup.status === 'Assigned' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                            'bg-yellow-100 text-yellow-700 border-yellow-200'
                        }`}>
                            {pickup.status}
                        </span>
                        <span className="text-xs text-gray-400 font-mono">#{pickup.id}</span>
                     </div>
                     <span className="text-xs font-bold text-gray-800">{pickup.date}</span>
                </div>

                {/* Content */}
                <div className="flex items-start gap-3 mb-4">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${pickup.status === 'Missed' ? 'bg-red-50 text-red-500' : 'bg-gray-100 text-gray-500'}`}>
                        {pickup.status === 'Missed' ? <AlertTriangle className="w-5 h-5" /> : <Truck className="w-5 h-5" />}
                    </div>
                    <div>
                        <h4 className="font-bold text-sm text-gray-900 leading-tight mb-1">{pickup.location}</h4>
                        <p className="text-xs text-gray-500 flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {pickup.time} • {pickup.items}
                        </p>
                        {pickup.contact && <p className="text-xs text-gray-400 mt-1">Contact: {pickup.contact}</p>}
                    </div>
                </div>

                {/* Actions Footer */}
                <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                    {pickup.driver ? (
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 text-[10px] font-bold">
                                {pickup.driver.charAt(0)}
                            </div>
                            <div className="text-xs">
                                <span className="text-gray-400">Driver:</span> <span className="font-bold text-gray-700">{pickup.driver}</span>
                            </div>
                        </div>
                    ) : (
                        <span className="text-xs text-yellow-600 font-medium italic">No driver assigned</span>
                    )}

                    <div className="flex gap-2">
                        {pickup.status === 'Missed' && (
                            <button 
                                onClick={() => handleReschedule(pickup.id)}
                                className="p-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-600 transition-colors"
                                title="Reschedule"
                            >
                                <RotateCcw className="w-4 h-4" />
                            </button>
                        )}
                        <button 
                            onClick={() => openAssignModal(pickup.id)}
                            className="bg-gray-900 text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-black transition-colors flex items-center gap-1"
                        >
                            <UserPlus className="w-3 h-3" /> {pickup.driver ? 'Reassign' : 'Assign'}
                        </button>
                    </div>
                </div>
            </div>
            ))
        )}
      </div>

      {/* Driver Assignment Modal */}
      {assignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
           <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setAssignModalOpen(false)}></div>
           <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-sm relative z-10 shadow-2xl animate-fade-in-up flex flex-col max-h-[80vh]">
               <div className="p-4 border-b border-gray-100 flex justify-between items-center">
                   <h3 className="font-bold text-gray-900">Assign Driver</h3>
                   <button onClick={() => setAssignModalOpen(false)} className="p-2 bg-gray-100 rounded-full">
                       <X className="w-5 h-5 text-gray-600" />
                   </button>
               </div>
               
               <div className="p-4 overflow-y-auto space-y-2">
                   {drivers.length === 0 ? (
                       <p className="text-center text-gray-400 text-sm py-8">No active collectors found.</p>
                   ) : (
                       drivers.map((driver) => (
                       <button 
                          key={driver.id}
                          onClick={() => confirmAssignment(driver.name)}
                          className="w-full p-3 rounded-xl border flex items-center justify-between group transition-all bg-white border-gray-100 hover:border-green-500 hover:shadow-md"
                       >
                           <div className="flex items-center gap-3">
                               <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-500 group-hover:bg-green-100 group-hover:text-green-700 transition-colors">
                                   <UserIcon className="w-5 h-5" />
                               </div>
                               <div className="text-left">
                                   <p className="font-bold text-sm text-gray-800">{driver.name}</p>
                                   <p className="text-xs text-gray-500">{driver.phone || 'No Phone'}</p>
                                </div>
                           </div>
                           <span className="text-[10px] font-bold px-2 py-1 rounded bg-green-100 text-green-700">
                               Available
                           </span>
                       </button>
                   )))}
               </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default DashboardStaff;