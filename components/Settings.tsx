import React, { useState, useEffect, useRef } from 'react';
import { User, UserRole } from '../types';
import { useApp } from '../context/AppContext';
import { Bell, Shield, CircleUser, LogOut, ChevronRight, ChevronDown, Moon, AlertCircle, ArrowLeft, Save, Lock, Eye, EyeOff, Check, Globe, Trash2, AlertTriangle, Landmark, Camera, KeyRound, Loader2, Phone, Mail, Headphones } from 'lucide-react';

// Access environment variables injected by Vite
const env = (import.meta as any).env || ({} as any);
const CLOUDINARY_CLOUD_NAME = env.VITE_CLOUDINARY_CLOUD_NAME; 
const CLOUDINARY_UPLOAD_PRESET = env.VITE_CLOUDINARY_UPLOAD_PRESET; 

interface Props {
  user: User;
  onLogout: () => void;
}

type SettingsView = 'MAIN' | 'ACCOUNT' | 'PRIVACY' | 'SUPPORT';

const validateImage = (file: File) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
  const maxSize = 5 * 1024 * 1024; // 5MB

  if (!allowedTypes.includes(file.type)) {
    throw new Error('Invalid file type. Only JPEG, PNG, and WebP are allowed.');
  }
  
  if (file.size > maxSize) {
    throw new Error('File too large. Maximum size is 5MB.');
  }
};

const Settings: React.FC<Props> = ({ user, onLogout }) => {
  const { updateUser, initiateChangePassword, confirmChangePassword } = useApp();
  const [currentView, setCurrentView] = useState<SettingsView>('MAIN');
  const [notifications, setNotifications] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
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
    gender: user.gender || '',
    address: user.address || '',
    avatar: user.avatar || '',
    bankName: user.bankDetails?.bankName || '',
    accountNumber: user.bankDetails?.accountNumber || '',
    accountName: user.bankDetails?.accountName || ''
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

  // Privacy State
  const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState('');
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  
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

  const uploadToCloudinary = async (file: File): Promise<string | null> => {
      // Safety check for environment variables
      if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_UPLOAD_PRESET) {
          console.error("Cloudinary credentials missing. Ensure VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET are set.");
          alert("System Configuration Error: Image upload is currently disabled. Please contact support.");
          return null;
      }

      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
      formData.append('folder', 'zilcycler_avatars'); 

      try {
          const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
              method: 'POST',
              body: formData
          });

          if (!response.ok) {
              const errorData = await response.json();
              throw new Error(errorData.error?.message || 'Upload failed');
          }

          const data = await response.json();
          return data.secure_url;
      } catch (error) {
          console.error("Cloudinary Upload Error:", error);
          alert("Failed to upload image. Please check your internet connection or try again.");
          return null;
      }
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      try {
        validateImage(file);
      } catch (err: any) {
        alert(err.message);
        e.target.value = ''; // Reset input
        return;
      }

      setIsUploadingAvatar(true);
      const url = await uploadToCloudinary(file);
      setIsUploadingAvatar(false);

      if (url) {
        setFormData({ ...formData, avatar: url });
      }
    }
  };

  const handleSaveAccount = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    updateUser(user.id, {
        name: formData.name,
        phone: formData.phone,
        gender: formData.gender,
        address: formData.address,
        avatar: formData.avatar,
        bankDetails: {
            bankName: formData.bankName,
            accountNumber: formData.accountNumber,
            accountName: formData.accountName
        }
    });

    setTimeout(() => {
        setIsSaving(false);
        alert("Profile updated successfully!");
        setCurrentView('MAIN');
    }, 1500);
  };

  // Step 1: Initiate Password Change
  const handleInitiatePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (passwords.new !== passwords.confirm) {
        alert("New passwords do not match!");
        return;
    }

    // Password Strength Validation
    // At least 8 characters, 1 letter, 1 number, 1 special char
    const passwordRegex = /^(?=.*[a-zA-Z])(?=.*\d)(?=.*[!@#$%^&*()_+{}\[\]:;<>,.?~\\-]).{8,}$/;
    if (!passwordRegex.test(passwords.new)) {
        alert("Password must be at least 8 characters long and contain a mix of letters, numbers, and symbols.");
        return;
    }

    setIsSaving(true);
    try {
        await initiateChangePassword(user.id, passwords.current);
        alert("Verification code sent to your email.");
        setIsVerifyingOtp(true); // Switch to OTP mode
        setIsSaving(false);
    } catch (error: any) {
        alert(error.message || "Failed to initiate password change. Check your current password.");
        setIsSaving(false);
    }
  };

  // Step 2: Confirm Password Change
  const handleConfirmPasswordChange = async () => {
      if (otp.length < 6) {
          alert("Please enter a valid 6-digit code.");
          return;
      }
      setIsSaving(true);
      try {
          await confirmChangePassword(user.id, otp, passwords.new);
          alert("Password changed successfully!");
          
          // Reset Form
          setPasswords({ current: '', new: '', confirm: '' });
          setOtp('');
          setIsVerifyingOtp(false);
          setCurrentView('MAIN');
      } catch (error: any) {
          alert(error.message || "Failed to change password. Invalid code.");
      } finally {
          setIsSaving(false);
      }
  };

  const renderMain = () => (
    <div className="space-y-6 animate-fade-in">
      {/* Profile Card */}
      <div className="flex items-center gap-4 bg-white dark:bg-gray-800 p-4 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 transition-colors">
        {user.avatar ? (
            <img src={user.avatar} alt="Profile" className="w-16 h-16 rounded-full border-2 border-green-100 dark:border-green-900 object-cover" />
        ) : (
            <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-700 dark:text-green-400 border-2 border-green-50 dark:border-green-800">
                <CircleUser className="w-8 h-8" />
            </div>
        )}
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

      {/* Help & Support Group */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden transition-colors">
         <div className="p-4 border-b border-gray-100 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-700/50">
          <h3 className="font-bold text-gray-800 dark:text-gray-200 text-sm uppercase tracking-wide">Help & Support</h3>
        </div>

         <button 
            onClick={() => setCurrentView('SUPPORT')}
            className="w-full p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
         >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-pink-50 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400 rounded-lg">
                <Headphones className="w-5 h-5" />
              </div>
              <div className="text-left">
                <span className="font-medium text-gray-700 dark:text-gray-200 block">Contact Support</span>
                <span className="text-xs text-gray-400 dark:text-gray-500">Reach out to our team</span>
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
                 <div className="relative group cursor-pointer" onClick={() => !isUploadingAvatar && fileInputRef.current?.click()}>
                    {isUploadingAvatar ? (
                        <div className="w-24 h-24 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center border-4 border-white dark:border-gray-800 shadow-lg">
                            <Loader2 className="w-8 h-8 animate-spin text-green-600" />
                        </div>
                    ) : formData.avatar ? (
                        <img src={formData.avatar} alt="Profile" className="w-24 h-24 rounded-full border-4 border-white dark:border-gray-800 shadow-lg object-cover" />
                    ) : (
                        <div className="w-24 h-24 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-400 dark:text-gray-500 border-4 border-white dark:border-gray-800 shadow-lg">
                            <CircleUser className="w-12 h-12" />
                        </div>
                    )}
                    {!isUploadingAvatar && (
                        <div className="absolute bottom-0 right-0 bg-green-600 text-white p-2 rounded-full shadow-md hover:bg-green-700 transition-colors">
                            <Camera className="w-4 h-4" />
                        </div>
                    )}
                    <input 
                        type="file" 
                        ref={fileInputRef} 
                        className="hidden" 
                        accept="image/*" 
                        onChange={handleImageChange} 
                        disabled={isUploadingAvatar}
                    />
                 </div>
                 <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                     {isUploadingAvatar ? 'Uploading...' : 'Tap to change photo'}
                 </p>
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
                        readOnly
                        className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none dark:text-white transition-colors font-medium opacity-70 cursor-not-allowed"
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
        <form onSubmit={handleInitiatePasswordChange} className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 space-y-4 transition-colors">
            <h3 className="font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                <Lock className="w-4 h-4 text-green-600" /> Change Password
            </h3>
            
            {/* If verifying OTP, show OTP input instead of password fields */}
            {isVerifyingOtp ? (
                <div className="space-y-3 animate-fade-in">
                    <div className="p-3 bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 text-sm rounded-xl border border-green-100 dark:border-green-900/50 mb-2">
                        Verification code sent to <b>{user.email}</b>.
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Enter Verification Code</label>
                        <input 
                            type="text" 
                            value={otp}
                            onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            className="w-full p-3 mt-1 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:border-green-500 dark:text-white text-center text-lg font-bold tracking-widest transition-colors"
                            placeholder="000000"
                            autoFocus
                        />
                    </div>
                    <button 
                        type="button" 
                        onClick={handleConfirmPasswordChange}
                        disabled={isSaving}
                        className="w-full bg-green-700 text-white py-3 rounded-xl font-bold shadow-md hover:bg-green-800 transition-all flex items-center justify-center gap-2 mt-4"
                    >
                        {isSaving ? 'Verifying...' : 'Verify & Update Password'}
                    </button>
                    <button 
                        type="button" 
                        onClick={() => { setIsVerifyingOtp(false); setOtp(''); }}
                        className="w-full text-gray-500 dark:text-gray-400 text-sm font-bold hover:underline"
                    >
                        Cancel
                    </button>
                </div>
            ) : (
                <>
                    <div className="space-y-3">
                        <div className="relative">
                            <input 
                                type={showPassword ? "text" : "password"} 
                                placeholder="Current Password"
                                value={passwords.current}
                                onChange={(e) => setPasswords({...passwords, current: e.target.value})}
                                className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:border-green-500 dark:text-white text-sm transition-colors"
                                required
                            />
                        </div>
                        <div className="relative">
                            <input 
                                type={showPassword ? "text" : "password"} 
                                placeholder="New Password"
                                value={passwords.new}
                                onChange={(e) => setPasswords({...passwords, new: e.target.value})}
                                className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:border-green-500 dark:text-white text-sm transition-colors"
                                required
                            />
                        </div>
                        <div className="relative">
                            <input 
                                type={showPassword ? "text" : "password"} 
                                placeholder="Confirm New Password"
                                value={passwords.confirm}
                                onChange={(e) => setPasswords({...passwords, confirm: e.target.value})}
                                className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:border-green-500 dark:text-white text-sm transition-colors"
                                required
                            />
                        </div>
                        
                        <div className="flex justify-between items-center text-xs">
                            <button type="button" onClick={() => setShowPassword(!showPassword)} className="text-gray-500 dark:text-gray-400 font-medium flex items-center gap-1 hover:text-green-600 dark:hover:text-green-400">
                                {showPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />} {showPassword ? 'Hide' : 'Show'}
                            </button>
                            <span className="text-gray-400">Min 8 chars, 1 number, 1 symbol</span>
                        </div>
                    </div>

                    <button 
                        type="submit" 
                        disabled={isSaving || !passwords.current || !passwords.new}
                        className="w-full bg-gray-900 dark:bg-black text-white py-3 rounded-xl font-bold text-sm hover:bg-black dark:hover:bg-gray-900 transition-all disabled:opacity-50 border border-transparent dark:border-gray-700"
                    >
                        {isSaving ? 'Checking...' : 'Update Password'}
                    </button>
                </>
            )}
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

  const renderSupport = () => (
    <div className="space-y-6 animate-fade-in">
        <div className="flex items-center gap-2 mb-2">
            <button onClick={() => setCurrentView('MAIN')} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
                <ArrowLeft className="w-6 h-6 text-gray-600 dark:text-gray-300" />
            </button>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">Support</h2>
        </div>

        <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 space-y-6 text-center">
            <div className="w-24 h-24 bg-green-50 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto text-green-600 dark:text-green-500 mb-4">
                <Headphones className="w-12 h-12" />
            </div>
            
            <div className="space-y-2">
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white">We're here to help</h3>
                <p className="text-gray-500 dark:text-gray-400">
                    Have questions or issues? Contact our support team directly.
                </p>
            </div>

            <div className="space-y-4 pt-4">
                <a href="tel:08173888000" className="flex items-center gap-4 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 hover:border-green-500 dark:hover:border-green-500 hover:shadow-md transition-all group bg-gray-50 dark:bg-gray-800/50">
                    <div className="w-12 h-12 bg-white dark:bg-gray-700 rounded-full flex items-center justify-center text-gray-400 group-hover:text-green-600 dark:group-hover:text-green-400 shadow-sm transition-colors">
                        <Phone className="w-6 h-6" />
                    </div>
                    <div className="text-left">
                        <p className="text-xs font-bold text-gray-400 uppercase">Call Us</p>
                        <p className="text-lg font-bold text-gray-900 dark:text-white font-mono">0817 388 8000</p>
                    </div>
                </a>

                <a href="mailto:admin@zilcycler.com" className="flex items-center gap-4 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 hover:border-green-500 dark:hover:border-green-500 hover:shadow-md transition-all group bg-gray-50 dark:bg-gray-800/50">
                    <div className="w-12 h-12 bg-white dark:bg-gray-700 rounded-full flex items-center justify-center text-gray-400 group-hover:text-green-600 dark:group-hover:text-green-400 shadow-sm transition-colors">
                        <Mail className="w-6 h-6" />
                    </div>
                    <div className="text-left">
                        <p className="text-xs font-bold text-gray-400 uppercase">Email Us</p>
                        <p className="text-lg font-bold text-gray-900 dark:text-white">admin@zilcycler.com</p>
                    </div>
                </a>
            </div>
        </div>
    </div>
  );

  return (
    <div className="h-full">
        {currentView === 'MAIN' && renderMain()}
        {currentView === 'ACCOUNT' && renderAccount()}
        {currentView === 'PRIVACY' && renderPrivacy()}
        {currentView === 'SUPPORT' && renderSupport()}
    </div>
  );
};

export default Settings;