import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Key, Shield, AlertTriangle, CheckCircle, Cpu, Lock } from 'lucide-react';
import { useLicense } from '../hooks/useLicense';

interface LicenseScreenProps {
  onActivate: (key: string) => Promise<boolean>;
  machineId: string | null;
  licenseError: string | null;
}

const LicenseScreen: React.FC<LicenseScreenProps> = ({ onActivate, machineId, licenseError }) => {
  const [key, setKey] = useState('');
  const [isActivating, setIsActivating] = useState(false);
  const [success, setSuccess] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const error = localError || licenseError;

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!key.trim() || isActivating) return;

    setLocalError(null);
    setIsActivating(true);
    const result = await onActivate(key.toUpperCase().trim());
    setIsActivating(false);
    
    if (result) {
      setSuccess(true);
    }
  };

  return (
    <div className="fixed inset-0 z-[10000] bg-background flex items-center justify-center overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-accent/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-accent/5 rounded-full blur-[120px]" />
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10" />
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="relative w-full max-w-md p-8 card bg-panel/80 backdrop-blur-xl border-white/10 shadow-2xl"
      >
        <div className="flex flex-col items-center text-center mb-8">
          <div className="w-16 h-16 bg-accent/10 rounded-2xl flex items-center justify-center mb-6 border border-accent/20">
            <Lock className="text-accent w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black tracking-tighter italic uppercase text-white mb-2">
            Activation Required
          </h1>
          <p className="text-white/40 text-sm leading-relaxed">
            Enter your license key to unlock the <span className="text-accent font-bold">GRiD UP</span> Performance Center.
          </p>
        </div>

        <form onSubmit={handleActivate} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-white/30 px-1">
              License Key
            </label>
            <div className="relative">
              <Key className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
              <input
                type="text"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                placeholder="GU-XXXX-XXXX-XXXX"
                className="w-full bg-black/40 border border-white/5 rounded-lg py-4 pl-12 pr-4 text-white font-mono tracking-widest focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all uppercase"
                required
              />
            </div>
          </div>

          <AnimatePresence mode="wait">
            {error && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-start gap-3 p-4 bg-status-error/10 border border-status-error/20 rounded-lg"
              >
                <AlertTriangle className="w-4 h-4 text-status-error shrink-0 mt-0.5" />
                <p className="text-xs text-status-error font-medium leading-relaxed">
                  {error}
                </p>
              </motion.div>
            )}

            {success && (
              <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="flex items-start gap-3 p-4 bg-status-success/10 border border-status-success/20 rounded-lg"
              >
                <CheckCircle className="w-4 h-4 text-status-success shrink-0 mt-0.5" />
                <p className="text-xs text-status-success font-medium leading-relaxed">
                  Success! Initializing your performance suite...
                </p>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            type="submit"
            disabled={isActivating || success}
            className={`w-full py-4 rounded-lg font-black uppercase tracking-widest text-xs transition-all flex items-center justify-center gap-2 ${
              isActivating || success 
              ? 'bg-white/5 text-white/20 cursor-not-allowed' 
              : 'bg-accent text-black hover:bg-white hover:scale-[1.02] active:scale-[0.98]'
            }`}
          >
            {isActivating ? (
              <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            ) : success ? (
              'Activated'
            ) : (
              <>
                Unlock Suite
                <Shield className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-white/5 flex flex-col items-center gap-4">
          <div className="flex items-center gap-2 text-[10px] text-white/20 font-mono uppercase">
            <Cpu className="w-3 h-3" />
            Hardware ID: {machineId || 'Detecting...'}
          </div>
          <p className="text-[10px] text-white/20 text-center leading-relaxed">
            Locked to this hardware. Contact <span className="text-white/40">GRiD UP Admin</span> for transfer requests.
          </p>
        </div>
      </motion.div>
    </div>
  );
};

export default LicenseScreen;
