import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { PickupTask, UserRole, WasteRates, SystemConfig, User, RedemptionRequest, BlogPost } from '../types';

interface AppContextType {
  pickups: PickupTask[];
  wasteRates: WasteRates;
  sysConfig: SystemConfig;
  users: User[];
  redemptionRequests: RedemptionRequest[];
  blogPosts: BlogPost[];
  schedulePickup: (task: PickupTask) => void;
  updatePickup: (id: string, updates: Partial<PickupTask>) => void;
  getPickupsByRole: (role: UserRole, userId?: string) => PickupTask[];
  updateWasteRates: (newRates: WasteRates) => void;
  updateSysConfig: (config: SystemConfig) => void;
  updateUser: (id: string, updates: Partial<User>) => void;
  addUser: (user: User) => void;
  createRedemptionRequest: (req: RedemptionRequest) => void;
  updateRedemptionStatus: (id: string, status: 'Approved' | 'Rejected') => void;
  addBlogPost: (post: BlogPost) => void;
  deleteBlogPost: (id: string) => void;
  loading: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [pickups, setPickups] = useState<PickupTask[]>([]);
  const [wasteRates, setWasteRates] = useState<WasteRates>({});
  const [sysConfig, setSysConfig] = useState<SystemConfig>({ maintenanceMode: false, allowRegistrations: true });
  const [users, setUsers] = useState<User[]>([]);
  const [redemptionRequests, setRedemptionRequests] = useState<RedemptionRequest[]>([]);
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>([]);

  // Initial Data Fetch
  useEffect(() => {
    const fetchAllData = async () => {
        try {
            setLoading(true);
            const endpoints = [
              '/api/users', 
              '/api/pickups', 
              '/api/config', 
              '/api/redemption', 
              '/api/blog'
            ];
            
            const responses = await Promise.all(endpoints.map(ep => fetch(ep)));
            
            // Check for non-OK responses first
            for (const res of responses) {
              if (!res.ok) {
                const text = await res.text();
                throw new Error(`API Error (${res.status}): ${text.substring(0, 50)}`);
              }
            }

            const usersData = await responses[0].json();
            const pickupsData = await responses[1].json();
            const configData = await responses[2].json();
            const redemptionsData = await responses[3].json();
            const blogData = await responses[4].json();

            setUsers(usersData);
            setPickups(pickupsData);
            setSysConfig(configData.sysConfig);
            setWasteRates(configData.wasteRates);
            setRedemptionRequests(redemptionsData);
            setBlogPosts(blogData);
        } catch (error: any) {
            console.error("Failed to load initial data", error);
            setErrorMsg(error.message);
        } finally {
            setLoading(false);
        }
    };

    fetchAllData();
  }, []);

  const schedulePickup = async (task: PickupTask) => {
    // Optimistic Update
    setPickups((prev) => [task, ...prev]);
    // API Call
    try {
        await fetch('/api/pickups', {
            method: 'POST',
            body: JSON.stringify(task)
        });
    } catch (e) {
        console.error("Failed to schedule pickup", e);
    }
  };

  const updatePickup = async (id: string, updates: Partial<PickupTask>) => {
    setPickups((prev) => 
      prev.map((p) => (p && p.id === id) ? { ...p, ...updates } : p)
    );
    // If completing, we also update user balance in frontend state for immediate feedback
    if (updates.earnedZoints && updates.status === 'Completed') {
        const task = pickups.find(p => p.id === id);
        if (task) {
            setUsers(prev => prev.map(u => u.id === task.userId ? { ...u, zointsBalance: u.zointsBalance + (updates.earnedZoints || 0) } : u));
        }
    }

    await fetch('/api/pickups', {
        method: 'PUT',
        body: JSON.stringify({ id, updates })
    });
  };

  const updateWasteRates = async (newRates: WasteRates) => {
    setWasteRates(newRates);
    await fetch('/api/rates/update', {
        method: 'POST',
        body: JSON.stringify({ rates: newRates })
    });
  };

  const updateSysConfig = async (config: SystemConfig) => {
    setSysConfig(config);
    await fetch('/api/config/update', {
        method: 'POST',
        body: JSON.stringify(config)
    });
  };

  const updateUser = async (id: string, updates: Partial<User>) => {
    setUsers((prev) => prev.map(u => (u && u.id === id) ? { ...u, ...updates } : u));
    await fetch('/api/users', {
        method: 'PUT',
        body: JSON.stringify({ id, updates })
    });
  };

  const addUser = async (user: User) => {
    setUsers((prev) => [user, ...prev]);
    await fetch('/api/users', {
        method: 'POST',
        body: JSON.stringify(user)
    });
  };

  const createRedemptionRequest = async (req: RedemptionRequest) => {
    setRedemptionRequests((prev) => [req, ...prev]);
    setUsers((prevUsers) => prevUsers.map(u => 
        (u && u.id === req.userId)
        ? { ...u, zointsBalance: u.zointsBalance - req.amount } 
        : u
    ));
    await fetch('/api/redemption', {
        method: 'POST',
        body: JSON.stringify(req)
    });
  };

  const updateRedemptionStatus = async (id: string, status: 'Approved' | 'Rejected') => {
    setRedemptionRequests((prev) => prev.map(r => (r && r.id === id) ? { ...r, status } : r));
    
    if (status === 'Rejected') {
        const req = redemptionRequests.find(r => r && r.id === id);
        if (req) {
            setUsers((prevUsers) => prevUsers.map(u => 
                (u && u.id === req.userId)
                ? { ...u, zointsBalance: u.zointsBalance + req.amount } 
                : u
            ));
        }
    }

    await fetch('/api/redemption', {
        method: 'PUT',
        body: JSON.stringify({ id, status })
    });
  };

  const addBlogPost = async (post: BlogPost) => {
    setBlogPosts(prev => [post, ...prev]);
    await fetch('/api/blog', {
        method: 'POST',
        body: JSON.stringify(post)
    });
  };

  const deleteBlogPost = async (id: string) => {
    setBlogPosts(prev => prev.filter(p => p.id !== id));
    await fetch('/api/blog', {
        method: 'DELETE',
        body: JSON.stringify({ id })
    });
  };

  const getPickupsByRole = (role: UserRole, userId?: string) => {
    switch (role) {
      case UserRole.HOUSEHOLD:
      case UserRole.ORGANIZATION:
        return pickups.filter(p => p && p.userId === userId);
      case UserRole.COLLECTOR:
        return pickups.filter(p => p && (p.status === 'Pending' || p.status === 'Assigned' || p.status === 'Missed' || p.status === 'Completed'));
      case UserRole.STAFF:
      case UserRole.ADMIN:
        return pickups;
      default:
        return [];
    }
  };

  if (loading) {
      return (
        <div className="h-screen w-full flex flex-col items-center justify-center text-green-800">
           <div className="w-8 h-8 border-4 border-green-200 border-t-green-700 rounded-full animate-spin mb-4"></div>
           <span className="font-bold">Connecting to Zilcycler Cloud...</span>
           {errorMsg && (
             <div className="mt-4 p-4 bg-red-50 text-red-600 rounded-xl text-center max-w-sm">
               <p className="font-bold mb-1">Connection Error</p>
               <p className="text-xs">{errorMsg}</p>
               <p className="text-xs mt-2 text-gray-500">Ensure Netlify Dev is running to access the database.</p>
             </div>
           )}
        </div>
      );
  }

  return (
    <AppContext.Provider value={{ loading, pickups, wasteRates, sysConfig, users, redemptionRequests, blogPosts, schedulePickup, updatePickup, getPickupsByRole, updateWasteRates, updateSysConfig, updateUser, addUser, createRedemptionRequest, updateRedemptionStatus, addBlogPost, deleteBlogPost }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};