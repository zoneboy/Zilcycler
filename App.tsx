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
    isNative,
} from './utils/native';
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
import { Home, FileText, Settings as SettingsIcon, LogOut, ArrowLeft, Wallet, WifiOff } from 'lucide-react';

// Helper function to check token expiry (Basic JWT check)
const isTokenExpired = (token: string): boolean => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return Date.now() >= payload.exp * 1000;
  } catch (e) {
    return true;
  }
};

const MainApp: React.FC = () => {
  const { users, loading, verifySession } = useApp();
  
  const [sessionToken, setSessionToken] = useState<string | null>(null);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [currentScreen, setCurrentScreen] = useState<Screen>(Screen.AUTH);
  const [isVerifying, setIsVerifying] = useState(true);
  const [isOnline, setIsOnline] = useState(true);

  // STAGE 2B: Initialize native plugins on mount
  useEffect(() => {
    const initNative = async () => {
      await initStatusBar();
      
      // Check initial network state
      const status = await getNetworkStatus();
      setIsOnline(status.connected);
    };
    initNative();
    
    // Listen for network changes
    const cleanup = onNetworkChange((connected) => {
      setIsOnline(connected);
    });
    
    return cleanup;
  }, []);

  // STAGE 2B: Async token retrieval
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

  // STAGE 2B: Hide splash screen once initial loading is done
  useEffect(() => {
    if (!loading && !isVerifying) {
      hideSplashScreen();
    }
  }, [loading, isVerifying]);

  // STAGE 2B: Hardware back button handler
  useEffect(() => {
    const handleBack = (): boolean => {
      // If on AUTH screen, allow exit
      if (currentScreen === Screen.AUTH) {
        return false; // Not handled - app will exit
      }
      
      // If on DASHBOARD, allow exit
      if (currentScreen === Screen.DASHBOARD) {
        return false; // Not handled - app will exit
      }
      
      // Otherwise, navigate back to dashboard
      setCurrentScreen(Screen.DASHBOARD);
      return true; // Handled
    };
    
    const cleanup = setupBackButtonHandler(handleBack);
    return cleanup;
  }, [currentScreen]);

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

  // STAGE 2B: Offline banner overlay (shown across all screens)
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
      <div className={`bg-gray-50 dark:bg-gray-900 min-h-screen flex justify-center font-sans text-gray-900 dark:text-gray-100 transition-colors duration-300 ${!isOnline ? 'pt-10' : ''}`}>
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
        <AppProvider>
            <MainApp />
        </AppProvider>
    );
};

export default App;