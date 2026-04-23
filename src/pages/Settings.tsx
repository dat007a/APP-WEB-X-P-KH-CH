import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { SystemSettings } from '../types';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { Save, RefreshCcw, ShieldAlert, Timer, Users, Zap, ClipboardList } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function Settings() {
  const [settings, setSettings] = useState<SystemSettings>({
    avgServiceTime: 20,
    maxServiceTime: 40,
    kpiThreshold: 90,
    ticketKpiThreshold: 95,
    fraudThreshold: 20
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'global'), (snap) => {
      if (snap.exists()) setSettings(prev => ({ ...prev, ...snap.data() }));
    });
    return () => unsub();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setSuccess(false);
    try {
      await setDoc(doc(db, 'settings', 'global'), settings);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      alert("Lỗi khi lưu cài đặt: " + err);
    } finally {
      setLoading(false);
    }
  };

  const updateField = (field: keyof SystemSettings, value: string) => {
    setSettings(prev => ({ ...prev, [field]: parseInt(value) || 0 }));
  };

  return (
    <div className="max-w-3xl mx-auto space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500 pb-20">
      <div className="text-center">
        <h1 className="text-4xl font-black text-slate-800 tracking-tighter">Cấu hình Hệ thống</h1>
        <p className="text-slate-400 text-xs font-black uppercase tracking-[0.2em] mt-2">Thiết lập & tối ưu vận hành shop</p>
      </div>

      <form onSubmit={handleSave} className="space-y-10">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <SettingField 
            icon={Timer}
            title="Ngưỡng Sắp Xong"
            description="Thời gian (phút) để ghế thợ chuyển sang màu VÀNG trên bản đồ."
            value={settings.avgServiceTime}
            onChange={(v: string) => updateField('avgServiceTime', v)}
            unit="m"
          />
          <SettingField 
            icon={Zap}
            title="Ngưỡng Quá Giờ"
            description="Giới hạn thời gian (phút) phục vụ tối đa trước khi gửi alert đỏ."
            value={settings.maxServiceTime}
            onChange={(v: string) => updateField('maxServiceTime', v)}
            unit="m"
          />
          <SettingField 
            icon={ShieldAlert}
            title="Kiểm soát Gian lận"
            description="Các phiếu cắt dưới mức này (phút) sẽ bị hệ thống gắn cờ nghi vấn."
            value={settings.fraudThreshold}
            onChange={(v: string) => updateField('fraudThreshold', v)}
            unit="m"
          />
          <SettingField 
            icon={Users}
            title="Mục tiêu KPI"
            description="Phần trăm tỷ lệ hoàn thành tối thiểu để nhân viên đạt tiêu chuẩn STAR."
            value={settings.kpiThreshold}
            onChange={(v: string) => updateField('kpiThreshold', v)}
            unit="%"
          />
          <SettingField 
            icon={ClipboardList}
            title="KPI Phiếu Thực tế"
            description="Ngưỡng đạt cho tỷ lệ: (Số phiếu trên App) / (Số phiếu thợ cắt thực tế)."
            value={settings.ticketKpiThreshold}
            onChange={(v: string) => updateField('ticketKpiThreshold', v)}
            unit="%"
          />
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-6 p-8 bg-white border border-slate-200 rounded-[2.5rem] shadow-sm">
           <button 
             type="button"
             onClick={() => window.location.reload()}
             className="flex items-center gap-2 text-slate-400 hover:text-slate-600 text-[10px] font-black uppercase tracking-widest transition-colors"
           >
             <RefreshCcw className="w-4 h-4" /> Reset thay đổi
           </button>

           <div className="flex items-center gap-6">
             <AnimatePresence>
              {success && (
                <motion.span 
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  className="text-emerald-500 text-xs font-black uppercase tracking-widest"
                >
                  ✓ Đã đồng bộ
                </motion.span>
              )}
             </AnimatePresence>
             <button 
               type="submit"
               disabled={loading}
               className="bg-indigo-600 hover:bg-indigo-700 text-white px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-indigo-100 disabled:opacity-50 active:scale-95 flex items-center gap-2"
             >
               <Save className="w-4 h-4" /> {loading ? 'SAVING...' : 'UPDATE SYSTEM'}
             </button>
           </div>
        </div>
      </form>
    </div>
  );
}

function SettingField({ icon: Icon, title, description, value, onChange, unit }: any) {
  return (
    <div className="bg-white border border-slate-100 p-8 rounded-[2rem] flex flex-col gap-6 shadow-sm hover:border-indigo-100 transition-colors">
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-slate-50 text-indigo-600 rounded-2xl flex items-center justify-center border border-slate-100 shadow-sm">
          <Icon className="w-6 h-6" />
        </div>
        <div>
          <h3 className="font-black text-slate-800 italic uppercase text-sm tracking-tight">{title}</h3>
          <p className="text-[10px] font-bold text-slate-400 leading-tight uppercase tracking-widest">{unit === 'm' ? 'Timeline' : 'Performance'}</p>
        </div>
      </div>
      <p className="text-xs text-slate-500 leading-relaxed font-medium min-h-[40px] border-l-2 border-slate-100 pl-4">{description}</p>
      <div className="relative group">
        <input 
          type="number" 
          value={value} 
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl py-4 pl-6 pr-14 text-2xl font-black text-indigo-600 focus:bg-white focus:border-indigo-600 focus:outline-none transition-all shadow-inner"
        />
        <span className="absolute right-6 top-1/2 -translate-y-1/2 text-xs font-black text-slate-300 uppercase tracking-widest group-focus-within:text-indigo-600">{unit}</span>
      </div>
    </div>
  );
}
