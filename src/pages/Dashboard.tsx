import React, { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where, doc, updateDoc, addDoc, getDocs, orderBy, limit, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Area, Chair, SystemSettings, Ticket, UserProfile } from '../types';
import { useAuth } from '../context/AuthContext';
import { 
  Users, 
  Ticket as TicketIcon, 
  Timer, 
  CheckCircle2, 
  AlertCircle,
  Plus,
  Minus,
  MoreVertical,
  Scissors,
  Edit
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { differenceInMinutes, parseISO, format } from 'date-fns';

export default function Dashboard() {
  const { profile } = useAuth();
  const [areas, setAreas] = useState<Area[]>([]);
  const [chairs, setChairs] = useState<Chair[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [settings, setSettings] = useState<SystemSettings>({
    avgServiceTime: 20,
    maxServiceTime: 40,
    kpiThreshold: 90,
    fraudThreshold: 20
  });
  const [stats, setStats] = useState({
    totalTickets: 0,
    avgTime: 0,
    availableChairs: 0,
    almostDone: 0,
    shortestWait: [] as Chair[]
  });

  useEffect(() => {
    // Listen to settings
    const settingsUnsub = onSnapshot(doc(db, 'settings', 'global'), (snap) => {
      if (snap.exists()) setSettings(snap.data() as SystemSettings);
    });

    // Listen to areas
    const areasUnsub = onSnapshot(collection(db, 'areas'), (snap) => {
      setAreas(snap.docs.map(d => ({ id: d.id, ...d.data() } as Area)));
    });

    // Listen to all chairs across all areas
    const chairsUnsub = onSnapshot(query(collection(db, 'chairs')), (snap) => {
      const allChairs = snap.docs.map(d => ({ id: d.id, ...d.data() } as Chair));
      setChairs(allChairs);
      
      // Calculate Stats
      const available = allChairs.filter(c => c.status === 'available');
      const inService = allChairs.filter(c => c.status === 'in-service');
      
      const almostDone = inService.filter(c => {
        if (!c.lastStartTime) return false;
        const minutes = differenceInMinutes(new Date(), parseISO(c.lastStartTime));
        return minutes >= settings.avgServiceTime && minutes < settings.maxServiceTime;
      });

      setStats(prev => {
        const activeChairs = allChairs.filter(c => c.status !== 'break');
        
        const sorted = [...activeChairs].sort((a, b) => {
          // 1. Primary: Waiting count (ascending)
          const waitA = a.waitingCount || 0;
          const waitB = b.waitingCount || 0;
          if (waitA !== waitB) return waitA - waitB;

          // 2. Secondary: Status Rank
          const getRank = (s: string) => {
            if (s === 'available') return 1;
            if (s === 'almost-done') return 2;
            return 3; // in-service
          };
          const rankA = getRank(a.status);
          const rankB = getRank(b.status);
          if (rankA !== rankB) return rankA - rankB;

          // 3. Tertiary: Elapsed time (longer service time = finishes sooner)
          const elapsedA = a.lastStartTime ? differenceInMinutes(new Date(), parseISO(a.lastStartTime)) : 0;
          const elapsedB = b.lastStartTime ? differenceInMinutes(new Date(), parseISO(b.lastStartTime)) : 0;
          return elapsedB - elapsedA;
        });

        return {
          ...prev,
          availableChairs: available.length,
          almostDone: almostDone.length,
          shortestWait: sorted.slice(0, 3)
        };
      });
    });

    // Listen to users for mapping names to chairs
    const usersUnsub = onSnapshot(collection(db, 'users'), (snap) => {
      setUsers(snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile)));
    });

    // Listen to today's tickets for dashboard
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const ticketsQuery = query(
      collection(db, 'tickets'),
      where('startTime', '>=', today.toISOString()),
      orderBy('startTime', 'desc')
    );
    const ticketsUnsub = onSnapshot(ticketsQuery, (snap) => {
      const docs = snap.docs.map(d => d.data() as Ticket);
      const finished = docs.filter(t => t.status === 'finished' && t.duration);
      const avg = finished.length > 0 
        ? Math.round(finished.reduce((acc, t) => acc + (t.duration || 0), 0) / finished.length) 
        : 0;
      
      setStats(prev => ({
        ...prev,
        totalTickets: docs.length,
        avgTime: avg
      }));
    });

    return () => {
      settingsUnsub();
      areasUnsub();
      chairsUnsub();
      usersUnsub();
      ticketsUnsub();
    };
  }, [settings.avgServiceTime, settings.maxServiceTime]);

  const updateWaiting = async (areaId: string, chairId: string, delta: number) => {
    if (profile?.role !== 'admin' && profile?.role !== 'cashier') return;
    const chairRef = doc(db, 'chairs', chairId);
    const chair = chairs.find(c => c.id === chairId);
    if (!chair) return;
    const newCount = Math.max(0, (chair.waitingCount || 0) + delta);
    await updateDoc(chairRef, { waitingCount: newCount });
    
    // Log action
    await addDoc(collection(db, 'logs'), {
      timestamp: new Date().toISOString(),
      userId: profile.uid,
      userName: profile.name,
      action: `${delta > 0 ? 'Thêm' : 'Giảm'} khách chờ`,
      details: `Ghế #${chair.number} tại ${areas.find(a => a.id === areaId)?.name}. SL mới: ${newCount}`
    });
  };

  const forceStatus = async (areaId: string, chairId: string, status: 'available' | 'in-service' | 'almost-done' | 'break') => {
    if (profile?.role !== 'admin' && profile?.role !== 'cashier') return;
    const chairRef = doc(db, 'chairs', chairId);
    
    // Logic for setting appropriate timestamps
    const updates: any = { status };
    if (status === 'available') {
      updates.currentTicketId = null;
      updates.currentBarberId = null;
      updates.lastStartTime = null;
    } else if (status === 'in-service' || status === 'almost-done') {
      // If we're forcing in-service or almost-done, we might want to simulate a start time if none exists
      const chair = chairs.find(c => c.id === chairId);
      if (!chair?.lastStartTime) {
        updates.lastStartTime = new Date().toISOString();
      }
      
      // If almost-done, we could intentionally set the start time back to trigger the yellow state if it's purely UI based
      // BUT we added a real status so we can just use that.
    }
    
    await updateDoc(chairRef, updates);
    
    // Log action
    await addDoc(collection(db, 'logs'), {
      timestamp: new Date().toISOString(),
      userId: profile.uid,
      userName: profile.name,
      action: `Cưỡng chế trạng thái`,
      details: `Ghế ID ${chairId} chuyển sang ${status}`
    });
  };

  return (
    <div className="space-y-6">
      {/* Top Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard 
          icon={TicketIcon} 
          label="Tổng số phiếu hôm nay" 
          value={stats.totalTickets} 
          sub={stats.totalTickets > 0 ? "Khách đã phục vụ" : "Chưa có khách"}
          color="blue"
        />
        <StatCard 
          icon={Timer} 
          label="Thời gian cắt TB" 
          value={`${stats.avgTime} phút`} 
          sub="Tính trên phiếu hoàn thành"
          color="purple"
        />
         <StatCard 
          icon={Users} 
          label="Ghế Rảnh" 
          value={stats.availableChairs} 
          sub={`Trong tổng số ${chairs.length} ghế`}
          color="emerald"
        />
        <StatCard 
          icon={CheckCircle2} 
          label="Ghế Sắp Xong" 
          value={stats.almostDone} 
          sub={`Dựa trên TB ${settings.avgServiceTime}p`}
          color="amber"
        />
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Map Grid */}
        <div className="xl:col-span-2 space-y-8">
          {areas.map(area => (
            <div key={area.id} className="bg-white border border-slate-200 rounded-2xl p-8 shadow-sm">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
                    <span className="w-1.5 h-6 bg-indigo-600 rounded-full" />
                    BẢNG MAP: {area.name}
                  </h2>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Trạng thái thời gian thực</p>
                </div>
                <div className="flex gap-4 text-[10px] font-bold text-slate-500 uppercase tracking-tight">
                   <div className="flex items-center gap-1.5">
                     <div className="w-3 h-3 bg-white border border-slate-300 rounded-sm" /> Rảnh
                   </div>
                   <div className="flex items-center gap-1.5">
                     <div className="w-3 h-3 bg-red-500 rounded-sm" /> Đang cắt
                   </div>
                   <div className="flex items-center gap-1.5">
                     <div className="w-3 h-3 bg-yellow-400 rounded-sm" /> Sắp xong
                   </div>
                   <div className="flex items-center gap-1.5">
                     <div className="w-3 h-3 bg-slate-400 rounded-sm" /> Nghỉ
                   </div>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {chairs.filter(c => c.areaId === area.id).sort((a,b) => a.number - b.number).map(chair => (
                  <ChairItem 
                    key={chair.id} 
                    chair={chair} 
                    settings={settings}
                    onUpdateWaiting={(d) => updateWaiting(area.id, chair.id, d)}
                    onForceStatus={(s) => forceStatus(area.id, chair.id, s)}
                    canControl={profile?.role === 'admin' || profile?.role === 'cashier'}
                    barberName={users.find(u => u.chairId === chair.id)?.name}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Sidebar Alerts & Info */}
        <div className="space-y-6">
           <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <Users className="w-4 h-4 text-indigo-600" /> Chờ Ít Nhất
              </h3>
              <div className="space-y-3">
                 {stats.shortestWait.map((c, i) => (
                   <div key={c.id} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center font-bold text-xs text-slate-800 shadow-sm">
                          {c.number}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-slate-800">Ghế #{c.number}</p>
                          <p className="text-[10px] text-slate-400 font-medium uppercase tracking-tighter">{areas.find(a => a.id === c.areaId)?.name}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-bold text-indigo-600">{c.waitingCount || 0} khách</p>
                        <p className="text-[9px] text-slate-400 font-bold uppercase">{c.status}</p>
                      </div>
                   </div>
                 ))}
              </div>
           </div>

           <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-500" /> Cảnh báo & Phát hiện
              </h3>
              <div className="space-y-4">
                 {chairs.filter(c => {
                    if (c.status !== 'in-service' || !c.lastStartTime) return false;
                    return differenceInMinutes(new Date(), parseISO(c.lastStartTime)) >= settings.maxServiceTime;
                 }).map(c => (
                   <div key={c.id} className="p-3 bg-red-50 border-l-4 border-red-500 rounded-r-xl">
                      <div className="flex justify-between items-start">
                        <p className="text-xs font-bold text-red-700">Quá giờ phục vụ ({differenceInMinutes(new Date(), parseISO(c.lastStartTime!))}m)</p>
                        <span className="text-[10px] text-red-400 font-bold">{format(parseISO(c.lastStartTime!), 'HH:mm')}</span>
                      </div>
                      <p className="text-[11px] text-red-600 mt-1">Ghế: #{c.number} • Phiếu: {c.currentTicketId}</p>
                   </div>
                 ))}
                 {chairs.filter(c => c.status === 'in-service' && c.lastStartTime && differenceInMinutes(new Date(), parseISO(c.lastStartTime)) >= settings.maxServiceTime).length === 0 && (
                   <div className="flex flex-col items-center justify-center py-6 text-slate-300 italic text-xs">
                      <CheckCircle2 className="w-4 h-4 mb-1 opacity-20" />
                      Mọi thứ ổn định
                   </div>
                 )}
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, sub, color }: any) {
  const colors: any = {
    blue: 'text-indigo-600 bg-indigo-50 border-indigo-100',
    purple: 'text-purple-600 bg-purple-50 border-purple-100',
    emerald: 'text-emerald-600 bg-emerald-50 border-emerald-100',
    amber: 'text-amber-600 bg-amber-50 border-amber-100',
  };

  return (
    <motion.div 
      whileHover={{ y: -2 }}
      className={`bg-white border border-slate-200 p-6 rounded-2xl shadow-sm`}
    >
      <div className="flex items-center gap-5">
        <div className={`p-3 rounded-xl ${colors[color]} border shadow-sm`}>
          <Icon className="w-6 h-6" />
        </div>
        <div>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{label}</p>
          <p className="text-2xl font-black text-slate-800 tabular-nums my-0.5">{value}</p>
          <p className="text-[10px] font-bold text-slate-500 tracking-tight">{sub}</p>
        </div>
      </div>
    </motion.div>
  );
}

function ChairItem({ chair, settings, onUpdateWaiting, onForceStatus, canControl, barberName }: { 
  chair: Chair, 
  settings: SystemSettings, 
  onUpdateWaiting: (d: number) => void | Promise<void>,
  onForceStatus: (s: 'available' | 'in-service' | 'almost-done' | 'break') => void | Promise<void>,
  canControl: boolean,
  barberName?: string,
  key?: React.Key
}) {
  const [showControls, setShowControls] = useState(false);
  const now = new Date();
  const startTime = chair.lastStartTime ? parseISO(chair.lastStartTime) : null;
  const elapsed = startTime ? differenceInMinutes(now, startTime) : 0;
  
  let bgColor = 'bg-white border-slate-200';
  let textColor = 'text-slate-800';
  let labelColor = 'text-slate-400';
  let subColor = 'text-slate-500';

  if (chair.status === 'almost-done') {
    bgColor = 'bg-yellow-400 border-yellow-500 shadow-md transform scale-[1.02]';
    textColor = 'text-white drop-shadow-sm';
    labelColor = 'text-yellow-800';
    subColor = 'text-yellow-900';
  } else if (chair.status === 'in-service') {
    if (elapsed >= settings.maxServiceTime) {
      bgColor = 'bg-red-500 border-red-600 shadow-lg ring-4 ring-red-100';
      textColor = 'text-white animate-pulse';
      labelColor = 'text-red-100';
      subColor = 'text-red-100';
    } else if (elapsed >= settings.avgServiceTime) {
      bgColor = 'bg-yellow-400 border-yellow-500 shadow-md transform scale-[1.02]';
      textColor = 'text-white drop-shadow-sm';
      labelColor = 'text-yellow-800';
      subColor = 'text-yellow-900';
    } else {
      bgColor = 'bg-red-500 border-red-600 shadow-sm';
      textColor = 'text-white';
      labelColor = 'text-red-100';
      subColor = 'text-red-100';
    }
  } else if (chair.status === 'break') {
    bgColor = 'bg-slate-400 border-slate-500 shadow-inner opacity-80';
    textColor = 'text-white';
    labelColor = 'text-slate-100';
    subColor = 'text-slate-200';
  }

  return (
    <motion.div
      layout
      className={`relative group chair-card rounded-2xl border-2 ${bgColor} aspect-[4/3] flex flex-col items-center justify-center p-4 transition-all duration-300 font-sans cursor-pointer`}
      onClick={() => canControl && setShowControls(true)}
    >
      {/* Edit Trigger - persistent for mobile */}
      {canControl && (
        <button 
          onClick={(e) => { e.stopPropagation(); setShowControls(true); }}
          className="absolute top-2 left-2 p-1.5 bg-white/20 hover:bg-white/40 rounded-lg text-white opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Edit className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Waiting Badge from design */}
      {chair.waitingCount > 0 && (
         <div className="absolute -top-2 -right-2 bg-indigo-600 text-white w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shadow-lg ring-2 ring-white">
           {chair.waitingCount}
         </div>
      )}

      <p className={`text-xl font-black uppercase mb-1 tracking-tighter ${labelColor}`}>GHẾ {chair.number < 10 ? `0${chair.number}` : chair.number}</p>
      
      <div className="text-center">
        {chair.status === 'in-service' || chair.status === 'almost-done' ? (
          <>
            <p className={`text-2xl font-black tabular-nums break-all ${textColor}`}>
              {elapsed}m
            </p>
            <p className={`text-[10px] font-bold mt-0.5 ${subColor}`}>
              {chair.status === 'almost-done' ? 'SẮP XONG' : `Phiếu #${chair.currentTicketId}`}
            </p>
          </>
        ) : (
          <p className={`text-2xl font-black ${textColor}`}>
            {chair.status === 'break' ? 'NGHỈ' : 'RẢNH'}
          </p>
        )}
      </div>

      <p className={`text-xs font-semibold mt-2 truncate max-w-full italic ${subColor}`}>
         {chair.status === 'available' ? '- Trống -' : (barberName || 'Nhân viên')}
      </p>

      {/* Control Overlay */}
      {canControl && showControls && (
        <motion.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 bg-slate-900/95 z-10 flex flex-col p-4 justify-center gap-3 backdrop-blur-md rounded-2xl overflow-hidden"
          onClick={(e) => e.stopPropagation()}
        >
           <div className="flex justify-between items-center bg-white/10 p-2 rounded-lg border border-white/10 mb-1">
              <span className="text-white text-[10px] font-black uppercase">Chờ: {chair.waitingCount}</span>
              <div className="flex gap-2">
                <button 
                  onClick={() => onUpdateWaiting(-1)}
                  className="w-8 h-8 bg-white/20 hover:bg-red-500 rounded-lg flex items-center justify-center text-white transition-all transform active:scale-95"
                >
                  <Minus className="w-4 h-4" />
                </button>
                <button 
                  onClick={() => onUpdateWaiting(1)}
                  className="w-8 h-8 bg-white/20 hover:bg-indigo-500 rounded-lg flex items-center justify-center text-white transition-all transform active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
           </div>
           
           <div className="grid grid-cols-1 gap-2">
              <select 
                onChange={(e) => {
                  const val = e.target.value as any;
                  if (val) {
                    onForceStatus(val);
                    setShowControls(false);
                  }
                }}
                className="bg-white/10 text-white text-[10px] font-black py-2.5 rounded-lg transition-colors uppercase border border-white/20 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={chair.status}
              >
                <option value="available" className="text-slate-800">Rảnh (Trắng)</option>
                <option value="in-service" className="text-slate-800">Đang cắt (Đỏ)</option>
                <option value="almost-done" className="text-slate-800">Sắp xong (Vàng)</option>
                <option value="break" className="text-slate-800">Nghỉ (Xám)</option>
              </select>
           </div>
           
           <button 
             onClick={() => setShowControls(false)}
             className="mt-1 text-[9px] font-black text-slate-500 hover:text-white uppercase tracking-widest py-2 transition-colors border border-dashed border-slate-700 rounded-lg"
           >
             Đóng
           </button>
        </motion.div>
      )}
    </motion.div>
  );
}
