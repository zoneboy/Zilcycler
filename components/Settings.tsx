import React, { useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { Bell, Shield, CircleUser, LogOut, ChevronRight, ChevronDown, Moon, AlertCircle, ArrowLeft, Save, Lock, Eye, EyeOff, Check, Globe, Trash2, AlertTriangle, Landmark } from 'lucide-react';

interface Props {
  user: User;
  onLogout: () => void;
}

type SettingsView = 'MAIN' | 'ACCOUNT' | 'PRIVACY';

const Settings: React.FC<Props> = ({ user, onLogout }) => {
  const [currentView, setCurrentView] = useState<SettingsView>('MAIN');
  const [notifications, setNotifications] = useState(true);
  
  // Initialize dark mode from localStorage or system preference
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('darkMode');
        if (saved !== null) {
            return saved === 'true';
        }
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return false;
  });
  
  // Account State
  const [formData, setFormData] = useState({
    name: user.name,
    email: user.email || '',
    phone: user.phone || '',
    gender: 'Female',
    address: '123 Green Avenue, Lagos',
    bankName: user.bankDetails?.bankName || '',
    accountNumber: user.bankDetails?.accountNumber || '',
    accountName: user.bankDetails?.accountName || ''
  });
  const [isSaving, setIsSaving] = useState(false);

  // Privacy State
  const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [publicProfile, setPublicProfile] = useState(false);
  const [dataSharing, setDataSharing] = useState(true);

  // Effect to apply dark mode class
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('darkMode', String(darkMode));
  }, [darkMode]);

  const handleSaveAccount = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setTimeout(() => {
        setIsSaving(false);
        alert("Profile updated successfully!");
        setCurrentView('MAIN');
    }, 1500);
  };

  const handleSavePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (passwords.new !== passwords.confirm) {
        alert("New passwords do not match!");
        return;
    }
    setIsSaving(true);
    setTimeout(() => {
        setIsSaving(false);
        alert("Password changed successfully!");
        setPasswords({ current: '', new: '', confirm: '' });
        setCurrentView('MAIN');
    }, 1500);
  };

  const renderMain = () => (
    <div className="space-y-6 animate-fade-in">
      {/* Profile Card */}
      <div className="flex items-center gap-4 bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 transition-colors">
        <img src={user.avatar} alt="Profile" className="w-16 h-16 rounded-full border-2 border-green-100 dark:border-green-900 object-cover" />
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">{user.name}</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">{user.role.toLowerCase()}</p>
        </div>
      </div>

      {/* Preferences Group */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden transition-colors">
        <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-700/50">
          <h3 className="font-bold text-gray-800 dark:text-gray-200 text-sm uppercase tracking-wide">App Preferences</h3>
        </div>
        
        <div className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors border-b border-gray-50 dark:border-gray-700 last:border-0">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg">
              <Bell className="w-5 h-5" />
            </div>
            <span className="font-medium text-gray-700 dark:text-gray-200">Notifications</span>
          </div>
          <button 
            onClick={() => setNotifications(!notifications)}
            className={`w-12 h-6 rounded-full transition-colors relative ${notifications ? 'bg-green-600' : 'bg-gray-300 dark:bg-gray-600'}`}
          >
            <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${notifications ? 'left-6.5 translate-x-1' : 'left-0.5'}`}></div>
          </button>
        </div>

        <div className="p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-lg">
              <Moon className="w-5 h-5" />
            </div>
            <span className="font-medium text-gray-700 dark:text-gray-200">Dark Mode</span>
          </div>
          <button 
            onClick={() => setDarkMode(!darkMode)}
            className={`w-12 h-6 rounded-full transition-colors relative ${darkMode ? 'bg-green-600' : 'bg-gray-300 dark:bg-gray-600'}`}
          >
            <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${darkMode ? 'left-6.5 translate-x-1' : 'left-0.5'}`}></div>
          </button>
        </div>
      </div>

      {/* Account Group */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden transition-colors">
         <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-700/50">
          <h3 className="font-bold text-gray-800 dark:text-gray-200 text-sm uppercase tracking-wide">Account Settings</h3>
        </div>

         <button 
            onClick={() => setCurrentView('ACCOUNT')}
            className="w-full p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors border-b border-gray-100 dark:border-gray-700"
         >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-lg">
                <CircleUser className="w-5 h-5" />
              </div>
              <div className="text-left">
                <span className="font-medium text-gray-700 dark:text-gray-200 block">Account Details</span>
                <span className="text-xs text-gray-400 dark:text-gray-500">Profile, Contact info, Bank details</span>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-300 dark:text-gray-600" />
         </button>
         <button 
            onClick={() => setCurrentView('PRIVACY')}
            className="w-full p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
         >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 rounded-lg">
                <Shield className="w-5 h-5" />
              </div>
              <div className="text-left">
                <span className="font-medium text-gray-700 dark:text-gray-200 block">Privacy & Security</span>
                <span className="text-xs text-gray-400 dark:text-gray-500">Password, Security settings</span>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-300 dark:text-gray-600" />
         </button>
      </div>

      <button 
        onClick={onLogout}
        className="w-full bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 p-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-red-100 dark:hover:bg-red-900/40 transition-colors"
      >
        <LogOut className="w-5 h-5" />
        Log Out
      </button>
    </div>
  );

  const renderAccount = () => (
    <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-2 mb-2">
            <button onClick={() => setCurrentView('MAIN')} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
                <ArrowLeft className="w-6 h-6 text-gray-600 dark:text-gray-300" />
            </button>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Edit Profile</h2>
        </div>

        <form onSubmit={handleSaveAccount} className="space-y-4">
             {/* Avatar Section */}
             <div className="flex flex-col items-center mb-6">
                 <div className="relative">
                    <img src={user.avatar} alt="Profile" className="w-24 h-24 rounded-full border-4 border-white dark:border-gray-800 shadow-lg object-cover" />
                    <button type="button" className="absolute bottom-0 right-0 bg-green-600 text-white p-2 rounded-full shadow-md hover:bg-green-700 transition-colors">
                         <CircleUser className="w-4 h-4" />
                    </button>
                 </div>
                 <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Tap to change photo</p>
             </div>

            <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 space-y-4 transition-colors">
                <div>
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">
                        {user.role === UserRole.ORGANIZATION ? 'Company Name' : 'Full Name'}
                    </label>
                    <input 
                        type="text" 
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                        className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:border-green-500 dark:text-white transition-colors font-medium"
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Email Address</label>
                    <input 
                        type="email" 
                        value={formData.email}
                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                        className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:border-green-500 dark:text-white transition-colors font-medium"
                    />
                </div>
                 <div>
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Phone Number</label>
                    <input 
                        type="tel" 
                        value={formData.phone}
                        onChange={(e) => setFormData({...formData, phone: e.target.value})}
                        className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:border-green-500 dark:text-white transition-colors font-medium"
                    />
                </div>
                <div>
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Gender</label>
                    <div className="relative">
                        <select 
                            value={formData.gender}
                            onChange={(e) => setFormData({...formData, gender: e.target.value})}
                            className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:border-green-500 dark:text-white transition-colors font-medium appearance-none"
                        >
                            <option value="">Select Gender</option>
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                            <option value="Other">Other</option>
                            <option value="Prefer not to say">Prefer not to say</option>
                        </select>
                        <ChevronDown className="absolute right-4 top-3.5 w-5 h-5 text-gray-400 pointer-events-none" />
                    </div>
                </div>
                 <div>
                    <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Address</label>
                    <textarea 
                        rows={3}
                        value={formData.address}
                        onChange={(e) => setFormData({...formData, address: e.target.value})}
                        className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:border-green-500 dark:text-white transition-colors font-medium resize-none"
                    />
                </div>

                {/* Bank Details Section */}
                <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
                    <h4 className="text-sm font-bold text-gray-800 dark:text-white mb-3 flex items-center gap-2">
                        <Landmark className="w-4 h-4 text-green-600 dark:text-green-500" /> Bank Details
                    </h4>
                    <div className="grid gap-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Bank Name</label>
                            <input 
                                type="text" 
                                value={formData.bankName}
                                onChange={(e) => setFormData({...formData, bankName: e.target.value})}
                                placeholder="e.g. GTBank"
                                className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:border-green-500 dark:text-white transition-colors font-medium"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Account Number</label>
                                <input 
                                    type="text" 
                                    value={formData.accountNumber}
                                    onChange={(e) => setFormData({...formData, accountNumber: e.target.value})}
                                    placeholder="0123456789"
                                    className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:border-green-500 dark:text-white transition-colors font-medium"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-1">Account Name</label>
                                <input 
                                    type="text" 
                                    value={formData.accountName}
                                    onChange={(e) => setFormData({...formData, accountName: e.target.value})}
                                    placeholder="Account Name"
                                    className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:border-green-500 dark:text-white transition-colors font-medium"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <button 
                type="submit" 
                disabled={isSaving}
                className="w-full bg-green-700 text-white py-4 rounded-2xl font-bold shadow-lg hover:bg-green-800 transition-all flex items-center justify-center gap-2 disabled:opacity-70"
            >
                {isSaving ? 'Saving...' : (
                    <>
                        <Save className="w-5 h-5" /> Save Changes
                    </>
                )}
            </button>
        </form>
    </div>
  );

  const renderPrivacy = () => (
    <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-2 mb-2">
            <button onClick={() => setCurrentView('MAIN')} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
                <ArrowLeft className="w-6 h-6 text-gray-600 dark:text-gray-300" />
            </button>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Privacy & Security</h2>
        </div>

        {/* Change Password */}
        <form onSubmit={handleSavePassword} className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 space-y-4 transition-colors">
            <h3 className="font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                <Lock className="w-4 h-4 text-green-600" /> Change Password
            </h3>
            
            <div className="space-y-3">
                 <div className="relative">
                    <input 
                        type={showPassword ? "text" : "password"} 
                        placeholder="Current Password"
                        value={passwords.current}
                        onChange={(e) => setPasswords({...passwords, current: e.target.value})}
                        className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:border-green-500 dark:text-white text-sm transition-colors"
                    />
                 </div>
                 <div className="relative">
                    <input 
                        type={showPassword ? "text" : "password"} 
                        placeholder="New Password"
                        value={passwords.new}
                        onChange={(e) => setPasswords({...passwords, new: e.target.value})}
                        className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:border-green-500 dark:text-white text-sm transition-colors"
                    />
                 </div>
                 <div className="relative">
                    <input 
                        type={showPassword ? "text" : "password"} 
                        placeholder="Confirm New Password"
                        value={passwords.confirm}
                        onChange={(e) => setPasswords({...passwords, confirm: e.target.value})}
                        className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:border-green-500 dark:text-white text-sm transition-colors"
                    />
                 </div>
                 
                 <button type="button" onClick={() => setShowPassword(!showPassword)} className="text-xs text-gray-500 dark:text-gray-400 font-medium flex items-center gap-1 hover:text-green-600 dark:hover:text-green-400">
                     {showPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />} {showPassword ? 'Hide' : 'Show'} Passwords
                 </button>
            </div>

            <button 
                type="submit" 
                disabled={isSaving || !passwords.current || !passwords.new}
                className="w-full bg-gray-900 dark:bg-black text-white py-3 rounded-xl font-bold text-sm hover:bg-black dark:hover:bg-gray-900 transition-all disabled:opacity-50 border border-transparent dark:border-gray-700"
            >
                {isSaving ? 'Updating...' : 'Update Password'}
            </button>
        </form>

        {/* Privacy Toggles */}
        <div className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden transition-colors">
             <h3 className="font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2 mb-4">
                <Globe className="w-4 h-4 text-green-600" /> Privacy Settings
            </h3>
            
            <div className="flex items-center justify-between py-3 border-b border-gray-50 dark:border-gray-700">
                 <div>
                     <span className="text-sm font-bold text-gray-700 dark:text-gray-300 block">Public Profile</span>
                     <span className="text-xs text-gray-400 dark:text-gray-500">Allow others to see your impact stats</span>
                 </div>
                 <button 
                    onClick={() => setPublicProfile(!publicProfile)}
                    className={`w-12 h-6 rounded-full transition-colors relative ${publicProfile ? 'bg-green-600' : 'bg-gray-300 dark:bg-gray-600'}`}
                 >
                    <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${publicProfile ? 'left-6.5 translate-x-1' : 'left-0.5'}`}></div>
                 </button>
            </div>
            
            <div className="flex items-center justify-between py-3">
                 <div>
                     <span className="text-sm font-bold text-gray-700 dark:text-gray-300 block">Data Sharing</span>
                     <span className="text-xs text-gray-400 dark:text-gray-500">Help improve Zilcycler with usage data</span>
                 </div>
                 <button 
                    onClick={() => setDataSharing(!dataSharing)}
                    className={`w-12 h-6 rounded-full transition-colors relative ${dataSharing ? 'bg-green-600' : 'bg-gray-300 dark:bg-gray-600'}`}
                 >
                    <div className={`w-5 h-5 bg-white rounded-full absolute top-0.5 transition-transform ${dataSharing ? 'left-6.5 translate-x-1' : 'left-0.5'}`}></div>
                 </button>
            </div>
        </div>

        {/* Danger Zone */}
        <div className="p-5 rounded-2xl border border-red-100 dark:border-red-900/30 bg-red-50 dark:bg-red-900/10 transition-colors">
             <h3 className="font-bold text-red-800 dark:text-red-400 flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4" /> Danger Zone
            </h3>
            <p className="text-xs text-red-600 dark:text-red-400/80 mb-4">Once you delete your account, there is no going back. Please be certain.</p>
            <button onClick={() => alert("Please contact support to delete your account.")} className="w-full bg-white dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 py-3 rounded-xl font-bold text-sm hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors flex items-center justify-center gap-2">
                <Trash2 className="w-4 h-4" /> Delete Account
            </button>
        </div>
    </div>
  );

  return (
    <div className="h-full">
        {currentView === 'MAIN' && renderMain()}
        {currentView === 'ACCOUNT' && renderAccount()}
        {currentView === 'PRIVACY' && renderPrivacy()}
    </div>
  );
};

export default Settings;