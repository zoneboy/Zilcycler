import React, { useState } from 'react';
import { UserRole, User } from '../types';
import { useApp } from '../context/AppContext';
import { Recycle, Building2, Truck, User as UserIcon, ArrowLeft, AlertTriangle, Lock, Eye, EyeOff, KeyRound, Mail, CheckCircle, ChevronDown } from 'lucide-react';

interface AuthProps {
  onLogin: (userId: string, token: string) => void;
}

type AuthView = 'landing' | 'login' | 'signup_household' | 'signup_org' | 'signup_verify' | 'forgot_password_request' | 'forgot_password_verify';

const Auth: React.FC<AuthProps> = ({ onLogin }) => {
  const { sysConfig, users, login, requestPasswordReset, resetPassword, sendSignupVerification, registerUser } = useApp();
  const [view, setView] = useState<AuthView>('landing');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Login Form State
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  
  // Password Reset State
  const [resetEmail, setResetEmail] = useState('');
  const [resetOtp, setResetOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  // Signup Verification State
  const [signupOtp, setSignupOtp] = useState('');

  // Validation & Form State
  const [signupData, setSignupData] = useState({
      role: UserRole.HOUSEHOLD,
      fullName: '',
      email: '',
      phone: '',
      gender: '',
      address: '',
      industry: '',
      password: '',
      confirmPassword: ''
  });
  const [validationError, setValidationError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const resetForm = (targetView: AuthView) => {
      setSignupData({
          role: UserRole.HOUSEHOLD,
          fullName: '',
          email: '',
          phone: '',
          gender: '',
          address: '',
          industry: '',
          password: '',
          confirmPassword: ''
      });
      setLoginEmail('');
      setLoginPassword('');
      setResetEmail('');
      setResetOtp('');
      setSignupOtp('');
      setNewPassword('');
      setConfirmNewPassword('');
      setValidationError('');
      setSuccessMessage('');
      setShowPassword(false);
      setView(targetView);
      setIsSubmitting(false);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationError('');
    setIsSubmitting(true);
    
    try {
        const { user, token } = await login(loginEmail, loginPassword);
        
        if (!user.isActive) {
            setValidationError("Account is suspended. Please contact support.");
            setIsSubmitting(false);
            return;
        }

        // Maintenance Mode Check
        if (sysConfig.maintenanceMode) {
            if (user.role !== UserRole.ADMIN && user.role !== UserRole.STAFF) {
                alert("⚠️ SYSTEM UNDER MAINTENANCE\n\nAccess is currently restricted to Admin and Staff only. Please check back later.");
                setIsSubmitting(false);
                return;
            }
        }

        onLogin(user.id, token);
    } catch (error: any) {
        console.error("Login Error", error);
        setValidationError(error.message || "Invalid email or password.");
        setIsSubmitting(false);
    }
  };

  const handleRequestReset = async (e: React.FormEvent) => {
      e.preventDefault();
      setValidationError('');
      setIsSubmitting(true);

      try {
          await requestPasswordReset(resetEmail);
          setSuccessMessage("OTP sent! Check your email.");
          setTimeout(() => {
              setSuccessMessage('');
              setView('forgot_password_verify');
              setIsSubmitting(false);
          }, 1500);
      } catch (error: any) {
          setValidationError(error.message || "Failed to request OTP.");
          setIsSubmitting(false);
      }
  };

  const handleVerifyReset = async (e: React.FormEvent) => {
      e.preventDefault();
      setValidationError('');
      
      if (newPassword !== confirmNewPassword) {
          setValidationError("Passwords do not match.");
          return;
      }
      if (newPassword.length < 8) {
          setValidationError("Password must be at least 8 characters.");
          return;
      }

      setIsSubmitting(true);

      try {
          await resetPassword(resetEmail, resetOtp, newPassword);
          setSuccessMessage("Password reset successfully!");
          setTimeout(() => {
              resetForm('login');
          }, 2000);
      } catch (error: any) {
          setValidationError(error.message || "Failed to reset password.");
          setIsSubmitting(false);
      }
  };

  // Step 1: Request Verification OTP
  const handleSignupSubmit = async (e: React.FormEvent, role: UserRole) => {
    e.preventDefault();
    setValidationError('');
    setIsSubmitting(true);

    if (sysConfig.maintenanceMode) {
         setValidationError("Cannot register while system is under maintenance.");
         setIsSubmitting(false);
         return;
    }

    // 1. Phone Validation
    const phoneRegex = /^[0-9+\-\s()]{10,}$/;
    if (!phoneRegex.test(signupData.phone)) {
        setValidationError("Please enter a valid phone number (min 10 digits).");
        setIsSubmitting(false);
        return;
    }

    // 2. Password Strength Validation
    if (signupData.password.length < 8) {
        setValidationError("Password must be at least 8 characters long.");
        setIsSubmitting(false);
        return;
    }
    if (!/\d/.test(signupData.password)) {
        setValidationError("Password must include at least one number.");
        setIsSubmitting(false);
        return;
    }
    if (!/[!@#$%^&*(),.?":{}|<>]/.test(signupData.password)) {
        setValidationError("Password must include at least one special symbol.");
        setIsSubmitting(false);
        return;
    }

    // 3. Confirm Password Match
    if (signupData.password !== signupData.confirmPassword) {
        setValidationError("Passwords do not match.");
        setIsSubmitting(false);
        return;
    }

    try {
        // Send OTP via email
        await sendSignupVerification(signupData.email);
        setSuccessMessage("Verification code sent to email.");
        setSignupData(prev => ({ ...prev, role })); // Ensure role is set
        setTimeout(() => {
             setSuccessMessage('');
             setView('signup_verify'); // Switch to verification view
             setIsSubmitting(false);
        }, 1500);
    } catch (error: any) {
        console.error("Signup request failed", error);
        setValidationError(error.message || "Failed to initiate signup.");
        setIsSubmitting(false);
    }
  };

  // Step 2: Verify OTP and Register
  const handleSignupVerify = async (e: React.FormEvent) => {
      e.preventDefault();
      setValidationError('');
      setIsSubmitting(true);

      const newUser: User = {
          id: '', // Server will generate
          name: signupData.fullName,
          email: signupData.email,
          phone: signupData.phone,
          role: signupData.role,
          avatar: '', // No default random avatar
          gender: signupData.gender,
          address: signupData.address,
          industry: signupData.industry, // Only used if Organization
          zointsBalance: 0,
          isActive: true,
          totalRecycledKg: 0
      };

      try {
          await registerUser(newUser, signupData.password, signupOtp);
          setSuccessMessage("Registration successful! Logging you in...");
          setTimeout(() => {
              resetForm('login');
          }, 2000);
      } catch (error: any) {
          setValidationError(error.message || "Invalid code or registration failed.");
          setIsSubmitting(false);
      }
  };

  const handleSignupClick = (targetView: AuthView) => {
      if (!sysConfig.allowRegistrations) {
          alert("New registrations are currently paused by the administrator.");
          return;
      }
      resetForm(targetView);
  };

  const renderLanding = () => (
    <div className="w-full max-w-sm space-y-3 animate-fade-in-up">
      {sysConfig.maintenanceMode && (
          <div className="bg-red-500/90 text-white p-4 rounded-2xl mb-4 border border-red-400 backdrop-blur-sm animate-pulse flex items-start gap-3 text-left shadow-lg">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <div>
                  <h3 className="font-bold text-sm uppercase">Maintenance Active</h3>
                  <p className="text-xs opacity-90">User login is temporarily disabled.</p>
              </div>
          </div>
      )}

      <button 
        onClick={() => handleSignupClick('signup_household')}
        disabled={!sysConfig.allowRegistrations}
        className={`w-full py-4 rounded-2xl font-bold shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-2 ${
            !sysConfig.allowRegistrations 
            ? 'bg-gray-400 text-gray-200 cursor-not-allowed opacity-80' 
            : 'bg-white text-green-800 hover:bg-green-50'
        }`}
      >
        {!sysConfig.allowRegistrations ? <Lock className="w-5 h-5" /> : <UserIcon className="w-5 h-5" />}
        {!sysConfig.allowRegistrations ? 'Signups Paused' : 'Sign Up as Household'}
      </button>

      <button 
        onClick={() => handleSignupClick('signup_org')}
        disabled={!sysConfig.allowRegistrations}
        className={`w-full py-4 rounded-2xl font-bold shadow-lg transition-transform active:scale-95 flex items-center justify-center gap-2 ${
            !sysConfig.allowRegistrations 
            ? 'bg-gray-400 text-gray-200 cursor-not-allowed opacity-80' 
            : 'bg-blue-50 text-blue-800 hover:bg-blue-100'
        }`}
      >
        {!sysConfig.allowRegistrations ? <Lock className="w-5 h-5" /> : <Building2 className="w-5 h-5" />}
        {!sysConfig.allowRegistrations ? 'Signups Paused' : 'Sign Up as Organization'}
      </button>

      <div className="mt-6 pt-6 border-t border-white/20">
         <p className="text-white mb-3 text-sm font-medium">Already have an account?</p>
         <button 
            onClick={() => setView('login')}
            className="w-full bg-stone-900/80 text-white backdrop-blur-sm py-3 rounded-2xl font-bold text-sm hover:bg-black transition-transform active:scale-95"
         >
            Log In
         </button>
      </div>
    </div>
  );

  const renderSignupForm = (role: UserRole, title: string, icon: React.ReactNode) => (
    <form onSubmit={(e) => handleSignupSubmit(e, role)} className="w-full max-w-sm space-y-4 animate-fade-in-up bg-white/10 backdrop-blur-md p-6 rounded-3xl border border-white/20 relative">
        <button type="button" onClick={() => resetForm('landing')} className="absolute top-4 left-4 text-white hover:text-green-200 transition-colors">
            <ArrowLeft className="w-6 h-6" />
        </button>
        <div className="text-center mb-6">
            <div className="inline-block p-3 bg-white/20 rounded-full mb-3 text-white shadow-inner">
                {icon}
            </div>
            <h2 className="text-2xl font-bold text-white">{title}</h2>
        </div>

        {validationError && (
            <div className="bg-red-500/80 text-white text-xs font-bold p-3 rounded-xl border border-red-400 backdrop-blur-sm animate-pulse flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                {validationError}
            </div>
        )}

        <div className="text-left space-y-3">
            <div>
                <label className="text-green-100 text-xs font-bold ml-1 uppercase tracking-wide">
                    {role === UserRole.HOUSEHOLD ? 'Full Name' : 'Company Name'}
                </label>
                <input 
                    type="text" 
                    value={signupData.fullName}
                    onChange={(e) => setSignupData({...signupData, fullName: e.target.value})}
                    className="w-full p-3 rounded-xl bg-white/20 border border-white/30 text-white placeholder-green-100/50 focus:outline-none focus:bg-white/30 focus:border-white/50 transition-all" 
                    required 
                />
            </div>
            <div>
                <label className="text-green-100 text-xs font-bold ml-1 uppercase tracking-wide">Email Address</label>
                <input 
                    type="email" 
                    value={signupData.email}
                    onChange={(e) => setSignupData({...signupData, email: e.target.value})}
                    className="w-full p-3 rounded-xl bg-white/20 border border-white/30 text-white placeholder-green-100/50 focus:outline-none focus:bg-white/30 focus:border-white/50 transition-all" 
                    required 
                />
            </div>
            
            {/* Phone Number Field */}
            <div>
                <label className="text-green-100 text-xs font-bold ml-1 uppercase tracking-wide">Phone Number</label>
                <input 
                    type="tel" 
                    value={signupData.phone}
                    onChange={(e) => setSignupData({...signupData, phone: e.target.value})}
                    placeholder="+234..."
                    className="w-full p-3 rounded-xl bg-white/20 border border-white/30 text-white placeholder-green-100/50 focus:outline-none focus:bg-white/30 focus:border-white/50 transition-all" 
                    required 
                />
            </div>

            {/* Gender Field */}
            <div>
                <label className="text-green-100 text-xs font-bold ml-1 uppercase tracking-wide">
                    {role === UserRole.HOUSEHOLD ? 'Gender' : 'Rep Gender'}
                </label>
                <div className="relative">
                    <select 
                        value={signupData.gender}
                        onChange={(e) => setSignupData({...signupData, gender: e.target.value})}
                        className="w-full p-3 rounded-xl bg-white/20 border border-white/30 text-white focus:outline-none focus:bg-white/30 focus:border-white/50 transition-all appearance-none [&>option]:text-black"
                        required
                    >
                        <option value="">Select Gender</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                        <option value="Other">Other</option>
                    </select>
                    <ChevronDown className="absolute right-4 top-3.5 w-5 h-5 text-white/70 pointer-events-none" />
                </div>
            </div>

            {/* Address Field */}
            <div>
                <label className="text-green-100 text-xs font-bold ml-1 uppercase tracking-wide">
                    {role === UserRole.HOUSEHOLD ? 'Home Address' : 'Company Address'}
                </label>
                <input 
                    type="text" 
                    value={signupData.address}
                    onChange={(e) => setSignupData({...signupData, address: e.target.value})}
                    className="w-full p-3 rounded-xl bg-white/20 border border-white/30 text-white placeholder-green-100/50 focus:outline-none focus:bg-white/30 focus:border-white/50 transition-all" 
                    required 
                />
            </div>

            {/* Industry Field (Organizations Only) */}
            {role === UserRole.ORGANIZATION && (
                <div>
                    <label className="text-green-100 text-xs font-bold ml-1 uppercase tracking-wide">Industry Type</label>
                    <div className="relative">
                        <select 
                            value={signupData.industry}
                            onChange={(e) => setSignupData({...signupData, industry: e.target.value})}
                            className="w-full p-3 rounded-xl bg-white/20 border border-white/30 text-white focus:outline-none focus:bg-white/30 focus:border-white/50 transition-all appearance-none [&>option]:text-black"
                            required
                        >
                            <option value="">Select Industry</option>
                            <option value="retail">Retail</option>
                            <option value="manufacturing">Manufacturing</option>
                            <option value="corporate">Corporate Office</option>
                            <option value="education">Education</option>
                            <option value="hospitality">Hospitality</option>
                        </select>
                        <ChevronDown className="absolute right-4 top-3.5 w-5 h-5 text-white/70 pointer-events-none" />
                    </div>
                </div>
            )}

            {/* Password Fields */}
            <div>
                <label className="text-green-100 text-xs font-bold ml-1 uppercase tracking-wide">Password</label>
                <div className="relative">
                    <input 
                        type={showPassword ? "text" : "password"} 
                        value={signupData.password}
                        onChange={(e) => setSignupData({...signupData, password: e.target.value})}
                        className="w-full p-3 rounded-xl bg-white/20 border border-white/30 text-white placeholder-green-100/50 focus:outline-none focus:bg-white/30 focus:border-white/50 transition-all pr-10" 
                        required 
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-3.5 text-white/70 hover:text-white transition-colors">
                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                    </button>
                </div>
                <p className="text-[10px] text-green-100/70 mt-1">Min 8 characters, 1 number, 1 symbol</p>
            </div>

            <div>
                <label className="text-green-100 text-xs font-bold ml-1 uppercase tracking-wide">Confirm Password</label>
                <input 
                    type="password" 
                    value={signupData.confirmPassword}
                    onChange={(e) => setSignupData({...signupData, confirmPassword: e.target.value})}
                    className={`w-full p-3 rounded-xl bg-white/20 border text-white placeholder-green-100/50 focus:outline-none focus:bg-white/30 transition-all ${
                        signupData.confirmPassword && signupData.password !== signupData.confirmPassword 
                        ? 'border-red-400 focus:border-red-400' 
                        : 'border-white/30 focus:border-white/50'
                    }`}
                    required 
                />
            </div>
        </div>

        <button 
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-white text-green-800 py-3 rounded-xl font-bold shadow-lg hover:bg-green-50 transition-transform active:scale-95 mt-6 disabled:opacity-70 disabled:active:scale-100"
        >
            {isSubmitting ? 'Sending Code...' : 'Send Verification Code'}
        </button>
    </form>
  );

  return (
    <div className="min-h-screen bg-[url('https://images.unsplash.com/photo-1542601906990-b4d3fb7d5c73?q=80&w=1000&auto=format&fit=crop')] bg-cover bg-center relative">
      <div className="absolute inset-0 bg-green-900/80 backdrop-blur-sm"></div>
      
      <div className="relative z-10 flex flex-col items-center justify-center min-h-screen p-6 text-center space-y-8">
        
        {view === 'landing' && (
            <div className="animate-fade-in-down">
            <div className="bg-white p-4 rounded-full inline-block mb-4 shadow-xl">
                <Recycle className="w-12 h-12 text-green-700" />
            </div>
            <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">Zilcycler</h1>
            <p className="text-green-100 text-lg font-medium">Recycle & Earn Rewards</p>
            </div>
        )}

        {view === 'landing' && renderLanding()}

        {view === 'signup_household' && renderSignupForm(UserRole.HOUSEHOLD, 'Household Join', <UserIcon className="w-8 h-8"/>)}

        {view === 'signup_org' && renderSignupForm(UserRole.ORGANIZATION, 'Organization Join', <Building2 className="w-8 h-8"/>)}

        {/* SIGNUP VERIFICATION */}
        {view === 'signup_verify' && (
            <form onSubmit={handleSignupVerify} className="w-full max-w-sm space-y-4 animate-fade-in-up bg-white/10 backdrop-blur-md p-6 rounded-3xl border border-white/20 relative">
                <button type="button" onClick={() => setView(signupData.role === UserRole.ORGANIZATION ? 'signup_org' : 'signup_household')} className="absolute top-4 left-4 text-white hover:text-green-200 transition-colors">
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <div className="text-center mb-6">
                    <div className="inline-block p-3 bg-white/20 rounded-full mb-3 text-white shadow-inner">
                        <KeyRound className="w-8 h-8" />
                    </div>
                    <h2 className="text-2xl font-bold text-white">Verify Email</h2>
                    <p className="text-green-100 text-xs mt-2">Enter the code sent to <span className="font-bold">{signupData.email}</span></p>
                </div>

                {validationError && (
                    <div className="bg-red-500/80 text-white text-xs font-bold p-3 rounded-xl border border-red-400 backdrop-blur-sm animate-pulse">
                        {validationError}
                    </div>
                )}
                {successMessage && (
                    <div className="bg-green-500/80 text-white text-xs font-bold p-3 rounded-xl border border-green-400 backdrop-blur-sm flex items-center gap-2">
                        <CheckCircle className="w-4 h-4" /> {successMessage}
                    </div>
                )}

                <div className="text-left">
                    <label className="text-green-100 text-xs font-bold ml-1 uppercase tracking-wide">Verification Code</label>
                    <input 
                        type="text" 
                        value={signupOtp}
                        onChange={(e) => setSignupOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        className="w-full p-3 rounded-xl bg-white/20 border border-white/30 text-white placeholder-green-100/50 focus:outline-none focus:bg-white/30 focus:border-white/50 transition-all text-center tracking-[0.5em] font-bold text-lg" 
                        placeholder="000000"
                        required 
                    />
                </div>

                <button 
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-white text-green-800 py-3 rounded-xl font-bold shadow-lg hover:bg-green-50 transition-transform active:scale-95 mt-4 disabled:opacity-70"
                >
                    {isSubmitting ? 'Verifying...' : 'Create Account'}
                </button>
            </form>
        )}

        {view === 'login' && (
             <form onSubmit={handleLoginSubmit} className="w-full max-w-sm space-y-4 animate-fade-in-up bg-white/10 backdrop-blur-md p-6 rounded-3xl border border-white/20 relative">
                <button type="button" onClick={() => resetForm('landing')} className="absolute top-4 left-4 text-white hover:text-green-200 transition-colors">
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <h2 className="text-2xl font-bold text-white mb-6">Welcome Back</h2>
                
                {validationError && (
                    <div className="bg-red-500/80 text-white text-xs font-bold p-3 rounded-xl border border-red-400 backdrop-blur-sm flex items-center gap-2 animate-pulse">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        {validationError}
                    </div>
                )}

                <div className="text-left space-y-3">
                    <div>
                        <label className="text-green-100 text-xs font-bold ml-1 uppercase tracking-wide">Email</label>
                        <input 
                            type="email" 
                            value={loginEmail}
                            onChange={(e) => setLoginEmail(e.target.value)}
                            className="w-full p-3 rounded-xl bg-white/20 border border-white/30 text-white placeholder-green-100/50 focus:outline-none focus:bg-white/30 focus:border-white/50 transition-all" 
                            required 
                        />
                    </div>
                    <div>
                        <div className="flex justify-between items-center mb-1">
                            <label className="text-green-100 text-xs font-bold uppercase tracking-wide">Password</label>
                            <button 
                                type="button" 
                                onClick={() => setView('forgot_password_request')}
                                className="text-[10px] font-bold text-green-200 hover:text-white hover:underline"
                            >
                                Forgot Password?
                            </button>
                        </div>
                        <input 
                            type="password" 
                            value={loginPassword}
                            onChange={(e) => setLoginPassword(e.target.value)}
                            className="w-full p-3 rounded-xl bg-white/20 border border-white/30 text-white placeholder-green-100/50 focus:outline-none focus:bg-white/30 focus:border-white/50 transition-all" 
                            required 
                        />
                    </div>
                </div>

                <button 
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-white text-green-800 py-3 rounded-xl font-bold shadow-lg hover:bg-green-50 transition-transform active:scale-95 mt-4 disabled:opacity-70"
                >
                    {isSubmitting ? 'Verifying...' : 'Log In'}
                </button>
            </form>
        )}

        {/* FORGOT PASSWORD: STEP 1 (EMAIL) */}
        {view === 'forgot_password_request' && (
            <form onSubmit={handleRequestReset} className="w-full max-w-sm space-y-4 animate-fade-in-up bg-white/10 backdrop-blur-md p-6 rounded-3xl border border-white/20 relative">
                <button type="button" onClick={() => resetForm('login')} className="absolute top-4 left-4 text-white hover:text-green-200 transition-colors">
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <div className="text-center mb-6">
                    <div className="inline-block p-3 bg-white/20 rounded-full mb-3 text-white shadow-inner">
                        <KeyRound className="w-8 h-8" />
                    </div>
                    <h2 className="text-2xl font-bold text-white">Reset Password</h2>
                    <p className="text-green-100 text-xs mt-2">Enter your email to receive a One-Time Password (OTP)</p>
                </div>

                {validationError && (
                    <div className="bg-red-500/80 text-white text-xs font-bold p-3 rounded-xl border border-red-400 backdrop-blur-sm animate-pulse">
                        {validationError}
                    </div>
                )}
                
                {successMessage && (
                    <div className="bg-green-500/80 text-white text-xs font-bold p-3 rounded-xl border border-green-400 backdrop-blur-sm flex items-center gap-2">
                        <CheckCircle className="w-4 h-4" /> {successMessage}
                    </div>
                )}

                <div className="text-left">
                    <label className="text-green-100 text-xs font-bold ml-1 uppercase tracking-wide">Email Address</label>
                    <div className="relative">
                        <input 
                            type="email" 
                            value={resetEmail}
                            onChange={(e) => setResetEmail(e.target.value)}
                            className="w-full p-3 rounded-xl bg-white/20 border border-white/30 text-white placeholder-green-100/50 focus:outline-none focus:bg-white/30 focus:border-white/50 transition-all pl-10" 
                            placeholder="you@example.com"
                            required 
                        />
                        <Mail className="absolute left-3 top-3.5 w-5 h-5 text-green-200/50" />
                    </div>
                </div>

                <button 
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-white text-green-800 py-3 rounded-xl font-bold shadow-lg hover:bg-green-50 transition-transform active:scale-95 mt-4 disabled:opacity-70"
                >
                    {isSubmitting ? 'Sending...' : 'Send OTP'}
                </button>
            </form>
        )}

        {/* FORGOT PASSWORD: STEP 2 (OTP & NEW PASS) */}
        {view === 'forgot_password_verify' && (
            <form onSubmit={handleVerifyReset} className="w-full max-w-sm space-y-4 animate-fade-in-up bg-white/10 backdrop-blur-md p-6 rounded-3xl border border-white/20 relative">
                <button type="button" onClick={() => setView('forgot_password_request')} className="absolute top-4 left-4 text-white hover:text-green-200 transition-colors">
                    <ArrowLeft className="w-6 h-6" />
                </button>
                <div className="text-center mb-6">
                    <h2 className="text-2xl font-bold text-white">Verify & Reset</h2>
                    <p className="text-green-100 text-xs mt-2">Enter the code sent to <span className="font-bold">{resetEmail}</span></p>
                </div>

                {validationError && (
                    <div className="bg-red-500/80 text-white text-xs font-bold p-3 rounded-xl border border-red-400 backdrop-blur-sm animate-pulse">
                        {validationError}
                    </div>
                )}
                {successMessage && (
                    <div className="bg-green-500/80 text-white text-xs font-bold p-3 rounded-xl border border-green-400 backdrop-blur-sm flex items-center gap-2">
                        <CheckCircle className="w-4 h-4" /> {successMessage}
                    </div>
                )}

                <div className="text-left space-y-3">
                    <div>
                        <label className="text-green-100 text-xs font-bold ml-1 uppercase tracking-wide">6-Digit OTP</label>
                        <input 
                            type="text" 
                            value={resetOtp}
                            onChange={(e) => setResetOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                            className="w-full p-3 rounded-xl bg-white/20 border border-white/30 text-white placeholder-green-100/50 focus:outline-none focus:bg-white/30 focus:border-white/50 transition-all text-center tracking-[0.5em] font-bold text-lg" 
                            placeholder="000000"
                            required 
                        />
                    </div>
                    <div>
                        <label className="text-green-100 text-xs font-bold ml-1 uppercase tracking-wide">New Password</label>
                        <input 
                            type="password" 
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="w-full p-3 rounded-xl bg-white/20 border border-white/30 text-white placeholder-green-100/50 focus:outline-none focus:bg-white/30 focus:border-white/50 transition-all" 
                            required 
                        />
                    </div>
                    <div>
                        <label className="text-green-100 text-xs font-bold ml-1 uppercase tracking-wide">Confirm New Password</label>
                        <input 
                            type="password" 
                            value={confirmNewPassword}
                            onChange={(e) => setConfirmNewPassword(e.target.value)}
                            className="w-full p-3 rounded-xl bg-white/20 border border-white/30 text-white placeholder-green-100/50 focus:outline-none focus:bg-white/30 focus:border-white/50 transition-all" 
                            required 
                        />
                    </div>
                </div>

                <button 
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full bg-white text-green-800 py-3 rounded-xl font-bold shadow-lg hover:bg-green-50 transition-transform active:scale-95 mt-4 disabled:opacity-70"
                >
                    {isSubmitting ? 'Resetting...' : 'Reset Password'}
                </button>
            </form>
        )}

      </div>
    </div>
  );
};

export default Auth;