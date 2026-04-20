import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { Ticket, UserProfile, SystemSettings } from '../types';
import { collection, query, where, getDocs, onSnapshot, doc } from 'firebase/firestore';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie
} from 'recharts';
import { 
  Calendar, 
  ChevronDown, 
  Filter, 
  Download, 
  Star, 
  TrendingUp, 
  AlertCircle,
  BarChart3
} from 'lucide-react';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, isWithinInterval, parseISO, format } from 'date-fns';

export default function Reports() {
  const [range, setRange] = useState<'today' | 'week' | 'month'>('today');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [settings, setSettings] = useState<SystemSettings>({
    avgServiceTime: 20, maxServiceTime: 40, kpiThreshold: 90, fraudThreshold: 20
  });

  useEffect(() => {
    // Basic fetches
    onSnapshot(collection(db, 'users'), (snap) => {
      setUsers(snap.docs.map(d => d.data() as UserProfile));
    });
    onSnapshot(doc(db, 'settings', 'global'), (snap) => {
      if (snap.exists()) setSettings(snap.data() as SystemSettings);
    });

    const fetchTickets = async () => {
      const now = new Date();
      let start: Date, end: Date;

      if (range === 'today') { start = startOfDay(now); end = endOfDay(now); }
      else if (range === 'week') { start = startOfWeek(now); end = endOfWeek(now); }
      else { start = startOfMonth(now); end = endOfMonth(now); }

      const q = query(
        collection(db, 'tickets'),
        where('startTime', '>=', start.toISOString()),
        where('startTime', '<=', end.toISOString())
      );
      const snap = await getDocs(q);
      setTickets(snap.docs.map(d => ({ id: d.id, ...d.data() } as Ticket)));
    };

    fetchTickets();
  }, [range]);

  const barberStats = users.filter(u => u.role === 'barber').map(barber => {
    const barberTickets = tickets.filter(t => t.barberId === barber.uid);
    const completed = barberTickets.filter(t => t.status === 'finished').length;
    const total = barberTickets.length;
    const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
    const avgDuration = completed > 0 
      ? Math.round(barberTickets.filter(t => t.status === 'finished').reduce((acc, t) => acc + (t.duration || 0), 0) / completed)
      : 0;

    return {
      name: barber.name,
      total,
      completed,
      rate,
      avgDuration,
      kpiMet: rate >= settings.kpiThreshold
    };
  }).sort((a, b) => b.rate - a.rate);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Đo lường Nhân viên & KPI</h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Phân tích hiệu suất và tỷ lệ hoàn thành Phiếu</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-white border border-slate-200 p-1 rounded-2xl shadow-sm">
             {(['today', 'week', 'month'] as const).map(r => (
               <button 
                 key={r}
                 onClick={() => setRange(r)}
                 className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${range === r ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'hover:text-slate-800 text-slate-400'}`}
               >
                 {r === 'today' ? 'Hôm nay' : r === 'week' ? 'Tuần' : 'Tháng'}
               </button>
             ))}
          </div>
          <button className="p-3 bg-white border border-slate-200 rounded-2xl text-slate-400 hover:text-indigo-600 transition-all shadow-sm">
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* KPI Chart */}
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-3xl p-8 shadow-sm">
           <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-8 flex items-center gap-2">
             <TrendingUp className="w-4 h-4 text-indigo-600" /> Biểu đồ Tỷ lệ hoàn thành (%)
           </h3>
           <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barberStats}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="name" stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} />
                <YAxis stroke="#94a3b8" fontSize={10} tickLine={false} axisLine={false} domain={[0, 100]} />
                <Tooltip 
                  cursor={{fill: '#f8fafc'}}
                  contentStyle={{ backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '16px', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                />
                <Bar dataKey="rate" radius={[6, 6, 0, 0]} barSize={40}>
                  {barberStats.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.kpiMet ? '#10b981' : '#ef4444'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
           </div>
        </div>

        {/* Quick Insights */}
        <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm flex flex-col justify-between">
           <div>
            <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-6">Sơ lược nhanh</h3>
            <div className="space-y-4">
              <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 group hover:border-indigo-200 transition-colors">
                 <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1">Tổng lượt cắt</p>
                 <p className="text-4xl font-black text-slate-800 tracking-tighter">{tickets.length}</p>
              </div>
              <div className="p-6 bg-slate-50 rounded-2xl border border-slate-100 group hover:border-indigo-200 transition-colors">
                 <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest mb-1">Thời gian TB Hệ thống</p>
                 <p className="text-4xl font-black text-slate-800 tracking-tighter">{Math.round(tickets.filter(t => t.duration).reduce((a, b) => a + (b.duration || 0), 0) / (tickets.filter(t => t.duration).length || 1))}m</p>
              </div>
              <div className="p-6 bg-emerald-50 rounded-2xl border border-emerald-100 group hover:border-emerald-200 transition-colors">
                 <p className="text-[10px] text-emerald-600 uppercase font-black tracking-widest mb-1">Đạt KPI ({settings.kpiThreshold}%)</p>
                 <p className="text-4xl font-black text-emerald-600 tracking-tighter">{barberStats.filter(s => s.kpiMet).length} <span className="text-xs font-bold text-slate-400">/ {barberStats.length} thợ</span></p>
              </div>
            </div>
           </div>
        </div>
      </div>

      {/* Leaderboard Table */}
      <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm">
        <div className="p-6 bg-slate-50/50 border-b border-slate-100 flex justify-between items-center">
           <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 italic">
              <BarChart3 className="w-4 h-4 text-indigo-600" /> Bảng xếp hạng hiệu suất thợ
           </h3>
           <div className="flex items-center gap-2 bg-white px-4 py-1.5 rounded-full border border-slate-200 shadow-sm">
              <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-tighter">STAR KPI: {settings.kpiThreshold}%</span>
           </div>
        </div>
        <table className="w-full text-left">
          <thead className="bg-slate-50/30 text-[10px] font-black text-slate-400 uppercase tracking-widest">
            <tr>
              <th className="p-6">Hạng</th>
              <th className="p-6">Nhân viên</th>
              <th className="p-6">Tổng</th>
              <th className="p-6">Xong</th>
              <th className="p-6">TB</th>
              <th className="p-6 text-center">Tỷ lệ KPI</th>
              <th className="p-6 text-right">Đánh giá</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {barberStats.map((stat, i) => (
              <tr key={stat.name} className={`hover:bg-slate-50 transition-colors ${i < 3 ? 'bg-indigo-50/30' : ''}`}>
                <td className="p-6">
                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black shadow-sm ${
                    i === 0 ? 'bg-amber-400 text-white' : 
                    i === 1 ? 'bg-slate-200 text-slate-600' :
                    i === 2 ? 'bg-orange-300 text-white' :
                    'bg-white border border-slate-200 text-slate-400'
                  }`}>
                    {i + 1}
                  </div>
                </td>
                <td className="p-6">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center font-black text-xs uppercase shadow-sm">
                      {stat.name[0]}
                    </div>
                    <span className="text-sm font-black text-slate-800 tracking-tight">{stat.name}</span>
                  </div>
                </td>
                <td className="p-6 text-sm font-bold text-slate-500">{stat.total}</td>
                <td className="p-6 text-sm font-bold text-emerald-600">{stat.completed}</td>
                <td className="p-6 text-sm font-bold text-slate-400 tabular-nums">{stat.avgDuration}m</td>
                <td className="p-6">
                   <div className="flex items-center gap-3 justify-center">
                     <div className="flex-1 max-w-[100px] h-2.5 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className={`h-full ring-1 ring-inset ${stat.kpiMet ? 'bg-emerald-500 ring-emerald-400/30' : 'bg-red-500 ring-red-400/30'}`} 
                          style={{ width: `${stat.rate}%` }} 
                        />
                     </div>
                     <span className={`text-[10px] font-black tabular-nums min-w-[35px] ${stat.kpiMet ? 'text-emerald-600' : 'text-red-500'}`}>{stat.rate}%</span>
                   </div>
                </td>
                <td className="p-6 text-right">
                   {stat.kpiMet ? (
                     <div className="inline-flex items-center gap-1.5 bg-emerald-50 text-emerald-600 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest ring-1 ring-emerald-200/50">
                       <Star className="w-3.5 h-3.5 fill-emerald-500" /> ACE
                     </div>
                   ) : (
                     <div className="inline-flex items-center gap-1.5 bg-red-50 text-red-600 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest ring-1 ring-red-200/50">
                       <AlertCircle className="w-3.5 h-3.5" /> RE-TRAIN
                     </div>
                   )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
