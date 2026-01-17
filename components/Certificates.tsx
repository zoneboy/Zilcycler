import React from 'react';
import { User, Certificate } from '../types';
import { useApp } from '../context/AppContext';
import { FileBadge, Download, Calendar, ExternalLink } from 'lucide-react';

interface Props {
  user: User;
  onBack: () => void;
}

const Certificates: React.FC<Props> = ({ user, onBack }) => {
  const { certificates } = useApp();

  // Filter certificates for this organization
  const myCertificates = certificates
    .filter(c => c.orgId === user.id)
    .sort((a, b) => new Date(b.dateIssued).getTime() - new Date(a.dateIssued).getTime());

  const handleDownload = (url: string) => {
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-6 animate-fade-in">
        <div className="bg-blue-600 rounded-3xl p-6 text-white shadow-lg relative overflow-hidden">
            <div className="relative z-10">
                <FileBadge className="w-10 h-10 mb-3 opacity-90" />
                <h2 className="text-2xl font-bold mb-1">ESG Certificates</h2>
                <p className="text-blue-100 text-sm opacity-90">
                    Monthly sustainability reports and compliance certificates issued by Zilcycler.
                </p>
            </div>
            <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-blue-500 rounded-full opacity-50 blur-xl"></div>
        </div>

        <div className="space-y-4">
            <h3 className="font-bold text-gray-800 dark:text-white flex items-center gap-2">
                Available Downloads
                <span className="bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs px-2 py-0.5 rounded-full">{myCertificates.length}</span>
            </h3>

            {myCertificates.length === 0 ? (
                <div className="text-center py-12 border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-2xl">
                    <FileBadge className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-500 dark:text-gray-400 font-medium">No certificates issued yet.</p>
                    <p className="text-xs text-gray-400 mt-1">Certificates are issued monthly based on recycling volume.</p>
                </div>
            ) : (
                myCertificates.map(cert => (
                    <div key={cert.id} className="bg-white dark:bg-gray-800 p-4 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm flex items-center justify-between group hover:border-blue-300 transition-all">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/30 rounded-xl flex flex-col items-center justify-center text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-800">
                                <span className="text-[10px] font-bold uppercase">{cert.month.substring(0, 3)}</span>
                                <span className="text-sm font-bold">{cert.year}</span>
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-800 dark:text-white text-sm">Sustainability Report</h4>
                                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                                    <Calendar className="w-3 h-3" /> Issued {new Date(cert.dateIssued).toLocaleDateString()}
                                </div>
                            </div>
                        </div>
                        
                        <button 
                            onClick={() => handleDownload(cert.url)}
                            className="p-3 bg-gray-50 dark:bg-gray-700 hover:bg-blue-50 dark:hover:bg-blue-900/50 text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 rounded-xl transition-colors"
                            title="Download PDF"
                        >
                            <Download className="w-5 h-5" />
                        </button>
                    </div>
                ))
            )}
        </div>
    </div>
  );
};

export default Certificates;