import React, { useState, useEffect, useMemo } from 'react';
import { User, UserRole, WasteRates, PickupTask, RedemptionRequest, BlogPost, Certificate } from '../types';
import { useApp } from '../context/AppContext';
import { BarChart, Bar, XAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie, Legend } from 'recharts';
import { Users, Settings, LogOut, ArrowLeft, Ban, CheckCircle, ShieldAlert, Save, Coins, Search, Mail, Phone, ChevronRight, Truck, Calendar, ArrowDownUp, X, Filter, MapPin, Package, User as UserIcon, AlertTriangle, ImageIcon, Download, Loader2, Scale, FileText, Banknote, Lock, Landmark, UserPlus, BookOpen, Trash2, Plus, Image as ImageIcon2, Shield, FileBadge, Upload, Leaf, Sparkles, BrainCircuit } from 'lucide-react';
import { GoogleGenAI } from "@google/genai";

interface Props {
  user: User;
  onLogout: () => void;
}

type AdminView = 'DASHBOARD' | 'USERS' | 'SETTINGS' | 'PICKUPS' | 'DAILY_STATS' | 'REQUESTS' | 'TIPS' | 'CERTIFICATES';
type SortOption = 'NAME' | 'WEIGHT_DESC' | 'WEIGHT_ASC';

const COLORS = ['#16a34a', '#2563eb', '#ca8a04', '#dc2626', '#9333ea', '#0891b2'];
const PICKUP_BATCH_SIZE = 10;

const MenuLink: React.FC<{ icon: React.ReactNode; label: string; onClick: () => void }> = ({ icon, label, onClick }) => (
  <button onClick={onClick} className="w-full bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between hover:bg-gray-50 hover:border-green-200 transition-all group">
    <div className="flex items-center gap-4">
      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 group-hover:bg-green-100 group-hover:text-green-700 transition-colors">
        {icon}
      </div>
      <span className="font-bold text-gray-700 group-hover:text-gray-900">{label}</span>
    </div>
    <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-green-600" />
  </button>
);

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

  // AI Insights State
  const [showAIInsights, setShowAIInsights] = useState(false);
  const [aiInsightsResult, setAiInsightsResult] = useState('');
  const [isGeneratingInsights, setIsGeneratingInsights] = useState(false);

  // Settings State - Rates
  const [editedRates, setEditedRates] = useState<WasteRates>(wasteRates);
  const [showSaveConfirmation, setShowSaveConfirmation] = useState(false);

  useEffect(() => { setEditedRates(wasteRates); }, [wasteRates]);

  // Reset pagination when filters change
  useEffect(() => {
    setVisiblePickupsCount(PICKUP_BATCH_SIZE);
  }, [pickupFilter, pickupSearch]);

  // --- ACTIONS ---

  const generateAIInsights = async () => {
    setIsGeneratingInsights(true);
    setShowAIInsights(true);
    setAiInsightsResult(''); // Clear previous result

    try {
        // Calculate metrics
        const totalPickups = pickups.length;
        const completedPickups = pickups.filter(p => p.status === 'Completed');
        const totalWeight = completedPickups.reduce((sum, p) => sum + (p.weight || 0), 0);
        const totalZoints = completedPickups.reduce((sum, p) => sum + (p.earnedZoints || 0), 0);
        
        const statusBreakdown = pickups.reduce((acc, p) => {
            acc[p.status] = (acc[p.status] || 0) + 1;
            return acc;
        }, {} as Record<string, number>);

        const categoryBreakdown = completedPickups.reduce((acc, p) => {
            if (p.collectionDetails) {
                p.collectionDetails.forEach(d => {
                    acc[d.category] = (acc[d.category] || 0) + d.weight;
                });
            } else if (p.weight) {
                 // Fallback if no details
                 const cat = p.items.split(',')[0].trim() || 'Unsorted'; 
                 acc[cat] = (acc[cat] || 0) + p.weight;
            }
            return acc;
        }, {} as Record<string, number>);

        const summary = {
            totalPickups,
            totalWeight,
            totalZoints,
            statusBreakdown,
            categoryBreakdown
        };

        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: `Analyze the following recycling data for 'Zilcycler' and provide 3 key insights and 1 actionable recommendation for the admin to improve efficiency or engagement.
            Data: ${JSON.stringify(summary)}`,
        });
        
        setAiInsightsResult(response.text || "No insights generated.");
    } catch (error) {
        console.error("AI Error", error);
        setAiInsightsResult("Failed to generate insights. Please try again.");
    } finally {
        setIsGeneratingInsights(false);
    }
  };

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
        <div className="space-y-6 animate-fade-in relative">
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

             {/* Chart Section */}
             <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100">
                 <h3 className="font-bold text-gray-800 mb-4">Weekly Recycling Volume</h3>
                 <div className="h-64">
                     <ResponsiveContainer width="100%" height="100%">
                         <BarChart data={weeklyStats}>
                             <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 12, fill: '#9ca3af'}} />
                             <Tooltip 
                                 cursor={{fill: '#f3f4f6'}} 
                                 contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} 
                             />
                             <Bar dataKey="value" fill="#16a34a" radius={[4, 4, 0, 0]} barSize={40} onClick={handleBarClick} />
                         </BarChart>
                     </ResponsiveContainer>
                 </div>
                 <p className="text-center text-xs text-gray-400 mt-2">Tap a bar to view daily details</p>
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

                 <div className="flex gap-2">
                    <button 
                        onClick={handleExportReport}
                        className="flex-1 bg-green-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-green-700 transition-colors"
                    >
                        <Download className="w-4 h-4" /> Export CSV
                    </button>
                    <button 
                        onClick={generateAIInsights}
                        className="flex-1 bg-purple-600 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 hover:bg-purple-700 transition-colors"
                    >
                        <Sparkles className="w-4 h-4" /> AI Insights
                    </button>
                 </div>
             </div>

             {/* Navigation Links */}
             <div className="space-y-2">
                 <MenuLink icon={<Users className="w-5 h-5" />} label="User Management" onClick={() => setCurrentView('USERS')} />
                 <MenuLink icon={<Truck className="w-5 h-5" />} label="Pickup Operations" onClick={() => setCurrentView('PICKUPS')} />
                 <MenuLink icon={<Banknote className="w-5 h-5" />} label="Redemption Requests" onClick={() => setCurrentView('REQUESTS')} />
                 <MenuLink icon={<BookOpen className="w-5 h-5" />} label="Content & Tips" onClick={() => setCurrentView('TIPS')} />
                 <MenuLink icon={<FileBadge className="w-5 h-5" />} label="Certificates" onClick={() => setCurrentView('CERTIFICATES')} />
                 <MenuLink icon={<Settings className="w-5 h-5" />} label="System Settings" onClick={() => setCurrentView('SETTINGS')} />
             </div>

             {/* AI Insights Modal */}
             {showAIInsights && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setShowAIInsights(false)}></div>
                    <div className="bg-white rounded-2xl w-full max-w-lg relative z-10 shadow-2xl p-6 animate-fade-in-up max-h-[80vh] overflow-y-auto">
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="text-xl font-bold text-purple-800 flex items-center gap-2">
                                <BrainCircuit className="w-6 h-6" /> AI Analysis
                            </h3>
                            <button onClick={() => setShowAIInsights(false)} className="p-2 hover:bg-gray-100 rounded-full">
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>

                        {isGeneratingInsights ? (
                            <div className="py-12 flex flex-col items-center justify-center text-center">
                                <div className="w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin mb-4"></div>
                                <p className="text-gray-600 font-medium">Analyzing recycling data...</p>
                                <p className="text-xs text-gray-400 mt-2">Connecting to Gemini AI</p>
                            </div>
                        ) : (
                            <div className="prose prose-sm max-w-none text-gray-700">
                                <div className="whitespace-pre-wrap leading-relaxed">
                                    {aiInsightsResult}
                                </div>
                                <div className="mt-6 pt-4 border-t border-gray-100 text-xs text-gray-400 flex items-center justify-center gap-1">
                                    <Sparkles className="w-3 h-3" /> Generated by Gemini 2.5 Flash
                                </div>
                            </div>
                        )}
                    </div>
                </div>
             )}
        </div>
    );
  };

  const renderRequests = () => {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold">Redemption Requests</h2>
            <button onClick={() => handleExportRequests(redemptionRequests)} className="flex items-center gap-2 text-sm font-bold text-green-700 bg-green-50 px-3 py-2 rounded-lg hover:bg-green-100">
                <Download className="w-4 h-4" /> Export
            </button>
        </div>
        {redemptionRequests.length === 0 ? <p className="text-gray-500">No requests.</p> : 
          redemptionRequests.map(req => (
            <div key={req.id} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex justify-between items-center">
                <div>
                    <p className="font-bold">{req.userName}</p>
                    <p className="text-sm text-gray-500">{req.type} - {req.amount} Z</p>
                    <p className="text-xs text-gray-400">{req.date}</p>
                </div>
                <div className="flex gap-2">
                    {req.status === 'Pending' ? (
                        <>
                            <button onClick={() => updateRedemptionStatus(req.id, 'Approved')} className="p-2 bg-green-100 text-green-600 rounded-full hover:bg-green-200"><CheckCircle className="w-5 h-5" /></button>
                            <button onClick={() => updateRedemptionStatus(req.id, 'Rejected')} className="p-2 bg-red-100 text-red-600 rounded-full hover:bg-red-200"><X className="w-5 h-5" /></button>
                        </>
                    ) : (
                        <span className={`px-2 py-1 rounded text-xs font-bold ${req.status === 'Approved' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>{req.status}</span>
                    )}
                </div>
            </div>
          ))
        }
      </div>
    );
  };

  const renderUsers = () => {
    const filteredUsers = users.filter(u => 
      u.name.toLowerCase().includes(userSearch.toLowerCase()) && 
      (roleFilter === 'ALL' || u.role === roleFilter)
    );

    return (
      <div className="space-y-4">
        <div className="flex gap-2">
          <input 
            type="text" 
            placeholder="Search users..." 
            value={userSearch}
            onChange={(e) => setUserSearch(e.target.value)}
            className="flex-1 p-2 border rounded-lg"
          />
          <select value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} className="p-2 border rounded-lg">
            <option value="ALL">All Roles</option>
            {Object.values(UserRole).map(role => <option key={role} value={role}>{role}</option>)}
          </select>
        </div>
        <div className="flex gap-2">
          <button onClick={() => openAddUserModal(UserRole.COLLECTOR)} className="flex-1 bg-blue-600 text-white py-2 rounded-lg font-bold text-sm">Add Collector</button>
          <button onClick={() => openAddUserModal(UserRole.STAFF)} className="flex-1 bg-purple-600 text-white py-2 rounded-lg font-bold text-sm">Add Staff</button>
        </div>
        <div className="space-y-2">
          {filteredUsers.map(u => (
            <div key={u.id} className="bg-white p-4 rounded-xl border border-gray-100 flex justify-between items-center">
              <div>
                <p className="font-bold">{u.name}</p>
                <p className="text-xs text-gray-500">{u.role} • {u.email}</p>
              </div>
              <button 
                onClick={(e) => toggleUserStatus(u.id, e)} 
                className={`px-3 py-1 rounded-full text-xs font-bold ${u.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}
              >
                {u.isActive ? 'Active' : 'Suspended'}
              </button>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderPickups = () => {
    const filteredPickups = pickups.filter(p => 
      (pickupFilter === 'ALL' || p.status === pickupFilter) &&
      p.location.toLowerCase().includes(pickupSearch.toLowerCase())
    );

    return (
      <div className="space-y-4">
        <div className="flex gap-2">
           <input 
            type="text" 
            placeholder="Search location..." 
            value={pickupSearch}
            onChange={(e) => setPickupSearch(e.target.value)}
            className="flex-1 p-2 border rounded-lg"
          />
          <select value={pickupFilter} onChange={(e) => setPickupFilter(e.target.value)} className="p-2 border rounded-lg">
             <option value="ALL">All Status</option>
             <option value="Pending">Pending</option>
             <option value="Assigned">Assigned</option>
             <option value="Completed">Completed</option>
             <option value="Missed">Missed</option>
          </select>
        </div>
        <div className="space-y-2">
           {filteredPickups.slice(0, visiblePickupsCount).map(p => (
             <div key={p.id} className="bg-white p-4 rounded-xl border border-gray-100">
               <div className="flex justify-between">
                 <p className="font-bold text-sm">{p.location}</p>
                 <span className={`text-xs px-2 py-0.5 rounded font-bold ${getStatusColor(p.status)}`}>{p.status}</span>
               </div>
               <p className="text-xs text-gray-500">{p.date} • {p.items}</p>
             </div>
           ))}
           {visiblePickupsCount < filteredPickups.length && (
             <button onClick={handleLoadMorePickups} className="w-full py-2 text-sm text-gray-500">Load More</button>
           )}
        </div>
      </div>
    );
  };

  const renderSettings = () => {
    return (
      <div className="space-y-6">
         <div className="bg-white p-4 rounded-xl border border-gray-100">
            <h3 className="font-bold mb-4">System Configuration</h3>
            <div className="flex justify-between items-center mb-4">
               <span>Maintenance Mode</span>
               <button onClick={() => updateSysConfig({...sysConfig, maintenanceMode: !sysConfig.maintenanceMode})} className={`w-12 h-6 rounded-full relative transition-colors ${sysConfig.maintenanceMode ? 'bg-green-600' : 'bg-gray-300'}`}>
                 <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${sysConfig.maintenanceMode ? 'left-6.5' : 'left-0.5'}`}></div>
               </button>
            </div>
            <div className="flex justify-between items-center">
               <span>Allow Registrations</span>
               <button onClick={() => updateSysConfig({...sysConfig, allowRegistrations: !sysConfig.allowRegistrations})} className={`w-12 h-6 rounded-full relative transition-colors ${sysConfig.allowRegistrations ? 'bg-green-600' : 'bg-gray-300'}`}>
                 <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${sysConfig.allowRegistrations ? 'left-6.5' : 'left-0.5'}`}></div>
               </button>
            </div>
         </div>

         <div className="bg-white p-4 rounded-xl border border-gray-100">
             <div className="flex justify-between items-center mb-4">
                <h3 className="font-bold">Waste Rates</h3>
                <button onClick={saveRates} className="text-sm bg-green-600 text-white px-3 py-1 rounded font-bold">Save</button>
             </div>
             <div className="space-y-3">
                {Object.entries(editedRates).map(([cat, details]) => (
                   <div key={cat} className="flex items-center gap-2">
                      <span className="w-24 text-sm font-bold">{cat}</span>
                      <input 
                        type="number" 
                        value={details.rate} 
                        onChange={(e) => handleRateChange(cat, 'rate', e.target.value)}
                        className="w-20 p-1 border rounded text-right" 
                      />
                      <span className="text-xs text-gray-500">Z/kg</span>
                      <input 
                        type="number" 
                        value={details.co2} 
                        onChange={(e) => handleRateChange(cat, 'co2', e.target.value)}
                        className="w-20 p-1 border rounded text-right" 
                      />
                      <span className="text-xs text-gray-500">CO2/kg</span>
                   </div>
                ))}
             </div>
         </div>
         {showSaveConfirmation && <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-green-600 text-white px-4 py-2 rounded-full shadow-lg">Settings Saved!</div>}
      </div>
    );
  };

  const renderTips = () => (
    <div className="space-y-4">
       <button onClick={() => setIsAddTipOpen(true)} className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 font-bold hover:bg-gray-50">+ Add New Tip</button>
       {blogPosts.map(post => (
         <div key={post.id} className="bg-white p-4 rounded-xl border border-gray-100 flex gap-4">
            <img src={post.image} className="w-16 h-16 rounded object-cover" />
            <div className="flex-1">
               <h4 className="font-bold">{post.title}</h4>
               <p className="text-xs text-gray-500 line-clamp-2">{post.excerpt}</p>
            </div>
            <button onClick={() => deleteBlogPost(post.id)} className="text-red-500"><Trash2 className="w-4 h-4" /></button>
         </div>
       ))}

       {isAddTipOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
             <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
                <h3 className="font-bold mb-4">Add Content</h3>
                <input className="w-full p-2 border rounded mb-2" placeholder="Title" value={newTip.title} onChange={e => setNewTip({...newTip, title: e.target.value})} />
                <input className="w-full p-2 border rounded mb-2" placeholder="Image URL" value={newTip.image} onChange={e => setNewTip({...newTip, image: e.target.value})} />
                <textarea className="w-full p-2 border rounded mb-4" placeholder="Content snippet..." rows={3} value={newTip.excerpt} onChange={e => setNewTip({...newTip, excerpt: e.target.value})}></textarea>
                <div className="flex gap-2">
                   <button onClick={() => setIsAddTipOpen(false)} className="flex-1 py-2 bg-gray-100 rounded">Cancel</button>
                   <button onClick={handleAddTip} className="flex-1 py-2 bg-green-600 text-white rounded">Add</button>
                </div>
             </div>
          </div>
       )}
    </div>
  );

  const renderCertificates = () => (
    <div className="space-y-4">
       <button onClick={() => setIsCertModalOpen(true)} className="w-full py-3 border-2 border-dashed border-gray-300 rounded-xl text-gray-500 font-bold hover:bg-gray-50">+ Issue Certificate</button>
       {certificates.map(cert => (
         <div key={cert.id} className="bg-white p-4 rounded-xl border border-gray-100">
            <p className="font-bold">{cert.orgName}</p>
            <p className="text-xs text-gray-500">{cert.month} {cert.year} • Issued {new Date(cert.dateIssued).toLocaleDateString()}</p>
         </div>
       ))}

       {isCertModalOpen && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
             <div className="bg-white rounded-2xl p-6 w-full max-w-sm">
                <h3 className="font-bold mb-4">Issue Certificate</h3>
                <select className="w-full p-2 border rounded mb-2" value={certForm.orgId} onChange={e => setCertForm({...certForm, orgId: e.target.value})}>
                   <option value="">Select Organization</option>
                   {users.filter(u => u.role === UserRole.ORGANIZATION).map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
                <div className="flex gap-2 mb-2">
                   <select className="flex-1 p-2 border rounded" value={certForm.month} onChange={e => setCertForm({...certForm, month: e.target.value})}>
                      {['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'].map(m => <option key={m} value={m}>{m}</option>)}
                   </select>
                   <input className="w-20 p-2 border rounded" type="number" value={certForm.year} onChange={e => setCertForm({...certForm, year: e.target.value})} />
                </div>
                <input className="w-full p-2 border rounded mb-2" placeholder="PDF URL" value={certForm.url} onChange={e => setCertForm({...certForm, url: e.target.value})} />
                <button onClick={handleGenerateMockUrl} className="text-xs text-blue-600 mb-4 hover:underline">Generate Mock URL</button>
                <div className="flex gap-2">
                   <button onClick={() => setIsCertModalOpen(false)} className="flex-1 py-2 bg-gray-100 rounded">Cancel</button>
                   <button onClick={handleAddCertificate} className="flex-1 py-2 bg-green-600 text-white rounded">Issue</button>
                </div>
             </div>
          </div>
       )}
    </div>
  );

  const renderDailyStats = () => {
      if (!selectedDayStats) return null;
      return (
          <div className="space-y-4">
              <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 text-center">
                  <h2 className="text-2xl font-bold text-gray-800">{new Date(selectedDayStats.date).toDateString()}</h2>
                  <div className="grid grid-cols-2 gap-4 mt-4">
                      <div className="p-3 bg-green-50 rounded-xl">
                          <p className="text-xs text-green-600 uppercase font-bold">Total Weight</p>
                          <p className="text-xl font-bold">{selectedDayStats.weight} kg</p>
                      </div>
                      <div className="p-3 bg-blue-50 rounded-xl">
                          <p className="text-xs text-blue-600 uppercase font-bold">Pickups</p>
                          <p className="text-xl font-bold">{selectedDayStats.count}</p>
                      </div>
                  </div>
              </div>
              
              <h3 className="font-bold text-gray-700">Detailed Pickups</h3>
              {selectedDayStats.items.map(p => (
                  <div key={p.id} className="bg-white p-4 rounded-xl border border-gray-100">
                      <div className="flex justify-between">
                          <span className="font-bold">{p.location}</span>
                          <span className="text-sm font-bold text-green-600">{p.weight} kg</span>
                      </div>
                      <p className="text-xs text-gray-500">{p.items}</p>
                  </div>
              ))}
          </div>
      );
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      {/* Top Bar for Sub-pages */}
      {currentView !== 'DASHBOARD' && (
        <div className="sticky top-0 bg-white border-b border-gray-200 z-10 px-4 py-3 flex items-center gap-3">
          <button onClick={() => setCurrentView('DASHBOARD')} className="p-2 hover:bg-gray-100 rounded-full">
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
          <h1 className="font-bold text-gray-900 capitalize">{currentView.replace('_', ' ').toLowerCase()}</h1>
        </div>
      )}
      
      <div className="p-4">
        {currentView === 'DASHBOARD' && renderDashboard()}
        {currentView === 'USERS' && renderUsers()}
        {currentView === 'PICKUPS' && renderPickups()}
        {currentView === 'SETTINGS' && renderSettings()}
        {currentView === 'REQUESTS' && renderRequests()}
        {currentView === 'TIPS' && renderTips()}
        {currentView === 'CERTIFICATES' && renderCertificates()}
        {currentView === 'DAILY_STATS' && renderDailyStats()}
      </div>

      {/* Add User Modal */}
      {isAddUserOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsAddUserOpen(false)}></div>
              <div className="bg-white rounded-2xl w-full max-w-sm relative z-10 p-6 shadow-2xl">
                  <h3 className="font-bold text-lg mb-4">Add New {addingRole}</h3>
                  <form onSubmit={handleAddUser} className="space-y-3">
                      <input 
                          type="text" 
                          placeholder="Full Name" 
                          value={newUserForm.name}
                          onChange={(e) => setNewUserForm({...newUserForm, name: e.target.value})}
                          className="w-full p-3 border rounded-xl"
                          required
                      />
                      <input 
                          type="email" 
                          placeholder="Email Address" 
                          value={newUserForm.email}
                          onChange={(e) => setNewUserForm({...newUserForm, email: e.target.value})}
                          className="w-full p-3 border rounded-xl"
                          required
                      />
                      <input 
                          type="tel" 
                          placeholder="Phone Number" 
                          value={newUserForm.phone}
                          onChange={(e) => setNewUserForm({...newUserForm, phone: e.target.value})}
                          className="w-full p-3 border rounded-xl"
                          required
                      />
                      <input 
                          type="password" 
                          placeholder="Temporary Password" 
                          value={newUserForm.password}
                          onChange={(e) => setNewUserForm({...newUserForm, password: e.target.value})}
                          className="w-full p-3 border rounded-xl"
                          required
                      />
                      <button type="submit" className="w-full bg-green-700 text-white py-3 rounded-xl font-bold mt-2">Create Account</button>
                  </form>
              </div>
          </div>
      )}
    </div>
  );
};

export default DashboardAdmin;