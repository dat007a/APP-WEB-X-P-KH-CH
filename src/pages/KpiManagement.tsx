import React, { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot, 
  query, 
  where, 
  doc, 
  setDoc, 
  orderBy, 
  getDocs,
  limit,
  Timestamp
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { DailyKpiRecord, UserProfile, SystemSettings, Ticket } from '../types';
import { useAuth } from '../context/AuthContext';
import { 
  ClipboardList, 
  Calendar as CalendarIcon, 
  Save, 
  CheckCircle2, 
  XCircle, 
  Trophy, 
  Filter,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  AlertCircle,
  Plus
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  format, 
  startOfDay, 
  endOfDay, 
  startOfWeek, 
  endOfWeek, 
  startOfMonth, 
  endOfMonth, 
  subDays,
  isAfter,
  parseISO,
  isSameDay
} from 'date-fns';

export default function KpiManagement() {
  const { profile } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [filterType, setFilterType] = useState<'day' | 'week' | 'month'>('day');
  const [loading, setLoading] = useState(false);
  const [barbers, setBarbers] = useState<UserProfile[]>([]);
  const [kpiRecords, setKpiRecords] = useState<DailyKpiRecord[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [settings, setSettings] = useState<SystemSettings>({
    avgServiceTime: 20,
    maxServiceTime: 40,
    kpiThreshold: 90,
    ticketKpiThreshold: 95,
    fraudThreshold: 20
  });
  const [editValues, setEditValues] = useState<{[userId: string]: string}>({});

  useEffect(() => {
    // Listen to settings
    const settingsUnsub = onSnapshot(doc(db, 'settings', 'global'), (snap) => {
      if (snap.exists()) setSettings(prev => ({ ...prev, ...snap.data() }));
    });

    // Listen to barbers
    const barbersUnsub = onSnapshot(
      query(collection(db, 'users'), where('role', '==', 'barber')),
      (snap) => {
        setBarbers(snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile)));
      }
    );

    return () => {
      settingsUnsub();
      barbersUnsub();
    };
  }, []);

  useEffect(() => {
    let start: Date, end: Date;
    if (filterType === 'day') {
      start = startOfDay(selectedDate);
      end = endOfDay(selectedDate);
    } else if (filterType === 'week') {
      start = startOfWeek(selectedDate, { weekStartsOn: 1 });
      end = endOfWeek(selectedDate, { weekStartsOn: 1 });
    } else {
      start = startOfMonth(selectedDate);
      end = endOfMonth(selectedDate);
    }

    // Listen to KPI records for the selected period
    const kpiQuery = query(
      collection(db, 'dailyKpiReports'),
      where('date', '>=', format(start, 'yyyy-MM-dd')),
      where('date', '<=', format(end, 'yyyy-MM-dd'))
    );

    const kpiUnsub = onSnapshot(kpiQuery, (snap) => {
      setKpiRecords(snap.docs.map(d => ({ id: d.id, ...d.data() } as DailyKpiRecord)));
    });

    // Fetch tickets and calculate app counts
    const fetchTickets = async () => {
      const tQuery = query(
        collection(db, 'tickets'),
        where('startTime', '>=', start.toISOString()),
        where('startTime', '<=', end.toISOString())
      );
      const tSnap = await getDocs(tQuery);
      setTickets(tSnap.docs.map(d => ({ id: d.id, ...d.data() } as Ticket)));
    };

    fetchTickets();

    return () => kpiUnsub();
  }, [selectedDate, filterType]);

  const isLocked = () => {
    if (profile?.role === 'admin') return false;
    
    const now = new Date();
    const today = startOfDay(now);
    const target = startOfDay(selectedDate);
    
    // If target day is before today, it's locked for non-admins
    if (isAfter(today, target)) return true;
    
    // If it's today, it locks after 23:59 (which is effectively tomorrow 00:00)
    // For simplicity, we check if the current time is still within the selected day
    return !isSameDay(now, selectedDate);
  };

  const handleUpdateActual = async (userId: string, userName: string) => {
    if (isLocked() && profile?.role !== 'admin') return;

    const val = parseInt(editValues[userId]);
    if (isNaN(val)) return;

    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const docId = `${dateStr}_${userId}`;
    
    // Calculate app tickets count for this user on this day
    const userAppTickets = tickets.filter(t => 
      t.barberId === userId && 
      isSameDay(parseISO(t.startTime), selectedDate)
    ).length;

    await setDoc(doc(db, 'dailyKpiReports', docId), {
      date: dateStr,
      userId,
      userName,
      actualTicketsCount: val,
      appTicketsCount: userAppTickets,
      updatedAt: new Date().toISOString(),
      updatedBy: profile?.name || 'Unknown'
    }, { merge: true });

    setEditValues(prev => {
      const next = { ...prev };
      delete next[userId];
      return next;
    });
  };

  const calculateUserKpi = (userId: string) => {
    let appTotal = 0;
    let actualTotal = 0;

    if (filterType === 'day') {
      const record = kpiRecords.find(r => r.userId === userId && r.date === format(selectedDate, 'yyyy-MM-dd'));
      const appCount = tickets.filter(t => t.barberId === userId).length;
      appTotal = appCount;
      actualTotal = record?.actualTicketsCount || 0;
    } else {
      const userRecords = kpiRecords.filter(r => r.userId === userId);
      actualTotal = userRecords.reduce((acc, r) => acc + r.actualTicketsCount, 0);
      appTotal = tickets.filter(t => t.barberId === userId).length;
    }

    if (actualTotal === 0) return 0;
    return Math.round((appTotal / actualTotal) * 100);
  };

  const rankingData = barbers.map(b => ({
    ...b,
    kpi: calculateUserKpi(b.uid),
    appTickets: tickets.filter(t => t.barberId === b.uid).length,
    actualTickets: kpiRecords.filter(r => r.userId === b.uid).reduce((acc, r) => acc + r.actualTicketsCount, 0) || (filterType === 'day' ? (kpiRecords.find(r => r.userId === b.uid && r.date === format(selectedDate, 'yyyy-MM-dd'))?.actualTicketsCount || 0) : 0)
  })).sort((a, b) => b.kpi - a.kpi);

  const achieved = rankingData.filter(d => d.kpi >= settings.ticketKpiThreshold && d.actualTickets > 0);
  const notAchieved = rankingData.filter(d => d.kpi < settings.ticketKpiThreshold && d.actualTickets > 0);
  const noData = rankingData.filter(d => d.actualTickets === 0);

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tighter flex items-center gap-3">
            <ClipboardList className="w-8 h-8 text-indigo-600" />
            QUẢN LÝ KPI PHIẾU
          </h1>
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">Đồng bộ hiệu suất thợ & app</p>
        </div>

        <div className="flex items-center gap-2 bg-white border border-slate-200 p-1.5 rounded-2xl shadow-sm">
          {(['day', 'week', 'month'] as const).map((type) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                filterType === type ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
              }`}
            >
              {type === 'day' ? 'Ngày' : type === 'week' ? 'Tuần' : 'Tháng'}
            </button>
          ))}
        </div>
      </div>

      {/* Date Controls */}
      <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex items-center justify-between">
        <button 
          onClick={() => setSelectedDate(subDays(selectedDate, filterType === 'day' ? 1 : filterType === 'week' ? 7 : 30))}
          className="p-3 hover:bg-slate-50 rounded-2xl transition-colors text-slate-400"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <div className="flex flex-col items-center gap-1">
          <div className="flex items-center gap-2 text-indigo-600">
            <CalendarIcon className="w-5 h-5" />
            <span className="text-lg font-black tracking-tight">
              {filterType === 'day' ? format(selectedDate, 'dd / MM / yyyy') : 
               filterType === 'week' ? `Tuần ${format(selectedDate, 'w')} (${format(startOfWeek(selectedDate, {weekStartsOn:1}), 'dd/MM')} - ${format(endOfWeek(selectedDate, {weekStartsOn:1}), 'dd/MM')})` :
               format(selectedDate, 'MMMM yyyy')}
            </span>
          </div>
          {filterType === 'day' && isLocked() && (
            <span className="text-[10px] font-black text-red-500 uppercase tracking-widest flex items-center gap-1">
              <AlertCircle className="w-3 h-3" /> Đã đóng chỉnh sửa (Sau 23:59)
            </span>
          )}
        </div>
        <button 
          onClick={() => setSelectedDate(subDays(selectedDate, filterType === 'day' ? -1 : filterType === 'week' ? -7 : -30))}
          className="p-3 hover:bg-slate-50 rounded-2xl transition-colors text-slate-400"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>

      {filterType === 'day' && (
        <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
          <div className="p-6 border-b border-slate-100 bg-slate-50/50">
            <h2 className="text-xs font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">
              <Plus className="w-4 h-4 text-indigo-600" /> Nhập số lượng phiếu thực tế
            </h2>
          </div>
          <div className="p-0 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100">
                  <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Nhân viên</th>
                  <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Phiếu App</th>
                  <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Phiếu Thực tế</th>
                  <th className="p-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">KPI Ngày</th>
                  <th className="p-6 text-right"></th>
                </tr>
              </thead>
              <tbody>
                {barbers.map(barber => {
                  const record = kpiRecords.find(r => r.userId === barber.uid && r.date === format(selectedDate, 'yyyy-MM-dd'));
                  const appCount = tickets.filter(t => t.barberId === barber.uid).length;
                  const actual = record?.actualTicketsCount || 0;
                  const kpi = actual > 0 ? Math.round((appCount / actual) * 100) : 0;
                  const locked = isLocked() && profile?.role !== 'admin';

                  return (
                    <tr key={barber.uid} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                      <td className="p-6">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center font-black text-slate-500">
                            {barber.name[0]}
                          </div>
                          <div>
                            <p className="text-sm font-black text-slate-800">{barber.name}</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">ID: {barber.uid.slice(0, 8)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-6 font-black text-slate-700 text-lg">{appCount}</td>
                      <td className="p-6">
                        <input 
                          type="number"
                          disabled={locked}
                          placeholder={actual.toString()}
                          value={editValues[barber.uid] ?? actual ?? ''}
                          onChange={(e) => setEditValues({ ...editValues, [barber.uid]: e.target.value })}
                          className={`w-24 bg-white border-2 border-slate-100 rounded-xl px-4 py-2 text-sm font-black text-indigo-600 focus:border-indigo-600 outline-none transition-all ${locked ? 'opacity-50 cursor-not-allowed bg-slate-50' : ''}`}
                        />
                      </td>
                      <td className="p-6">
                        <div className="flex items-center gap-2">
                           <span className={`text-sm font-black ${kpi >= settings.ticketKpiThreshold ? 'text-emerald-500' : kpi > 0 ? 'text-red-500' : 'text-slate-300'}`}>
                             {kpi}%
                           </span>
                           {kpi >= settings.ticketKpiThreshold ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : kpi > 0 ? <XCircle className="w-4 h-4 text-red-500" /> : null}
                        </div>
                      </td>
                      <td className="p-6 text-right">
                        {!locked && (
                          <button 
                            onClick={() => handleUpdateActual(barber.uid, barber.name)}
                            disabled={editValues[barber.uid] === undefined}
                            className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-30 disabled:grayscale text-white w-10 h-10 rounded-xl flex items-center justify-center transition-all shadow-md active:scale-90"
                          >
                            <Save className="w-5 h-5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Analytics Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Winner List */}
          <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
            <div className="p-6 bg-emerald-50 border-b border-emerald-100 flex items-center justify-between">
              <h2 className="text-xs font-black text-emerald-700 uppercase tracking-widest flex items-center gap-2">
                <Trophy className="w-4 h-4" /> NHÂN VIÊN ĐẠT KPI ({settings.ticketKpiThreshold}%)
              </h2>
              <span className="bg-emerald-500 text-white text-[10px] font-black px-2.5 py-1 rounded-full">{achieved.length}</span>
            </div>
            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
               {achieved.map(user => (
                 <div key={user.uid} className="flex items-center gap-3 p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                    <div className="w-12 h-12 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center justify-center font-black text-lg text-emerald-500">
                      {user.kpi}%
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-black text-slate-800 truncate">{user.name}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">{user.appTickets} / {user.actualTickets} Phiếu</p>
                    </div>
                 </div>
               ))}
               {achieved.length === 0 && (
                 <div className="col-span-full py-10 text-center text-slate-300 italic text-sm">Chưa có ai đạt mục tiêu</div>
               )}
            </div>
          </div>

          {/* Not Achieved List */}
          <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
            <div className="p-6 bg-red-50 border-b border-red-100 flex items-center justify-between">
              <h2 className="text-xs font-black text-red-700 uppercase tracking-widest flex items-center gap-2">
                <AlertCircle className="w-4 h-4" /> CHƯA ĐẠT MỤC TIÊU
              </h2>
              <span className="bg-red-500 text-white text-[10px] font-black px-2.5 py-1 rounded-full">{notAchieved.length}</span>
            </div>
            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
               {notAchieved.map(user => (
                 <div key={user.uid} className="flex items-center gap-3 p-4 bg-slate-50 border border-slate-100 rounded-2xl">
                    <div className="w-12 h-12 bg-white rounded-xl shadow-sm border border-slate-100 flex items-center justify-center font-black text-lg text-red-500">
                      {user.kpi}%
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-black text-slate-800 truncate">{user.name}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase">{user.appTickets} / {user.actualTickets} Phiếu</p>
                    </div>
                 </div>
               ))}
               {notAchieved.length === 0 && (
                 <div className="col-span-full py-10 text-center text-slate-300 italic text-sm">Không có nhân viên nào bị trễ KPI</div>
               )}
            </div>
          </div>
        </div>

        {/* TOP Ranking Sidebar */}
        <div className="bg-slate-900 rounded-[2.5rem] p-8 shadow-2xl shadow-slate-200">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-indigo-500 rounded-2xl flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-white font-black text-lg tracking-tight uppercase">Bảng Xếp Hạng</h2>
              <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">{filterType === 'day' ? 'Hôm nay' : filterType === 'week' ? 'Tuần này' : 'Tháng này'}</p>
            </div>
          </div>

          <div className="space-y-6">
            {rankingData.slice(0, 10).map((user, index) => (
              <div key={user.uid} className="flex items-center justify-between group">
                <div className="flex items-center gap-4">
                  <span className={`w-6 text-center font-black font-mono transition-colors ${index < 3 ? 'text-indigo-400 text-xl' : 'text-slate-700'}`}>
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-black text-slate-200 truncate group-hover:text-white transition-colors">{user.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <div className="w-16 h-1 bg-slate-800 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full ${user.kpi >= settings.ticketKpiThreshold ? 'bg-emerald-500' : 'bg-indigo-500'}`} style={{ width: `${Math.min(100, user.kpi)}%` }} />
                      </div>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tighter">{user.kpi}%</span>
                    </div>
                  </div>
                </div>
                {index < 3 && (
                  <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-lg">
                    {index === 0 ? '🥇' : index === 1 ? '🥈' : '🥉'}
                  </div>
                )}
              </div>
            ))}
            {rankingData.length === 0 && (
              <div className="text-center py-20 text-slate-600 italic text-sm">Chưa có dữ liệu xếp hạng</div>
            )}
          </div>

          <div className="mt-8 pt-8 border-t border-slate-800">
             <p className="text-slate-500 text-[9px] font-black uppercase tracking-widest leading-relaxed">
               * Xếp hạng dựa trên tỷ lệ phiếu app hoàn thành so với phiếu thực tế thợ cắt. Mục tiêu chung: {settings.ticketKpiThreshold}%
             </p>
          </div>
        </div>
      </div>
    </div>
  );
}
