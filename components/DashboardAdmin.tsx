import React, { useState, useEffect, useMemo } from 'react';
import { User, UserRole, WasteRates, PickupTask, RedemptionRequest, BlogPost, Certificate } from '../types';
import { useApp } from '../context/AppContext';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';
import { Users, Settings, LogOut, ArrowLeft, Ban, CheckCircle, ShieldAlert, Save, Coins, Search, Mail, Phone, ChevronRight, Truck, Calendar, ArrowDownUp, X, Filter, MapPin, Package, User as UserIcon, AlertTriangle, ImageIcon, Download, Loader2, Scale, FileText, Banknote, Lock, Landmark, UserPlus, BookOpen, Trash2, Plus, Image as ImageIcon2, Shield, FileBadge, Upload } from 'lucide-react';

interface Props {
  user: User;
  onLogout: () => void;
}

type AdminView = 'DASHBOARD' | 'USERS' | 'SETTINGS' | 'PICKUPS' | 'DAILY_STATS' | 'REQUESTS' | 'TIPS' | 'CERTIFICATES';
type SortOption = 'NAME' | 'WEIGHT_DESC' | 'WEIGHT_ASC';

const COLORS = ['#16a34a', '#2563eb', '#ca8a04', '#dc2626', '#9333ea', '#0891b2'];
const PICKUP_BATCH_SIZE = 10;

const DashboardAdmin: React.FC<Props> = ({ user, onLogout }) => {
  const { wasteRates, updateWasteRates, pickups, sysConfig, updateSysConfig, users, updateUser, redemptionRequests, updateRedemptionStatus, addUser, blogPosts, addBlogPost, deleteBlogPost, certificates, addCertificate } = useApp();
  const [currentView, setCurrentView] = useState<AdminView>('DASHBOARD');
  
  // User Management State
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userSearch, setUserSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('ALL');
  
  // Add User State (Collector/Staff)
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [addingRole, setAddingRole] = useState<UserRole>(UserRole.COLLECTOR);
  const [newUserForm, setNewUserForm] = useState({ name: '', email: '', phone: '', password: '' });
  
  // Pickup Management State
  const [pickupFilter, setPickupFilter] = useState('ALL');
  const [pickupSearch, setPickupSearch] = useState('');
  const [selectedPickup, setSelectedPickup] = useState<PickupTask | null>(null);
  const [visiblePickupsCount, setVisiblePickupsCount] = useState(PICKUP_BATCH_SIZE);
  const [isLoadingMorePickups, setIsLoadingMorePickups] = useState(false);

  // Daily Stats State
  const [selectedDayStats, setSelectedDayStats] = useState<{ date: string; weight: number; count: number; items: PickupTask[] } | null>(null);

  // Redemption Requests State
  const [selectedRedemption, setSelectedRedemption] = useState<RedemptionRequest | null>(null);
  const [requestDateRange, setRequestDateRange] = useState({ start: '', end: '' });

  // Tips/Content Management State
  const [isAddTipOpen, setIsAddTipOpen] = useState(false);
  const [newTip, setNewTip] = useState({ title: '', category: 'Tips', excerpt: '', image: '' });

  // Certificates State
  const [certForm, setCertForm] = useState({ orgId: '', month: 'January', year: new Date().getFullYear().toString(), url: '' });
  const [isCertModalOpen, setIsCertModalOpen] = useState(false);

  // Filtering & Sorting State (Users)
  const [showFilters, setShowFilters] = useState(false);
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [sortOption, setSortOption] = useState<SortOption>('NAME');

  // Report State
  const [reportRange, setReportRange] = useState(() => {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - 30);
      return {
          start: start.toISOString().split('T')[0],
          end: end.toISOString().split('T')[0]
      };
  });

  // Settings State - Rates only, SysConfig moved to global
  const [editedRates, setEditedRates] = useState<WasteRates>(wasteRates);
  const [showSaveConfirmation, setShowSaveConfirmation] = useState(false);

  useEffect(() => { setEditedRates(wasteRates); }, [wasteRates]);

  // Reset pagination when filters change
  useEffect(() => {
    setVisiblePickupsCount(PICKUP_BATCH_SIZE);
  }, [pickupFilter, pickupSearch]);

  // --- ACTIONS ---

  const toggleUserStatus = (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      const targetUser = users.find(u => u && u.id === id);
      if (targetUser) {
          updateUser(id, { isActive: !targetUser.isActive });
      }
      
      // Update selectedUser if open
      if (selectedUser && selectedUser.id === id) {
          setSelectedUser(prev => prev ? ({...prev, isActive: !prev.isActive}) : null);
      }
  };
  
  const handleRateChange = (category: string, value: string) => {
      setEditedRates(prev => ({ ...prev, [category]: parseFloat(value) || 0 }));
  };

  const saveRates = () => {
      updateWasteRates(editedRates);
      setShowSaveConfirmation(true);
      setTimeout(() => setShowSaveConfirmation(false), 3000);
  };

  const clearFilters = () => {
      setDateRange({ start: '', end: '' });
      setSortOption('NAME');
  };

  const handleLoadMorePickups = () => {
      setIsLoadingMorePickups(true);
      setTimeout(() => {
          setVisiblePickupsCount(prev => prev + PICKUP_BATCH_SIZE);
          setIsLoadingMorePickups(false);
      }, 600);
  };

  const openAddUserModal = (role: UserRole) => {
      setAddingRole(role);
      setNewUserForm({ name: '', email: '', phone: '', password: '' });
      setIsAddUserOpen(true);
  };

  const handleAddUser = (e: React.FormEvent) => {
      e.preventDefault();
      const newUser: User = {
          id: `u_${Math.random().toString(36).substr(2, 9)}`,
          name: newUserForm.name,
          email: newUserForm.email,
          phone: newUserForm.phone,
          role: addingRole,
          avatar: `https://i.pravatar.cc/150?u=${newUserForm.email}`,
          zointsBalance: 0,
          isActive: true,
          totalRecycledKg: 0
      };
      // Pass password to context for creation
      addUser(newUser, newUserForm.password);
      setIsAddUserOpen(false);
      
      const roleName = addingRole === UserRole.COLLECTOR ? 'Collector' : 'Staff';
      alert(`${roleName} Account Created!\n\nName: ${newUserForm.name}\nEmail: ${newUserForm.email}\nPassword: ${newUserForm.password}\n\nPlease share these credentials securely.`);
      
      setNewUserForm({ name: '', email: '', phone: '', password: '' });
  };

  const handleAddTip = (e: React.FormEvent) => {
      e.preventDefault();
      const newPost: BlogPost = {
          id: `blog_${Math.random().toString(36).substr(2, 9)}`,
          title: newTip.title,
          category: newTip.category,
          excerpt: newTip.excerpt,
          image: newTip.image || 'https://picsum.photos/400/200?grayscale'
      };
      addBlogPost(newPost);
      setIsAddTipOpen(false);
      setNewTip({ title: '', category: 'Tips', excerpt: '', image: '' });
  };

  const handleAddCertificate = (e: React.FormEvent) => {
      e.preventDefault();
      const org = users.find(u => u.id === certForm.orgId);
      if (!org) return;

      const newCert: Certificate = {
          id: `cert_${Date.now()}`,
          orgId: certForm.orgId,
          orgName: org.name,
          month: certForm.month,
          year: parseInt(certForm.year),
          url: certForm.url || 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', // Mock default
          dateIssued: new Date().toISOString()
      };
      addCertificate(newCert);
      setIsCertModalOpen(false);
      setCertForm({ orgId: '', month: 'January', year: new Date().getFullYear().toString(), url: '' });
  };

  const handleGenerateMockUrl = () => {
      setCertForm(prev => ({...prev, url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf'}));
  };

  const handleExportPickups = (data: PickupTask[]) => {
      // CSV Header
      let csvContent = "data:text/csv;charset=utf-8,ID,Date,Time,Status,Location,Items,Contact,Driver,Weight(kg),Earned(Z)\n";
      
      // CSV Rows
      data.forEach(p => {
          if (!p) return;
          const row = [
              p.id,
              p.date,
              p.time,
              p.status,
              `"${p.location.replace(/"/g, '""')}"`, // Escape quotes
              `"${p.items.replace(/"/g, '""')}"`,
              `"${p.contact.replace(/"/g, '""')}"`,
              p.driver || 'Unassigned',
              p.weight || 0,
              p.earnedZoints || 0
          ].join(",");
          csvContent += row + "\n";
      });

      // Download
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `pickups_export_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const handleExportRequests = (data: RedemptionRequest[]) => {
      let csvContent = "data:text/csv;charset=utf-8,ID,User,Type,Amount (Z),Status,Date\n";
      data.forEach(req => {
          const row = [
              req.id,
              `"${req.userName}"`,
              req.type,
              req.amount,
              req.status,
              req.date
          ].join(",");
          csvContent += row + "\n";
      });
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `redemption_requests_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  const handleDateSelect = (dateString: string) => {
      if (!dateString) return;
      
      // Create date object from input (YYYY-MM-DD), force local midnight to match how pickup dates (May 12, 2024) are usually parsed
      const targetDate = new Date(dateString + 'T00:00:00');
      const targetDateString = targetDate.toDateString();

      const items = pickups.filter(p => {
          if (!p) return false;
          if (p.status !== 'Completed') return false;
          const pDate = new Date(p.date);
          return pDate.toDateString() === targetDateString;
      });
      
      const weight = items.reduce((sum, p) => sum + (p.weight || 0), 0);
      
      setSelectedDayStats({
          date: targetDate.toISOString(), 
          weight,
          count: items.length,
          items
      });
  };

  // --- DERIVED DATA & HELPERS ---

  // Report Generation Data
  const reportData = useMemo(() => {
      const start = new Date(reportRange.start);
      const end = new Date(reportRange.end);
      end.setHours(23, 59, 59, 999); // Include the entire end day

      return pickups.filter(p => {
          if (!p) return false;
          if (p.status !== 'Completed') return false;
          const pDate = new Date(p.date);
          return pDate >= start && pDate <= end;
      });
  }, [pickups, reportRange]);

  const reportStats = useMemo(() => ({
      weight: reportData.reduce((sum, p) => sum + (p.weight || 0), 0),
      earned: reportData.reduce((sum, p) => sum + (p.earnedZoints || 0), 0),
      count: reportData.length
  }), [reportData]);

  const handleExportReport = () => {
      if (reportData.length === 0) {
          alert("No data available for the selected date range.");
          return;
      }

      let csvContent = "data:text/csv;charset=utf-8,Date,Location,Items,Weight(kg),Earned(Z),Driver,Details\n";
      reportData.forEach(p => {
          if (!p) return;
          const details = p.collectionDetails 
              ? p.collectionDetails.map(d => `${d.category}:${d.weight}kg`).join('; ') 
              : '';
          const row = [
              p.date,
              `"${p.location.replace(/"/g, '""')}"`,
              `"${p.items.replace(/"/g, '""')}"`,
              p.weight || 0,
              p.earnedZoints || 0,
              p.driver || 'N/A',
              `"${details}"`
          ].join(",");
          csvContent += row + "\n";
      });

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `platform_report_${reportRange.start}_to_${reportRange.end}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };

  // Dynamic Weekly Stats Calculation
  const weeklyStats = useMemo(() => {
    // 1. Group completed pickups by date
    const groupedData: { [date: string]: { weight: number; count: number; items: PickupTask[] } } = {};

    pickups.forEach(p => {
        if (p && p.status === 'Completed' && p.weight) {
            // Normalize date string if needed, assuming YYYY-MM-DD or readable string
            const dateKey = p.date; 
            if (!groupedData[dateKey]) {
                groupedData[dateKey] = { weight: 0, count: 0, items: [] };
            }
            groupedData[dateKey].weight += p.weight;
            groupedData[dateKey].count += 1;
            groupedData[dateKey].items.push(p);
        }
    });

    // 2. Convert to array and sort by date
    const sortedStats = Object.entries(groupedData)
        .map(([date, data]) => ({
            name: new Date(date).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric' }), // e.g., "Mon 12"
            fullDate: date,
            value: data.weight,
            count: data.count,
            items: data.items
        }))
        .sort((a, b) => new Date(a.fullDate).getTime() - new Date(b.fullDate).getTime());

    // 3. Take only the last 7 entries if there are many
    return sortedStats.slice(-7);
  }, [pickups]);

  // Simplified handler attached directly to Bar component
  const handleBarClick = (data: any) => {
    if (data) {
        setSelectedDayStats({
            date: data.fullDate,
            weight: data.value,
            count: data.count,
            items: data.items
        });
        setCurrentView('DAILY_STATS');
    }
  };


  // Check if date filtering is active
  const isDateFilterActive = !!(dateRange.start && dateRange.end);

  // Helper: Calculate metrics for a user within a specific date range (or all time if no range)
  const getFilteredMetrics = (targetUser: User) => {
      const start = dateRange.start ? new Date(dateRange.start) : null;
      const end = dateRange.end ? new Date(dateRange.end) : null;
      // Adjust end date to include the full day
      if (end) end.setHours(23, 59, 59, 999);

      // Filter global pickups
      const userPickups = pickups.filter(p => {
          if (!p) return false;
          // Ownership check
          const isOwner = targetUser.role === UserRole.COLLECTOR 
              ? p.driver === targetUser.name 
              : p.userId === targetUser.id;

          if (!isOwner || p.status !== 'Completed') return false;

          // Date Check
          if (start && end) {
              const taskDate = new Date(p.date);
              return taskDate >= start && taskDate <= end;
          }
          return true;
      });

      const weight = userPickups.reduce((sum, p) => sum + (p.weight || 0), 0);
      const earned = userPickups.reduce((sum, p) => sum + (p.earnedZoints || 0), 0);

      return { weight, earned, count: userPickups.length };
  };

  // Helper: Get Total All-Time Balance (for default view)
  const getTotalBalance = (targetUser: User) => {
      const allTimeEarnings = pickups
          .filter(p => p && p.userId === targetUser.id && p.status === 'Completed')
          .reduce((sum, p) => sum + (p.earnedZoints || 0), 0);
      return targetUser.zointsBalance + allTimeEarnings;
  };

  // Helper: Get Detailed Stats for Profile View (No date filter applied usually, or re-use logic)
  const getUserStats = (targetUser: User) => {
      let userPickups: PickupTask[] = [];

      if (targetUser.role === UserRole.COLLECTOR) {
          userPickups = pickups.filter(p => p && p.driver === targetUser.name);
      } else {
          userPickups = pickups.filter(p => p && p.userId === targetUser.id);
      }

      const completed = userPickups.filter(p => p.status === 'Completed');
      
      const totalWeight = completed.reduce((sum, p) => sum + (p.weight || 0), 0);
      const composition: {[key: string]: number} = {};
      completed.forEach(p => {
          if (p.collectionDetails) {
              p.collectionDetails.forEach(d => {
                  composition[d.category] = (composition[d.category] || 0) + d.weight;
              });
          } else {
              const cat = p.items.split(' ')[0] || 'Other';
              composition[cat] = (composition[cat] || 0) + (p.weight || 0);
          }
      });

      const compositionData = Object.entries(composition).map(([name, value]) => ({ name, value }));
      return { userPickups, completed, totalWeight, compositionData };
  };

  const getStatusColor = (status: string) => {
    switch(status) {
        case 'Pending': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
        case 'Assigned': return 'bg-blue-100 text-blue-700 border-blue-200';
        case 'Completed': return 'bg-green-100 text-green-700 border-green-200';
        case 'Missed': return 'bg-red-100 text-red-700 border-red-200';
        default: return 'bg-gray-100 text-gray-700';
    }
  };


  // --- VIEWS ---

  const renderRequests = () => {
    // Filter by date range
    const filteredRequests = redemptionRequests.filter(req => {
        if (!requestDateRange.start && !requestDateRange.end) return true;
        const reqDate = new Date(req.date);
        const start = requestDateRange.start ? new Date(requestDateRange.start) : null;
        const end = requestDateRange.end ? new Date(requestDateRange.end) : null;
        
        if (end) end.setHours(23, 59, 59, 999);

        if (start && reqDate < start) return false;
        if (end && reqDate > end) return false;
        return true;
    });

    const pendingRequests = filteredRequests.filter(r => r && r.status === 'Pending');
    const pastRequests = filteredRequests.filter(r => r && r.status !== 'Pending');

    return (
        <div className="space-y-6 animate-fade-in h-full flex flex-col">
            <div className="flex items-center gap-2 mb-2">
                <button onClick={() => setCurrentView('DASHBOARD')} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                    <ArrowLeft className="w-6 h-6 text-gray-600" />
                </button>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Redemption Requests</h2>
                  <p className="text-xs text-gray-500">{pendingRequests.length} pending actions</p>
                </div>
            </div>

            {/* Filter & Export Controls */}
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col sm:flex-row gap-4 items-end sm:items-center justify-between">
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <div className="flex-1 sm:flex-none">
                        <label className="text-[10px] font-bold text-gray-400 uppercase ml-1 block">From</label>
                        <input 
                            type="date" 
                            value={requestDateRange.start}
                            onChange={(e) => setRequestDateRange({...requestDateRange, start: e.target.value})}
                            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-xs font-bold text-gray-700 outline-none focus:border-green-500"
                        />
                    </div>
                    <div className="flex-1 sm:flex-none">
                        <label className="text-[10px] font-bold text-gray-400 uppercase ml-1 block">To</label>
                        <input 
                            type="date" 
                            value={requestDateRange.end}
                            onChange={(e) => setRequestDateRange({...requestDateRange, end: e.target.value})}
                            className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-xs font-bold text-gray-700 outline-none focus:border-green-500"
                        />
                    </div>
                    {(requestDateRange.start || requestDateRange.end) && (
                        <button 
                            onClick={() => setRequestDateRange({ start: '', end: '' })}
                            className="p-2 mt-4 bg-gray-100 rounded-lg hover:bg-gray-200 text-gray-500"
                            title="Clear Dates"
                        >
                            <X className="w-3 h-3" />
                        </button>
                    )}
                </div>

                <button 
                    onClick={() => handleExportRequests(filteredRequests)}
                    className="flex items-center gap-2 bg-blue-50 text-blue-600 px-4 py-2 rounded-xl text-xs font-bold hover:bg-blue-100 transition-colors w-full sm:w-auto justify-center"
                >
                    <Download className="w-4 h-4" /> Export CSV
                </button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-6 pb-4">
                {/* Pending Section */}
                <div className="space-y-3">
                    <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Pending Requests</h3>
                    {pendingRequests.length === 0 ? (
                         <div className="bg-gray-50 p-6 rounded-2xl border border-dashed border-gray-200 text-center text-gray-400">
                             <CheckCircle className="w-8 h-8 mx-auto mb-2 opacity-20" />
                             <p className="text-sm">All caught up!</p>
                         </div>
                    ) : (
                        pendingRequests.map(req => (
                            <div 
                                key={req.id} 
                                onClick={() => setSelectedRedemption(req)}
                                className="bg-white p-4 rounded-2xl shadow-sm border border-orange-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 cursor-pointer hover:border-orange-300 transition-all"
                            >
                                <div className="flex items-start gap-3">
                                    <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center shrink-0">
                                        <Banknote className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-gray-900">{req.userName}</h4>
                                        <p className="text-xs text-gray-500">Requested {req.type} Withdrawal</p>
                                        <div className="mt-1 flex items-center gap-2 text-xs text-gray-400">
                                            <span>{req.date}</span>
                                            <span>•</span>
                                            <span>ID: {req.id}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                                    <span className="text-xl font-bold text-gray-800">{req.amount.toLocaleString()} Z</span>
                                    <div className="flex gap-2">
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                updateRedemptionStatus(req.id, 'Rejected');
                                            }}
                                            className="px-3 py-2 rounded-lg bg-red-50 text-red-600 font-bold text-xs hover:bg-red-100 transition-colors"
                                        >
                                            Reject
                                        </button>
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                updateRedemptionStatus(req.id, 'Approved');
                                            }}
                                            className="px-3 py-2 rounded-lg bg-green-600 text-white font-bold text-xs hover:bg-green-700 transition-colors shadow-md"
                                        >
                                            Approve
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* History Section */}
                <div className="space-y-3 opacity-80">
                    <h3 className="text-sm font-bold text-gray-700 uppercase tracking-wide">Recent History</h3>
                    {pastRequests.length === 0 ? (
                         <p className="text-xs text-gray-400 italic">No past requests matching criteria.</p>
                    ) : (
                        pastRequests.map(req => (
                            <div 
                                key={req.id} 
                                onClick={() => setSelectedRedemption(req)}
                                className="bg-gray-50 p-4 rounded-2xl border border-gray-100 flex justify-between items-center cursor-pointer hover:bg-gray-100 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                     <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${req.status === 'Approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                         {req.status === 'Approved' ? 'AP' : 'RJ'}
                                     </div>
                                     <div>
                                        <h4 className="font-bold text-sm text-gray-700">{req.userName}</h4>
                                        <p className="text-xs text-gray-500">{req.type} • {req.amount} Z</p>
                                        <p className="text-[10px] text-gray-400">{req.date}</p>
                                     </div>
                                </div>
                                <span className={`text-xs font-bold px-2 py-1 rounded ${req.status === 'Approved' ? 'text-green-600 bg-green-50' : 'text-red-600 bg-red-50'}`}>
                                    {req.status}
                                </span>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Redemption Details Modal */}
            {selectedRedemption && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setSelectedRedemption(null)}></div>
                    <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-sm relative z-10 shadow-2xl animate-fade-in-up p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-bold text-gray-900">Request Details</h3>
                            <button onClick={() => setSelectedRedemption(null)} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition-colors">
                                <X className="w-5 h-5 text-gray-600" />
                            </button>
                        </div>
                        
                        {(() => {
                           const reqUser = users.find(u => u.id === selectedRedemption.userId);
                           return (
                               <div className="space-y-6">
                                   {/* Amount Card */}
                                   <div className="bg-green-50 p-5 rounded-2xl border border-green-100 text-center">
                                       <p className="text-xs text-green-600 font-bold uppercase mb-1">Requested Amount</p>
                                       <p className="text-4xl font-bold text-gray-900 tracking-tight">{selectedRedemption.amount.toLocaleString()} <span className="text-lg text-gray-500 font-normal">Z</span></p>
                                       <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 bg-white/60 rounded-full text-xs font-bold text-gray-600">
                                            <Banknote className="w-3 h-3" />
                                            {selectedRedemption.type} Withdrawal
                                       </div>
                                   </div>

                                   {/* Bank Details */}
                                   {selectedRedemption.type === 'Cash' && (
                                       <div className="space-y-3">
                                           <h4 className="font-bold text-gray-800 text-sm flex items-center gap-2">
                                               <Landmark className="w-4 h-4 text-gray-500" /> Bank Details
                                           </h4>
                                           <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 space-y-3">
                                               {reqUser?.bankDetails ? (
                                                   <>
                                                       <div className="flex justify-between items-center">
                                                           <span className="text-xs text-gray-500 uppercase font-bold">Bank Name</span>
                                                           <span className="text-sm font-bold text-gray-900">{reqUser.bankDetails.bankName}</span>
                                                       </div>
                                                       <div className="flex justify-between items-center">
                                                           <span className="text-xs text-gray-500 uppercase font-bold">Account Number</span>
                                                           <span className="text-sm font-bold text-gray-900 font-mono tracking-wide">{reqUser.bankDetails.accountNumber}</span>
                                                       </div>
                                                       <div className="flex justify-between items-center border-t border-gray-200 pt-2 mt-2">
                                                           <span className="text-xs text-gray-500 uppercase font-bold">Account Name</span>
                                                           <span className="text-sm font-bold text-gray-900">{reqUser.bankDetails.accountName}</span>
                                                       </div>
                                                   </>
                                               ) : (
                                                   <div className="text-center py-2">
                                                       <AlertTriangle className="w-6 h-6 text-red-400 mx-auto mb-1" />
                                                       <p className="text-sm text-red-500 font-medium">No bank details provided.</p>
                                                   </div>
                                               )}
                                           </div>
                                       </div>
                                   )}
                                   
                                   {/* User Context */}
                                   <div className="flex items-center gap-3 p-3 rounded-xl border border-gray-100 bg-white">
                                       <img src={reqUser?.avatar || 'https://i.pravatar.cc/150'} alt="User" className="w-10 h-10 rounded-full object-cover border border-gray-100" />
                                       <div>
                                           <p className="text-sm font-bold text-gray-900">{selectedRedemption.userName}</p>
                                           <p className="text-xs text-gray-500">Member since May 2024</p>
                                       </div>
                                       <div className="ml-auto text-right">
                                            <p className="text-[10px] text-gray-400 font-bold uppercase">Status</p>
                                            <span className={`text-xs font-bold ${
                                                selectedRedemption.status === 'Approved' ? 'text-green-600' : 
                                                selectedRedemption.status === 'Rejected' ? 'text-red-600' : 'text-orange-600'
                                            }`}>{selectedRedemption.status}</span>
                                       </div>
                                   </div>

                                   {/* Action Buttons (Only for Pending) */}
                                   {selectedRedemption.status === 'Pending' && (
                                       <div className="grid grid-cols-2 gap-3 pt-2">
                                            <button 
                                                onClick={() => {
                                                    updateRedemptionStatus(selectedRedemption.id, 'Rejected');
                                                    setSelectedRedemption(null);
                                                }}
                                                className="py-3.5 rounded-xl bg-red-50 text-red-600 font-bold text-sm hover:bg-red-100 transition-colors flex items-center justify-center gap-2"
                                            >
                                                <X className="w-4 h-4" /> Reject Request
                                            </button>
                                            <button 
                                                onClick={() => {
                                                    updateRedemptionStatus(selectedRedemption.id, 'Approved');
                                                    setSelectedRedemption(null);
                                                }}
                                                className="py-3.5 rounded-xl bg-green-600 text-white font-bold text-sm hover:bg-green-700 transition-colors shadow-lg shadow-green-200 flex items-center justify-center gap-2"
                                            >
                                                <CheckCircle className="w-4 h-4" /> Approve Transfer
                                            </button>
                                       </div>
                                   )}
                               </div>
                           );
                        })()}
                    </div>
                </div>
            )}
        </div>
    );
  };

  const renderContentManagement = () => (
      <div className="space-y-6 animate-fade-in h-full flex flex-col">
          <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                  <button onClick={() => setCurrentView('DASHBOARD')} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                      <ArrowLeft className="w-6 h-6 text-gray-600" />
                  </button>
                  <h2 className="text-lg font-bold text-gray-900">Content Management</h2>
              </div>
              <button 
                  onClick={() => setIsAddTipOpen(true)}
                  className="bg-green-700 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-md hover:bg-green-800 transition-colors flex items-center gap-2"
              >
                  <Plus className="w-4 h-4" /> New Tip
              </button>
          </div>

          <div className="flex-1 overflow-y-auto space-y-4 pb-4">
              {blogPosts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-gray-400 border-2 border-dashed border-gray-100 rounded-3xl">
                      <BookOpen className="w-12 h-12 mb-3 opacity-20" />
                      <p>No tips published yet.</p>
                  </div>
              ) : (
                  blogPosts.map((post) => (
                      <div key={post.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-start gap-4 transition-all hover:border-green-200">
                          <img src={post.image} alt={post.title} className="w-20 h-20 rounded-xl object-cover" />
                          <div className="flex-1">
                              <div className="flex justify-between items-start">
                                  <h3 className="font-bold text-gray-800">{post.title}</h3>
                                  <button onClick={() => deleteBlogPost(post.id)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Delete Tip">
                                      <Trash2 className="w-4 h-4" />
                                  </button>
                              </div>
                              <span className="inline-block px-2 py-0.5 bg-green-50 text-green-700 text-[10px] font-bold uppercase rounded-md mb-2">{post.category}</span>
                              <p className="text-xs text-gray-500 line-clamp-2">{post.excerpt}</p>
                          </div>
                      </div>
                  ))
              )}
          </div>

          {/* Add Tip Modal */}
          {isAddTipOpen && (
              <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setIsAddTipOpen(false)}></div>
                  <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-sm relative z-10 shadow-2xl animate-fade-in-up p-6">
                      <div className="flex justify-between items-center mb-6">
                          <h3 className="font-bold text-gray-900">Publish New Tip</h3>
                          <button onClick={() => setIsAddTipOpen(false)} className="p-2 bg-gray-100 rounded-full">
                              <X className="w-5 h-5 text-gray-600" />
                          </button>
                      </div>
                      <form onSubmit={handleAddTip} className="space-y-4">
                          <div>
                              <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Title</label>
                              <input 
                                  required
                                  type="text" 
                                  value={newTip.title} 
                                  onChange={e => setNewTip({...newTip, title: e.target.value})}
                                  className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 focus:outline-none focus:border-green-500 font-bold text-gray-800"
                                  placeholder="e.g. How to recycle batteries"
                              />
                          </div>
                          <div>
                              <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Category</label>
                              <select 
                                  value={newTip.category}
                                  onChange={e => setNewTip({...newTip, category: e.target.value})}
                                  className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 focus:outline-none focus:border-green-500 font-bold text-gray-800"
                              >
                                  <option value="Tips">Recycling Tips</option>
                                  <option value="Lifestyle">Lifestyle</option>
                                  <option value="Community">Community</option>
                                  <option value="News">News</option>
                              </select>
                          </div>
                          <div>
                              <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Image URL</label>
                              <div className="relative">
                                  <input 
                                      type="text" 
                                      value={newTip.image} 
                                      onChange={e => setNewTip({...newTip, image: e.target.value})}
                                      className="w-full p-3 pl-10 bg-gray-50 rounded-xl border border-gray-200 focus:outline-none focus:border-green-500 text-sm text-gray-800"
                                      placeholder="https://..."
                                  />
                                  <ImageIcon2 className="absolute left-3 top-3.5 w-4 h-4 text-gray-400" />
                              </div>
                              {newTip.image && (
                                  <img src={newTip.image} alt="Preview" className="mt-2 w-full h-24 object-cover rounded-lg border border-gray-100" onError={(e) => (e.currentTarget.style.display = 'none')} />
                              )}
                          </div>
                          <div>
                              <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Excerpt / Content</label>
                              <textarea 
                                  required
                                  rows={4}
                                  value={newTip.excerpt} 
                                  onChange={e => setNewTip({...newTip, excerpt: e.target.value})}
                                  className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 focus:outline-none focus:border-green-500 text-sm text-gray-800 resize-none"
                                  placeholder="Write a short description..."
                              />
                          </div>
                          <button type="submit" className="w-full py-4 rounded-xl bg-green-700 text-white font-bold shadow-lg hover:bg-green-800 transition-transform active:scale-95 mt-2">
                              Publish Content
                          </button>
                      </form>
                  </div>
              </div>
          )}
      </div>
  );

  const renderCertificatesManagement = () => {
      const orgUsers = users.filter(u => u.role === UserRole.ORGANIZATION);

      return (
          <div className="space-y-6 animate-fade-in h-full flex flex-col">
              <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                      <button onClick={() => setCurrentView('DASHBOARD')} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                          <ArrowLeft className="w-6 h-6 text-gray-600" />
                      </button>
                      <h2 className="text-lg font-bold text-gray-900">Certificate Management</h2>
                  </div>
                  <button 
                      onClick={() => setIsCertModalOpen(true)}
                      className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold shadow-md hover:bg-blue-700 transition-colors flex items-center gap-2"
                  >
                      <Upload className="w-4 h-4" /> Upload
                  </button>
              </div>

              <div className="flex-1 overflow-y-auto space-y-4 pb-4">
                  {certificates.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-12 text-gray-400 border-2 border-dashed border-gray-100 rounded-3xl">
                          <FileBadge className="w-12 h-12 mb-3 opacity-20" />
                          <p>No certificates uploaded yet.</p>
                      </div>
                  ) : (
                      certificates.map((cert) => (
                          <div key={cert.id} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between group hover:border-blue-200">
                              <div className="flex items-center gap-4">
                                  <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center text-blue-600">
                                      <FileBadge className="w-5 h-5" />
                                  </div>
                                  <div>
                                      <h3 className="font-bold text-gray-800 text-sm">{cert.orgName}</h3>
                                      <p className="text-xs text-gray-500">{cert.month} {cert.year}</p>
                                  </div>
                              </div>
                              <a 
                                href={cert.url} 
                                target="_blank" 
                                rel="noreferrer"
                                className="text-blue-600 hover:underline text-xs font-bold flex items-center gap-1"
                              >
                                  View <Download className="w-3 h-3" />
                              </a>
                          </div>
                      ))
                  )}
              </div>

              {/* Upload Modal */}
              {isCertModalOpen && (
                  <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
                      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setIsCertModalOpen(false)}></div>
                      <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-sm relative z-10 shadow-2xl animate-fade-in-up p-6">
                          <div className="flex justify-between items-center mb-6">
                              <h3 className="font-bold text-gray-900">Upload Certificate</h3>
                              <button onClick={() => setIsCertModalOpen(false)} className="p-2 bg-gray-100 rounded-full">
                                  <X className="w-5 h-5 text-gray-600" />
                              </button>
                          </div>
                          
                          <form onSubmit={handleAddCertificate} className="space-y-4">
                              <div>
                                  <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Organization</label>
                                  <select 
                                      required
                                      value={certForm.orgId}
                                      onChange={(e) => setCertForm({...certForm, orgId: e.target.value})}
                                      className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 focus:outline-none focus:border-blue-500 font-bold text-gray-800"
                                  >
                                      <option value="">Select Organization</option>
                                      {orgUsers.map(u => (
                                          <option key={u.id} value={u.id}>{u.name}</option>
                                      ))}
                                  </select>
                              </div>
                              <div className="grid grid-cols-2 gap-4">
                                  <div>
                                      <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Month</label>
                                      <select 
                                          value={certForm.month}
                                          onChange={(e) => setCertForm({...certForm, month: e.target.value})}
                                          className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 focus:outline-none focus:border-blue-500 font-bold text-gray-800"
                                      >
                                          {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map(m => (
                                              <option key={m} value={m}>{m}</option>
                                          ))}
                                      </select>
                                  </div>
                                  <div>
                                      <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Year</label>
                                      <input 
                                          type="number"
                                          value={certForm.year}
                                          onChange={(e) => setCertForm({...certForm, year: e.target.value})}
                                          className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 focus:outline-none focus:border-blue-500 font-bold text-gray-800"
                                      />
                                  </div>
                              </div>
                              <div>
                                  <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Certificate URL (PDF)</label>
                                  <div className="relative">
                                      <input 
                                          type="text" 
                                          required
                                          value={certForm.url}
                                          onChange={(e) => setCertForm({...certForm, url: e.target.value})}
                                          className="w-full p-3 pl-3 pr-20 bg-gray-50 rounded-xl border border-gray-200 focus:outline-none focus:border-blue-500 text-sm text-gray-800"
                                          placeholder="https://..."
                                      />
                                      <button 
                                          type="button"
                                          onClick={handleGenerateMockUrl}
                                          className="absolute right-2 top-2 bottom-2 px-2 bg-gray-200 rounded-lg text-[10px] font-bold text-gray-600 hover:bg-gray-300 transition-colors"
                                      >
                                          Mock
                                      </button>
                                  </div>
                              </div>
                              
                              <button type="submit" className="w-full py-4 rounded-xl bg-blue-600 text-white font-bold shadow-lg hover:bg-blue-700 transition-transform active:scale-95 mt-2">
                                  Issue Certificate
                              </button>
                          </form>
                      </div>
                  </div>
              )}
          </div>
      );
  };

  const renderDashboard = () => (
    <div className="space-y-6 animate-fade-in">
        {/* Key Metrics */}
        <div className="grid grid-cols-2 gap-4">
            <div 
                onClick={() => setCurrentView('USERS')}
                className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 cursor-pointer hover:shadow-md hover:border-green-200 transition-all group"
            >
                <div className="flex justify-between items-start">
                    <div>
                        <p className="text-xs text-gray-500 font-bold uppercase group-hover:text-green-600 transition-colors">Total Users</p>
                        <h3 className="text-3xl font-bold text-gray-800">{users.length}</h3>
                    </div>
                    <Users className="w-5 h-5 text-gray-300 group-hover:text-green-500" />
                </div>
            </div>
            
            <div 
                onClick={() => setCurrentView('PICKUPS')}
                className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 cursor-pointer hover:shadow-md hover:border-green-200 transition-all group"
            >
                <div className="flex justify-between items-start">
                    <div>
                         <p className="text-xs text-gray-500 font-bold uppercase group-hover:text-green-600 transition-colors">Active Pickups</p>
                         <h3 className="text-3xl font-bold text-green-600">
                            {pickups.filter(p => p && (p.status === 'Pending' || p.status === 'Assigned')).length}
                         </h3>
                    </div>
                    <Truck className="w-5 h-5 text-gray-300 group-hover:text-green-500" />
                </div>
                <div className="mt-2 flex items-center gap-1 text-[10px] text-gray-400">
                    <span>Click to manage operations</span>
                    <ChevronRight className="w-3 h-3" />
                </div>
            </div>
        </div>

        {/* Global Chart - DYNAMIC */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100">
            <div className="flex justify-between items-center mb-4">
                <div>
                    <h3 className="font-bold text-gray-800">Platform Growth</h3>
                    <p className="text-xs text-gray-400">Weekly collected volume (kg)</p>
                </div>
                <span className="text-xs font-bold bg-green-50 text-green-600 px-2 py-1 rounded-lg">
                    {weeklyStats.reduce((sum, item) => sum + item.value, 0).toLocaleString()} kg Total
                </span>
            </div>
            
            <div className="h-56 w-full">
                {weeklyStats.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={weeklyStats}>
                            <XAxis dataKey="name" tick={{fontSize: 10}} axisLine={false} tickLine={false} />
                            <Tooltip 
                                cursor={{fill: '#f0fdf4'}} 
                                contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} 
                                labelStyle={{ fontWeight: 'bold', color: '#374151' }}
                            />
                            <Bar dataKey="value" radius={[4, 4, 0, 0]} cursor="pointer" onClick={handleBarClick}>
                                {weeklyStats.map((entry, index) => (
                                    <Cell 
                                        key={`cell-${index}`} 
                                        fill={index % 2 === 0 ? '#15803d' : '#4ade80'} 
                                        className="hover:opacity-80 transition-opacity"
                                    />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-100 rounded-xl">
                        <Scale className="w-8 h-8 mb-2 opacity-20" />
                        <p className="text-sm">No completed pickups yet.</p>
                    </div>
                )}
            </div>
            <p className="text-[10px] text-center text-gray-400 mt-2 italic">Click on a bar to see daily material breakdown</p>
        </div>

        {/* Platform Reports Section */}
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                    <FileText className="w-5 h-5 text-blue-600" /> Platform Report
                </h3>
                <button 
                    onClick={handleExportReport}
                    disabled={reportData.length === 0}
                    className="flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-2 rounded-xl text-xs font-bold hover:bg-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <Download className="w-4 h-4" /> Export CSV
                </button>
            </div>

            <div className="flex items-center gap-2 bg-gray-50 p-2 rounded-xl border border-gray-200">
                <div className="flex-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Start Date</label>
                    <input 
                        type="date" 
                        value={reportRange.start}
                        onChange={(e) => setReportRange({...reportRange, start: e.target.value})}
                        className="w-full bg-transparent text-sm font-bold text-gray-700 outline-none cursor-pointer"
                    />
                </div>
                <div className="w-px h-8 bg-gray-200"></div>
                <div className="flex-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">End Date</label>
                    <input 
                        type="date" 
                        value={reportRange.end}
                        onChange={(e) => setReportRange({...reportRange, end: e.target.value})}
                        className="w-full bg-transparent text-sm font-bold text-gray-700 outline-none cursor-pointer"
                    />
                </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
                <div className="p-3 bg-blue-50 rounded-xl border border-blue-100 text-center">
                    <p className="text-[10px] text-blue-600 font-bold uppercase">Total Volume</p>
                    <p className="text-lg font-bold text-gray-800">{reportStats.weight.toLocaleString()} <span className="text-xs font-normal text-gray-500">kg</span></p>
                </div>
                <div className="p-3 bg-green-50 rounded-xl border border-green-100 text-center">
                    <p className="text-[10px] text-green-600 font-bold uppercase">Payouts</p>
                    <p className="text-lg font-bold text-gray-800">{reportStats.earned.toLocaleString()} <span className="text-xs font-normal text-gray-500">Z</span></p>
                </div>
                <div className="p-3 bg-purple-50 rounded-xl border border-purple-100 text-center">
                    <p className="text-[10px] text-purple-600 font-bold uppercase">Pickups</p>
                    <p className="text-lg font-bold text-gray-800">{reportStats.count}</p>
                </div>
            </div>
        </div>

        {/* Menu Links */}
        <div className="space-y-3">
            <h3 className="font-bold text-gray-800 text-sm">Quick Actions</h3>
            <MenuLink icon={<Banknote className="w-5 h-5" />} label="Redemption Requests" onClick={() => setCurrentView('REQUESTS')} />
            <MenuLink icon={<Users className="w-5 h-5" />} label="User Management & Profiles" onClick={() => setCurrentView('USERS')} />
            <MenuLink icon={<FileBadge className="w-5 h-5" />} label="Certificates" onClick={() => setCurrentView('CERTIFICATES')} />
            <MenuLink icon={<BookOpen className="w-5 h-5" />} label="Tips & Content Management" onClick={() => setCurrentView('TIPS')} />
            <MenuLink icon={<Settings className="w-5 h-5" />} label="Platform Settings & Rates" onClick={() => setCurrentView('SETTINGS')} />
        </div>
    </div>
  );

  const renderUserManagement = () => {
    const filteredUsers = users.filter(u => {
      const matchesSearch = u.name.toLowerCase().includes(userSearch.toLowerCase()) || 
                            (u.email && u.email.toLowerCase().includes(userSearch.toLowerCase()));
      const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
      return matchesSearch && matchesRole;
    });

    return (
      <div className="space-y-6 animate-fade-in h-full flex flex-col">
        {/* Header & Controls */}
        <div className="flex flex-col gap-4 bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
           <div className="flex items-center gap-2 mb-2">
                <button onClick={() => setCurrentView('DASHBOARD')} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                    <ArrowLeft className="w-6 h-6 text-gray-600" />
                </button>
                <h2 className="text-lg font-bold text-gray-900">User Management</h2>
           </div>
           
           <div className="flex flex-col sm:flex-row gap-2">
               <div className="relative flex-1">
                   <Search className="absolute left-3 top-3 text-gray-400 w-4 h-4" />
                   <input 
                       type="text" 
                       placeholder="Search users..." 
                       value={userSearch}
                       onChange={(e) => setUserSearch(e.target.value)}
                       className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-green-500"
                   />
               </div>
               <select 
                   value={roleFilter}
                   onChange={(e) => setRoleFilter(e.target.value)}
                   className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-700 outline-none"
               >
                   <option value="ALL">All Roles</option>
                   <option value={UserRole.HOUSEHOLD}>Household</option>
                   <option value={UserRole.ORGANIZATION}>Organization</option>
                   <option value={UserRole.COLLECTOR}>Collector</option>
                   <option value={UserRole.STAFF}>Staff</option>
               </select>
               <button 
                  onClick={() => openAddUserModal(UserRole.COLLECTOR)}
                  className="bg-gray-900 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-black transition-colors whitespace-nowrap"
               >
                   <UserPlus className="w-4 h-4" /> Add Collector
               </button>
               <button 
                  onClick={() => openAddUserModal(UserRole.STAFF)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors whitespace-nowrap"
               >
                   <Shield className="w-4 h-4" /> Add Staff
               </button>
           </div>
        </div>

        {/* User List */}
        <div className="flex-1 overflow-y-auto space-y-3 pb-4">
            {filteredUsers.map(u => (
                <div key={u.id} onClick={() => setSelectedUser(u)} className="bg-white p-4 rounded-2xl border border-gray-100 flex items-center justify-between cursor-pointer hover:border-green-300 transition-all shadow-sm">
                    <div className="flex items-center gap-3">
                        <img src={u.avatar} alt={u.name} className="w-10 h-10 rounded-full object-cover border border-gray-100" />
                        <div>
                            <h4 className="font-bold text-sm text-gray-900">{u.name} <span className="text-gray-400 font-normal text-xs">({u.role})</span></h4>
                            <p className="text-xs text-gray-500">{u.email || 'No email'}</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <div className={`text-right ${u.isActive ? 'text-green-600' : 'text-red-500'}`}>
                            <span className="text-xs font-bold block">{u.isActive ? 'Active' : 'Suspended'}</span>
                            <span className="text-[10px] text-gray-400 font-bold uppercase">Status</span>
                        </div>
                        <button 
                             onClick={(e) => toggleUserStatus(u.id, e)}
                             className={`p-2 rounded-full ${u.isActive ? 'bg-red-50 text-red-500 hover:bg-red-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}
                             title={u.isActive ? "Suspend User" : "Activate User"}
                        >
                            <Ban className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            ))}
        </div>

        {/* Add User Modal (Generalized for Collector and Staff) */}
        {isAddUserOpen && (
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setIsAddUserOpen(false)}></div>
                <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-sm relative z-10 shadow-2xl animate-fade-in-up p-6">
                    <div className="flex justify-between items-center mb-6">
                        <h3 className="font-bold text-gray-900">Add New {addingRole === UserRole.COLLECTOR ? 'Collector' : 'Staff'}</h3>
                        <button onClick={() => setIsAddUserOpen(false)} className="p-2 bg-gray-100 rounded-full">
                            <X className="w-5 h-5 text-gray-600" />
                        </button>
                    </div>
                    <form onSubmit={handleAddUser} className="space-y-4">
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">
                                {addingRole === UserRole.COLLECTOR ? 'Company Name' : 'Full Name'}
                            </label>
                            <input required type="text" value={newUserForm.name} onChange={e => setNewUserForm({...newUserForm, name: e.target.value})} className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 focus:outline-none focus:border-green-500" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Email</label>
                            <input required type="email" value={newUserForm.email} onChange={e => setNewUserForm({...newUserForm, email: e.target.value})} className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 focus:outline-none focus:border-green-500" />
                        </div>
                         <div>
                            <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Phone</label>
                            <input required type="tel" value={newUserForm.phone} onChange={e => setNewUserForm({...newUserForm, phone: e.target.value})} className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 focus:outline-none focus:border-green-500" />
                        </div>
                        <div>
                            <label className="text-xs font-bold text-gray-500 uppercase mb-1 block">Temporary Password</label>
                            <input required type="text" value={newUserForm.password} onChange={e => setNewUserForm({...newUserForm, password: e.target.value})} className="w-full p-3 bg-gray-50 rounded-xl border border-gray-200 focus:outline-none focus:border-green-500" />
                        </div>
                        <button type="submit" className="w-full py-4 bg-green-700 text-white font-bold rounded-xl shadow-lg hover:bg-green-800 transition-transform active:scale-95">Create Account</button>
                    </form>
                </div>
            </div>
        )}

        {/* User Detail Modal */}
        {selectedUser && (
            <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
               <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setSelectedUser(null)}></div>
               <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-sm relative z-10 shadow-2xl animate-fade-in-up p-6 max-h-[90vh] overflow-y-auto">
                   <div className="flex justify-between items-center mb-6">
                       <h3 className="font-bold text-gray-900">User Profile</h3>
                       <button onClick={() => setSelectedUser(null)} className="p-2 bg-gray-100 rounded-full">
                           <X className="w-5 h-5 text-gray-600" />
                       </button>
                   </div>
                   
                   <div className="flex flex-col items-center mb-6">
                       <img src={selectedUser.avatar} className="w-20 h-20 rounded-full border-4 border-gray-50 mb-3" alt="Profile" />
                       <h2 className="text-xl font-bold text-gray-900">{selectedUser.name}</h2>
                       <span className="px-3 py-1 bg-gray-100 rounded-full text-xs font-bold text-gray-600 uppercase mt-1">{selectedUser.role}</span>
                   </div>

                   <div className="space-y-4">
                       <div className="bg-green-50 p-4 rounded-2xl border border-green-100 flex justify-between items-center">
                           <div>
                               <p className="text-xs font-bold text-green-700 uppercase">Wallet Balance</p>
                               <p className="text-2xl font-bold text-green-800">{getTotalBalance(selectedUser).toLocaleString()} Z</p>
                           </div>
                           <Coins className="w-8 h-8 text-green-200" />
                       </div>

                       <div className="grid grid-cols-2 gap-3">
                           <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                               <p className="text-[10px] font-bold text-gray-400 uppercase">Total Recycled</p>
                               <p className="text-lg font-bold text-gray-800">{getUserStats(selectedUser).totalWeight} kg</p>
                           </div>
                            <div className="bg-gray-50 p-3 rounded-xl border border-gray-100">
                               <p className="text-[10px] font-bold text-gray-400 uppercase">Pickups</p>
                               <p className="text-lg font-bold text-gray-800">{getUserStats(selectedUser).userPickups.length}</p>
                           </div>
                       </div>
                       
                       <div className="space-y-2">
                            <h4 className="text-sm font-bold text-gray-700">Recycling Breakdown</h4>
                             {getUserStats(selectedUser).compositionData.map((d: any) => (
                                 <div key={d.name} className="flex justify-between text-sm">
                                     <span className="text-gray-500">{d.name}</span>
                                     <span className="font-bold text-gray-800">{d.value} kg</span>
                                 </div>
                             ))}
                       </div>

                       <div className="pt-4 border-t border-gray-100">
                            <p className="text-xs text-gray-400 mb-2">Contact Information</p>
                            <div className="space-y-2 text-sm">
                                <div className="flex items-center gap-2 text-gray-600">
                                    <Mail className="w-4 h-4" /> {selectedUser.email}
                                </div>
                                <div className="flex items-center gap-2 text-gray-600">
                                    <Phone className="w-4 h-4" /> {selectedUser.phone}
                                </div>
                            </div>
                       </div>
                   </div>
               </div>
            </div>
        )}
      </div>
    );
  };

  const renderSettings = () => (
      <div className="space-y-6 animate-fade-in">
           <div className="flex items-center gap-2 mb-2">
                <button onClick={() => setCurrentView('DASHBOARD')} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                    <ArrowLeft className="w-6 h-6 text-gray-600" />
                </button>
                <h2 className="text-lg font-bold text-gray-900">Platform Settings</h2>
           </div>

           {/* System Controls */}
           <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5 text-gray-500" /> System Controls
                </h3>
                
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-200">
                    <div>
                        <span className="font-bold text-gray-800 block text-sm">Maintenance Mode</span>
                        <span className="text-xs text-gray-500">Disable login for non-admin users</span>
                    </div>
                    <button 
                        onClick={() => updateSysConfig({...sysConfig, maintenanceMode: !sysConfig.maintenanceMode})}
                        className={`w-12 h-6 rounded-full transition-colors relative ${sysConfig.maintenanceMode ? 'bg-red-500' : 'bg-gray-300'}`}
                    >
                        <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${sysConfig.maintenanceMode ? 'left-6.5 translate-x-1' : 'left-0.5'}`}></div>
                    </button>
                </div>

                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-200">
                    <div>
                        <span className="font-bold text-gray-800 block text-sm">Allow Registrations</span>
                        <span className="text-xs text-gray-500">Open/Close new user signups</span>
                    </div>
                    <button 
                        onClick={() => updateSysConfig({...sysConfig, allowRegistrations: !sysConfig.allowRegistrations})}
                        className={`w-12 h-6 rounded-full transition-colors relative ${sysConfig.allowRegistrations ? 'bg-green-600' : 'bg-gray-300'}`}
                    >
                        <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${sysConfig.allowRegistrations ? 'left-6.5 translate-x-1' : 'left-0.5'}`}></div>
                    </button>
                </div>
           </div>

           {/* Waste Rates */}
           <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                <div className="flex justify-between items-center">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                        <Coins className="w-5 h-5 text-yellow-500" /> Exchange Rates
                    </h3>
                    {showSaveConfirmation && (
                        <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-lg animate-fade-in">Saved!</span>
                    )}
                </div>
                <p className="text-xs text-gray-500">Set the Zoint value per kg for each waste category.</p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {Object.keys(editedRates).map((cat) => (
                        <div key={cat} className="flex items-center gap-3 bg-gray-50 p-3 rounded-xl border border-gray-200">
                            <span className="text-sm font-bold text-gray-600 w-24">{cat}</span>
                            <input 
                                type="number" 
                                value={editedRates[cat]} 
                                onChange={(e) => handleRateChange(cat, e.target.value)}
                                className="flex-1 bg-white border border-gray-300 rounded-lg px-3 py-1 text-sm font-bold text-gray-900 focus:outline-none focus:border-green-500"
                            />
                            <span className="text-xs text-gray-400 font-medium">Z/kg</span>
                        </div>
                    ))}
                </div>

                <button 
                    onClick={saveRates}
                    className="w-full bg-green-700 text-white py-3 rounded-xl font-bold shadow-md hover:bg-green-800 transition-colors flex items-center justify-center gap-2"
                >
                    <Save className="w-4 h-4" /> Save Rates
                </button>
           </div>
      </div>
  );

  const renderPickupsManagement = () => {
      const filteredPickups = pickups.filter(p => {
          if (!p) return false;
          const matchesFilter = pickupFilter === 'ALL' || p.status === pickupFilter;
          const matchesSearch = 
              p.id.toLowerCase().includes(pickupSearch.toLowerCase()) || 
              p.location.toLowerCase().includes(pickupSearch.toLowerCase()) || 
              (p.driver && p.driver.toLowerCase().includes(pickupSearch.toLowerCase()));
          return matchesFilter && matchesSearch;
      });

      const displayedPickups = filteredPickups.slice(0, visiblePickupsCount);
      const hasMore = visiblePickupsCount < filteredPickups.length;

      return (
          <div className="space-y-4 animate-fade-in h-full flex flex-col">
               <div className="flex items-center gap-2 mb-2">
                    <button onClick={() => setCurrentView('DASHBOARD')} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <ArrowLeft className="w-6 h-6 text-gray-600" />
                    </button>
                    <h2 className="text-lg font-bold text-gray-900">Pickup Operations</h2>
               </div>

               {/* Controls */}
               <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-3 text-gray-400 w-4 h-4" />
                        <input 
                            type="text" 
                            placeholder="Search location, driver, ID..." 
                            value={pickupSearch}
                            onChange={(e) => setPickupSearch(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-green-500"
                        />
                    </div>
                    <div className="flex gap-2">
                        <select 
                            value={pickupFilter}
                            onChange={(e) => setPickupFilter(e.target.value)}
                            className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm font-bold text-gray-700 outline-none"
                        >
                            <option value="ALL">All Status</option>
                            <option value="Pending">Pending</option>
                            <option value="Assigned">Assigned</option>
                            <option value="Completed">Completed</option>
                            <option value="Missed">Missed</option>
                        </select>
                        <button 
                            onClick={() => handleExportPickups(filteredPickups)}
                            className="bg-blue-50 text-blue-600 px-3 py-2 rounded-xl hover:bg-blue-100 transition-colors"
                            title="Export CSV"
                        >
                            <Download className="w-5 h-5" />
                        </button>
                    </div>
               </div>

               {/* List */}
               <div className="flex-1 overflow-y-auto space-y-3 pb-4">
                   {displayedPickups.map(p => (
                       <div 
                           key={p.id} 
                           onClick={() => setSelectedPickup(p)}
                           className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm cursor-pointer hover:border-green-300 transition-all"
                       >
                           <div className="flex justify-between items-start mb-2">
                               <div className="flex items-center gap-2">
                                   <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${getStatusColor(p.status)}`}>
                                       {p.status}
                                   </span>
                                   <span className="text-xs text-gray-400 font-mono">#{p.id}</span>
                               </div>
                               <span className="text-xs font-bold text-gray-700">{p.date}</span>
                           </div>
                           <div className="flex items-start gap-3">
                               <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-500 shrink-0">
                                   <Truck className="w-5 h-5" />
                               </div>
                               <div>
                                   <p className="text-sm font-bold text-gray-900 line-clamp-1">{p.location}</p>
                                   <p className="text-xs text-gray-500">{p.items}</p>
                                   {p.driver && (
                                       <p className="text-xs text-blue-600 font-bold mt-1 flex items-center gap-1">
                                           Driver: {p.driver}
                                       </p>
                                   )}
                               </div>
                           </div>
                       </div>
                   ))}
                   
                   {hasMore && (
                        <button 
                            onClick={handleLoadMorePickups}
                            disabled={isLoadingMorePickups}
                            className="w-full py-3 text-sm text-gray-500 font-bold hover:bg-gray-50 rounded-xl transition-colors disabled:opacity-50"
                        >
                            {isLoadingMorePickups ? 'Loading...' : 'Load More'}
                        </button>
                   )}
               </div>

               {/* Detail Modal */}
               {selectedPickup && (
                   <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
                       <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setSelectedPickup(null)}></div>
                       <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-sm relative z-10 shadow-2xl animate-fade-in-up p-6 max-h-[90vh] overflow-y-auto">
                            <div className="flex justify-between items-center mb-6">
                                <h3 className="font-bold text-gray-900">Pickup Details</h3>
                                <button onClick={() => setSelectedPickup(null)} className="p-2 bg-gray-100 rounded-full">
                                    <X className="w-5 h-5 text-gray-600" />
                                </button>
                            </div>
                            
                            <div className="space-y-4">
                                <div className="flex items-center justify-between">
                                    <span className={`px-3 py-1 rounded-full text-sm font-bold ${getStatusColor(selectedPickup.status)}`}>{selectedPickup.status}</span>
                                    <span className="font-mono text-gray-500 text-sm">#{selectedPickup.id}</span>
                                </div>
                                
                                <div className="bg-gray-50 p-4 rounded-xl space-y-3">
                                    <div>
                                        <label className="text-xs font-bold text-gray-400 uppercase">Customer</label>
                                        <p className="font-bold text-gray-800">{selectedPickup.contact}</p>
                                        {selectedPickup.phoneNumber && <p className="text-sm text-gray-600">{selectedPickup.phoneNumber}</p>}
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-gray-400 uppercase">Location</label>
                                        <p className="font-bold text-gray-800 text-sm">{selectedPickup.location}</p>
                                    </div>
                                </div>

                                {selectedPickup.status === 'Completed' && (
                                    <div className="bg-green-50 p-4 rounded-xl border border-green-100 space-y-2">
                                        <h4 className="font-bold text-green-800 text-sm">Collection Summary</h4>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-green-700">Total Weight</span>
                                            <span className="font-bold text-green-900">{selectedPickup.weight} kg</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-green-700">Zoints Earned</span>
                                            <span className="font-bold text-green-900">{selectedPickup.earnedZoints} Z</span>
                                        </div>
                                        {selectedPickup.collectionDetails && (
                                            <div className="pt-2 mt-2 border-t border-green-200">
                                                {selectedPickup.collectionDetails.map((d, i) => (
                                                    <div key={i} className="flex justify-between text-xs text-green-700/80">
                                                        <span>{d.category}</span>
                                                        <span>{d.weight} kg</span>
                                                    </div>
                                                ))}
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

  const renderDailyStats = () => {
      if (!selectedDayStats) return null;

      return (
          <div className="space-y-6 animate-fade-in h-full flex flex-col">
              <div className="flex items-center gap-2 mb-2">
                    <button onClick={() => setCurrentView('DASHBOARD')} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <ArrowLeft className="w-6 h-6 text-gray-600" />
                    </button>
                    <div>
                        <h2 className="text-lg font-bold text-gray-900">Daily Breakdown</h2>
                        <p className="text-xs text-gray-500">{new Date(selectedDayStats.date).toDateString()}</p>
                    </div>
               </div>

               <div className="grid grid-cols-2 gap-4">
                   <div className="bg-green-50 p-4 rounded-2xl border border-green-100">
                       <p className="text-xs text-green-600 font-bold uppercase">Volume</p>
                       <p className="text-2xl font-bold text-gray-800">{selectedDayStats.weight.toLocaleString()} kg</p>
                   </div>
                   <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                       <p className="text-xs text-blue-600 font-bold uppercase">Collections</p>
                       <p className="text-2xl font-bold text-gray-800">{selectedDayStats.count}</p>
                   </div>
               </div>

               <div className="flex-1 overflow-y-auto space-y-3 pb-4">
                   <h3 className="font-bold text-gray-800 text-sm">Completed Collections</h3>
                   {selectedDayStats.items.map(p => (
                       <div key={p.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex justify-between items-center">
                           <div>
                               <p className="font-bold text-sm text-gray-900">{p.location}</p>
                               <p className="text-xs text-gray-500">{p.driver || 'No Driver'}</p>
                           </div>
                           <div className="text-right">
                               <span className="block font-bold text-green-700">{p.weight} kg</span>
                               <span className="text-xs text-gray-400">{p.time}</span>
                           </div>
                       </div>
                   ))}
               </div>
          </div>
      );
  };

  return (
    <div className="space-y-6 pb-24 h-full flex flex-col">
       {/* Header */}
       <div className="flex justify-between items-center shrink-0">
        <h1 className="text-xl font-bold text-gray-900">Admin Panel</h1>
        <div className="flex items-center gap-3">
            <span className="text-xs font-bold bg-purple-100 text-purple-700 px-2 py-1 rounded-md uppercase">Super Admin</span>
            <button 
                onClick={onLogout} 
                className="p-2 bg-gray-50 hover:bg-red-50 text-gray-600 hover:text-red-600 rounded-full transition-colors"
                title="Log Out"
            >
                <LogOut className="w-5 h-5" />
            </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
          {currentView === 'DASHBOARD' && renderDashboard()}
          {currentView === 'REQUESTS' && renderRequests()}
          {currentView === 'USERS' && renderUserManagement()}
          {currentView === 'SETTINGS' && renderSettings()}
          {currentView === 'PICKUPS' && renderPickupsManagement()}
          {currentView === 'DAILY_STATS' && renderDailyStats()}
          {currentView === 'TIPS' && renderContentManagement()}
          {currentView === 'CERTIFICATES' && renderCertificatesManagement()}
      </div>
    </div>
  );
};

const MenuLink = ({ icon, label, onClick }: { icon: React.ReactNode, label: string, onClick: () => void }) => (
    <button onClick={onClick} className="w-full flex items-center justify-between bg-white p-4 rounded-2xl border border-gray-100 shadow-sm hover:bg-gray-50 transition-colors">
        <div className="flex items-center gap-3 text-gray-600">
            {icon}
            <span className="font-medium text-gray-800">{label}</span>
        </div>
        <span className="text-gray-300">&rarr;</span>
    </button>
);

export default DashboardAdmin;