import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { PickupTask, UserRole, WasteRates, SystemConfig, User, RedemptionRequest, BlogPost, DropOffLocation, Message, Certificate } from '../types';

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

  const fetchAllData = async () => {
    try {
        // We set loading false early for public data, but keep internal loading state if needed
        // Fetch Public Config/Data first
        const [configRes, blogRes, locRes, certRes] = await Promise.all([
             fetch('/api/config'),
             fetch('/api/blog'),
             fetch('/api/locations'),
             fetch('/api/certificates')
        ]);

        if (configRes.ok) {
             const configData = await configRes.json();
             setSysConfig(configData.sysConfig);
             setWasteRates(configData.wasteRates);
        }
        if (blogRes.ok) setBlogPosts(await blogRes.json());
        if (locRes.ok) setDropOffLocations(await locRes.json());
        if (certRes.ok) setCertificates(await certRes.json());

        // Check if we have a token for protected data
        const token = localStorage.getItem('zilcycler_token');
        if (token) {
             const headers = { 'Authorization': `Bearer ${token}` };
             
             // Protected Endpoints
             const [usersRes, pickupsRes, redemptionsRes, messagesRes] = await Promise.all([
                 fetch('/api/users', { headers }),
                 fetch('/api/pickups', { headers }),
                 fetch('/api/redemption', { headers }),
                 fetch('/api/messages', { headers })
             ]);

             if (usersRes.ok) setUsers(await usersRes.json());
             if (pickupsRes.ok) setPickups(await pickupsRes.json());
             if (redemptionsRes.ok) setRedemptionRequests(await redemptionsRes.json());
             if (messagesRes.ok) setMessages(await messagesRes.json());
        }

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
      const response = await fetch('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password })
      });
      
      if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || 'Login failed');
      }

      const data = await response.json();
      // Store token immediately so subsequent fetches work
      localStorage.setItem('zilcycler_token', data.token);
      
      // Trigger data refresh to load protected data
      await fetchAllData();

      return data;
  };

  const verifySession = async (token: string): Promise<{ userId: string; valid: boolean }> => {
      const response = await fetch('/api/auth/verify', {
          method: 'GET',
          headers: {
              'Authorization': `Bearer ${token}`
          }
      });

      if (!response.ok) {
          throw new Error('Invalid or expired session');
      }

      return await response.json();
  };

  const requestPasswordReset = async (email: string): Promise<void> => {
      const response = await fetch('/api/auth/forgot-password', {
          method: 'POST',
          body: JSON.stringify({ email })
      });
      
      if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || 'Request failed');
      }
  };

  const resetPassword = async (email: string, otp: string, newPassword: string): Promise<void> => {
      const response = await fetch('/api/auth/reset-password', {
          method: 'POST',
          body: JSON.stringify({ email, otp, newPassword })
      });
      
      if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || 'Reset failed');
      }
  };

  const initiateChangePassword = async (userId: string, currentPassword: string): Promise<void> => {
      const response = await fetch('/api/auth/change-password/initiate', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ userId, currentPassword })
      });
      if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || 'Password verification failed');
      }
  };

  const confirmChangePassword = async (userId: string, otp: string, newPassword: string): Promise<void> => {
      const response = await fetch('/api/auth/change-password/confirm', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ userId, otp, newPassword })
      });
      if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || 'Failed to update password');
      }
  };

  const schedulePickup = async (task: PickupTask) => {
    setPickups((prev) => [task, ...prev]);
    try {
        await fetch('/api/pickups', {
            method: 'POST',
            headers: getAuthHeaders(),
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
    if (updates.earnedZoints && updates.status === 'Completed') {
        const task = pickups.find(p => p.id === id);
        if (task) {
            setUsers(prev => prev.map(u => u.id === task.userId ? { ...u, zointsBalance: u.zointsBalance + (updates.earnedZoints || 0) } : u));
        }
    }

    await fetch('/api/pickups', {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ id, updates })
    });
  };

  const updateWasteRates = async (newRates: WasteRates) => {
    setWasteRates(newRates);
    await fetch('/api/rates/update', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ rates: newRates })
    });
  };

  const updateSysConfig = async (config: SystemConfig) => {
    setSysConfig(config);
    await fetch('/api/config/update', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(config)
    });
  };

  const updateUser = async (id: string, updates: Partial<User>) => {
    setUsers((prev) => prev.map(u => (u && u.id === id) ? { ...u, ...updates } : u));
    await fetch('/api/users', {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ id, updates })
    });
  };

  const addUser = async (user: User, password?: string) => {
    // Standard User Creation (Used by Admin)
    const response = await fetch('/api/users', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ ...user, password })
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Registration failed: ${errorText}`);
    }

    // Only update state if successful
    setUsers((prev) => [user, ...prev]);
  };

  const sendSignupVerification = async (email: string) => {
      const response = await fetch('/api/auth/send-verification', {
          method: 'POST',
          body: JSON.stringify({ email })
      });
      if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || 'Failed to send verification email');
      }
  };

  const registerUser = async (user: User, password: string, otp: string) => {
      const response = await fetch('/api/auth/register', {
          method: 'POST',
          body: JSON.stringify({ user, password, otp })
      });

      if (!response.ok) {
          const err = await response.json();
          throw new Error(err.error || 'Registration failed');
      }

      setUsers((prev) => [user, ...prev]);
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
        headers: getAuthHeaders(),
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
        headers: getAuthHeaders(),
        body: JSON.stringify({ id, status })
    });
  };

  const addBlogPost = async (post: BlogPost) => {
    setBlogPosts(prev => [post, ...prev]);
    await fetch('/api/blog', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(post)
    });
  };

  const deleteBlogPost = async (id: string) => {
    setBlogPosts(prev => prev.filter(p => p.id !== id));
    await fetch('/api/blog', {
        method: 'DELETE',
        headers: getAuthHeaders(),
        body: JSON.stringify({ id })
    });
  };

  const sendMessage = async (msg: Message) => {
      setMessages(prev => [...prev, msg]);
      await fetch('/api/messages', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(msg)
      });
  };

  const addCertificate = async (cert: Certificate) => {
      setCertificates(prev => [cert, ...prev]);
      await fetch('/api/certificates', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify(cert)
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