import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { ActivityLog, Ticket } from '../types';
import { collection, query, orderBy, limit, onSnapshot, where } from 'firebase/firestore';
import { 
  History, 
  Search, 
  ShieldAlert, 
  Clock, 
  User, 
  Tag as TagIcon,
  AlertTriangle,
  ArrowRight,
  Filter
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { motion, AnimatePresence } from 'motion/react';

export default function Logs() {
  const [activeTab, setActiveTab] = useState<'all' | 'fraud'>('all');
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [fraudTickets, setFraudTickets] = useState<Ticket[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    // All logs
    const logsQuery = query(collection(db, 'logs'), orderBy('timestamp', 'desc'), limit(100));
    const unsubLogs = onSnapshot(logsQuery, (snap) => {
      setLogs(snap.docs.map(d => ({ id: d.id, ...d.data() } as ActivityLog)));
    });

    // Fraud tickets (duration < fraudThreshold)
    const fraudQuery = query(collection(db, 'tickets'), where('isFraudulent', '==', true), orderBy('startTime', 'desc'));
    const unsubFraud = onSnapshot(fraudQuery, (snap) => {
      setFraudTickets(snap.docs.map(d => ({ id: d.id, ...d.data() } as Ticket)));
    });

    return () => {
      unsubLogs();
      unsubFraud();
    };
  }, []);

  const filteredLogs = logs.filter(log => 
    log.userName.toLowerCase().includes(searchTerm.toLowerCase()) || 
    log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.details.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
       <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Giám sát & Nhật ký</h1>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Audit log thời gian thực và phát hiện bất thường</p>
        </div>
        
        <div className="flex bg-white p-1 rounded-2xl border border-slate-200 shadow-sm">
          <button 
            onClick={() => setActiveTab('all')}
            className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'all' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <History className="w-4 h-4" /> Hệ thống Log
          </button>
          <button 
            onClick={() => setActiveTab('fraud')}
            className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-3 ${activeTab === 'fraud' ? 'bg-orange-500 text-white shadow-lg shadow-orange-100' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <ShieldAlert className="w-4 h-4" /> Gian lận
            {fraudTickets.length > 0 && <span className="bg-white/20 px-2 py-0.5 rounded-full text-[10px]">{fraudTickets.length}</span>}
          </button>
        </div>
      </div>

      <div className="relative group">
        <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300 w-5 h-5 group-focus-within:text-indigo-600 transition-colors" />
        <input 
          type="text" 
          placeholder="Tìm thợ, mã phiếu, hoặc hành động kỹ thuật..." 
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-white border border-slate-200 rounded-[2rem] py-5 pl-14 pr-6 text-sm font-bold text-slate-700 focus:ring-2 focus:ring-indigo-600/20 focus:border-indigo-600 focus:outline-none transition-all shadow-sm"
        />
      </div>

      <div className="bg-white border border-slate-200 rounded-[2.5rem] overflow-hidden min-h-[500px] shadow-sm">
        <AnimatePresence mode="wait">
          {activeTab === 'all' ? (
            <motion.div 
              key="all-logs"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="divide-y divide-slate-50"
            >
              {filteredLogs.map((log, idx) => (
                <div key={log.id} className={`p-6 flex items-start gap-6 hover:bg-slate-50/80 transition-colors ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}>
                   <div className="w-12 h-12 bg-white border border-slate-100 rounded-2xl flex items-center justify-center shrink-0 shadow-sm">
                      <Clock className="w-5 h-5 text-slate-300" />
                   </div>
                   <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1.5">
                        <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest bg-indigo-50 px-2 py-1 rounded-lg">{log.action}</span>
                        <span className="text-[10px] font-bold text-slate-300 tabular-nums">{format(parseISO(log.timestamp), 'HH:mm:ss • dd/MM/yyyy')}</span>
                      </div>
                      <p className="text-sm font-bold text-slate-800 leading-relaxed italic">{log.details}</p>
                      <div className="flex items-center gap-2 mt-3 text-slate-400">
                        <div className="w-5 h-5 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center text-[8px] font-black">{log.userName[0]}</div>
                        <span className="text-[10px] font-black uppercase tracking-tighter">{log.userName}</span>
                      </div>
                   </div>
                </div>
              ))}
              {filteredLogs.length === 0 && (
                <div className="flex flex-col items-center justify-center py-32 text-slate-200">
                   <History className="w-16 h-16 mb-4 opacity-10" />
                   <p className="text-sm font-black uppercase tracking-widest">Không có dữ liệu trùng khớp</p>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div 
              key="fraud-logs"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="p-8"
            >
              <div className="grid grid-cols-1 gap-6">
                 {fraudTickets.map(ticket => (
                   <div key={ticket.id} className="bg-orange-50/50 border-l-8 border-orange-500 rounded-2xl p-8 flex flex-col md:flex-row md:items-center justify-between gap-8 group hover:bg-orange-50 transition-colors shadow-sm">
                      <div className="flex items-start gap-6">
                        <div className="w-14 h-14 bg-white border border-orange-100 rounded-2xl flex items-center justify-center shrink-0 shadow-sm relative">
                           <ShieldAlert className="w-7 h-7 text-orange-500" />
                           <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full animate-ping" />
                        </div>
                        <div>
                           <div className="flex items-center gap-3 mb-3">
                             <span className="text-base font-black text-slate-800 tracking-tight">Nghi vấn gian lận thời gian</span>
                             <span className="bg-red-500 text-white text-[9px] px-3 py-1 rounded-full font-black uppercase tracking-widest shadow-lg shadow-red-200">High Risk</span>
                           </div>
                           <div className="flex flex-wrap gap-6 text-[10px] font-black uppercase tracking-widest text-slate-400">
                              <span className="flex items-center gap-2 bg-white px-3 py-1 rounded-lg shadow-sm border border-slate-100"><TagIcon className="w-3.5 h-3.5 text-indigo-500" /> PHIẾU #{ticket.ticketNumber}</span>
                              <span className="flex items-center gap-2 bg-white px-3 py-1 rounded-lg shadow-sm border border-slate-100"><User className="w-3.5 h-3.5 text-indigo-500" /> THỢ: {ticket.barberName}</span>
                              <span className="flex items-center gap-2 bg-red-100 text-red-600 px-3 py-1 rounded-lg shadow-sm border border-red-200"><Clock className="w-3.5 h-3.5" /> {ticket.duration} PHÚT</span>
                           </div>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-4 bg-white p-4 rounded-2xl shadow-sm border border-slate-100 group-hover:border-orange-200 transition-colors">
                         <div className="text-right">
                           <p className="text-[9px] text-slate-400 uppercase font-black tracking-widest mb-1">Hoàn thành</p>
                           <p className="text-sm font-black text-slate-800 tabular-nums leading-none">{ticket.endTime ? format(parseISO(ticket.endTime), 'HH:mm:ss') : '---'}</p>
                           <p className="text-[9px] text-slate-400 mt-1">{ticket.endTime ? format(parseISO(ticket.endTime), 'dd/MM/yyyy') : ''}</p>
                         </div>
                         <button className="w-10 h-10 bg-indigo-50 hover:bg-indigo-600 hover:text-white rounded-xl transition-all flex items-center justify-center text-indigo-400">
                           <ArrowRight className="w-5 h-5" />
                         </button>
                      </div>
                   </div>
                 ))}
                 {fraudTickets.length === 0 && (
                   <div className="flex flex-col items-center justify-center py-32 text-slate-100">
                      <ShieldAlert className="w-24 h-24 mb-6 opacity-5" />
                      <h3 className="text-xl font-black text-slate-300 uppercase tracking-widest italic">Khu vực an toàn</h3>
                      <p className="text-xs font-bold text-slate-300 uppercase tracking-tight mt-2 italic">Chưa phát hiện bất thường trong ca làm việc</p>
                   </div>
                 )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
