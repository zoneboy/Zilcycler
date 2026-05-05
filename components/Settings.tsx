import React, { useState, useEffect, useRef } from 'react';
import { Share } from '@capacitor/share';
import { User, UserRole } from '../types';
import { useApp } from '../context/AppContext';
import { captureImage, pickImageFromInput, uploadToCloudinary } from '../utils/imageUpload';
import { isNative } from '../utils/native';
import { Bell, Shield, CircleUser, LogOut, ChevronRight, ChevronDown, Moon, ArrowLeft, Save, Lock, Eye, EyeOff, Globe, Trash2, AlertTriangle, Landmark, Camera, Loader2, Phone, Mail, Headphones, Share2 } from 'lucide-react';

interface Props {
  user: User;
  onLogout: () => void;
}

type SettingsView = 'MAIN' | 'ACCOUNT' | 'PRIVACY' | 'SUPPORT' | 'DELETE_ACCOUNT';

const Settings: React.FC<Props> = ({ user, onLogout }) => {
  const { updateUser, initiateChangePassword, confirmChangePassword, initiateAccountDeletion, confirmAccountDeletion } = useApp();
  const [currentView, setCurrentView] = useState<SettingsView>('MAIN');
  const [notifications, setNotifications] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
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

  const [passwords, setPasswords] = useState({ current: '', new: '', confirm: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState('');
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  
  const [publicProfile, setPublicProfile] = useState(false);
  const [dataSharing, setDataSharing] = useState(true);

  // STAGE 2C: Account deletion state
  const [deleteStep, setDeleteStep] = useState<'CONFIRM' | 'PASSWORD' | 'OTP'>('CONFIRM');
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteOtp, setDeleteOtp] = useState('');
  const [deleteReason, setDeleteReason] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('darkMode', String(darkMode));
  }, [darkMode]);

  const handleAvatarPick = async () => {
    if (isUploadingAvatar) return;
    
    try {
      let captured = null;
      
      if (isNative()) {
        captured = await captureImage();
      } else if (fileInputRef.current) {
        captured = await pickImageFromInput(fileInputRef.current);
      }
      
      if (!captured) return;
      
      setIsUploadingAvatar(true);
      const url = await uploadToCloudinary(captured.file, 'zilcycler_avatars');
      setIsUploadingAvatar(false);

      if (url) {
        setFormData({ ...formData, avatar: url });
      }
    } catch (err: any) {
      setIsUploadingAvatar(false);
      alert(err.message || 'Failed to load image');
    }
  };

  const handleSaveAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    try {
      await updateUser(user.id, {
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
      setIsSaving(false);
      alert("Profile updated successfully!");
      setCurrentView('MAIN');
    } catch (err: any) {
      setIsSaving(false);
      alert(err.message || "Failed to save profile.");
    }
  };

  const handleShareApp = async () => {
    const shareData = {
        title: 'Zilcycler',
        text: 'Join me on Zilcycler to recycle and earn rewards!',
        url: typeof window !== 'undefined' ? window.location.origin : 'https://zilcycler.netlify.app',
    };
    
    try {
        if (isNative()) {
            await Share.share({
                title: shareData.title,
                text: shareData.text,
                url: shareData.url,
                dialogTitle: 'Share Zilcycler with friends',
            });
            return;
        }
        
        if (typeof navigator !== 'undefined' && navigator.share) {
            await navigator.share(shareData);
            return;
        }
        
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
            await navigator.clipboard.writeText(shareData.url);
            alert('Link copied to clipboard!');
        } else {
            alert('Sharing is not supported on this device.');
        }
    } catch (error: any) {
        if (error.message && !error.message.toLowerCase().includes('cancel')) {
            console.error('Share error:', error);
        }
    }
  };

  const handleInitiatePasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (passwords.new !== passwords.confirm) {
        alert("New passwords do not match!");
        return;
    }

    const passwordRegex = /^(?=.*[a-zA-Z])(?=.*\d)(?=.*[!@#$%^&*()_+{}\[\]:;<>,.?~\\-]).{8,}$/;
    if (!passwordRegex.test(passwords.new)) {
        alert("Password must be at least 8 characters long and contain a mix of letters, numbers, and symbols.");
        return;
    }

    setIsSaving(true);
    try {
        await initiateChangePassword(user.id, passwords.current);
        alert("Verification code sent to your email.");
        setIsVerifyingOtp(true);
        setIsSaving(false);
    } catch (error: any) {
        alert(error.message || "Failed to initiate password change. Check your current password.");
        setIsSaving(false);
    }
  };

  const handleConfirmPasswordChange = async () => {
      if (otp.length < 6) {
          alert("Please enter a valid 6-digit code.");
          return;
      }
      setIsSaving(true);
      try {
          await confirmChangePassword(user.id, otp, passwords.new);
          alert("Password changed successfully!");
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

  // STAGE 2C: Account deletion handlers
  const handleStartDeletion = () => {
      // Block admins from self-deleting (server also enforces)
      if (user.role === UserRole.ADMIN) {
          alert("Admin accounts cannot be self-deleted. Please contact another administrator.");
          return;
      }
      setDeleteStep('CONFIRM');
      setDeletePassword('');
      setDeleteOtp('');
      setDeleteReason('');
      setDeleteError('');
      setCurrentView('DELETE_ACCOUNT');
  };

  const handleSendDeleteOtp = async (e: React.FormEvent) => {
      e.preventDefault();
      setDeleteError('');
      setIsDeleting(true);
      try {
          await initiateAccountDeletion(user.id, deletePassword);
          setDeleteStep('OTP');
      } catch (err: any) {
          setDeleteError(err.message || 'Failed to send verification code.');
      } finally {
          setIsDeleting(false);
      }
  };

  const handleConfirmDelete = async (e: React.FormEvent) => {
      e.preventDefault();
      setDeleteError('');
      
      if (deleteOtp.length < 6) {
          setDeleteError('Please enter the 6-digit code from your email.');
          return;
      }
      
      setIsDeleting(true);
      try {
          await confirmAccountDeletion(user.id, deleteOtp, deleteReason);
          // Account deleted - log out and reload
          alert('Your account has been deleted. Personal data has been anonymized.');
          await onLogout();
      } catch (err: any) {
          setDeleteError(err.message || 'Failed to delete account.');
          setIsDeleting(false);
      }
  };

  const renderDeleteAccount = () => (
      <div className="space-y-6 animate-fade-in">
          <div className="flex items-center gap-2 mb-2">
              <button onClick={() => setCurrentView('PRIVACY')} disabled={isDeleting} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors disabled:opacity-50">
                  <ArrowLeft className="w-6 h-6 text-gray-600 dark:text-gray-300" />
              </button>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Delete Account</h2>
          </div>

          {deleteError && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/50 text-red-700 dark:text-red-400 text-sm p-3 rounded-xl flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{deleteError}</span>
              </div>
          )}

          {deleteStep === 'CONFIRM' && (
              <div className="space-y-4 animate-fade-in">
                  <div className="bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-900/30 rounded-2xl p-5">
                      <div className="flex items-center gap-2 mb-3">
                          <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
                          <h3 className="font-bold text-red-800 dark:text-red-400">This action cannot be undone</h3>
                      </div>
                      <p className="text-sm text-red-700 dark:text-red-300/80 mb-3">When you delete your account:</p>
                      <ul className="space-y-2 text-sm text-red-700 dark:text-red-300/80">
                          <li className="flex items-start gap-2">
                              <span className="text-red-500 mt-0.5">•</span>
                              <span>Your personal information will be anonymized within 30 days</span>
                          </li>
                          <li className="flex items-start gap-2">
                              <span className="text-red-500 mt-0.5">•</span>
                              <span>Your <b>{user.zointsBalance?.toLocaleString() || 0} Zoints</b> will be forfeited</span>
                          </li>
                          <li className="flex items-start gap-2">
                              <span className="text-red-500 mt-0.5">•</span>
                              <span>Pending pickups and redemptions will be cancelled</span>
                          </li>
                          <li className="flex items-start gap-2">
                              <span className="text-red-500 mt-0.5">•</span>
                              <span>You will be immediately logged out</span>
                          </li>
                          <li className="flex items-start gap-2">
                              <span className="text-red-500 mt-0.5">•</span>
                              <span>You can register again with the same email after deletion</span>
                          </li>
                      </ul>
                  </div>

                  <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
                      <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase mb-2">
                          Reason for leaving (optional)
                      </label>
                      <textarea 
                          rows={3}
                          value={deleteReason}
                          onChange={(e) => setDeleteReason(e.target.value)}
                          placeholder="Help us improve. What didn't work for you?"
                          maxLength={500}
                          className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:border-green-500 dark:text-white transition-colors resize-none text-sm"
                      />
                      <p className="text-[10px] text-gray-400 mt-1 text-right">{deleteReason.length}/500</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                      <button 
                          onClick={() => setCurrentView('PRIVACY')}
                          className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 py-3 rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                      >
                          Cancel
                      </button>
                      <button 
                          onClick={() => setDeleteStep('PASSWORD')}
                          className="bg-red-600 text-white py-3 rounded-xl font-bold hover:bg-red-700 transition-colors"
                      >
                          Continue
                      </button>
                  </div>
              </div>
          )}

          {deleteStep === 'PASSWORD' && (
              <form onSubmit={handleSendDeleteOtp} className="space-y-4 animate-fade-in">
                  <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
                      <h3 className="font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                          <Lock className="w-4 h-4 text-red-600" /> Confirm Your Password
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                          Enter your password to verify it's really you. We'll send a confirmation code to <b className="text-gray-700 dark:text-gray-300">{user.email}</b>.
                      </p>
                      <input 
                          type="password"
                          value={deletePassword}
                          onChange={(e) => setDeletePassword(e.target.value)}
                          placeholder="Your password"
                          className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:border-red-500 dark:text-white transition-colors"
                          required
                          autoFocus
                          disabled={isDeleting}
                      />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                      <button 
                          type="button"
                          onClick={() => setDeleteStep('CONFIRM')}
                          disabled={isDeleting}
                          className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 py-3 rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                      >
                          Back
                      </button>
                      <button 
                          type="submit"
                          disabled={isDeleting || !deletePassword}
                          className="bg-red-600 text-white py-3 rounded-xl font-bold hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                          {isDeleting ? <><Loader2 className="w-4 h-4 animate-spin" /> Sending...</> : 'Send Code'}
                      </button>
                  </div>
              </form>
          )}

          {deleteStep === 'OTP' && (
              <form onSubmit={handleConfirmDelete} className="space-y-4 animate-fade-in">
                  <div className="bg-white dark:bg-gray-800 rounded-2xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
                      <h3 className="font-bold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                          <Mail className="w-4 h-4 text-red-600" /> Final Confirmation
                      </h3>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
                          We sent a 6-digit code to <b className="text-gray-700 dark:text-gray-300">{user.email}</b>. Enter it below to permanently delete your account.
                      </p>
                      <input 
                          type="text"
                          inputMode="numeric"
                          value={deleteOtp}
                          onChange={(e) => setDeleteOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          placeholder="000000"
                          className="w-full p-3 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl focus:outline-none focus:border-red-500 dark:text-white transition-colors text-center text-lg font-bold tracking-widest"
                          required
                          autoFocus
                          disabled={isDeleting}
                      />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                      <button 
                          type="button"
                          onClick={() => setDeleteStep('PASSWORD')}
                          disabled={isDeleting}
                          className="bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 py-3 rounded-xl font-bold hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
                      >
                          Back
                      </button>
                      <button 
                          type="submit"
                          disabled={isDeleting || deleteOtp.length < 6}
                          className="bg-red-600 text-white py-3 rounded-xl font-bold hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                      >
                          {isDeleting ? <><Loader2 className="w-4 h-4 animate-spin" /> Deleting...</> : 'Delete Forever'}
                      </button>
                  </div>
              </form>
          )}
      </div>
  );

  const renderMain = () => (
    <div className="space-y-6 animate-fade-in">
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
                <span className="text-xs text-gray-400 dark:text-gray-500">Password, Delete account</span>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-300 dark:text-gray-600" />
         </button>
      </div>

       <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden transition-colors">
         <button 
            onClick={handleShareApp}
            className="w-full p-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
         >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg">
                <Share2 className="w-5 h-5" />
              </div>
              <div className="text-left">
                <span className="font-medium text-gray-700 dark:text-gray-200 block">Share App</span>
                <span className="text-xs text-gray-400 dark:text-gray-500">Invite friends to join</span>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-gray-300 dark:text-gray-600" />
         </button>
      </div>

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

      {/* STAGE 2C: Legal links footer */}
      <div className="text-center text-xs text-gray-400 dark:text-gray-500 py-2">
          <a href="/privacy.html" target="_blank" rel="noopener noreferrer" className="hover:text-green-600 dark:hover:text-green-500 underline">Privacy Policy</a>
          <span className="mx-2">·</span>
          <a href="/terms.html" target="_blank" rel="noopener noreferrer" className="hover:text-green-600 dark:hover:text-green-500 underline">Terms of Service</a>
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
             <div className="flex flex-col items-center mb-6">
                 <div className="relative group cursor-pointer" onClick={handleAvatarPick}>
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
                        inputMode="tel"
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
                                    inputMode="numeric"
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

        <form onSubmit={handleInitiatePasswordChange} className="bg-white dark:bg-gray-800 p-5 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 space-y-4 transition-colors">
            <h3 className="font-bold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                <Lock className="w-4 h-4 text-green-600" /> Change Password
            </h3>
            
            {isVerifyingOtp ? (
                <div className="space-y-3 animate-fade-in">
                    <div className="p-3 bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300 text-sm rounded-xl border border-green-100 dark:border-green-900/50 mb-2">
                        Verification code sent to <b>{user.email}</b>.
                    </div>
                    <div>
                        <label className="text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide">Enter Verification Code</label>
                        <input 
                            type="text"
                            inputMode="numeric"
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

        {/* STAGE 2C: Real account deletion - admins can't self-delete */}
        {user.role !== UserRole.ADMIN && (
            <div className="p-5 rounded-2xl border border-red-100 dark:border-red-900/30 bg-red-50 dark:bg-red-900/10 transition-colors">
                 <h3 className="font-bold text-red-800 dark:text-red-400 flex items-center gap-2 mb-2">
                    <AlertTriangle className="w-4 h-4" /> Danger Zone
                </h3>
                <p className="text-xs text-red-600 dark:text-red-400/80 mb-4">Once you delete your account, your personal data will be anonymized within 30 days and unredeemed Zoints will be forfeited. This cannot be undone.</p>
                <button onClick={handleStartDeletion} className="w-full bg-white dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 py-3 rounded-xl font-bold text-sm hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors flex items-center justify-center gap-2">
                    <Trash2 className="w-4 h-4" /> Delete My Account
                </button>
            </div>
        )}
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
        {currentView === 'DELETE_ACCOUNT' && renderDeleteAccount()}
    </div>
  );
};

export default Settings;