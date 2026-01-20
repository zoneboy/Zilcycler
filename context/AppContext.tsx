import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { PickupTask, UserRole, WasteRates, SystemConfig, User, RedemptionRequest, BlogPost, DropOffLocation, Message, Certificate } from '../types';
import { API_BASE_URL } from '../constants';

interface AppContextType {
  pickups: PickupTask[];
  wasteRates: WasteRates;
  sysConfig: SystemConfig;
  users: User[];
  redemptionRequests: RedemptionRequest[];
  blogPosts: BlogPost[];
  dropOffLocations: DropOffLocation[];
  messages: Message[];
  certificates: Certificate[];
  schedulePickup: (task: PickupTask) => void;
  updatePickup: (id: string, updates: Partial<PickupTask>) => void;
  getPickupsByRole: (role: UserRole, userId?: string) => PickupTask[];
  updateWasteRates: (newRates: WasteRates) => void;
  updateSysConfig: (config: SystemConfig) => void;
  updateUser: (id: string, updates: Partial<User>) => void;
  login: (email: string, password: string) => Promise<{ user: User; token: string }>;
  verifySession: (token: string) => Promise<{ userId: string; valid: boolean }>;
  requestPasswordReset: (email: string) => Promise<void>;
  resetPassword: (email: string, otp: string, newPassword: string) => Promise<void>;
  initiateChangePassword: (userId: string, currentPassword: string) => Promise<void>;
  confirmChangePassword: (userId: string, otp: string, newPassword: string) => Promise<void>;
  addUser: (user: User, password?: string) => Promise<void>;
  registerUser: (user: User, password: string, otp: string) => Promise<void>;
  sendSignupVerification: (email: string) => Promise<void>;
  createRedemptionRequest: (req: RedemptionRequest) => void;
  updateRedemptionStatus: (id: string, status: 'Approved' | 'Rejected') => void;
  addBlogPost: (post: BlogPost) => void;
  deleteBlogPost: (id: string) => void;
  sendMessage: (msg: Message) => void;
  addCertificate: (cert: Certificate) => void;
  refreshData: () => Promise<void>; // Exposed to trigger refresh after login
  loading: boolean;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Data States
  const [pickups, setPickups] = useState<PickupTask[]>([]);
  const [wasteRates, setWasteRates] = useState<WasteRates>({});
  const [sysConfig, setSysConfig] = useState<SystemConfig>({ maintenanceMode: false, allowRegistrations: true });
  const [users, setUsers] = useState<User[]>([]);
  const [redemptionRequests, setRedemptionRequests] = useState<RedemptionRequest[]>([]);
  const [blogPosts, setBlogPosts] = useState<BlogPost[]>([]);
  const [dropOffLocations, setDropOffLocations] = useState<DropOffLocation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [certificates, setCertificates] = useState<Certificate[]>([]);

  // Helper to get Auth Headers
  const getAuthHeaders = () => {
      const token = localStorage.getItem('zilcycler_token');
      return token ? { 'Authorization': `Bearer ${token}` } : {};
  };

  // Helper for safe fetch
  const safeFetch = async (endpoint: string, options: RequestInit = {}) => {
      const url = `${API_BASE_URL}${endpoint}`;
      try {
          const res = await fetch(url, options);
          
          // Check for HTML response (usually 404 or 500 error page from server/proxy)
          const contentType = res.headers.get("content-type");
          if (contentType && contentType.includes("text/html")) {
              const text = await res.text();
              console.error(`Received HTML response from ${url}:`, text.substring(0, 100));
              throw new Error(`Server Error: Endpoint not found or server error at ${endpoint}`);
          }

          if (!res.ok) {
              // Try to parse error JSON
              let errorMessage = res.statusText;
              try {
                  const errorData = await res.json();
                  errorMessage = errorData.error || errorMessage;
              } catch (e) {
                  // If JSON parse fails, use status text
              }
              throw new Error(errorMessage);
          }
          
          return await res.json();
      } catch (error: any) {
          console.error(`Fetch error for ${endpoint}:`, error);
          throw error;
      }
  };

  const fetchAllData = async () => {
    try {
        const token = localStorage.getItem('zilcycler_token');
        if (!token) {
            setLoading(false);
            return;
        }

        const headers = { 'Authorization': `Bearer ${token}` };

        // Fetch All Protected Data
        const [configData, blogData, locData, certData, usersData, pickupsData, redemptionsData, messagesData] = await Promise.all([
             safeFetch('/config', { headers }),
             safeFetch('/blog', { headers }),
             safeFetch('/locations', { headers }),
             safeFetch('/certificates', { headers }),
             safeFetch('/users', { headers }),
             safeFetch('/pickups', { headers }),
             safeFetch('/redemption', { headers }),
             safeFetch('/messages', { headers })
        ]);

        if (configData) {
             setSysConfig(configData.sysConfig);
             setWasteRates(configData.wasteRates);
        }
        setBlogPosts(blogData || []);
        setDropOffLocations(locData || []);
        setCertificates(certData || []);
        setUsers(usersData || []);
        setPickups(pickupsData || []);
        setRedemptionRequests(redemptionsData || []);
        setMessages(messagesData || []);

    } catch (error: any) {
        console.error("Failed to load data", error);
        setErrorMsg(error.message);
    } finally {
        setLoading(false);
    }
  };

  // Initial Data Fetch
  useEffect(() => {
    fetchAllData();
  }, []);

  const login = async (email: string, password: string): Promise<{ user: User; token: string }> => {
      const data = await safeFetch('/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password })
      });
      
      localStorage.setItem('zilcycler_token', data.token);
      await fetchAllData();
      return data;
  };

  const verifySession = async (token: string): Promise<{ userId: string; valid: boolean }> => {
      return await safeFetch('/auth/verify', {
          method: 'GET',
          headers: {
              'Authorization': `Bearer ${token}`
          }
      });
  };

  const requestPasswordReset = async (email: string): Promise<void> => {
      await safeFetch('/auth/forgot-password', {
          method: 'POST',
          body: JSON.stringify({ email })
      });
  };

  const resetPassword = async (email: string, otp: string, newPassword: string): Promise<void> => {
      await safeFetch('/auth/reset-password', {
          method: 'POST',
          body: JSON.stringify({ email, otp, newPassword })
      });
  };

  const initiateChangePassword = async (userId: string, currentPassword: string): Promise<void> => {
      await safeFetch('/auth/change-password/initiate', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ userId, currentPassword })
      });
  };

  const confirmChangePassword = async (userId: string, otp: string, newPassword: string): Promise<void> => {
      await safeFetch('/auth/change-password/confirm', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ userId, otp, newPassword })
      });
  };

  const schedulePickup = async (task: PickupTask) => {
    try {
        const data = await safeFetch('/pickups', {
            method: 'POST',
            headers: getAuthHeaders(),
            body: JSON.stringify(task)
        });
        if (data.id) {
            const newTask = { ...task, id: data.id };
            setPickups((prev) => [newTask, ...prev]);
        }
    } catch (e) {
        console.error("Failed to schedule pickup", e);
    }
  };

  const updatePickup = async (id: string, updates: Partial<PickupTask>) => {
    setPickups((prev) => 
      prev.map((p) => (p && p.id === id) ? { ...p, ...updates } : p)
    );
    if (updates.earnedZoints && updates.status === 'Completed') {
        const task = pickups.find(p => p.id === id);
        if (task) {
            setUsers(prev => prev.map(u => u.id === task.userId ? { ...u, zointsBalance: u.zointsBalance + (updates.earnedZoints || 0) } : u));
        }
    }

    await safeFetch('/pickups', {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ id, updates })
    });
  };

  const updateWasteRates = async (newRates: WasteRates) => {
    setWasteRates(newRates);
    await safeFetch('/rates/update', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ rates: newRates })
    });
  };

  const updateSysConfig = async (config: SystemConfig) => {
    setSysConfig(config);
    await safeFetch('/config/update', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(config)
    });
  };

  const updateUser = async (id: string, updates: Partial<User>) => {
    setUsers((prev) => prev.map(u => (u && u.id === id) ? { ...u, ...updates } : u));
    await safeFetch('/users', {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ id, updates })
    });
  };

  const addUser = async (user: User, password?: string) => {
    const data = await safeFetch('/users', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ ...user, password })
    });

    const newUser = { ...user, id: data.userId };
    setUsers((prev) => [newUser, ...prev]);
  };

  const sendSignupVerification = async (email: string) => {
      await safeFetch('/auth/send-verification', {
          method: 'POST',
          body: JSON.stringify({ email })
      });
  };

  const registerUser = async (user: User, password: string, otp: string) => {
      const data = await safeFetch('/auth/register', {
          method: 'POST',
          body: JSON.stringify({ user, password, otp })
      });

      const newUser = { ...user, id: data.userId };
      setUsers((prev) => [newUser, ...prev]);
  };

  const createRedemptionRequest = async (req: RedemptionRequest) => {
    const data = await safeFetch('/redemption', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(req)
    });
    if(data.id) {
        const newReq = { ...req, id: data.id };
        setRedemptionRequests((prev) => [newReq, ...prev]);
        setUsers((prevUsers) => prevUsers.map(u => 
            (u && u.id === req.userId)
            ? { ...u, zointsBalance: u.zointsBalance - req.amount } 
            : u
        ));
    }
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
    await safeFetch('/redemption', {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ id, status })
    });
  };

  const addBlogPost = async (post: BlogPost) => {
    const data = await safeFetch('/blog', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(post)
    });
    if(data.id) {
        setBlogPosts(prev => [{...post, id: data.id}, ...prev]);
    }
  };

  const deleteBlogPost = async (id: string) => {
    setBlogPosts(prev => prev.filter(p => p.id !== id));
    await safeFetch('/blog', {
        method: 'DELETE',
        headers: getAuthHeaders(),
        body: JSON.stringify({ id })
    });
  };

  const sendMessage = async (msg: Message) => {
      const data = await safeFetch('/messages', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(msg)
      });
      if(data.id) {
          setMessages(prev => [...prev, { ...msg, id: data.id }]);
      }
  };

  const addCertificate = async (cert: Certificate) => {
      const data = await safeFetch('/certificates', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(cert)
      });
      if(data.id) {
          setCertificates(prev => [{...cert, id: data.id}, ...prev]);
      }
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
        <div className="h-screen w-full flex flex-col items-center justify-center text-green-800 bg-gray-50 dark:bg-gray-900">
           <div className="w-8 h-8 border-4 border-green-200 border-t-green-700 rounded-full animate-spin mb-4"></div>
           <span className="font-bold dark:text-gray-200">Connecting to Zilcycler Cloud...</span>
           {errorMsg && (
             <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-300 rounded-xl text-center max-w-sm border border-red-100 dark:border-red-800">
               <p className="font-bold mb-1">Connection Error</p>
               <p className="text-xs">{errorMsg}</p>
               <p className="text-xs mt-2 text-gray-500 dark:text-gray-400">Ensure the backend is running and reachable.</p>
             </div>
           )}
        </div>
      );
  }

  return (
    <AppContext.Provider value={{ loading, pickups, wasteRates, sysConfig, users, redemptionRequests, blogPosts, dropOffLocations, messages, certificates, sendMessage, schedulePickup, updatePickup, getPickupsByRole, updateWasteRates, updateSysConfig, updateUser, addUser, registerUser, sendSignupVerification, login, verifySession, requestPasswordReset, resetPassword, initiateChangePassword, confirmChangePassword, createRedemptionRequest, updateRedemptionStatus, addBlogPost, deleteBlogPost, addCertificate, refreshData: fetchAllData }}>
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
