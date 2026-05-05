import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback, useRef } from 'react';
import { 
    User, 
    UserRole, 
    PickupTask, 
    BlogPost, 
    DropOffLocation, 
    SystemConfig, 
    WasteRates, 
    RedemptionRequest,
    Message,
    Certificate
} from '../types';
import { API_BASE_URL } from '../constants';
import { getToken } from '../utils/storage';

// ============================================================
// CONTEXT TYPES
// ============================================================

interface AppContextType {
  users: User[];
  pickups: PickupTask[];
  blogPosts: BlogPost[];
  dropOffLocations: DropOffLocation[];
  redemptionRequests: RedemptionRequest[];
  messages: Message[];
  certificates: Certificate[];
  sysConfig: SystemConfig;
  wasteRates: WasteRates;
  loading: boolean;
  
  login: (email: string, password: string) => Promise<{ user: User; token: string }>;
  verifySession: (token: string) => Promise<{ userId: string }>;
  requestPasswordReset: (email: string) => Promise<void>;
  resetPassword: (email: string, otp: string, newPassword: string) => Promise<void>;
  sendSignupVerification: (email: string) => Promise<void>;
  registerUser: (user: User, password: string, otp: string, acceptedTerms: boolean) => Promise<void>;
  initiateChangePassword: (userId: string, currentPassword: string) => Promise<void>;
  confirmChangePassword: (userId: string, otp: string, newPassword: string) => Promise<void>;
  
  // STAGE 2C: Account deletion
  initiateAccountDeletion: (userId: string, password: string) => Promise<void>;
  confirmAccountDeletion: (userId: string, otp: string, reason?: string) => Promise<void>;
  
  addUser: (user: User, password: string) => Promise<void>;
  updateUser: (id: string, updates: Partial<User>) => Promise<void>;
  
  schedulePickup: (pickup: PickupTask) => Promise<void>;
  updatePickup: (id: string, updates: Partial<PickupTask>) => Promise<void>;
  getPickupsByRole: (role: UserRole, userId?: string) => PickupTask[];
  
  createRedemptionRequest: (req: RedemptionRequest) => Promise<void>;
  updateRedemptionStatus: (id: string, status: 'Approved' | 'Rejected') => Promise<void>;
  
  sendMessage: (msg: Message) => Promise<void>;
  
  updateSysConfig: (config: SystemConfig) => Promise<void>;
  updateWasteRates: (rates: WasteRates) => Promise<void>;
  
  addBlogPost: (post: BlogPost) => Promise<void>;
  deleteBlogPost: (id: string) => Promise<void>;
  
  addCertificate: (cert: Certificate) => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// ============================================================
// API HELPER
// ============================================================

const apiCall = async (endpoint: string, options: RequestInit = {}) => {
    const token = await getToken();
    const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string> || {}),
    };
    
    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }
    
    const response = await fetch(`${API_BASE_URL}/${endpoint}`, {
        ...options,
        headers,
    });
    
    if (!response.ok) {
        let errorMsg = `Request failed: ${response.status}`;
        try {
            const data = await response.json();
            errorMsg = data.error || errorMsg;
        } catch (e) {
            // Response wasn't JSON
        }
        throw new Error(errorMsg);
    }
    
    if (response.status === 204) return null;
    
    return response.json();
};

// ============================================================
// PROVIDER
// ============================================================

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [users, setUsers] = useState<User[]>([]);
    const [pickups, setPickups] = useState<PickupTask[]>([]);
    const [blogPosts, setBlogPosts] = useState<BlogPost[]>([]);
    const [dropOffLocations, setDropOffLocations] = useState<DropOffLocation[]>([]);
    const [redemptionRequests, setRedemptionRequests] = useState<RedemptionRequest[]>([]);
    const [messages, setMessages] = useState<Message[]>([]);
    const [certificates, setCertificates] = useState<Certificate[]>([]);
    const [sysConfig, setSysConfig] = useState<SystemConfig>({ maintenanceMode: false, allowRegistrations: true });
    const [wasteRates, setWasteRates] = useState<WasteRates>({});
    const [loading, setLoading] = useState(true);
    
    const hasInitialized = useRef(false);

    const fetchConfig = useCallback(async () => {
        try {
            const data = await apiCall('config');
            if (data.sysConfig) setSysConfig(data.sysConfig);
            if (data.wasteRates) setWasteRates(data.wasteRates);
        } catch (e) {
            console.error('Failed to fetch config', e);
        }
    }, []);

    const fetchUsers = useCallback(async () => {
        try {
            const data = await apiCall('users');
            setUsers(data || []);
        } catch (e) {
            console.error('Failed to fetch users', e);
        }
    }, []);

    const fetchPickups = useCallback(async () => {
        try {
            const data = await apiCall('pickups');
            setPickups(data || []);
        } catch (e) {
            console.error('Failed to fetch pickups', e);
        }
    }, []);

    const fetchBlog = useCallback(async () => {
        try {
            const data = await apiCall('blog');
            setBlogPosts(data || []);
        } catch (e) {
            console.error('Failed to fetch blog', e);
        }
    }, []);

    const fetchLocations = useCallback(async () => {
        try {
            const data = await apiCall('locations');
            setDropOffLocations(data || []);
        } catch (e) {
            console.error('Failed to fetch locations', e);
        }
    }, []);

    const fetchRedemption = useCallback(async () => {
        try {
            const data = await apiCall('redemption');
            setRedemptionRequests(data || []);
        } catch (e) {
            console.error('Failed to fetch redemption', e);
        }
    }, []);

    const fetchMessages = useCallback(async () => {
        try {
            const data = await apiCall('messages');
            setMessages(data || []);
        } catch (e) {
            console.error('Failed to fetch messages', e);
        }
    }, []);

    const fetchCertificates = useCallback(async () => {
        try {
            const data = await apiCall('certificates');
            setCertificates(data || []);
        } catch (e) {
            console.error('Failed to fetch certificates', e);
        }
    }, []);

    const refreshAll = useCallback(async () => {
        await Promise.all([
            fetchUsers(),
            fetchPickups(),
            fetchRedemption(),
            fetchMessages(),
            fetchCertificates(),
        ]);
    }, [fetchUsers, fetchPickups, fetchRedemption, fetchMessages, fetchCertificates]);

    useEffect(() => {
        if (hasInitialized.current) return;
        hasInitialized.current = true;
        
        const init = async () => {
            await Promise.all([
                fetchConfig(),
                fetchBlog(),
                fetchLocations(),
            ]);
            
            const token = await getToken();
            if (token) {
                await refreshAll();
            }
            
            setLoading(false);
        };
        init();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const login = async (email: string, password: string) => {
        const data = await apiCall('auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        });
        setTimeout(async () => {
            await refreshAll();
        }, 200);
        return { user: data.user, token: data.token };
    };

    const verifySession = useCallback(async (token: string) => {
        const response = await fetch(`${API_BASE_URL}/auth/verify`, {
            headers: { 'Authorization': `Bearer ${token}` },
        });
        if (!response.ok) throw new Error('Invalid session');
        const data = await response.json();
        await refreshAll();
        return data;
    }, [refreshAll]);

    const requestPasswordReset = async (email: string) => {
        await apiCall('auth/forgot-password', {
            method: 'POST',
            body: JSON.stringify({ email }),
        });
    };

    const resetPassword = async (email: string, otp: string, newPassword: string) => {
        await apiCall('auth/reset-password', {
            method: 'POST',
            body: JSON.stringify({ email, otp, newPassword }),
        });
    };

    const sendSignupVerification = async (email: string) => {
        await apiCall('auth/send-verification', {
            method: 'POST',
            body: JSON.stringify({ email }),
        });
    };

    // STAGE 2C: Send acceptedTerms with registration
    const registerUser = async (user: User, password: string, otp: string, acceptedTerms: boolean) => {
        await apiCall('auth/register', {
            method: 'POST',
            body: JSON.stringify({ user, password, otp, acceptedTerms }),
        });
    };

    const initiateChangePassword = async (userId: string, currentPassword: string) => {
        await apiCall('auth/change-password/initiate', {
            method: 'POST',
            body: JSON.stringify({ userId, currentPassword }),
        });
    };

    const confirmChangePassword = async (userId: string, otp: string, newPassword: string) => {
        await apiCall('auth/change-password/confirm', {
            method: 'POST',
            body: JSON.stringify({ userId, otp, newPassword }),
        });
    };

    // STAGE 2C: Account deletion methods
    const initiateAccountDeletion = async (userId: string, password: string) => {
        await apiCall('auth/delete-account/initiate', {
            method: 'POST',
            body: JSON.stringify({ userId, password }),
        });
    };

    const confirmAccountDeletion = async (userId: string, otp: string, reason?: string) => {
        await apiCall('auth/delete-account/confirm', {
            method: 'POST',
            body: JSON.stringify({ userId, otp, reason: reason || '' }),
        });
    };

    const addUser = async (user: User, password: string) => {
        await apiCall('users', {
            method: 'POST',
            body: JSON.stringify({ ...user, password }),
        });
        await fetchUsers();
    };

    const updateUser = async (id: string, updates: Partial<User>) => {
        await apiCall('users', {
            method: 'PUT',
            body: JSON.stringify({ id, updates }),
        });
        await fetchUsers();
    };

    const schedulePickup = async (pickup: PickupTask) => {
        await apiCall('pickups', {
            method: 'POST',
            body: JSON.stringify(pickup),
        });
        await fetchPickups();
    };

    const updatePickup = async (id: string, updates: Partial<PickupTask>) => {
        await apiCall('pickups', {
            method: 'PUT',
            body: JSON.stringify({ id, updates }),
        });
        await Promise.all([fetchPickups(), fetchUsers()]);
    };

    const getPickupsByRole = useCallback((role: UserRole, userId?: string): PickupTask[] => {
        if (role === UserRole.ADMIN || role === UserRole.STAFF) {
            return pickups;
        }
        if (role === UserRole.COLLECTOR) {
            return pickups;
        }
        if (userId) {
            return pickups.filter(p => p.userId === userId);
        }
        return [];
    }, [pickups]);

    const createRedemptionRequest = async (req: RedemptionRequest) => {
        await apiCall('redemption', {
            method: 'POST',
            body: JSON.stringify(req),
        });
        await Promise.all([fetchRedemption(), fetchUsers()]);
    };

    const updateRedemptionStatus = async (id: string, status: 'Approved' | 'Rejected') => {
        await apiCall('redemption', {
            method: 'PUT',
            body: JSON.stringify({ id, status }),
        });
        await Promise.all([fetchRedemption(), fetchUsers()]);
    };

    const sendMessage = async (msg: Message) => {
        await apiCall('messages', {
            method: 'POST',
            body: JSON.stringify(msg),
        });
        await fetchMessages();
    };

    const updateSysConfig = async (config: SystemConfig) => {
        await apiCall('config/update', {
            method: 'POST',
            body: JSON.stringify(config),
        });
        setSysConfig(config);
    };

    const updateWasteRates = async (rates: WasteRates) => {
        await apiCall('rates/update', {
            method: 'POST',
            body: JSON.stringify({ rates }),
        });
        setWasteRates(rates);
    };

    const addBlogPost = async (post: BlogPost) => {
        await apiCall('blog', {
            method: 'POST',
            body: JSON.stringify(post),
        });
        await fetchBlog();
    };

    const deleteBlogPost = async (id: string) => {
        await apiCall('blog', {
            method: 'DELETE',
            body: JSON.stringify({ id }),
        });
        await fetchBlog();
    };

    const addCertificate = async (cert: Certificate) => {
        await apiCall('certificates', {
            method: 'POST',
            body: JSON.stringify(cert),
        });
        await fetchCertificates();
    };

    const value: AppContextType = {
        users,
        pickups,
        blogPosts,
        dropOffLocations,
        redemptionRequests,
        messages,
        certificates,
        sysConfig,
        wasteRates,
        loading,
        login,
        verifySession,
        requestPasswordReset,
        resetPassword,
        sendSignupVerification,
        registerUser,
        initiateChangePassword,
        confirmChangePassword,
        initiateAccountDeletion,
        confirmAccountDeletion,
        addUser,
        updateUser,
        schedulePickup,
        updatePickup,
        getPickupsByRole,
        createRedemptionRequest,
        updateRedemptionStatus,
        sendMessage,
        updateSysConfig,
        updateWasteRates,
        addBlogPost,
        deleteBlogPost,
        addCertificate,
    };

    return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
};

export const useApp = (): AppContextType => {
    const context = useContext(AppContext);
    if (!context) {
        throw new Error('useApp must be used within an AppProvider');
    }
    return context;
};