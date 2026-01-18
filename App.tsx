import React, { useState, useEffect } from 'react';
import { User, UserRole, Screen } from './types';
import { AppProvider, useApp } from './context/AppContext';
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
import { Home, FileText, Settings as SettingsIcon, LogOut, ArrowLeft, Building2, Wallet } from 'lucide-react';

const MainApp: React.FC = () => {
  const { users, loading } = useApp();
  
  // Initialize state from localStorage
  const [sessionUserId, setSessionUserId] = useState<string | null>(() => {
      return localStorage.getItem('zilcycler_session_id');
  });
  
  // Set initial screen based on session existence
  const [currentScreen, setCurrentScreen] = useState<Screen>(() => {
      return localStorage.getItem('zilcycler_session_id') ? Screen.DASHBOARD : Screen.AUTH;
  });

  const handleLogin = (userId: string) => {
    localStorage.setItem('zilcycler_session_id', userId);
    setSessionUserId(userId);
    setCurrentScreen(Screen.DASHBOARD);
  };

  const handleLogout = () => {
    localStorage.removeItem('zilcycler_session_id');
    setSessionUserId(null);
    setCurrentScreen(Screen.AUTH);
  };

  // Validate session when users are loaded
  useEffect(() => {
      if (!loading && sessionUserId) {
          const validUser = users.find(u => u.id === sessionUserId);
          if (!validUser) {
              // User ID in storage but not in DB (deleted or invalid)
              handleLogout();
          }
      }
  }, [loading, users, sessionUserId]);

  if (loading) {
       return (
        <div className="h-screen w-full flex flex-col items-center justify-center text-green-800 bg-gray-50 dark:bg-gray-900">
           <div className="w-8 h-8 border-4 border-green-200 border-t-green-700 rounded-full animate-spin mb-4"></div>
           <span className="font-bold dark:text-white">Initializing Zilcycler...</span>
        </div>
      );
  }

  // Get live user data from context with defensive check
  const currentUser = users.find(u => u && u.id === sessionUserId) || null;

  const renderScreen = () => {
    // Fallback if context user not found
    const effectiveUser = currentUser;

    // If still at Dashboard screen but no user found (and not loading), redirect to auth or show error
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
        return <DashboardHousehold user={effectiveUser} onNavigate={setCurrentScreen} />; // Fallback
    }
  };

  if (currentScreen === Screen.AUTH) {
    return <Auth onLogin={handleLogin} />;
  }
  
  // Need a valid user object for layout
  if (!currentUser) return <Auth onLogin={handleLogin} />;

  // Common Layout for logged-in users
  return (
    <div className="bg-gray-50 dark:bg-gray-900 min-h-screen flex justify-center font-sans text-gray-900 dark:text-gray-100 transition-colors duration-300">
      <div className="w-full max-w-md bg-white dark:bg-gray-900 min-h-screen shadow-2xl relative flex flex-col transition-colors duration-300">
        
        {/* Top Navigation / Header area for non-dashboard screens */}
        {currentScreen !== Screen.DASHBOARD && (
             <div className="p-4 flex items-center gap-2 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 sticky top-0 z-20 transition-colors duration-300">
                 <button onClick={() => setCurrentScreen(Screen.DASHBOARD)} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
                     <ArrowLeft className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                 </button>
                 <span className="font-bold text-lg capitalize text-gray-900 dark:text-white">{currentScreen.toLowerCase().replace('_', ' ')}</span>
             </div>
        )}

        {/* Main Content Area */}
        <main className="flex-1 p-6 overflow-y-auto scroll-smooth">
          {renderScreen()}
        </main>

        {/* Bottom Navigation (Household & Organization) */}
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