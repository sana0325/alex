import React, { useState, useEffect } from 'react';
import { X, Save, Shield, AlertTriangle } from 'lucide-react';
import { ExchangeConfig, ExchangeName } from '../types';
import { saveExchangeConfig, loadExchangeConfig, clearExchangeConfig } from '../services/trade';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const EXCHANGES: ExchangeName[] = ['BINANCE', 'BYBIT', 'OKX'];

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<ExchangeName>('BINANCE');
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [passphrase, setPassphrase] = useState('');
  const [isTestnet, setIsTestnet] = useState(false);
  const [savedConfigs, setSavedConfigs] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (isOpen) {
      loadSavedStatus();
    }
  }, [isOpen]);

  const loadSavedStatus = async () => {
    const current = await loadExchangeConfig();
    const status: Record<string, boolean> = {};
    EXCHANGES.forEach(ex => {
      status[ex] = !!current[ex];
    });
    setSavedConfigs(status);
    
    // Clear inputs when switching
    setApiKey('');
    setApiSecret('');
    setPassphrase('');
  };

  const handleSave = async () => {
    if (!apiKey || !apiSecret) return;
    
    const config: ExchangeConfig = {
      name: activeTab,
      apiKey,
      apiSecret,
      passphrase: activeTab === 'OKX' ? passphrase : undefined,
      isTestnet
    };

    await saveExchangeConfig(config);
    await loadSavedStatus();
    alert(`${activeTab} keys saved locally!`);
  };

  const handleDelete = async () => {
    await clearExchangeConfig(activeTab);
    await loadSavedStatus();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-200">
      <div className="bg-[#111827] w-full max-w-md rounded-xl border border-gray-700 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-900">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Shield className="text-blue-500" size={20} />
            Execution Settings
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white p-2">
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="bg-blue-900/20 border border-blue-800/50 p-3 rounded-lg flex gap-3">
             <AlertTriangle className="text-blue-400 shrink-0" size={20} />
             <p className="text-xs text-blue-200">
               Keys are stored locally. For mobile/desktop native apps, this storage is isolated to the application sandbox.
               <br/><br/>
               Use <strong>Trade Only</strong> API permissions.
             </p>
          </div>

          {/* Exchange Tabs */}
          <div className="flex gap-2 border-b border-gray-700 pb-2 overflow-x-auto">
            {EXCHANGES.map(ex => (
              <button
                key={ex}
                onClick={() => setActiveTab(ex)}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-all whitespace-nowrap ${
                  activeTab === ex 
                    ? 'bg-blue-600 text-white' 
                    : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }`}
              >
                {ex} {savedConfigs[ex] && '✓'}
              </button>
            ))}
          </div>

          <div className="space-y-4">
             <div>
               <label className="block text-xs font-medium text-gray-400 mb-1">API Key</label>
               <input 
                 type="password" 
                 value={apiKey}
                 onChange={e => setApiKey(e.target.value)}
                 className="w-full bg-gray-950 border border-gray-700 rounded p-2 text-sm text-white focus:border-blue-500 outline-none transition-colors"
                 placeholder="Enter Exchange API Key"
               />
             </div>

             <div>
               <label className="block text-xs font-medium text-gray-400 mb-1">API Secret</label>
               <input 
                 type="password" 
                 value={apiSecret}
                 onChange={e => setApiSecret(e.target.value)}
                 className="w-full bg-gray-950 border border-gray-700 rounded p-2 text-sm text-white focus:border-blue-500 outline-none transition-colors"
                 placeholder="Enter Exchange API Secret"
               />
             </div>

             {activeTab === 'OKX' && (
               <div>
                 <label className="block text-xs font-medium text-gray-400 mb-1">Passphrase</label>
                 <input 
                   type="password" 
                   value={passphrase}
                   onChange={e => setPassphrase(e.target.value)}
                   className="w-full bg-gray-950 border border-gray-700 rounded p-2 text-sm text-white focus:border-blue-500 outline-none transition-colors"
                   placeholder="OKX Passphrase"
                 />
               </div>
             )}

             <div className="flex items-center gap-2">
               <input 
                 type="checkbox" 
                 id="testnet" 
                 checked={isTestnet}
                 onChange={e => setIsTestnet(e.target.checked)}
                 className="rounded border-gray-700 bg-gray-900 w-4 h-4"
               />
               <label htmlFor="testnet" className="text-sm text-gray-300">Use Testnet</label>
             </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-700 bg-gray-900 flex justify-between">
          {savedConfigs[activeTab] ? (
             <button onClick={handleDelete} className="text-red-400 text-sm hover:underline">
               Delete Config
             </button>
          ) : <div></div>}
          
          <button 
            onClick={handleSave}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            <Save size={18} />
            Save {activeTab}
          </button>
        </div>
      </div>
    </div>
  );
};