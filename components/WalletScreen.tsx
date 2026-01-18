import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { useApp } from '../context/AppContext'; // Import Context
import WalletCard from './WalletCard';
import { ArrowDownLeft, ArrowUpRight, History, ChevronUp, ChevronDown, Loader2, Search, X, Hash, Clock, CheckCircle, Download, TrendingUp, AlertCircle } from 'lucide-react';

interface Props {
  user: User;
}

interface Transaction {
  id: string;
  type: 'EARNED' | 'REDEEMED';
  amount: number;
  date: string; // Display date string
  rawDate: Date; // For sorting
  timestamp: string;
  description: string;
}

const INITIAL_BATCH_SIZE = 20;

const WalletScreen: React.FC<Props> = ({ user }) => {
  const { getPickupsByRole, wasteRates, redemptionRequests } = useApp(); // Access global state
  
  const [showAll, setShowAll] = useState(false);
  const [displayCount, setDisplayCount] = useState(5);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [showRates, setShowRates] = useState(false);
  
  // New State features
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'ALL' | 'EARNED' | 'REDEEMED'>('ALL');
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

  // --- DYNAMIC DATA LOGIC ---
  // 1. Get Completed Pickups from Context for this user (Earnings)
  const completedPickups = getPickupsByRole(user.role, user.id).filter(p => p.status === 'Completed' && p.earnedZoints && p.earnedZoints > 0);
  
  // 2. Use user.zointsBalance as the single source of truth for total balance.
  // The backend handles adding earnings to this balance when pickups are completed.
  const currentTotalBalance = user.zointsBalance;

  // 3. Convert Pickups to Transactions
  const recentRealTransactions: Transaction[] = completedPickups.map(p => {
    const pDate = new Date(p.date + ' ' + p.time); // Attempt to parse
    const validDate = isNaN(pDate.getTime()) ? new Date() : pDate;
    
    return {
      id: `TX-${p.id}`,
      type: 'EARNED',
      amount: p.earnedZoints || 0,
      date: validDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      rawDate: validDate,
      timestamp: p.time,
      description: `Recycled Waste (${p.weight}kg)`
    };
  });

  // 4. Convert Redemption Requests to Transactions (Spendings)
  const myRedemptions = redemptionRequests.filter(r => r.userId === user.id);
  const redemptionTransactions: Transaction[] = myRedemptions.map(r => {
    const rDate = new Date(r.date);
    return {
        id: r.id,
        type: 'REDEEMED',
        amount: r.amount,
        date: rDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
        rawDate: rDate,
        timestamp: '12:00 PM', // Fallback as requests only have date
        description: `${r.type} Redemption (${r.status})`
    };
  });

  // 5. Merge Real History and Sort by Date (Newest First)
  const allTransactions = [...recentRealTransactions, ...redemptionTransactions].sort((a, b) => {
      return b.rawDate.getTime() - a.rawDate.getTime();
  });
  // --------------------------

  // Reset pagination when filters change
  useEffect(() => {
    if (showAll) {
        setDisplayCount(INITIAL_BATCH_SIZE);
    }
  }, [searchQuery, filterType]);

  const handleToggleView = () => {
    if (showAll) {
      // Collapsing
      setShowAll(false);
      setDisplayCount(5);
      setSearchQuery(''); // Optional: clear search on collapse
      setFilterType('ALL');
    } else {
      // Expanding
      setShowAll(true);
      setDisplayCount(INITIAL_BATCH_SIZE);
    }
  };

  const handleLoadMore = () => {
    setIsLoadingMore(true);
    // Simulate network latency
    setTimeout(() => {
      setDisplayCount(prev => prev + 20);
      setIsLoadingMore(false);
    }, 600);
  };

  // Filter Logic
  const filteredData = allTransactions.filter(tx => {
    const matchesSearch = tx.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'ALL' || tx.type === filterType;
    return matchesSearch && matchesType;
  });

  const displayedTransactions = showAll 
    ? filteredData.slice(0, displayCount) 
    : filteredData.slice(0, 5);
  
  const hasMore = showAll && displayCount < filteredData.length;

  const handleExport = () => {
    // CSV Header
    let csvContent = "data:text/csv;charset=utf-8,Transaction ID,Date,Time,Description,Type,Amount (Z)\n";
    
    // CSV Rows
    filteredData.forEach(tx => {
        const row = [
            tx.id,
            tx.date,
            tx.timestamp,
            `"${tx.description}"`, // Quote description to handle commas
            tx.type,
            tx.type === 'EARNED' ? tx.amount : -tx.amount
        ].join(",");
        csvContent += row + "\n";
    });

    // Create download link
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "zilcycler_transactions.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 pb-24 animate-fade-in relative">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">My Wallet</h1>
        <button 
          onClick={() => setShowRates(true)}
          className="bg-white dark:bg-gray-800 text-xs font-bold px-3 py-1.5 rounded-full border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 flex items-center gap-1 shadow-sm hover:bg-green-50 dark:hover:bg-green-900/30 transition-colors"
        >
          <TrendingUp className="w-3 h-3" /> Market Rates
        </button>
      </div>
      
      {/* Pass the dynamic balance directly from user context which updates on redemption */}
      <WalletCard user={user} balance={currentTotalBalance} />

      <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 transition-all duration-300">
          <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-bold text-gray-800 dark:text-white flex items-center gap-2">
                    <History className="w-5 h-5 text-gray-400" />
                    {showAll ? 'History' : 'Recent'}
                </h3>
                {showAll && (
                  <p className="text-[10px] text-gray-400 font-medium ml-7 mt-0.5">
                    Showing {displayedTransactions.length} of {filteredData.length.toLocaleString()}
                  </p>
                )}
              </div>
              <button 
                onClick={handleToggleView}
                className="text-xs font-bold text-green-700 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/30 px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1"
              >
                {showAll ? (
                    <>Show Less <ChevronUp className="w-3 h-3" /></>
                ) : (
                    <>View All <ChevronDown className="w-3 h-3" /></>
                )}
              </button>
          </div>

          {/* Search and Filters (Visible only when Expanded) */}
          {showAll && (
            <div className="mb-6 space-y-3 animate-fade-in">
                {/* Search Bar */}
                <div className="relative">
                    <Search className="absolute left-3 top-3 text-gray-400 w-4 h-4" />
                    <input 
                        type="text" 
                        placeholder="Search transactions..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-xl text-sm focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500 transition-all dark:text-white"
                    />
                </div>

                {/* Filter Pills and Export */}
                <div className="flex items-center gap-2">
                    <div className="flex gap-2 flex-1">
                        {(['ALL', 'EARNED', 'REDEEMED'] as const).map((type) => (
                            <button
                                key={type}
                                onClick={() => setFilterType(type)}
                                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-colors capitalize ${
                                    filterType === type 
                                        ? 'bg-green-700 text-white shadow-md' 
                                        : 'bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
                                }`}
                            >
                                {type.toLowerCase()}
                            </button>
                        ))}
                    </div>
                    <button
                        onClick={handleExport}
                        className="p-2.5 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-600 dark:text-gray-300 rounded-lg transition-colors"
                        title="Export to CSV"
                    >
                        <Download className="w-4 h-4" />
                    </button>
                </div>
            </div>
          )}

          {/* List */}
          <div className="space-y-2">
              {displayedTransactions.length > 0 ? (
                displayedTransactions.map(tx => (
                    <div 
                        key={tx.id} 
                        onClick={() => setSelectedTransaction(tx)}
                        className="flex justify-between items-center p-3 -mx-2 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors group animate-fade-in"
                    >
                        <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition-colors ${tx.type === 'EARNED' ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400 group-hover:bg-green-200 dark:group-hover:bg-green-900/50' : 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400 group-hover:bg-orange-200 dark:group-hover:bg-orange-900/50'}`}>
                                {tx.type === 'EARNED' ? <ArrowDownLeft className="w-5 h-5" /> : <ArrowUpRight className="w-5 h-5" />}
                            </div>
                            <div>
                                <p className="font-bold text-gray-800 dark:text-white text-sm group-hover:text-green-800 dark:group-hover:text-green-300 transition-colors">{tx.description}</p>
                                <p className="text-xs text-gray-400">{tx.date}</p>
                            </div>
                        </div>
                        <span className={`font-bold whitespace-nowrap ${tx.type === 'EARNED' ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-gray-200'}`}>
                            {tx.type === 'EARNED' ? '+' : '-'}{tx.amount} Z
                        </span>
                    </div>
                ))
              ) : (
                <div className="text-center py-8 text-gray-400">
                    <p className="text-sm">No transactions found.</p>
                </div>
              )}
          </div>

          {/* Load More */}
          {hasMore && (
              <div className="mt-6 pt-2 text-center">
                  <button 
                    onClick={handleLoadMore}
                    disabled={isLoadingMore}
                    className="w-full py-3 rounded-xl border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 font-bold text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-70"
                  >
                    {isLoadingMore ? (
                        <>
                            <Loader2 className="w-4 h-4 animate-spin" /> Loading...
                        </>
                    ) : (
                        'Load More Transactions'
                    )}
                  </button>
              </div>
          )}
      </div>

      {/* Market Rates Modal */}
      {showRates && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setShowRates(false)}></div>
              <div className="bg-white dark:bg-gray-800 rounded-t-3xl sm:rounded-3xl w-full max-w-md relative z-10 shadow-2xl animate-fade-in-up p-6 max-h-[85vh] overflow-y-auto">
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                          <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-500" /> Current Rates
                      </h3>
                      <button onClick={() => setShowRates(false)} className="p-2 bg-gray-100 dark:bg-gray-700 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                          <X className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                      </button>
                  </div>
                  
                  <div className="space-y-3">
                      {Object.keys(wasteRates).length === 0 ? (
                           <p className="text-center text-gray-500 py-4">Rates not configured.</p>
                      ) : (
                          Object.entries(wasteRates).map(([category, details]) => (
                              <div key={category} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-100 dark:border-gray-600">
                                  <span className="font-bold text-gray-700 dark:text-gray-200">{category}</span>
                                  <span className="font-bold text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-3 py-1 rounded-lg text-sm">
                                      {details.rate} Z / kg
                                  </span>
                              </div>
                          ))
                      )}
                  </div>

                  <div className="mt-6 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex gap-3 items-start border border-blue-100 dark:border-blue-900/30">
                        <div className="p-1 bg-blue-100 dark:bg-blue-900/50 rounded-full text-blue-600 dark:text-blue-400 mt-0.5 shrink-0">
                            <AlertCircle className="w-3 h-3" />
                        </div>
                        <p className="text-xs text-blue-800 dark:text-blue-300">
                            Rates are set globally by Zilcycler admins and are subject to change based on market demand.
                        </p>
                  </div>
              </div>
          </div>
      )}

      {/* Transaction Detail Modal */}
      {selectedTransaction && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setSelectedTransaction(null)}></div>
              <div className="bg-white dark:bg-gray-800 rounded-t-3xl sm:rounded-3xl w-full max-w-md relative z-10 shadow-2xl animate-fade-in-up p-6 max-h-[85vh] overflow-y-auto">
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                          <History className="w-5 h-5 text-gray-400" /> Transaction Details
                      </h3>
                      <button onClick={() => setSelectedTransaction(null)} className="p-2 bg-gray-100 dark:bg-gray-700 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                          <X className="w-5 h-5 text-gray-600 dark:text-gray-300" />
                      </button>
                  </div>

                  <div className="space-y-4">
                      <div className="flex flex-col items-center justify-center py-4">
                          <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-3 ${selectedTransaction.type === 'EARNED' ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' : 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400'}`}>
                                {selectedTransaction.type === 'EARNED' ? <ArrowDownLeft className="w-8 h-8" /> : <ArrowUpRight className="w-8 h-8" />}
                          </div>
                          <h2 className={`text-3xl font-bold ${selectedTransaction.type === 'EARNED' ? 'text-green-600 dark:text-green-400' : 'text-gray-900 dark:text-white'}`}>
                             {selectedTransaction.type === 'EARNED' ? '+' : '-'}{selectedTransaction.amount} Z
                          </h2>
                          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">{selectedTransaction.type === 'EARNED' ? 'Received' : 'Sent'}</p>
                      </div>

                      <div className="bg-gray-50 dark:bg-gray-700/30 rounded-2xl p-4 space-y-3 border border-gray-100 dark:border-gray-700">
                          <div className="flex justify-between">
                              <span className="text-xs text-gray-400 font-bold uppercase">Transaction ID</span>
                              <span className="text-sm font-mono font-bold text-gray-800 dark:text-gray-200">{selectedTransaction.id}</span>
                          </div>
                          <div className="flex justify-between">
                              <span className="text-xs text-gray-400 font-bold uppercase">Date</span>
                              <span className="text-sm font-bold text-gray-800 dark:text-gray-200">{selectedTransaction.date} • {selectedTransaction.timestamp}</span>
                          </div>
                          <div className="flex justify-between">
                              <span className="text-xs text-gray-400 font-bold uppercase">Description</span>
                              <span className="text-sm font-bold text-gray-800 dark:text-gray-200 text-right max-w-[200px]">{selectedTransaction.description}</span>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default WalletScreen;