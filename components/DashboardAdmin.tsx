import React, { useState, useEffect, useMemo } from 'react';
import { User, UserRole, WasteRates, PickupTask, RedemptionRequest, BlogPost, Certificate } from '../types';
import { useApp } from '../context/AppContext';
import { Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';
import { Users, Settings, LogOut, ArrowLeft, Ban, CheckCircle, ShieldAlert, Save, Coins, Search, Mail, Phone, ChevronRight, Truck, Calendar, ArrowDownUp, X, Filter, MapPin, Package, User as UserIcon, AlertTriangle, ImageIcon, Download, Loader2, Scale, FileText, Banknote, Lock, Landmark, UserPlus, BookOpen, Trash2, Plus, Image as ImageIcon2, Shield, FileBadge, Upload, Leaf } from 'lucide-react';

interface Props {
  user: User;
  onLogout: () => void;
}

type AdminView = 'DASHBOARD' | 'USERS' | 'SETTINGS' | 'PICKUPS' | 'DAILY_STATS' | 'REQUESTS' | 'TIPS' | 'CERTIFICATES' | 'RECYCLING_VOLUME';
type SortOption = 'NAME' | 'WEIGHT_DESC' | 'WEIGHT_ASC';

const COLORS = ['#16a34a', '#2563eb', '#ca8a04', '#dc2626', '#9333ea', '#0891b2'];
const PICKUP_BATCH_SIZE = 10;

// Sub-component for Recycling Volume to ensure hooks are called correctly
const RecyclingVolumeView: React.FC<{
    pickups: PickupTask[];
    onBack: () => void;
}> = ({ pickups, onBack }) => {
    const [filterRange, setFilterRange] = useState({ start: '', end: '' });

    // Aggregation Logic using useMemo
    const volumeData = useMemo(() => {
        const stats: Record<string, { totalWeight: number; count: number; categories: Record<string, number> }> = {};
        
        const start = filterRange.start ? new Date(filterRange.start) : null;
        const end = filterRange.end ? new Date(filterRange.end) : null;
        // Set end date to end of day to include pickups on that day
        if (end) end.setHours(23, 59, 59, 999);

        pickups.forEach(p => {
             if (p.status !== 'Completed') return;

             // Date filtering
             const pDate = new Date(p.date);
             if (start && pDate < start) return;
             if (end && pDate > end) return;

             // Ensure date consistency
             const dateKey = p.date; 
             if (!stats[dateKey]) {
                 stats[dateKey] = { totalWeight: 0, count: 0, categories: {} };
             }
             
             const entry = stats[dateKey];
             entry.totalWeight += (p.weight || 0);
             entry.count += 1;

             if (p.collectionDetails && p.collectionDetails.length > 0) {
                 p.collectionDetails.forEach(d => {
                     entry.categories[d.category] = (entry.categories[d.category] || 0) + d.weight;
                 });
             } else {
                 // Fallback
                 const cat = p.items ? p.items.split(',')[0].trim() : 'Other';
                 entry.categories[cat] = (entry.categories[cat] || 0) + (p.weight || 0);
             }
        });

        return Object.entries(stats)
            .map(([date, data]) => ({ date, ...data }))
            .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    }, [pickups, filterRange]);

    const handleExport = () => {
        if (volumeData.length === 0) {
            alert("No data available to export for the selected range.");
            return;
        }

        let csvContent = "data:text/csv;charset=utf-8,Date,Total Weight (kg),Count,Composition\n";
        
        volumeData.forEach(day => {
            const compString = Object.entries(day.categories).map(([k,v]) => `${k}: ${v.toFixed(1)}kg`).join('; ');
            const row = [
                day.date,
                day.totalWeight,
                day.count,
                `"${compString}"`
            ].join(",");
            csvContent += row + "\n";
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `recycling_volume_export_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="space-y-6 animate-fade-in h-full flex flex-col">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <ArrowLeft className="w-6 h-6 text-gray-600" />
                    </button>
                    <h2 className="text-lg font-bold text-gray-900">Recycling Volume</h2>
                </div>
                <button onClick={handleExport} className="p-2 bg-gray-100 rounded-full text-gray-600 hover:bg-gray-200" title="Export CSV">
                    <Download className="w-5 h-5" />
                </button>
            </div>

            {/* Date Range Filter */}
            <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 flex flex-wrap gap-3 items-center">
                <Calendar className="w-4 h-4 text-gray-400" />
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-500">From:</span>
                    <input 
                        type="date" 
                        value={filterRange.start}
                        onChange={(e) => setFilterRange({...filterRange, start: e.target.value})}
                        className="bg-white border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-green-500"
                    />
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-gray-500">To:</span>
                    <input 
                        type="date" 
                        value={filterRange.end}
                        onChange={(e) => setFilterRange({...filterRange, end: e.target.value})}
                        className="bg-white border border-gray-200 rounded-lg px-2 py-1 text-sm focus:outline-none focus:border-green-500"
                    />
                </div>
                {(filterRange.start || filterRange.end) && (
                    <button 
                        onClick={() => setFilterRange({start: '', end: ''})}
                        className="ml-auto text-xs font-bold text-red-500 hover:text-red-700 hover:bg-red-50 px-2 py-1 rounded"
                    >
                        Clear Filter
                    </button>
                )}
            </div>

            <div className="flex justify-between items-center px-2">
                 <span className="text-xs font-bold text-gray-400 uppercase">
                     Showing {volumeData.length} entries
                 </span>
                 <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-full">
                     Total: {volumeData.reduce((acc, curr) => acc + curr.totalWeight, 0).toLocaleString()} kg
                 </span>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4">
                {volumeData.length === 0 ? (
                    <div className="text-center py-10 text-gray-400">
                        <p>No recycling data recorded for this period.</p>
                    </div>
                ) : (
                    volumeData.map((day) => (
                        <div key={day.date} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm hover:border-green-200 transition-colors">
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <h3 className="font-bold text-gray-800 text-lg">
                                        {new Date(day.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                                    </h3>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="bg-green-100 text-green-700 text-xs font-bold px-2 py-0.5 rounded-full">
                                            {day.totalWeight.toLocaleString()} kg Total
                                        </span>
                                        <span className="text-xs text-gray-400 font-medium">
                                            {day.count} Pickups
                                        </span>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
                                <p className="text-xs font-bold text-gray-400 uppercase mb-2">Composition</p>
                                <div className="flex flex-wrap gap-2">
                                    {Object.entries(day.categories).map(([cat, w]) => (
                                        <div key={cat} className="text-xs flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-gray-100 shadow-sm">
                                            <span className="text-gray-600 font-medium">{cat}</span>
                                            <span className="font-bold text-gray-900">{w.toFixed(1)}kg</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

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

  // Settings State - Rates
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
  
  const handleRateChange = (category: string, field: 'rate' | 'co2', value: string) => {
      setEditedRates(prev => ({ 
          ...prev, 
          [category]: { 
              ...prev[category],
              [field]: parseFloat(value) || 0 
          } 
      }));
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

  const handleExportUsers = (data: User[]) => {
      // CSV Header
      let csvContent = "data:text/csv;charset=utf-8,ID,Name,Role,Email,Phone,Gender,Address,Industry,Status,Balance (Z),Total Recycled (kg),ESG Score,Bank Name,Account Number,Account Name\n";
      
      // CSV Rows
      data.forEach(u => {
          const row = [
              u.id,
              `"${u.name.replace(/"/g, '""')}"`,
              u.role,
              `"${(u.email || '').replace(/"/g, '""')}"`,
              `"${(u.phone || '').replace(/"/g, '""')}"`,
              u.gender || '',
              `"${(u.address || '').replace(/"/g, '""')}"`,
              u.industry || '',
              u.isActive ? 'Active' : 'Suspended',
              u.zointsBalance,
              u.totalRecycledKg || 0,
              u.esgScore || '',
              `"${(u.bankDetails?.bankName || '').replace(/"/g, '""')}"`,
              `"\t${u.bankDetails?.accountNumber || ''}"`, // Force text format for account numbers in Excel
              `"${(u.bankDetails?.accountName || '').replace(/"/g, '""')}"`
          ].join(",");
          csvContent += row + "\n";
      });

      // Download
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `users_export_${new Date().toISOString().split('T')[0]}.csv`);
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

  const renderDashboard = () => {
    // Stats calculation
    const totalUsers = users.length;
    const totalWeight = pickups.filter(p => p.status === 'Completed').reduce((acc, curr) => acc + (curr.weight || 0), 0);
    const pendingRedemptions = redemptionRequests.filter(r => r.status === 'Pending').length;

    return (
        <div className="space-y-6 animate-fade-in">
             {/* Stats Grid */}
             <div className="grid grid-cols-2 gap-4">
                 <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                     <div className="flex justify-between items-start mb-2">
                        <div className="p-2 bg-blue-50 rounded-lg text-blue-600"><Users className="w-5 h-5" /></div>
                        <span className="text-xs font-bold text-gray-400 uppercase">Users</span>
                     </div>
                     <span className="text-2xl font-bold text-gray-900">{totalUsers}</span>
                 </div>
                 <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                     <div className="flex justify-between items-start mb-2">
                        <div className="p-2 bg-green-50 rounded-lg text-green-600"><Scale className="w-5 h-5" /></div>
                        <span className="text-xs font-bold text-gray-400 uppercase">Recycled</span>
                     </div>
                     <span className="text-2xl font-bold text-gray-900">{totalWeight.toLocaleString()} <span className="text-sm text-gray-500">kg</span></span>
                 </div>
                 <div onClick={() => setCurrentView('REQUESTS')} className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 cursor-pointer hover:border-orange-200 transition-colors">
                     <div className="flex justify-between items-start mb-2">
                        <div className="p-2 bg-orange-50 rounded-lg text-orange-600"><Banknote className="w-5 h-5" /></div>
                        <span className="text-xs font-bold text-gray-400 uppercase">Requests</span>
                     </div>
                     <div className="flex items-center gap-2">
                        <span className="text-2xl font-bold text-gray-900">{pendingRedemptions}</span>
                        {pendingRedemptions > 0 && <span className="bg-red-100 text-red-600 text-xs px-2 py-0.5 rounded-full font-bold">Action Needed</span>}
                     </div>
                 </div>
                 <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
                     <div className="flex justify-between items-start mb-2">
                        <div className="p-2 bg-purple-50 rounded-lg text-purple-600"><Truck className="w-5 h-5" /></div>
                        <span className="text-xs font-bold text-gray-400 uppercase">Pickups</span>
                     </div>
                     <span className="text-2xl font-bold text-gray-900">{pickups.length}</span>
                 </div>
             </div>

             {/* Reports Section */}
             <div className="bg-gray-900 text-white p-5 rounded-2xl shadow-lg">
                 <div className="flex justify-between items-center mb-4">
                     <h3 className="font-bold flex items-center gap-2">
                         <FileText className="w-5 h-5 text-gray-400" /> Generate Report
                     </h3>
                 </div>
                 <div className="grid grid-cols-2 gap-3 mb-4">
                     <div>
                         <label className="text-xs text-gray-400 block mb-1">Start Date</label>
                         <input 
                            type="date" 
                            value={reportRange.start}
                            onChange={(e) => setReportRange({...reportRange, start: e.target.value})}
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500"
                         />
                     </div>
                     <div>
                         <label className="text-xs text-gray-400 block mb-1">End Date</label>
                         <input 
                            type="date" 
                            value={reportRange.end}
                            onChange={(e) => setReportRange({...reportRange, end: e.target.value})}
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-green-500"
                         />
                     </div>
                 </div>
                 
                 {/* Report Preview Stats */}
                 <div className="flex gap-4 mb-4 text-sm border-t border-gray-800 pt-3">
                     <div>
                         <span className="block text-gray-400 text-xs">Pickups</span>
                         <span className="font-bold">{reportStats.count}</span>
                     </div>
                     <div>
                         <span className="block text-gray-400 text-xs">Total Weight</span>
                         <span className="font-bold">{reportStats.weight.toLocaleString()} kg</span>
                     </div>
                     <div>
                         <span className="block text-gray-400 text-xs">Payout</span>
                         <span className="font-bold">{reportStats.earned.toLocaleString()} Z</span>
                     </div>
                 </div>

                 <button 
                    onClick={handleExportReport}
                    className="w-full bg-green-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-green-700 transition-colors"
                 >
                     <Download className="w-4 h-4" /> Export Data (CSV)
                 </button>
             </div>

             {/* Navigation Links */}
             <div className="space-y-2">
                 <MenuLink icon={<Scale className="w-5 h-5" />} label="Recycling Volume" onClick={() => setCurrentView('RECYCLING_VOLUME')} />
                 <MenuLink icon={<Users className="w-5 h-5" />} label="User Management" onClick={() => setCurrentView('USERS')} />
                 <MenuLink icon={<Truck className="w-5 h-5" />} label="Pickup Operations" onClick={() => setCurrentView('PICKUPS')} />
                 <MenuLink icon={<Banknote className="w-5 h-5" />} label="Redemption Requests" onClick={() => setCurrentView('REQUESTS')} />
                 <MenuLink icon={<BookOpen className="w-5 h-5" />} label="Content & Tips" onClick={() => setCurrentView('TIPS')} />
                 <MenuLink icon={<FileBadge className="w-5 h-5" />} label="Certificates" onClick={() => setCurrentView('CERTIFICATES')} />
                 <MenuLink icon={<Settings className="w-5 h-5" />} label="System Settings" onClick={() => setCurrentView('SETTINGS')} />
             </div>
        </div>
    );
};

  const renderRequests = () => {
      // Logic for filtering
      const filteredRequests = redemptionRequests.filter(req => {
         // Date Filter
         if (requestDateRange.start && requestDateRange.end) {
             const reqDate = new Date(req.date);
             const start = new Date(requestDateRange.start);
             const end = new Date(requestDateRange.end);
             if (reqDate < start || reqDate > end) return false;
         }
         return true;
      });

      const pending = filteredRequests.filter(r => r.status === 'Pending');
      const history = filteredRequests.filter(r => r.status !== 'Pending');

      return (
        <div className="space-y-6 animate-fade-in">
           <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <button onClick={() => setCurrentView('DASHBOARD')} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <ArrowLeft className="w-6 h-6 text-gray-600" />
                    </button>
                    <h2 className="text-lg font-bold text-gray-900">Redemption Requests</h2>
                </div>
                <button onClick={() => handleExportRequests(filteredRequests)} className="p-2 bg-gray-100 rounded-full text-gray-600 hover:bg-gray-200" title="Export CSV">
                    <Download className="w-5 h-5" />
                </button>
           </div>
           
           {/* Date Filter */}
           <div className="flex gap-2 items-center bg-gray-50 p-2 rounded-xl border border-gray-200 mb-4">
                <Calendar className="w-4 h-4 text-gray-400 ml-2" />
                <input 
                    type="date" 
                    value={requestDateRange.start}
                    onChange={(e) => setRequestDateRange({...requestDateRange, start: e.target.value})}
                    className="bg-transparent text-sm focus:outline-none w-32"
                />
                <span className="text-gray-400">-</span>
                <input 
                    type="date" 
                    value={requestDateRange.end}
                    onChange={(e) => setRequestDateRange({...requestDateRange, end: e.target.value})}
                    className="bg-transparent text-sm focus:outline-none w-32"
                />
                {(requestDateRange.start || requestDateRange.end) && (
                    <button onClick={() => setRequestDateRange({start: '', end: ''})} className="ml-auto text-xs text-gray-400 hover:text-gray-600">Clear</button>
                )}
           </div>

           {/* Pending List */}
           <div>
               <h3 className="text-xs font-bold text-gray-400 uppercase mb-2 ml-1">Pending Approval ({pending.length})</h3>
               <div className="space-y-3">
                   {pending.length === 0 ? (
                       <p className="text-sm text-gray-400 italic ml-1">No pending requests.</p>
                   ) : (
                       pending.map(req => {
                         const reqUser = users.find(u => u.id === req.userId);
                         return (
                           <div key={req.id} className="bg-white p-4 rounded-2xl shadow-sm border border-orange-100 flex flex-col gap-3">
                               <div className="flex justify-between items-start">
                                   <div>
                                       <h4 className="font-bold text-gray-800">{req.userName}</h4>
                                       <p className="text-xs text-gray-500">{req.type} • {req.date}</p>
                                       {req.type === 'Cash' && reqUser?.bankDetails && (
                                           <div className="mt-1 text-xs text-gray-500 bg-gray-50 p-2 rounded-lg border border-gray-100">
                                               <p><span className="font-bold">Bank:</span> {reqUser.bankDetails.bankName}</p>
                                               <p><span className="font-bold">Acct:</span> {reqUser.bankDetails.accountNumber}</p>
                                               <p><span className="font-bold">Name:</span> {reqUser.bankDetails.accountName}</p>
                                           </div>
                                       )}
                                   </div>
                                   <span className="text-xl font-bold text-green-600">{req.amount.toLocaleString()} Z</span>
                               </div>
                               <div className="flex gap-2 pt-2 border-t border-gray-50">
                                   <button 
                                      onClick={() => updateRedemptionStatus(req.id, 'Rejected')}
                                      className="flex-1 py-2 rounded-lg border border-red-200 text-red-600 font-bold text-sm hover:bg-red-50"
                                   >
                                       Reject
                                   </button>
                                   <button 
                                      onClick={() => updateRedemptionStatus(req.id, 'Approved')}
                                      className="flex-1 py-2 rounded-lg bg-green-600 text-white font-bold text-sm hover:bg-green-700 shadow-sm"
                                   >
                                       Approve
                                   </button>
                               </div>
                           </div>
                       )})
                   )}
               </div>
           </div>

           {/* History List */}
           <div className="pt-4">
               <h3 className="text-xs font-bold text-gray-400 uppercase mb-2 ml-1">History</h3>
               <div className="space-y-2 opacity-80">
                   {history.map(req => (
                       <div key={req.id} className="flex justify-between items-center p-3 bg-gray-50 rounded-xl border border-gray-100">
                           <div>
                               <p className="text-sm font-bold text-gray-700">{req.userName}</p>
                               <p className="text-xs text-gray-400">{req.date} • {req.type}</p>
                           </div>
                           <div className="text-right">
                               <span className="block font-bold text-gray-800">{req.amount} Z</span>
                               <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${req.status === 'Approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                   {req.status}
                               </span>
                           </div>
                       </div>
                   ))}
               </div>
           </div>
        </div>
      );
  };

  const renderUserManagement = () => {
    // Logic for Filtering Users
    const filteredUsers = users.filter(u => {
        const matchesSearch = u.name.toLowerCase().includes(userSearch.toLowerCase()) || 
                              u.email?.toLowerCase().includes(userSearch.toLowerCase());
        const matchesRole = roleFilter === 'ALL' || u.role === roleFilter;
        return matchesSearch && matchesRole;
    });

    return (
        <div className="space-y-6 animate-fade-in h-full flex flex-col">
           <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <button onClick={() => setCurrentView('DASHBOARD')} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <ArrowLeft className="w-6 h-6 text-gray-600" />
                    </button>
                    <h2 className="text-lg font-bold text-gray-900">Users</h2>
                </div>
                <div className="flex gap-2">
                    <button onClick={() => openAddUserModal(UserRole.COLLECTOR)} className="p-2 bg-blue-50 text-blue-600 rounded-full hover:bg-blue-100" title="Add Collector">
                        <Truck className="w-5 h-5" />
                    </button>
                    <button onClick={() => openAddUserModal(UserRole.STAFF)} className="p-2 bg-purple-50 text-purple-600 rounded-full hover:bg-purple-100" title="Add Staff">
                        <Shield className="w-5 h-5" />
                    </button>
                    <button onClick={() => handleExportUsers(filteredUsers)} className="p-2 bg-gray-100 text-gray-600 rounded-full hover:bg-gray-200" title="Export CSV">
                        <Download className="w-5 h-5" />
                    </button>
                </div>
           </div>

           {/* Search & Filters */}
           <div className="space-y-3">
               <div className="flex gap-2">
                   <div className="relative flex-1">
                       <Search className="absolute left-3 top-3 text-gray-400 w-4 h-4" />
                       <input 
                           type="text" 
                           placeholder="Search users..." 
                           value={userSearch}
                           onChange={(e) => setUserSearch(e.target.value)}
                           className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-green-500"
                       />
                   </div>
                   <button 
                       onClick={() => setShowFilters(!showFilters)}
                       className={`p-2 rounded-xl border ${showFilters ? 'bg-gray-800 text-white border-gray-800' : 'bg-white border-gray-200 text-gray-600'}`}
                   >
                       <Filter className="w-5 h-5" />
                   </button>
               </div>
               
               {/* Extended Filters */}
               {showFilters && (
                   <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 space-y-3 animate-fade-in">
                       <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                           {['ALL', 'HOUSEHOLD', 'ORGANIZATION', 'COLLECTOR', 'STAFF'].map((role) => (
                               <button 
                                   key={role}
                                   onClick={() => setRoleFilter(role)}
                                   className={`px-3 py-1 rounded-full text-xs font-bold whitespace-nowrap ${roleFilter === role ? 'bg-green-600 text-white' : 'bg-white border border-gray-200 text-gray-600'}`}
                               >
                                   {role}
                               </button>
                           ))}
                       </div>
                       
                       {/* Date Range for Stats Calculation */}
                       <div className="flex gap-2 items-center">
                           <span className="text-xs font-bold text-gray-500">Stats Range:</span>
                           <input 
                                type="date" 
                                value={dateRange.start}
                                onChange={(e) => setDateRange({...dateRange, start: e.target.value})}
                                className="bg-white border border-gray-200 rounded px-2 py-1 text-xs"
                           />
                           <span className="text-gray-400">-</span>
                           <input 
                                type="date" 
                                value={dateRange.end}
                                onChange={(e) => setDateRange({...dateRange, end: e.target.value})}
                                className="bg-white border border-gray-200 rounded px-2 py-1 text-xs"
                           />
                           {(dateRange.start || dateRange.end) && (
                               <button onClick={clearFilters} className="ml-auto text-xs text-gray-400 hover:text-gray-600 underline">Clear</button>
                           )}
                       </div>
                   </div>
               )}
           </div>

           {/* User List */}
           <div className="flex-1 overflow-y-auto space-y-3 pb-4">
               {filteredUsers.map(u => {
                   const metrics = getFilteredMetrics(u);
                   // For default view, use the global balance, else use calculated earned in period
                   const displayBalance = isDateFilterActive ? metrics.earned : u.zointsBalance;
                   
                   // Dynamic weight calculation: Base (if any) + All Pickups Sum (returned by metrics if no date filter)
                   // If date filter is active, metrics.weight is only for that period.
                   const displayWeight = isDateFilterActive 
                        ? metrics.weight 
                        : (u.totalRecycledKg || 0) + metrics.weight;
                   
                   return (
                       <div 
                           key={u.id} 
                           onClick={() => setSelectedUser(u)}
                           className={`bg-white p-4 rounded-2xl border cursor-pointer hover:border-green-300 transition-all shadow-sm ${!u.isActive ? 'opacity-60 bg-gray-50' : 'border-gray-100'}`}
                       >
                           <div className="flex justify-between items-start mb-2">
                               <div className="flex items-center gap-3">
                                   {u.avatar ? (
                                       <img src={u.avatar} alt={u.name} className="w-10 h-10 rounded-full object-cover" />
                                   ) : (
                                       <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-500">
                                           <UserIcon className="w-5 h-5" />
                                       </div>
                                   )}
                                   <div>
                                       <div className="flex items-center gap-2">
                                           <h4 className="font-bold text-gray-900">{u.name}</h4>
                                           {!u.isActive && <span className="bg-red-100 text-red-600 text-[10px] font-bold px-1.5 rounded">SUSPENDED</span>}
                                       </div>
                                       <p className="text-xs text-gray-500 capitalize">{u.role.toLowerCase()}</p>
                                   </div>
                               </div>
                               <button onClick={(e) => toggleUserStatus(u.id, e)} className="text-gray-300 hover:text-red-500 transition-colors">
                                   {u.isActive ? <Ban className="w-4 h-4" /> : <CheckCircle className="w-4 h-4 text-green-500" />}
                               </button>
                           </div>
                           
                           {/* Quick Stats Row */}
                           <div className="flex gap-4 mt-3 pt-3 border-t border-gray-50 text-xs">
                               <div className="flex-1">
                                   <span className="block text-gray-400">Recycled</span>
                                   <span className="font-bold text-gray-800">{displayWeight.toLocaleString()} kg</span>
                               </div>
                               <div className="flex-1">
                                   <span className="block text-gray-400">{isDateFilterActive ? 'Earned' : 'Balance'}</span>
                                   <span className="font-bold text-green-600">{displayBalance.toLocaleString()} Z</span>
                               </div>
                               {isDateFilterActive && (
                                   <div className="flex-1">
                                       <span className="block text-gray-400">Pickups</span>
                                       <span className="font-bold text-gray-800">{metrics.count}</span>
                                   </div>
                               )}
                           </div>
                       </div>
                   );
               })}
           </div>

           {/* User Detail Modal */}
           {selectedUser && (
              <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setSelectedUser(null)}></div>
                  <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-lg relative z-10 shadow-2xl animate-fade-in-up p-6 max-h-[90vh] overflow-y-auto">
                      <div className="flex justify-between items-start mb-6">
                          <div className="flex items-center gap-4">
                              <img src={selectedUser.avatar || `https://ui-avatars.com/api/?name=${selectedUser.name}`} className="w-16 h-16 rounded-full border-4 border-gray-50" />
                              <div>
                                  <h3 className="text-xl font-bold text-gray-900">{selectedUser.name}</h3>
                                  <p className="text-sm text-gray-500">{selectedUser.email}</p>
                                  <div className="flex gap-2 mt-1">
                                      <span className="bg-blue-50 text-blue-600 text-xs px-2 py-0.5 rounded-full font-bold uppercase">{selectedUser.role}</span>
                                      {selectedUser.industry && <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full capitalize">{selectedUser.industry}</span>}
                                  </div>
                              </div>
                          </div>
                          <button onClick={() => setSelectedUser(null)} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200">
                              <X className="w-5 h-5 text-gray-600" />
                          </button>
                      </div>

                      {/* Detail Grid */}
                      <div className="grid grid-cols-2 gap-4 mb-6">
                           <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                               <p className="text-xs text-gray-400 uppercase font-bold">Phone</p>
                               <p className="font-medium text-gray-800">{selectedUser.phone || 'N/A'}</p>
                           </div>
                           <div className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                               <p className="text-xs text-gray-400 uppercase font-bold">Gender</p>
                               <p className="font-medium text-gray-800">{selectedUser.gender || 'N/A'}</p>
                           </div>
                           <div className="col-span-2 p-3 bg-gray-50 rounded-xl border border-gray-100">
                               <p className="text-xs text-gray-400 uppercase font-bold">Address</p>
                               <p className="font-medium text-gray-800">{selectedUser.address || 'N/A'}</p>
                           </div>
                           {selectedUser.bankDetails && (
                               <div className="col-span-2 p-3 bg-blue-50 rounded-xl border border-blue-100">
                                   <p className="text-xs text-blue-400 uppercase font-bold mb-1 flex items-center gap-1"><Landmark className="w-3 h-3"/> Bank Account</p>
                                   <p className="font-bold text-blue-900">{selectedUser.bankDetails.bankName}</p>
                                   <p className="text-sm text-blue-800">{selectedUser.bankDetails.accountNumber} • {selectedUser.bankDetails.accountName}</p>
                               </div>
                           )}
                      </div>

                      {/* User Stats Chart */}
                      <div className="mb-6">
                           <h4 className="font-bold text-gray-800 mb-3">Recycling Breakdown</h4>
                           <div className="h-48">
                               {getUserStats(selectedUser).totalWeight > 0 ? (
                                   <ResponsiveContainer width="100%" height="100%">
                                       <PieChart>
                                           <Pie 
                                             data={getUserStats(selectedUser).compositionData} 
                                             dataKey="value" 
                                             nameKey="name" 
                                             cx="50%" cy="50%" 
                                             innerRadius={40} 
                                             outerRadius={60}
                                           >
                                               {getUserStats(selectedUser).compositionData.map((entry, index) => (
                                                   <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                               ))}
                                           </Pie>
                                           <Tooltip />
                                           <Legend verticalAlign="bottom" height={36} iconType="circle" />
                                       </PieChart>
                                   </ResponsiveContainer>
                               ) : (
                                   <div className="h-full flex items-center justify-center text-gray-400 text-sm border-2 border-dashed border-gray-100 rounded-xl">No recycling data</div>
                               )}
                           </div>
                      </div>

                      {/* Actions */}
                      <button 
                         onClick={(e) => { toggleUserStatus(selectedUser.id, e); setSelectedUser(null); }}
                         className={`w-full py-3 rounded-xl font-bold text-white transition-colors flex items-center justify-center gap-2 ${selectedUser.isActive ? 'bg-red-500 hover:bg-red-600' : 'bg-green-600 hover:bg-green-700'}`}
                      >
                          {selectedUser.isActive ? <Ban className="w-4 h-4" /> : <CheckCircle className="w-4 h-4" />}
                          {selectedUser.isActive ? 'Suspend Account' : 'Activate Account'}
                      </button>
                  </div>
              </div>
           )}

           {/* Add User Modal */}
           {isAddUserOpen && (
               <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                   <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setIsAddUserOpen(false)}></div>
                   <div className="bg-white rounded-2xl w-full max-w-sm relative z-10 shadow-2xl p-6">
                       <h3 className="text-lg font-bold text-gray-900 mb-4">Add {addingRole === UserRole.COLLECTOR ? 'Collector' : 'Staff'}</h3>
                       <form onSubmit={handleAddUser} className="space-y-3">
                           <input type="text" placeholder="Full Name" required className="w-full p-3 bg-gray-50 border rounded-xl" value={newUserForm.name} onChange={e => setNewUserForm({...newUserForm, name: e.target.value})} />
                           <input type="email" placeholder="Email Address" required className="w-full p-3 bg-gray-50 border rounded-xl" value={newUserForm.email} onChange={e => setNewUserForm({...newUserForm, email: e.target.value})} />
                           <input type="tel" placeholder="Phone" required className="w-full p-3 bg-gray-50 border rounded-xl" value={newUserForm.phone} onChange={e => setNewUserForm({...newUserForm, phone: e.target.value})} />
                           <input type="password" placeholder="Create Password" required className="w-full p-3 bg-gray-50 border rounded-xl" value={newUserForm.password} onChange={e => setNewUserForm({...newUserForm, password: e.target.value})} />
                           
                           <button type="submit" className="w-full bg-green-700 text-white py-3 rounded-xl font-bold mt-2 hover:bg-green-800">Create Account</button>
                       </form>
                       <button onClick={() => setIsAddUserOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X className="w-5 h-5"/></button>
                   </div>
               </div>
           )}
        </div>
    );
  };

  const renderPickupsManagement = () => {
    // Logic for Filtering Pickups
    const filteredPickups = pickups.filter(p => {
        const matchesSearch = (p.id.toLowerCase().includes(pickupSearch.toLowerCase()) || 
                              p.location.toLowerCase().includes(pickupSearch.toLowerCase()));
        const matchesFilter = pickupFilter === 'ALL' || p.status === pickupFilter;
        return matchesSearch && matchesFilter;
    });

    const displayedPickups = filteredPickups.slice(0, visiblePickupsCount);

    return (
        <div className="space-y-6 animate-fade-in h-full flex flex-col">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <button onClick={() => setCurrentView('DASHBOARD')} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <ArrowLeft className="w-6 h-6 text-gray-600" />
                    </button>
                    <h2 className="text-lg font-bold text-gray-900">Operations</h2>
                </div>
                <button onClick={() => handleExportPickups(filteredPickups)} className="p-2 bg-gray-100 text-gray-600 rounded-full hover:bg-gray-200" title="Export CSV">
                    <Download className="w-5 h-5" />
                </button>
            </div>

            {/* Controls */}
            <div className="space-y-3">
                 <div className="flex gap-2">
                     <div className="relative flex-1">
                         <Search className="absolute left-3 top-3 text-gray-400 w-4 h-4" />
                         <input 
                             type="text" 
                             placeholder="Search location, ID..." 
                             value={pickupSearch}
                             onChange={(e) => setPickupSearch(e.target.value)}
                             className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-green-500"
                         />
                     </div>
                     <select 
                        value={pickupFilter}
                        onChange={(e) => setPickupFilter(e.target.value)}
                        className="bg-white border border-gray-200 rounded-xl text-sm px-3 focus:outline-none font-bold text-gray-600"
                     >
                         <option value="ALL">All Status</option>
                         <option value="Pending">Pending</option>
                         <option value="Assigned">Assigned</option>
                         <option value="Completed">Completed</option>
                         <option value="Missed">Missed</option>
                     </select>
                 </div>
            </div>

            {/* Table/List View */}
            <div className="flex-1 overflow-y-auto pb-4 space-y-3">
                {displayedPickups.length === 0 ? (
                    <div className="text-center py-10 text-gray-400">No pickups found.</div>
                ) : (
                    displayedPickups.map(p => (
                        <div key={p.id} onClick={() => setSelectedPickup(p)} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm cursor-pointer hover:border-green-300 transition-colors">
                            <div className="flex justify-between items-start mb-2">
                                <div className="flex items-center gap-2">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${getStatusColor(p.status)}`}>
                                        {p.status}
                                    </span>
                                    <span className="text-xs text-gray-400 font-mono">#{p.id}</span>
                                </div>
                                <span className="text-xs font-bold text-gray-500">{p.date}</span>
                            </div>
                            <div className="flex items-start gap-3">
                                <div className="p-2 bg-gray-50 rounded-lg text-gray-400">
                                    <MapPin className="w-5 h-5" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-sm text-gray-900 line-clamp-1">{p.location}</h4>
                                    <p className="text-xs text-gray-500">{p.items}</p>
                                    <div className="flex gap-4 mt-1 text-xs text-gray-400">
                                        <span>User: {users.find(u => u.id === p.userId)?.name || 'Unknown'}</span>
                                        {p.driver && <span>Driver: <span className="text-gray-600 font-bold">{p.driver}</span></span>}
                                    </div>
                                </div>
                            </div>
                            {p.status === 'Completed' && (
                                <div className="mt-3 pt-2 border-t border-gray-50 flex justify-between text-xs font-bold">
                                    <span className="text-gray-500">Weight: {p.weight} kg</span>
                                    <span className="text-green-600">Earned: {p.earnedZoints} Z</span>
                                </div>
                            )}
                        </div>
                    ))
                )}
                
                {/* Load More */}
                {visiblePickupsCount < filteredPickups.length && (
                    <button 
                        onClick={handleLoadMorePickups}
                        disabled={isLoadingMorePickups}
                        className="w-full py-3 bg-gray-50 text-gray-500 font-bold text-sm rounded-xl hover:bg-gray-100"
                    >
                        {isLoadingMorePickups ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Load More'}
                    </button>
                )}
            </div>

            {/* Pickup Detail Modal */}
            {selectedPickup && (
                <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setSelectedPickup(null)}></div>
                  <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md relative z-10 shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
                      <div className="flex justify-between items-center mb-6">
                          <h3 className="font-bold text-lg text-gray-900">Pickup Details</h3>
                          <button onClick={() => setSelectedPickup(null)}><X className="w-5 h-5 text-gray-500" /></button>
                      </div>

                      {/* Image */}
                      {selectedPickup.wasteImage && (
                          <div className="mb-4 rounded-xl overflow-hidden border border-gray-200">
                              <img src={selectedPickup.wasteImage} className="w-full h-48 object-cover" />
                          </div>
                      )}

                      <div className="space-y-4">
                          <div className="grid grid-cols-2 gap-4">
                              <div className="p-3 bg-gray-50 rounded-xl">
                                  <span className="text-xs text-gray-400 font-bold uppercase">Status</span>
                                  <p className={`font-bold ${selectedPickup.status === 'Completed' ? 'text-green-600' : 'text-gray-800'}`}>{selectedPickup.status}</p>
                              </div>
                              <div className="p-3 bg-gray-50 rounded-xl">
                                  <span className="text-xs text-gray-400 font-bold uppercase">Date</span>
                                  <p className="font-bold text-gray-800">{selectedPickup.date}</p>
                              </div>
                          </div>
                          
                          <div className="p-3 bg-gray-50 rounded-xl">
                              <span className="text-xs text-gray-400 font-bold uppercase">Location</span>
                              <p className="font-medium text-gray-800 text-sm">{selectedPickup.location}</p>
                          </div>

                          <div className="p-3 bg-gray-50 rounded-xl">
                              <span className="text-xs text-gray-400 font-bold uppercase">Items</span>
                              <p className="font-medium text-gray-800 text-sm">{selectedPickup.items}</p>
                          </div>

                          {selectedPickup.collectionDetails && (
                              <div className="border border-green-100 bg-green-50/50 rounded-xl p-3">
                                  <span className="text-xs text-green-700 font-bold uppercase mb-2 block">Collection Breakdown</span>
                                  <div className="space-y-1">
                                      {selectedPickup.collectionDetails.map((d, i) => (
                                          <div key={i} className="flex justify-between text-sm">
                                              <span className="text-gray-600">{d.category}</span>
                                              <span className="font-bold text-gray-800">{d.weight} kg</span>
                                          </div>
                                      ))}
                                      <div className="border-t border-green-200 pt-1 mt-1 flex justify-between font-bold text-green-800">
                                          <span>Total</span>
                                          <span>{selectedPickup.earnedZoints} Z</span>
                                      </div>
                                  </div>
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
                    <h2 className="text-lg font-bold text-gray-900">Daily Report</h2>
                    <p className="text-xs text-gray-500">{new Date(selectedDayStats.date).toDateString()}</p>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="bg-green-50 p-4 rounded-2xl border border-green-100 text-center">
                    <span className="text-3xl font-bold text-green-700">{selectedDayStats.weight.toLocaleString()}</span>
                    <span className="text-xs text-green-600 font-bold uppercase block">Kg Recycled</span>
                </div>
                <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 text-center">
                    <span className="text-3xl font-bold text-blue-700">{selectedDayStats.count}</span>
                    <span className="text-xs text-blue-600 font-bold uppercase block">Pickups Completed</span>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto">
                <h3 className="font-bold text-gray-800 mb-3">Transactions</h3>
                <div className="space-y-2">
                    {selectedDayStats.items.map(p => (
                        <div key={p.id} className="bg-white p-3 rounded-xl border border-gray-100 flex justify-between items-center">
                            <div>
                                <p className="font-bold text-sm text-gray-800">{p.location}</p>
                                <p className="text-xs text-gray-500">{p.items}</p>
                            </div>
                            <div className="text-right">
                                <span className="block font-bold text-green-600">{p.weight} kg</span>
                                <span className="text-xs text-gray-400">{p.time}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
  };

  const renderContentManagement = () => (
      <div className="space-y-6 animate-fade-in">
          <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <button onClick={() => setCurrentView('DASHBOARD')} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <ArrowLeft className="w-6 h-6 text-gray-600" />
                    </button>
                    <h2 className="text-lg font-bold text-gray-900">Recycling Tips</h2>
                </div>
                <button onClick={() => setIsAddTipOpen(true)} className="flex items-center gap-1 bg-green-600 text-white px-3 py-2 rounded-full text-xs font-bold hover:bg-green-700">
                    <Plus className="w-4 h-4" /> Add New
                </button>
           </div>

           <div className="grid gap-4">
               {blogPosts.map(post => (
                   <div key={post.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex gap-4">
                       <img src={post.image} className="w-20 h-20 rounded-xl object-cover bg-gray-100" />
                       <div className="flex-1">
                           <div className="flex justify-between items-start">
                               <h3 className="font-bold text-gray-800 line-clamp-1">{post.title}</h3>
                               <button onClick={() => deleteBlogPost(post.id)} className="text-gray-400 hover:text-red-500">
                                   <Trash2 className="w-4 h-4" />
                               </button>
                           </div>
                           <p className="text-xs text-gray-500 line-clamp-2 mt-1">{post.excerpt}</p>
                           <span className="inline-block mt-2 bg-gray-100 text-gray-600 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">{post.category}</span>
                       </div>
                   </div>
               ))}
           </div>

           {/* Add Tip Modal */}
           {isAddTipOpen && (
               <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                   <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setIsAddTipOpen(false)}></div>
                   <div className="bg-white rounded-2xl w-full max-w-sm relative z-10 shadow-2xl p-6">
                       <h3 className="text-lg font-bold text-gray-900 mb-4">Add New Tip</h3>
                       <form onSubmit={handleAddTip} className="space-y-3">
                           <input type="text" placeholder="Title" required className="w-full p-3 bg-gray-50 border rounded-xl text-sm" value={newTip.title} onChange={e => setNewTip({...newTip, title: e.target.value})} />
                           <select className="w-full p-3 bg-gray-50 border rounded-xl text-sm" value={newTip.category} onChange={e => setNewTip({...newTip, category: e.target.value})}>
                               <option>Tips</option>
                               <option>News</option>
                               <option>Guide</option>
                           </select>
                           <textarea rows={3} placeholder="Excerpt/Content" required className="w-full p-3 bg-gray-50 border rounded-xl text-sm resize-none" value={newTip.excerpt} onChange={e => setNewTip({...newTip, excerpt: e.target.value})} />
                           <div className="relative">
                               <input type="text" placeholder="Image URL (Optional)" className="w-full p-3 bg-gray-50 border rounded-xl text-sm pl-10" value={newTip.image} onChange={e => setNewTip({...newTip, image: e.target.value})} />
                               <ImageIcon2 className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                           </div>
                           <button type="submit" className="w-full bg-green-700 text-white py-3 rounded-xl font-bold mt-2 hover:bg-green-800">Publish Post</button>
                       </form>
                       <button onClick={() => setIsAddTipOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X className="w-5 h-5"/></button>
                   </div>
               </div>
           )}
      </div>
  );

  const renderCertificatesManagement = () => (
      <div className="space-y-6 animate-fade-in">
          <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                    <button onClick={() => setCurrentView('DASHBOARD')} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <ArrowLeft className="w-6 h-6 text-gray-600" />
                    </button>
                    <h2 className="text-lg font-bold text-gray-900">Certificates</h2>
                </div>
                <button onClick={() => setIsCertModalOpen(true)} className="flex items-center gap-1 bg-blue-600 text-white px-3 py-2 rounded-full text-xs font-bold hover:bg-blue-700">
                    <Plus className="w-4 h-4" /> Issue New
                </button>
           </div>

           <div className="grid gap-3">
               {certificates.map(cert => (
                   <div key={cert.id} className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
                       <div className="flex items-center gap-3">
                           <div className="w-10 h-10 bg-blue-50 rounded-full flex items-center justify-center text-blue-600">
                               <FileBadge className="w-5 h-5" />
                           </div>
                           <div>
                               <h4 className="font-bold text-gray-800 text-sm">{cert.orgName}</h4>
                               <p className="text-xs text-gray-500">{cert.month} {cert.year}</p>
                           </div>
                       </div>
                       <a href={cert.url} target="_blank" rel="noreferrer" className="text-blue-600 text-xs font-bold hover:underline">View PDF</a>
                   </div>
               ))}
           </div>

           {/* Issue Certificate Modal */}
           {isCertModalOpen && (
               <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                   <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setIsCertModalOpen(false)}></div>
                   <div className="bg-white rounded-2xl w-full max-w-sm relative z-10 shadow-2xl p-6">
                       <h3 className="text-lg font-bold text-gray-900 mb-4">Issue Certificate</h3>
                       <form onSubmit={handleAddCertificate} className="space-y-3">
                           <div>
                               <label className="text-xs font-bold text-gray-500 mb-1 block">Organization</label>
                               <select 
                                    className="w-full p-3 bg-gray-50 border rounded-xl text-sm" 
                                    value={certForm.orgId} 
                                    onChange={e => setCertForm({...certForm, orgId: e.target.value})}
                                    required
                                >
                                   <option value="">Select Organization</option>
                                   {users.filter(u => u.role === UserRole.ORGANIZATION).map(org => (
                                       <option key={org.id} value={org.id}>{org.name}</option>
                                   ))}
                               </select>
                           </div>
                           <div className="grid grid-cols-2 gap-2">
                               <select className="w-full p-3 bg-gray-50 border rounded-xl text-sm" value={certForm.month} onChange={e => setCertForm({...certForm, month: e.target.value})}>
                                   {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map(m => (
                                       <option key={m} value={m}>{m}</option>
                                   ))}
                               </select>
                               <input type="number" className="w-full p-3 bg-gray-50 border rounded-xl text-sm" value={certForm.year} onChange={e => setCertForm({...certForm, year: e.target.value})} />
                           </div>
                           
                           <div>
                                <label className="text-xs font-bold text-gray-500 mb-1 block">Certificate URL (PDF)</label>
                                <div className="flex gap-2">
                                    <input 
                                        type="text" 
                                        placeholder="https://..." 
                                        className="w-full p-3 bg-gray-50 border rounded-xl text-sm" 
                                        value={certForm.url} 
                                        onChange={e => setCertForm({...certForm, url: e.target.value})}
                                        required 
                                    />
                                    <button type="button" onClick={handleGenerateMockUrl} className="bg-gray-200 px-3 rounded-xl text-xs font-bold hover:bg-gray-300">Mock</button>
                                </div>
                           </div>

                           <button type="submit" className="w-full bg-blue-600 text-white py-3 rounded-xl font-bold mt-2 hover:bg-blue-700">Issue Certificate</button>
                       </form>
                       <button onClick={() => setIsCertModalOpen(false)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"><X className="w-5 h-5"/></button>
                   </div>
               </div>
           )}
      </div>
  );

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

           {/* Waste Rates & CO2 */}
           <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 space-y-4">
                <div className="flex justify-between items-center">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                        <Coins className="w-5 h-5 text-yellow-500" /> Rates & Sustainability
                    </h3>
                    {showSaveConfirmation && (
                        <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded-lg animate-fade-in">Saved!</span>
                    )}
                </div>
                <p className="text-xs text-gray-500">Set the Zoint value and CO₂ saving factor per kg for each waste category.</p>

                <div className="space-y-4">
                    {Object.keys(editedRates).map((cat) => (
                        <div key={cat} className="flex flex-col sm:flex-row items-start sm:items-center gap-3 bg-gray-50 p-3 rounded-xl border border-gray-200">
                            <span className="text-sm font-bold text-gray-600 w-24">{cat}</span>
                            <div className="flex items-center gap-2 flex-1 w-full">
                                <div className="relative flex-1">
                                    <input 
                                        type="number" 
                                        value={editedRates[cat].rate} 
                                        onChange={(e) => handleRateChange(cat, 'rate', e.target.value)}
                                        className="w-full bg-white border border-gray-300 rounded-lg pl-2 pr-10 py-1 text-sm font-bold text-gray-900 focus:outline-none focus:border-green-500"
                                    />
                                    <span className="absolute right-2 top-1 text-[10px] text-gray-400 font-bold mt-0.5">Z/kg</span>
                                </div>
                                <div className="relative flex-1">
                                    <input 
                                        type="number" 
                                        step="0.01"
                                        value={editedRates[cat].co2} 
                                        onChange={(e) => handleRateChange(cat, 'co2', e.target.value)}
                                        className="w-full bg-white border border-gray-300 rounded-lg pl-2 pr-14 py-1 text-sm font-bold text-gray-900 focus:outline-none focus:border-green-500"
                                    />
                                    <span className="absolute right-2 top-1 text-[10px] text-gray-400 font-bold mt-0.5 flex items-center gap-0.5">
                                        <Leaf className="w-2 h-2" /> CO₂
                                    </span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                <button 
                    onClick={saveRates}
                    className="w-full bg-green-700 text-white py-3 rounded-xl font-bold shadow-md hover:bg-green-800 transition-colors flex items-center justify-center gap-2"
                >
                    <Save className="w-4 h-4" /> Save Configuration
                </button>
           </div>
      </div>
  );

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
          {currentView === 'RECYCLING_VOLUME' && <RecyclingVolumeView pickups={pickups} onBack={() => setCurrentView('DASHBOARD')} />}
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

// ... MenuLink component remains the same ...
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