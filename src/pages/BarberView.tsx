import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { auth, db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { Chair, Area, Ticket, SystemSettings } from '../types';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  updateDoc, 
  doc, 
  addDoc, 
  onSnapshot,
  getDoc,
  serverTimestamp
} from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Scissors, 
  CheckCircle2, 
  Play, 
  AlertCircle,
  Timer,
  Hash,
  LogOut
} from 'lucide-react';
import { differenceInMinutes, parseISO } from 'date-fns';

export default function BarberView() {
  const { profile } = useAuth();
  const [chair, setChair] = useState<Chair | null>(null);
  const [area, setArea] = useState<Area | null>(null);
  const [settings, setSettings] = useState<SystemSettings>({
    avgServiceTime: 20,
    maxServiceTime: 40,
    kpiThreshold: 90,
    fraudThreshold: 20
  });
  const [ticketNumber, setTicketNumber] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!profile?.areaId || !profile?.chairId) {
      setChair(null);
      setArea(null);
      return;
    }

    // Listen to assigned chair
    const chairUnsub = onSnapshot(doc(db, 'chairs', profile.chairId), (snap) => {
      if (snap.exists()) {
        setChair({ id: snap.id, ...snap.data() } as Chair);
      } else {
        setChair(null);
      }
    }, (err) => {
      console.error("Chair sync error:", err);
    });

    // Listen to assigned area
    const areaUnsub = onSnapshot(doc(db, 'areas', profile.areaId), (snap) => {
      if (snap.exists()) {
        setArea({ id: snap.id, ...snap.data() } as Area);
      } else {
        setArea(null);
      }
    }, (err) => {
      console.error("Area sync error:", err);
    });

    // Listen to settings
    const settingsUnsub = onSnapshot(doc(db, 'settings', 'global'), (snap) => {
      if (snap.exists()) setSettings(snap.data() as SystemSettings);
    });

    return () => {
      chairUnsub();
      areaUnsub();
      settingsUnsub();
    };
  }, [profile?.areaId, profile?.chairId]);

  // Update timer
  useEffect(() => {
    let interval: any;
    if (chair?.status === 'in-service' && chair.lastStartTime) {
      interval = setInterval(() => {
        setElapsed(differenceInMinutes(new Date(), parseISO(chair.lastStartTime!)));
      }, 30000); // update every 30s
      setElapsed(differenceInMinutes(new Date(), parseISO(chair.lastStartTime!)));
    } else {
      setElapsed(0);
    }
    return () => clearInterval(interval);
  }, [chair]);

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketNumber.trim()) return;
    setLoading(true);
    setError('');

    try {
      // Check if ticket exists in active session
      const q = query(collection(db, 'tickets'), where('status', '==', 'in-progress'), where('ticketNumber', '==', ticketNumber.trim()));
      const dupeCheck = await getDocs(q);
      if (!dupeCheck.empty) {
        setError('Số phiếu này đang được sử dụng ở một ghế khác.');
        setLoading(false);
        return;
      }

      const now = new Date().toISOString();
      const newTicket = {
        ticketNumber: ticketNumber.trim(),
        barberId: profile!.uid,
        barberName: profile!.name,
        areaId: profile!.areaId,
        chairId: profile!.chairId,
        startTime: now,
        status: 'in-progress'
      };

      const ticketRef = await addDoc(collection(db, 'tickets'), newTicket);
      
      // Update chair status
      const chairRef = doc(db, 'chairs', profile!.chairId!);
      await updateDoc(chairRef, {
        status: 'in-service',
        currentTicketId: ticketNumber.trim(),
        currentBarberId: profile!.uid,
        lastStartTime: now,
        waitingCount: Math.max(0, (chair?.waitingCount || 0) - 1)
      });

      // Log
      await addDoc(collection(db, 'logs'), {
        timestamp: now,
        userId: profile!.uid,
        userName: profile!.name,
        action: 'Bắt đầu cắt',
        details: `Phiếu #${ticketNumber.trim()} tại Ghế ${chair?.number}`
      });

      setTicketNumber('');
    } catch (err) {
      console.error(err);
      setError('Đã có lỗi xảy ra. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const handleAlmostDone = async () => {
    if (!chair?.currentTicketId) return;
    setLoading(true);
    try {
      console.log(`⏳ Setting chair ${chair.number} to almost-done`);
      const chairRef = doc(db, 'chairs', profile!.chairId!);
      await updateDoc(chairRef, { status: 'almost-done' });
      console.log("✅ State updated: almost-done");
    } catch (err) {
      console.error("AlmostDone error:", err);
      alert('Lỗi: Không thể chuyển trạng thái. Hãy thử tải lại trang.');
    } finally {
      setLoading(false);
    }
  };

  const handleFinish = async () => {
    if (!chair) return;
    if (!chair.currentTicketId && chair.status === 'available') return;
    
    setLoading(true);
    try {
      const now = new Date().toISOString();
      const startTime = chair.lastStartTime ? parseISO(chair.lastStartTime) : new Date();
      const duration = differenceInMinutes(new Date(now), startTime);

      console.log(`🏁 Finishing ticket #${chair.currentTicketId} for Chair ${chair.number}`);

      // Find active ticket
      // In permissive mode, this should work, but we find by ticketNumber and chairId to be precise
      const q = query(
        collection(db, 'tickets'), 
        where('ticketNumber', '==', chair.currentTicketId), 
        where('status', '==', 'in-progress'),
        where('chairId', '==', profile!.chairId)
      );
      
      const ticketSnap = await getDocs(q);
      console.log(`🔍 Found ${ticketSnap.size} matching tickets to close`);
      
      if (!ticketSnap.empty) {
        const ticketDoc = ticketSnap.docs[0];
        await updateDoc(doc(db, 'tickets', ticketDoc.id), {
          status: 'finished',
          endTime: now,
          duration: duration,
          isFraudulent: duration < settings.fraudThreshold
        });
        console.log("✅ Ticket marked as finished");
      }

      // Update chair
      const chairRef = doc(db, 'chairs', profile!.chairId!);
      await updateDoc(chairRef, {
        status: 'available',
        currentTicketId: null,
        currentBarberId: null,
        lastStartTime: null
      });
      console.log("✅ Chair reset to available");

      // Log
      await addDoc(collection(db, 'logs'), {
        timestamp: now,
        userId: profile!.uid,
        userName: profile!.name,
        action: 'Hoàn thành cắt',
        details: `Phiếu #${chair.currentTicketId} tại Ghế ${chair.number}. Thời gian: ${duration}p`
      });

    } catch (err: any) {
      console.error("Finish Error:", err);
      alert(`❌ Lỗi: ${err.message || 'Không thể hoàn thành phiếu.'}`);
    } finally {
      setLoading(false);
    }
  };

  if (!profile?.areaId || !profile?.chairId || !chair || !area) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center bg-white border border-slate-200 rounded-[2rem] shadow-sm">
        <AlertCircle className="w-16 h-16 text-amber-500 mb-6" />
        <h2 className="text-xl font-black text-slate-800 tracking-tight">
          {!profile?.areaId || !profile?.chairId ? 'Chưa được gán vị trí' : 'Vị trí không tồn tại'}
        </h2>
        <p className="text-slate-500 mt-2 text-sm leading-relaxed max-w-xs mx-auto">
          {!profile?.areaId || !profile?.chairId 
            ? 'Vui lòng liên hệ Admin để gán khu vực và số ghế cho tài khoản của bạn.' 
            : 'Khu vực hoặc số ghế được gán cho bạn đã bị xóa khỏi hệ thống. Vui lòng liên hệ Admin để gán lại.'}
        </p>
        <div className="flex flex-col gap-3 mt-8 w-full max-w-[200px]">
          <button 
            onClick={() => window.location.reload()}
            className="w-full px-6 py-4 bg-indigo-600 hover:bg-indigo-700 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white transition-all shadow-lg shadow-indigo-100"
          >
            LÀM MỚI TRANG
          </button>
          
          {(profile?.role === 'admin') && (
            <Link 
              to="/admin"
              className="w-full px-6 py-4 bg-slate-100 hover:bg-slate-200 rounded-2xl text-[10px] font-black uppercase tracking-widest text-slate-600 transition-all text-center"
            >
              VỀ TRANG ADMIN
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto space-y-8">
      <div className="bg-white border border-slate-200 rounded-[2rem] p-10 relative overflow-hidden shadow-sm">
         {/* Decorative Background */}
         <div className="absolute top-0 right-0 p-10 opacity-[0.03]">
           <Scissors className="w-40 h-40 rotate-[15deg] text-slate-900" />
         </div>

         <div className="relative z-10 text-center">
            <h1 className="text-3xl font-black text-slate-800 tracking-tighter uppercase mb-2">Barber Control</h1>
            <p className="text-indigo-600 font-black uppercase text-[10px] tracking-[0.2em] mb-4">Hệ Thống Tường Barber Phát Triển</p>
            <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">{area?.name} — Ghế số {chair?.number}</p>

            <AnimatePresence mode="wait">
               {chair?.status === 'in-service' || chair?.status === 'almost-done' ? (
                <motion.div 
                  key="in-service"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="space-y-8 mt-10"
                >
                  <div className={`p-10 rounded-3xl border-2 flex flex-col items-center gap-6 ${chair.status === 'almost-done' ? 'bg-yellow-50 border-yellow-400' : (elapsed >= settings.maxServiceTime ? 'bg-red-50 border-red-500' : 'bg-red-50 border-red-200')}`}>
                    <div className="flex items-center gap-8">
                      <div className="text-center">
                        <p className="text-[10px] uppercase font-black text-slate-400 mb-2 tracking-widest">Đang phục vụ</p>
                        <p className={`text-5xl font-black tabular-nums tracking-tighter ${chair.status === 'almost-done' ? 'text-yellow-600' : (elapsed >= settings.maxServiceTime ? 'text-red-600' : 'text-slate-800')}`}>#{chair.currentTicketId}</p>
                      </div>
                      <div className="w-px h-16 bg-slate-200" />
                      <div className="text-center">
                        <p className="text-[10px] uppercase font-black text-slate-400 mb-2 tracking-widest">Thời gian trôi qua</p>
                        <p className={`text-5xl font-black tabular-nums tracking-tighter ${chair.status === 'almost-done' ? 'text-yellow-600' : (elapsed >= settings.maxServiceTime ? 'text-red-500' : 'text-slate-800')}`}>
                          {elapsed}m
                        </p>
                      </div>
                    </div>
                    
                    {chair.status === 'almost-done' && (
                       <div className="bg-yellow-500 px-6 py-2 rounded-full flex items-center gap-2 text-white text-xs font-black shadow-lg shadow-yellow-100 uppercase tracking-widest">
                         SẮP XONG (CHỜ THANH TOÁN)
                       </div>
                    )}

                    {elapsed >= settings.maxServiceTime && chair.status !== 'almost-done' && (
                       <motion.div 
                        animate={{ scale: [1, 1.05, 1] }} 
                        transition={{ repeat: Infinity }}
                        className="bg-red-600 px-6 py-2 rounded-full flex items-center gap-2 text-white text-xs font-black shadow-lg shadow-red-200 uppercase tracking-widest"
                       >
                         <AlertCircle className="w-4 h-4" /> QUÁ GIỜ (CẢNH BÁO)
                       </motion.div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-4">
                    {chair.status !== 'almost-done' && (
                      <button
                        onClick={handleAlmostDone}
                        disabled={loading}
                        className="w-full h-20 bg-yellow-400 hover:bg-yellow-500 active:scale-95 transition-all text-white rounded-3xl flex items-center justify-center gap-4 text-xl font-black shadow-xl shadow-yellow-100 disabled:opacity-50"
                      >
                        <Timer className="w-8 h-8" />
                        SẮP XONG
                      </button>
                    )}

                    <button
                      onClick={handleFinish}
                      disabled={loading}
                      className="w-full h-24 bg-indigo-600 hover:bg-indigo-700 active:scale-95 transition-all text-white rounded-3xl flex items-center justify-center gap-4 text-2xl font-black shadow-2xl shadow-indigo-100 disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-10 h-10" />
                      HOÀN THÀNH
                    </button>
                  </div>
                </motion.div>
              ) : (
                <motion.div 
                  key="available"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="space-y-8 mt-10"
                >
                  <div className="bg-slate-50 p-8 rounded-3xl border border-slate-100 flex flex-col items-center">
                    <div className="flex items-center gap-3 mb-8">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Trạng thái hiện tại: </span>
                      <span className={`text-[10px] font-black py-1 px-4 rounded-full uppercase ring-1 ${chair?.status === 'available' ? 'bg-green-50 text-green-600 ring-green-500/20' : 'bg-slate-200 text-slate-500 ring-slate-400/20'}`}>
                        {chair?.status === 'available' ? 'Sẵn sàng' : 'Nghỉ'}
                      </span>
                    </div>

                    <form onSubmit={handleStart} className="w-full space-y-6">
                      <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none">
                          <Hash className="w-6 h-6 text-slate-300 group-focus-within:text-indigo-600 transition-colors" />
                        </div>
                        <input
                          type="text"
                          value={ticketNumber}
                          onChange={(e) => setTicketNumber(e.target.value)}
                          placeholder="Mã số phiếu khách..."
                          className="w-full h-20 bg-white border-2 border-slate-100 rounded-3xl pl-16 pr-6 text-2xl font-black text-slate-800 focus:border-indigo-600 focus:outline-none transition-all placeholder:text-slate-200 shadow-sm"
                          required
                        />
                      </div>
                      
                      {error && (
                        <p className="text-red-500 text-xs text-center font-bold bg-red-50 py-3 rounded-2xl border border-red-100">
                          {error}
                        </p>
                      )}

                      <button
                        type="submit"
                        disabled={loading || !ticketNumber.trim() || chair?.status === 'break'}
                        className="w-full h-24 bg-red-500 hover:bg-red-600 disabled:opacity-50 disabled:grayscale active:scale-95 transition-all text-white rounded-3xl flex items-center justify-center gap-4 text-2xl font-black shadow-2xl shadow-red-100"
                      >
                        <Play className="w-10 h-10 fill-current" />
                        BẮT ĐẦU CẮT
                      </button>
                    </form>
                  </div>
                  
                  <div className="bg-slate-100 rounded-full py-2 px-6 inline-block">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-tight">Khách đang đợi tại ghế này: <span className="text-indigo-600 font-black">{chair?.waitingCount || 0}</span></p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
         </div>
      </div>

      <div className="grid grid-cols-2 gap-6">
         <div className="bg-white border border-slate-200 p-6 rounded-3xl flex flex-col items-center shadow-sm">
            <Timer className="text-slate-300 w-6 h-6 mb-2" />
            <span className="text-lg font-black text-slate-800 tabular-nums leading-none">{settings.avgServiceTime}m</span>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">TB Cắt</span>
         </div>
         <div className="bg-white border border-slate-200 p-6 rounded-3xl flex flex-col items-center shadow-sm">
            <AlertCircle className="text-slate-300 w-6 h-6 mb-2" />
            <span className="text-lg font-black text-slate-800 tabular-nums leading-none">{settings.maxServiceTime}m</span>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Giới Hạn</span>
         </div>
      </div>

      {/* Logout button at bottom for barbers */}
      <div className="pt-4">
        <button
          onClick={() => auth.signOut()}
          className="w-full flex items-center justify-center gap-3 p-5 bg-white border border-red-100 rounded-3xl text-red-500 font-black uppercase text-[10px] tracking-[0.2em] shadow-sm hover:bg-red-50 transition-all border-dashed"
        >
          <LogOut className="w-4 h-4" /> Đăng xuất tài khoản
        </button>
      </div>
    </div>
  );
}
