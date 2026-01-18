import React, { useState } from 'react';
import { Coins, Gift, Heart, Banknote, X, ArrowRight, ChevronLeft, AlertCircle } from 'lucide-react';
import { ZOINTS_RATE_NAIRA } from '../constants';
import { User, RedemptionRequest } from '../types';
import { useApp } from '../context/AppContext';

interface WalletCardProps {
  user: User;
  balance: number;
}

type ModalView = 'MENU' | 'INPUT' | 'PROCESSING' | 'SUCCESS';
type RedeemType = 'Cash' | 'Charity' | 'Goods' | null;

const WalletCard: React.FC<WalletCardProps> = ({ user, balance }) => {
  const { createRedemptionRequest } = useApp();
  const [showRedeemModal, setShowRedeemModal] = useState(false);
  const [view, setView] = useState<ModalView>('MENU');
  const [selectedType, setSelectedType] = useState<RedeemType>(null);
  const [amount, setAmount] = useState('');
  const [error, setError] = useState('');

  const resetModal = () => {
    setShowRedeemModal(false);
    setTimeout(() => {
        setView('MENU');
        setSelectedType(null);
        setAmount('');
        setError('');
    }, 300);
  };

  const handleOptionSelect = (type: RedeemType) => {
    if (type === 'Goods') return; // Disabled
    setSelectedType(type);
    setView('INPUT');
    setError('');
  };

  const handleConfirmAmount = () => {
      // Defensive check for user
      if (!user) {
          setError("User not identified. Please re-login.");
          return;
      }

      const val = parseFloat(amount);
      if (!val || val <= 0) {
          setError("Please enter a valid amount.");
          return;
      }
      if (val > balance) {
          setError("Insufficient balance.");
          return;
      }
      if (val < 500) {
          setError("Minimum redemption is 500 Z.");
          return;
      }

      setView('PROCESSING');
      
      const newRequest: RedemptionRequest = {
        id: '', // Server generated
        userId: user.id,
        userName: user.name,
        type: selectedType === 'Cash' ? 'Cash' : 'Charity',
        amount: val,
        status: 'Pending',
        date: new Date().toISOString().split('T')[0]
      };

      // Call API / Context
      setTimeout(() => {
          createRedemptionRequest(newRequest);
          setView('SUCCESS');
      }, 1000);
  };

  const handleMax = () => {
      setAmount(balance.toString());
      setError('');
  };

  return (
    <>
      <div className="bg-gradient-to-br from-green-800 to-green-600 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden">
        <div className="absolute -right-10 -top-10 bg-green-500 opacity-20 w-40 h-40 rounded-full blur-2xl"></div>
        <div className="absolute -left-10 -bottom-10 bg-yellow-400 opacity-10 w-32 h-32 rounded-full blur-2xl"></div>
        
        <div className="relative z-10">
          <div className="flex justify-between items-start">
              <div>
                <h3 className="text-green-100 text-sm font-medium mb-1">Your ZOINT Balance</h3>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-4xl font-bold tracking-tight">{balance.toLocaleString()} Z</span>
                  <Coins className="text-yellow-400 w-8 h-8" />
                </div>
              </div>
              <button 
                onClick={() => setShowRedeemModal(true)}
                className="bg-white/20 hover:bg-white/30 backdrop-blur-md px-4 py-2 rounded-xl text-sm font-bold transition-colors flex items-center gap-1"
              >
                Redeem <ArrowRight className="w-4 h-4" />
              </button>
          </div>
          <div className="bg-white/20 backdrop-blur-sm inline-block px-3 py-1 rounded-full text-xs font-semibold text-green-50 mt-2">
            1 ZOINT = ₦{ZOINTS_RATE_NAIRA.toFixed(2)}
          </div>
        </div>
      </div>

      {/* Redeem Modal - FLEX COLUMN FIX */}
      {showRedeemModal && (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center sm:p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={resetModal}></div>
            <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md relative z-10 shadow-2xl animate-fade-in-up flex flex-col max-h-[85vh]">
                
                {/* --- SUCCESS VIEW --- */}
                {view === 'SUCCESS' && (
                    <div className="p-6 flex flex-col items-center py-8 animate-fade-in">
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4 text-green-600">
                             <Coins className="w-8 h-8" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-800 mb-2">Request Sent!</h3>
                        <p className="text-gray-500 text-center text-sm mb-6">
                            Admin has been notified of your request to {selectedType === 'Cash' ? 'withdraw' : 'donate'} <span className="font-bold text-gray-800">{parseFloat(amount).toLocaleString()} Z</span>.
                        </p>
                        <button onClick={resetModal} className="w-full bg-green-700 text-white py-3 rounded-xl font-bold">
                            Done
                        </button>
                    </div>
                )}

                {/* --- PROCESSING VIEW --- */}
                {view === 'PROCESSING' && (
                    <div className="p-6 flex flex-col items-center py-12 animate-fade-in">
                        <div className="w-12 h-12 border-4 border-green-200 border-t-green-600 rounded-full animate-spin mb-4"></div>
                        <h3 className="text-lg font-bold text-gray-800">Processing Request...</h3>
                    </div>
                )}

                {/* --- INPUT VIEW --- */}
                {view === 'INPUT' && (
                    <>
                        <div className="p-6 border-b border-gray-100 shrink-0 flex justify-between items-center">
                            <button onClick={() => setView('MENU')} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                                <ChevronLeft className="w-5 h-5 text-gray-600" />
                            </button>
                            <h3 className="text-lg font-bold text-gray-900">
                                {selectedType === 'Cash' ? 'Cash Out' : 'Donate to Charity'}
                            </h3>
                            <div className="w-9"></div> {/* Spacer */}
                        </div>

                        <div className="p-6 overflow-y-auto">
                            <div className="bg-gray-50 p-4 rounded-2xl border border-gray-100 mb-6">
                                <div className="flex justify-between items-end mb-2">
                                    <label className="text-xs font-bold text-gray-500 uppercase">Amount (Z)</label>
                                    <span className="text-xs text-gray-400">Balance: {balance.toLocaleString()}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input 
                                        type="number" 
                                        value={amount}
                                        onChange={(e) => {
                                            setAmount(e.target.value);
                                            setError('');
                                        }}
                                        placeholder="0"
                                        className="flex-1 bg-transparent text-3xl font-bold text-gray-800 placeholder-gray-300 outline-none w-full"
                                        autoFocus
                                    />
                                    <button 
                                        onClick={handleMax}
                                        className="text-xs font-bold bg-green-100 text-green-700 px-2 py-1 rounded hover:bg-green-200"
                                    >
                                        MAX
                                    </button>
                                </div>
                                {error && (
                                    <div className="flex items-center gap-1 mt-2 text-red-500 text-xs font-medium animate-pulse">
                                        <AlertCircle className="w-3 h-3" /> {error}
                                    </div>
                                )}
                            </div>

                            <div className="space-y-3">
                                <div className="flex justify-between items-center text-sm p-3 border-b border-gray-100">
                                    <span className="text-gray-500">Equivalent Value</span>
                                    <span className="font-bold text-gray-800">₦{((parseFloat(amount) || 0) * ZOINTS_RATE_NAIRA).toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</span>
                                </div>
                                {selectedType === 'Cash' && (
                                    <div className="flex justify-between items-center text-sm p-3">
                                        <span className="text-gray-500">Destination</span>
                                        <span className="font-bold text-gray-800 flex items-center gap-1">
                                            Bank Transfer <span className="text-xs font-normal text-gray-400">(Default)</span>
                                        </span>
                                    </div>
                                )}
                            </div>

                            <button 
                                onClick={handleConfirmAmount}
                                className="w-full bg-green-700 text-white py-4 rounded-xl font-bold shadow-lg hover:bg-green-800 transition-transform active:scale-95 mt-6"
                            >
                                Confirm {selectedType === 'Cash' ? 'Withdrawal' : 'Donation'}
                            </button>
                        </div>
                    </>
                )}

                {/* --- MENU VIEW --- */}
                {view === 'MENU' && (
                    <>
                        <div className="p-6 border-b border-gray-100 shrink-0 flex justify-between items-center">
                            <h3 className="text-xl font-bold text-gray-900">Redeem ZOINTS</h3>
                            <button onClick={resetModal} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200">
                                <X className="w-5 h-5 text-gray-600" />
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto">
                            <div className="space-y-3">
                                <button onClick={() => handleOptionSelect('Cash')} className="w-full flex items-center gap-4 p-4 rounded-2xl border border-gray-100 bg-green-50 hover:bg-green-100 hover:border-green-200 transition-all group text-left">
                                    <div className="w-10 h-10 rounded-full bg-green-200 text-green-700 flex items-center justify-center group-hover:scale-110 transition-transform">
                                        <Banknote className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-gray-800">Cash Out</h4>
                                        <p className="text-xs text-gray-500">Convert ZOINTS to Naira</p>
                                    </div>
                                </button>

                                <button disabled className="w-full flex items-center gap-4 p-4 rounded-2xl border border-gray-100 bg-gray-50 opacity-70 cursor-not-allowed group text-left relative overflow-hidden">
                                    <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-400 flex items-center justify-center grayscale">
                                        <Gift className="w-5 h-5" />
                                    </div>
                                    <div className="flex-1">
                                        <div className="flex justify-between items-center">
                                            <h4 className="font-bold text-gray-600">Eco Goods</h4>
                                            <span className="text-[10px] font-bold bg-gray-200 text-gray-500 px-2 py-0.5 rounded-full uppercase tracking-wide">Coming Soon</span>
                                        </div>
                                        <p className="text-xs text-gray-400">Buy sustainable products</p>
                                    </div>
                                </button>

                                <button onClick={() => handleOptionSelect('Charity')} className="w-full flex items-center gap-4 p-4 rounded-2xl border border-gray-100 bg-rose-50 hover:bg-rose-100 hover:border-rose-200 transition-all group text-left">
                                    <div className="w-10 h-10 rounded-full bg-rose-200 text-rose-700 flex items-center justify-center group-hover:scale-110 transition-transform">
                                        <Heart className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-gray-800">Donate</h4>
                                        <p className="text-xs text-gray-500">Support environmental causes</p>
                                    </div>
                                </button>
                            </div>
                            <p className="text-center text-xs text-gray-400 mt-6">Minimum redemption: 500 Z</p>
                        </div>
                    </>
                )}
            </div>
        </div>
      )}
    </>
  );
};

export default WalletCard;