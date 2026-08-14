import React, { useState, useEffect, useCallback } from 'react';
import { User, UserRole, Screen } from './types';
import { AppProvider, useApp } from './context/AppContext';
import { getToken, setToken, removeToken } from './utils/storage';
import { 
    initStatusBar, 
    hideSplashScreen, 
    setupBackButtonHandler, 
    onNetworkChange,
    getNetworkStatus,
} from './utils/native';
import { initErrorTracking, logError } from './utils/errorTracking';
import { checkAppVersion, VersionCheckResult } from './utils/versionCheck';
import Auth from './components/Auth';
import DashboardHousehold from './components/DashboardHousehold';
import DashboardCollector from './components/DashboardCollector';
import DashboardOrganization from './components/DashboardOrganization';
import DashboardStaff from './components/DashboardStaff';
import DashboardAdmin from './components/DashboardAdmin';
import SchedulePickup from './components/SchedulePickup';
import BlogList from './components/BlogList';
import Settings from './components/Settings';
import DropOffLocations from './components/DropOffLocations';
import MessagesWithUser from './components/Messages'; 
import WalletScreen from './components/WalletScreen';
import PickupHistory from './components/PickupHistory';
import Certificates from './components/Certificates';
import { Home, FileText, Settings as SettingsIcon, LogOut, ArrowLeft, Wallet, WifiOff, Download, AlertTriangle } from 'lucide-react';

// JWT expiry helper
const isTokenExpired = (token: string): boolean => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return Date.now() >= payload.exp * 1000;
  } catch (e) {
    return true;
  }
};

// ============================================================
// ERROR BOUNDARY (catches React rendering errors)
// ============================================================
interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

class ErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
    constructor(props: { children: React.ReactNode }) {
        super(props);
        this.state = { hasError: false, error: null };
    }
    
    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }
    
    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        logError('react_error_boundary', error, {
            componentStack: errorInfo.componentStack,
        });
    }
    
    handleReload = () => {
        if (typeof window !== 'undefined') {
            window.location.reload();
        }
    };
    
    render() {
        if (this.state.hasError) {
            return (
                <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center p-6">
                    <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 text-center">
                        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                            <AlertTriangle className="w-8 h-8 text-red-600 dark:text-red-400" />
                        </div>
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Something went wrong</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                            We've been notified. Please reload the app to try again.
                        </p>
                        <button 
                            onClick={this.handleReload}
                            className="w-full bg-green-700 text-white py-3 rounded-xl font-bold hover:bg-green-800 transition-colors"
                        >
                            Reload App
                        </button>
                    </div>
                </div>
            );
        }
        return this.props.children;
    }
}

// ============================================================
// FORCE UPDATE MODAL
// ============================================================
const ForceUpdateModal: React.FC<{ result: VersionCheckResult }> = ({ result }) => {
    const handleUpdate = () => {
        if (result.updateUrl && typeof window !== 'undefined') {
            window.open(result.updateUrl, '_blank');
        } else if (typeof window !== 'undefined') {
            window.location.reload();
        }
    };
    
    return (
        <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6">
            <div className="max-w-sm w-full bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-6 text-center">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Download className="w-8 h-8 text-green-700 dark:text-green-500" />
                </div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Update Required</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                    {result.updateMessage || 'A new version of Zilcycler is available. Please update to continue.'}
                </p>
                <button 
                    onClick={handleUpdate}
                    className="w-full bg-green-700 text-white py-3 rounded-xl font-bold hover:bg-green-800 transition-colors"
                >
                    {result.updateUrl ? 'Open Play Store' : 'Reload App'}
                </button>
            </div>
        </div>
    );
};

const MainApp: React.FC = () => {
  const { users, loading, verifySession } = useApp();
  
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [currentScreen, setCurrentScreen] = useState<Screen>(Screen.AUTH);
  const [isVerifying, setIsVerifying] = useState(true);
  const [isOnline, setIsOnline] = useState(true);
  const [forceUpdateInfo, setForceUpdateInfo] = useState<VersionCheckResult | null>(null);

  // Initialize native plugins, error tracking, version check
  useEffect(() => {
    const initApp = async () => {
      // Error tracking first - want to catch any errors during init
      initErrorTracking();
      
      // Native plugins
      await initStatusBar();
      
      // Network status
      const status = await getNetworkStatus();
      setIsOnline(status.connected);
      
      // Version check - only enforce force-update, ignore rest
      const versionResult = await checkAppVersion();
      if (versionResult?.forceUpdate) {
        setForceUpdateInfo(versionResult);
      }
    };
    initApp();
    
    const cleanup = onNetworkChange((connected) => {
      setIsOnline(connected);
    });
    
    return cleanup;
  }, []);

  // Async token retrieval
  useEffect(() => {
    const loadToken = async () => {
      const token = await getToken();
      if (token && !isTokenExpired(token)) {
        setSessionToken(token);
      } else if (token) {
        await removeToken();
      }
    };
    loadToken();
  }, []);

  const handleLogin = async (userId: string, token: string) => {
    await setToken(token);
    setSessionToken(token);
    setSessionUserId(userId);
    setCurrentScreen(Screen.DASHBOARD);
  };

  const handleLogout = useCallback(async () => {
    await removeToken();
    setSessionToken(null);
    setSessionUserId(null);
    setCurrentScreen(Screen.AUTH);
  }, []);

  // Validate session
  useEffect(() => {
      const restoreSession = async () => {
          if (!sessionToken) {
              setIsVerifying(false);
              return;
          }
          
          try {
              const { userId } = await verifySession(sessionToken);
              setSessionUserId(userId);
              setCurrentScreen(Screen.DASHBOARD);
          } catch (e) {
              console.error("Invalid session", e);
              await handleLogout();
          } finally {
              setIsVerifying(false);
          }
      };

      if (!loading) {
          restoreSession();
      }
  }, [loading, sessionToken, verifySession, handleLogout]);

  // Hide splash screen once initial loading is done
  useEffect(() => {
    if (!loading && !isVerifying) {
      hideSplashScreen();
    }
  }, [loading, isVerifying]);

  // Hardware back button handler
  useEffect(() => {
    const handleBack = (): boolean => {
      if (currentScreen === Screen.AUTH) return false;
      if (currentScreen === Screen.DASHBOARD) return false;
      setCurrentScreen(Screen.DASHBOARD);
      return true;
    };
    
    const cleanup = setupBackButtonHandler(handleBack);
    return cleanup;
  }, [currentScreen]);

  // Force update modal blocks everything else
  if (forceUpdateInfo) {
    return <ForceUpdateModal result={forceUpdateInfo} />;
  }

  // Loading state
  if (loading || isVerifying) {
       return (
        <div className="h-screen w-full flex flex-col items-center justify-center text-green-800 bg-gray-50 dark:bg-gray-900">
           <div className="w-8 h-8 border-4 border-green-200 border-t-green-700 rounded-full animate-spin mb-4"></div>
           <span className="font-bold dark:text-white">{loading ? 'Initializing Zilcycler...' : 'Verifying Session...'}</span>
        </div>
      );
  }

  const currentUser = users.find(u => u && u.id === sessionUserId) || null;

  const renderScreen = () => {
    const effectiveUser = currentUser;

    if (!effectiveUser && currentScreen !== Screen.AUTH) {
        return <Auth onLogin={handleLogin} />;
    }

    if (!effectiveUser) return <Auth onLogin={handleLogin} />;

    switch (currentScreen) {
      case Screen.DASHBOARD:
        switch (effectiveUser.role) {
          case UserRole.HOUSEHOLD:
            return <DashboardHousehold user={effectiveUser} onNavigate={setCurrentScreen} />;
          case UserRole.COLLECTOR:
            return <DashboardCollector user={effectiveUser} onLogout={handleLogout} />;
          case UserRole.ORGANIZATION:
            return <DashboardOrganization user={effectiveUser} onNavigate={setCurrentScreen} />;
          case UserRole.STAFF:
            return <DashboardStaff user={effectiveUser} onLogout={handleLogout} />;
          case UserRole.ADMIN:
            return <DashboardAdmin user={effectiveUser} onLogout={handleLogout} />;
          default:
            return <div>Role not supported yet</div>;
        }
      case Screen.SCHEDULE_PICKUP:
        return <SchedulePickup user={effectiveUser} onBack={() => setCurrentScreen(Screen.DASHBOARD)} onSubmit={() => setCurrentScreen(Screen.DASHBOARD)} />;
      case Screen.BLOG:
        return <BlogList />;
      case Screen.SETTINGS:
        return <Settings user={effectiveUser} onLogout={handleLogout} />;
      case Screen.DROP_OFF:
        return <DropOffLocations />;
      case Screen.MESSAGES:
        return <MessagesWithUser user={effectiveUser} />; 
      case Screen.WALLET:
        return <WalletScreen user={effectiveUser} />;
      case Screen.PICKUP_HISTORY:
        return <PickupHistory user={effectiveUser} onBack={() => setCurrentScreen(Screen.DASHBOARD)} />;
      case Screen.CERTIFICATES:
        return <Certificates user={effectiveUser} onBack={() => setCurrentScreen(Screen.DASHBOARD)} />;
      default:
        return <DashboardHousehold user={effectiveUser} onNavigate={setCurrentScreen} />;
    }
  };

  const offlineBanner = !isOnline && (
    <div className="fixed top-0 left-0 right-0 z-[200] bg-orange-500 text-white text-center py-2 px-4 text-sm font-bold shadow-lg flex items-center justify-center gap-2 animate-fade-in-down">
      <WifiOff className="w-4 h-4" />
      <span>You're offline. Some features may not work.</span>
    </div>
  );

  if (currentScreen === Screen.AUTH) {
    return (
      <>
        {offlineBanner}
        <Auth onLogin={handleLogin} />
      </>
    );
  }
  
  if (!currentUser) {
    return (
      <>
        {offlineBanner}
        <Auth onLogin={handleLogin} />
      </>
    );
  }

  return (
    <>
      {offlineBanner}
      {/* pt-safe: Android 15+ forces edge-to-edge, so the webview draws under the
          status bar. env(safe-area-inset-top) is 0 on web and older devices. */}
      <div className={`bg-gray-50 dark:bg-gray-900 min-h-screen flex justify-center font-sans text-gray-900 dark:text-gray-100 transition-colors duration-300 ${!isOnline ? 'pt-10' : 'pt-safe'}`}>
        <div className="w-full max-w-md bg-white dark:bg-gray-900 min-h-screen shadow-2xl relative flex flex-col transition-colors duration-300">
          
          {currentScreen !== Screen.DASHBOARD && (
              <div className="p-4 flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 sticky top-0 z-20 transition-colors duration-300">
                  <button onClick={() => setCurrentScreen(Screen.DASHBOARD)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
                      <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                  </button>
                  <span className="font-bold text-lg capitalize text-gray-900 dark:text-white">{currentScreen.toLowerCase().replace('_', ' ')}</span>
              </div>
          )}

          <main className="flex-1 p-6 overflow-y-auto scroll-smooth">
            {renderScreen()}
          </main>

          {(currentUser.role === UserRole.HOUSEHOLD || currentUser.role === UserRole.ORGANIZATION) && (
            <nav className="sticky bottom-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 py-3 px-6 flex justify-between items-center z-30 pb-safe transition-colors duration-300">
              <button 
                onClick={() => setCurrentScreen(Screen.DASHBOARD)} 
                className={`flex flex-col items-center gap-1 ${currentScreen === Screen.DASHBOARD ? 'text-green-700 dark:text-green-500' : 'text-gray-400 dark:text-gray-500'}`}
              >
                <Home className="w-6 h-6" />
                <span className="text-[10px] font-bold">Home</span>
              </button>
              <button 
                onClick={() => setCurrentScreen(Screen.BLOG)}
                className={`flex flex-col items-center gap-1 ${currentScreen === Screen.BLOG ? 'text-green-700 dark:text-green-500' : 'text-gray-400 dark:text-gray-500'}`}
              >
                <FileText className="w-6 h-6" />
                <span className="text-[10px] font-bold">Tips</span>
              </button>
              <button 
                onClick={() => setCurrentScreen(Screen.WALLET)}
                className={`flex flex-col items-center gap-1 ${currentScreen === Screen.WALLET ? 'text-green-700 dark:text-green-500' : 'text-gray-400 dark:text-gray-500'}`}
              >
                <Wallet className="w-6 h-6" />
                <span className="text-[10px] font-bold">Wallet</span>
              </button>
              <button 
                onClick={() => setCurrentScreen(Screen.SETTINGS)}
                className={`flex flex-col items-center gap-1 ${currentScreen === Screen.SETTINGS ? 'text-green-700 dark:text-green-500' : 'text-gray-400 dark:text-gray-500'}`}
              >
                <SettingsIcon className="w-6 h-6" />
                <span className="text-[10px] font-bold">Settings</span>
              </button>
              <button onClick={handleLogout} className="flex flex-col items-center gap-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400">
                <LogOut className="w-6 h-6" />
                <span className="text-[10px] font-bold">Logout</span>
              </button>
            </nav>
          )}
        </div>
      </div>
    </>
  );
};

const App: React.FC = () => {
    return (
        <ErrorBoundary>
            <AppProvider>
                <MainApp />
            </AppProvider>
        </ErrorBoundary>
    );
};

export default App;