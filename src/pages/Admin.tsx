import React, { useState, useEffect } from 'react';
import { db, auth } from '../lib/firebase';
import { Area, Chair, UserProfile, UserRole } from '../types';
import { 
  collection, 
  onSnapshot, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  addDoc, 
  query, 
  where,
  getDocs,
  getDoc,
  writeBatch
} from 'firebase/firestore';
import { createUserWithEmailAndPassword, getAuth } from 'firebase/auth';
import { initializeApp, deleteApp, getApp, FirebaseApp } from 'firebase/app';
import firebaseConfig from '../../firebase-applet-config.json';
import { 
  Plus, 
  Settings, 
  Trash2, 
  Edit, 
  Map as MapIcon, 
  Users,
  Grid3X3,
  Save,
  X
} from 'lucide-react';
import { motion } from 'motion/react';

export default function Admin() {
  const [activeTab, setActiveTab] = useState<'users' | 'areas'>('areas');
  const [areas, setAreas] = useState<Area[]>([]);
  const [chairs, setChairs] = useState<Chair[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  
  // States for modals
  const [isAreaModalOpen, setIsAreaModalOpen] = useState(false);
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingArea, setEditingArea] = useState<Area | null>(null);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [selectedAreaId, setSelectedAreaId] = useState<string>('');
  
  // Confirmation state
  const [confirmDelete, setConfirmDelete] = useState<{ id: string, type: 'area' | 'chair' | 'user' } | null>(null);

  useEffect(() => {
    const unsubAreas = onSnapshot(collection(db, 'areas'), (snap) => {
      setAreas(snap.docs.map(d => ({ id: d.id, ...d.data() } as Area)));
    });
    const unsubChairs = onSnapshot(query(collection(db, 'chairs')), (snap) => {
      setChairs(snap.docs.map(d => ({ id: d.id, ...d.data() } as Chair)));
    });
    const unsubUsers = onSnapshot(collection(db, 'users'), (snap) => {
      console.log(`📊 Syncing ${snap.size} user profiles...`);
      setUsers(snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile)));
    });
    return () => {
      unsubAreas();
      unsubChairs();
      unsubUsers();
    };
  }, []);

  const handleUserModalOpen = (user: UserProfile | null) => {
    setEditingUser(user);
    setSelectedAreaId(user?.areaId || '');
    setIsUserModalOpen(true);
  };

  const handleCreateArea = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const name = formData.get('name') as string;
    const chairCount = parseInt(formData.get('chairCount') as string);

    if (editingArea) {
      await updateDoc(doc(db, 'areas', editingArea.id), { name });
    } else {
      const areaRef = await addDoc(collection(db, 'areas'), { name });
      // Create chairs
      for (let i = 1; i <= chairCount; i++) {
        await addDoc(collection(db, 'chairs'), {
          areaId: areaRef.id,
          number: i,
          status: 'available',
          waitingCount: 0
        });
      }
    }
    setIsAreaModalOpen(false);
    setEditingArea(null);
  };

  const handleCreateUser = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;
    const name = formData.get('name') as string;
    const role = formData.get('role') as UserRole;
    const phone = formData.get('phone') as string;
    const areaId = formData.get('areaId') as string;
    const chairId = formData.get('chairId') as string;

    if (!name || !role) {
      alert("Vui lòng điền đầy đủ tên và vai trò.");
      return;
    }

    try {
      let finalChairId = editingUser?.chairId || (formData.get('chairId') as string) || null;

      if (role === 'barber' && areaId) {
        if (!finalChairId) {
          // Creating new chair for new barber
          const areaChairs = chairs.filter(c => c.areaId === areaId);
          const nextNumber = areaChairs.length > 0 ? Math.max(...areaChairs.map(c => c.number)) + 1 : 1;
          const chairRef = await addDoc(collection(db, 'chairs'), {
            areaId,
            number: nextNumber,
            name: name,
            status: 'available',
            waitingCount: 0
          });
          finalChairId = chairRef.id;
        } else {
          // Check if chair exists before updating to avoid "No document to update" error
          const chairDocRef = doc(db, 'chairs', finalChairId);
          const chairSnap = await getDoc(chairDocRef);
          
          if (chairSnap.exists()) {
            await updateDoc(chairDocRef, {
              name: name,
              areaId: areaId
            });
          } else {
            // Re-create the chair if it was lost/deleted but the ID was still in user profile
            const areaChairs = chairs.filter(c => c.areaId === areaId);
            const nextNumber = areaChairs.length > 0 ? Math.max(...areaChairs.map(c => c.number)) + 1 : 1;
            await setDoc(chairDocRef, {
              areaId,
              number: nextNumber,
              name: name,
              status: 'available',
              waitingCount: 0
            });
          }
        }
      }

      const userData: any = {
        name, 
        role, 
        phone: phone || '',
        email: email || (editingUser?.email || ''),
        areaId: (role === 'barber' && areaId) ? areaId : null,
        chairId: (role === 'barber') ? finalChairId : null
      };

      if (editingUser) {
        await updateDoc(doc(db, 'users', editingUser.uid), userData);
        alert("✨ Cập nhật hồ sơ nhân viên thành công.");
      } else {
        if (!email || !password) {
          alert("Email và mật khẩu là bắt buộc cho đăng ký mới.");
          return;
        }

        const secondaryAppName = `UserRegistry_${Date.now()}`;
        const secondaryApp = initializeApp(firebaseConfig, secondaryAppName);
        const secondaryAuth = getAuth(secondaryApp);
        
        try {
          const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
          
          // Force include UID in the data object
          const finalData = {
            ...userData,
            uid: userCredential.user.uid,
            email: email
          };

          await setDoc(doc(db, 'users', userCredential.user.uid), finalData);
          alert("🚀 Đã tạo tài khoản nhân viên thành công!");
        } catch (authErr: any) {
          if (authErr.code === 'auth/email-already-in-use') {
             alert("Email này đã được đăng ký trong hệ thống. Vui lòng dùng chức năng 'Sửa' nếu muốn thay đổi thông tin.");
          } else {
            throw authErr;
          }
        } finally {
          await deleteApp(secondaryApp);
        }
      }
      setIsUserModalOpen(false);
      setEditingUser(null);
    } catch (err: any) {
      console.error("Form error:", err);
      alert("⚠️ KHÔNG THỂ THỰC HIỆN: " + (err.message || 'Lỗi hệ thống.'));
    }
  };

  const deleteUser = async (user: UserProfile) => {
    if (!user.uid) return;
    
    try {
      console.log(`🗑️ Deleting user profile and associated chair: ${user.uid}`);
      
      const batch = writeBatch(db);
      
      // Delete user
      batch.delete(doc(db, 'users', user.uid));
      
      // Delete associated chair if any
      if (user.chairId) {
        batch.delete(doc(db, 'chairs', user.chairId));
      }
      
      await batch.commit();
      
      console.log("✅ User and chair deleted");
      setConfirmDelete(null);
      alert('✅ ĐÃ GỠ BỎ: Hồ sơ nhân viên và ghế làm việc đã được xóa.');
    } catch (err: any) {
      console.error("Delete user error:", err);
      alert('❌ Lỗi: ' + (err.message || 'Không thể xóa nhân viên này.'));
    }
  };

  const deleteArea = async (id: string) => {
    if (!id) return;
    
    try {
      console.log(`🚀 Starting deletion for area: ${id}`);
      
      // 1. Find all chairs in this area
      const chairQuery = query(collection(db, 'chairs'), where('areaId', '==', id));
      const chairSnaps = await getDocs(chairQuery);
      
      console.log(`🔍 Found ${chairSnaps.size} chairs to delete.`);
      
      const batch = writeBatch(db);
      
      // Queue chairs for deletion
      chairSnaps.docs.forEach(snap => {
        batch.delete(snap.ref);
      });
      
      // Queue the area itself
      batch.delete(doc(db, 'areas', id));
      
      console.log("📤 Committing batch deletion...");
      await batch.commit();
      
      console.log("✅ Deletion successful");
      setConfirmDelete(null);
      alert('✅ ĐÃ XÓA THÀNH CÔNG: Khu vực và các ghế bên trong đã được gỡ bỏ.');
    } catch (err: any) {
      console.error("❌ Critical Delete Error:", err);
      
      // Fallback: Try deleting the area doc directly if batch fails
      try {
        console.log("⚠️ Batch failed, attempting direct area deletion...");
        await deleteDoc(doc(db, 'areas', id));
        setConfirmDelete(null);
        alert('⚠️ Đã xóa khu vực, nhưng có thể một số ghế chưa được dọn sạch. Vui lòng kiểm tra lại.');
      } catch (fallbackErr: any) {
        alert('❌ LỖI HỆ THỐNG: Không thể thực hiện lệnh xóa. Vui lòng kiểm tra quyền truy cập hoặc kết nối.');
      }
    }
  };

  const addChairToArea = async (areaId: string) => {
    const chairName = window.prompt("Nhập tên hoặc số hiệu cho ghế mới (Vd: Ghế 01, Barber VIP...):");
    if (chairName === null) return; // Cancelled

    const areaChairs = chairs.filter(c => c.areaId === areaId);
    const nextNumber = areaChairs.length > 0 ? Math.max(...areaChairs.map(c => c.number)) + 1 : 1;
    
    await addDoc(collection(db, 'chairs'), {
      areaId,
      number: nextNumber,
      name: chairName || `Ghế ${nextNumber}`,
      status: 'available',
      waitingCount: 0
    });
  };

  const deleteChair = async (chairId: string) => {
    if (!chairId) {
      console.error("❌ Cannot delete chair: Chair ID is missing");
      return;
    }
    
    try {
      console.log(`🗑️ Attempting to delete chair: ${chairId}`);
      const chairRef = doc(db, 'chairs', chairId);
      await deleteDoc(chairRef);
      console.log("✅ Chair deleted successfully");
      setConfirmDelete(null);
      alert('✅ Đã xóa ghế thành công.');
    } catch (err: any) {
      console.error("Delete chair error:", err);
      alert('❌ LỖI: ' + (err.message || 'Không thể xóa ghế. Hãy thử tải lại trang hoặc kiểm tra kết nối.'));
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Quản trị Hệ thống</h1>
          <p className="text-neutral-500 text-sm">Quản lý khu vực, thợ và thiết lập cửa hàng</p>
        </div>
        <div className="flex bg-white p-1 rounded-2xl border border-slate-200 shadow-sm">
          <button 
            onClick={() => setActiveTab('areas')}
            className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'areas' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <MapIcon className="w-4 h-4" /> Khu vực & Ghế
          </button>
          <button 
            onClick={() => setActiveTab('users')}
            className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${activeTab === 'users' ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-100' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <Users className="w-4 h-4" /> Nhân sự
          </button>
        </div>
      </div>

      {activeTab === 'areas' && (
        <div className="space-y-6">
          <div className="flex justify-end">
            <button 
              onClick={() => { setEditingArea(null); setIsAreaModalOpen(true); }}
              className="bg-indigo-600 hover:bg-indigo-700 px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest text-white flex items-center gap-2 transition-all shadow-xl shadow-indigo-100 active:scale-95"
            >
              <Plus className="w-4 h-4" /> Thêm khu vực
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {areas.map(area => (
              <div key={area.id} className="bg-white border border-slate-200 rounded-3xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                  <div>
                    <h3 className="font-black text-slate-800 tracking-tight">{area.name}</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Khu vực quản lý</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { setEditingArea(area); setIsAreaModalOpen(true); }} className="p-2 hover:bg-white rounded-xl text-slate-400 hover:text-indigo-600 transition-colors shadow-sm border border-transparent hover:border-slate-100">
                      <Edit className="w-4 h-4" />
                    </button>
                    <button onClick={() => setConfirmDelete({ id: area.id, type: 'area' })} className="p-2 hover:bg-white rounded-xl text-slate-400 hover:text-red-500 transition-colors shadow-sm border border-transparent hover:border-slate-100">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="p-6">
                  <div className="grid grid-cols-4 gap-3">
                    {chairs.filter(c => c.areaId === area.id).sort((a,b) => a.number - b.number).map(chair => (
                      <div key={chair.id} className="relative group/chair">
                        <div className="aspect-square flex flex-col items-center justify-center bg-slate-50 border border-slate-100 rounded-xl text-center p-1">
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter mb-0.5 leading-none">
                            {chair.number < 10 ? `0${chair.number}` : chair.number}
                          </span>
                          <span className="text-[9px] font-bold text-slate-600 truncate max-w-full leading-tight">
                            {chair.name || `Ghế ${chair.number}`}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'users' && (
        <div className="space-y-6">
          <div className="flex justify-end">
            <button 
              onClick={() => { setEditingUser(null); setSelectedAreaId(''); setIsUserModalOpen(true); }}
              className="bg-indigo-600 hover:bg-indigo-700 px-6 py-3 rounded-2xl text-xs font-black uppercase tracking-widest text-white flex items-center gap-2 transition-all shadow-xl shadow-indigo-100 active:scale-95"
            >
              <Plus className="w-4 h-4" /> Thêm nhân viên mới
            </button>
          </div>

          <div className="bg-white border border-slate-200 rounded-3xl overflow-hidden overflow-x-auto shadow-sm">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <tr>
                  <th className="p-6 border-b border-slate-100">Nhân viên</th>
                  <th className="p-6 border-b border-slate-100">Vai trò</th>
                  <th className="p-6 border-b border-slate-100">SĐT</th>
                  <th className="p-6 border-b border-slate-100">Phân bổ</th>
                  <th className="p-6 border-b border-slate-100 text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {users.map(user => (
                  <tr key={user.uid} className="hover:bg-slate-50/50 transition-colors">
                    <td className="p-6">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black text-sm uppercase shadow-sm border border-indigo-100">
                          {user.name[0]}
                        </div>
                        <div>
                          <p className="text-sm font-black text-slate-800 tracking-tight">{user.name}</p>
                          <p className="text-[10px] font-bold text-slate-400">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-6">
                      <span className={`text-[9px] font-black px-2.5 py-1 rounded-full uppercase tracking-tighter ${
                        user.role === 'admin' ? 'bg-red-50 text-red-600 ring-1 ring-red-200/50' :
                        user.role === 'cashier' ? 'bg-indigo-50 text-indigo-600 ring-1 ring-indigo-200/50' :
                        'bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200/50'
                      }`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="p-6 text-sm font-bold text-slate-500">{user.phone || '---'}</td>
                    <td className="p-6 text-sm font-medium text-slate-500">
                      {user.areaId ? (
                        <div className="flex items-center gap-2">
                           <MapIcon className="w-3.5 h-3.5 text-slate-300" />
                           <span>
                             {areas.find(a => a.id === user.areaId)?.name} — <b className="text-slate-700">
                               {(() => {
                                 const c = chairs.find(ch => ch.id === user.chairId);
                                 return c ? (c.name || `Ghế ${c.number}`) : 'Ghế không tồn tại';
                               })()}
                             </b>
                           </span>
                        </div>
                      ) : (
                        <span className="text-[10px] font-black uppercase text-slate-300 tracking-widest">Chưa gán</span>
                      )}
                    </td>
                    <td className="p-6 text-right">
                       <div className="flex justify-end gap-3">
                        <button onClick={() => { setEditingUser(user); setSelectedAreaId(user.areaId || ''); setIsUserModalOpen(true); }} className="p-2 hover:bg-slate-50 rounded-xl text-slate-300 hover:text-indigo-600 transition-colors">
                          <Edit className="w-4.5 h-4.5" />
                        </button>
                        <button onClick={() => setConfirmDelete({ id: user.uid, type: 'user', data: user } as any)} className="p-2 hover:bg-slate-50 rounded-xl text-slate-300 hover:text-red-500 transition-colors">
                          <Trash2 className="w-4.5 h-4.5" />
                        </button>
                       </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Area Modal */}
      {isAreaModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            className="bg-white border border-slate-200 w-full max-w-md rounded-[2.5rem] p-10 shadow-2xl"
          >
            <div className="flex justify-between items-center mb-8">
              <div>
                <h2 className="text-xl font-black text-slate-800 tracking-tight">{editingArea ? 'Cập nhật' : 'Tạo mới'}</h2>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Khu vực phục vụ</p>
              </div>
              <button onClick={() => setIsAreaModalOpen(false)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-50 text-slate-400 transition-colors border border-transparent hover:border-slate-100">
                <X />
              </button>
            </div>
            <form onSubmit={handleCreateArea} className="space-y-6">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tên khu vực</label>
                <input name="name" placeholder="Vd: Khu VIP 01" defaultValue={editingArea?.name} className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl p-4 text-sm font-bold focus:bg-white focus:border-indigo-600 focus:outline-none transition-all" required />
              </div>
              {!editingArea && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Số lượng ghế ban đầu</label>
                  <input name="chairCount" type="number" defaultValue="4" className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl p-4 text-sm font-bold focus:bg-white focus:border-indigo-600 focus:outline-none transition-all" required />
                </div>
              )}
              <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-widest py-4 rounded-2xl transition-all shadow-xl shadow-indigo-100 active:scale-95 flex items-center justify-center gap-2">
                <Save className="w-4 h-4" /> {editingArea ? 'LƯU THAY ĐỔI' : 'KHỞI TẠO KHU VỰC'}
              </button>
            </form>
          </motion.div>
        </div>
      )}

      {/* User Modal */}
      {isUserModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            className="bg-white border border-slate-200 w-full max-w-lg rounded-[2.5rem] p-10 shadow-2xl max-h-[90vh] overflow-y-auto"
          >
            <div className="flex justify-between items-center mb-8">
              <div>
                <h2 className="text-xl font-black text-slate-800 tracking-tight">{editingUser ? 'Sửa thông tin' : 'Đăng ký mới'}</h2>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Hồ sơ nhân sự</p>
              </div>
              <button onClick={() => setIsUserModalOpen(false)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-50 text-slate-400 transition-colors border border-transparent hover:border-slate-100">
                <X />
              </button>
            </div>
            <form onSubmit={handleCreateUser} className="space-y-6">
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Họ và tên</label>
                  <input name="name" defaultValue={editingUser?.name} className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl p-4 text-sm font-bold focus:bg-white focus:border-indigo-600 focus:outline-none transition-all" required />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Số điện thoại</label>
                  <input name="phone" defaultValue={editingUser?.phone} className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl p-4 text-sm font-bold focus:bg-white focus:border-indigo-600 focus:outline-none transition-all" />
                </div>
              </div>
              
              {!editingUser && (
                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Email đăng nhập</label>
                    <input name="email" type="email" className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl p-4 text-sm font-bold focus:bg-white focus:border-indigo-600 focus:outline-none transition-all" required />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Mật khẩu</label>
                    <input name="password" type="password" className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl p-4 text-sm font-bold focus:bg-white focus:border-indigo-600 focus:outline-none transition-all" required />
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Vai trò hệ thống</label>
                <select name="role" defaultValue={editingUser?.role || 'barber'} className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl p-4 text-sm font-bold focus:bg-white focus:border-indigo-600 focus:outline-none transition-all appearance-none">
                  <option value="barber">Thợ cắt tóc (Barber)</option>
                  <option value="cashier">Thu ngân (Cashier)</option>
                  <option value="admin">Quản lý (Admin)</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Khu vực làm việc</label>
                <select 
                  name="areaId" 
                  value={selectedAreaId} 
                  onChange={(e) => setSelectedAreaId(e.target.value)}
                  className="w-full bg-slate-50 border-2 border-slate-50 rounded-2xl p-4 text-sm font-bold focus:bg-white focus:border-indigo-600 focus:outline-none transition-all appearance-none"
                >
                  <option value="">Chưa gán</option>
                  {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
                <p className="text-[9px] text-slate-400 italic ml-1">* Hệ thống sẽ tự động tạo ghế làm việc tại khu vực này.</p>
              </div>

              <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl">
                 <p className="text-[10px] text-indigo-600 font-bold leading-relaxed italic text-center">
                    Lưu ý: Trong phiên bản preview, việc tạo user mới bằng email sẽ tự động đăng xuất tài khoản hiện tại.
                 </p>
              </div>

              <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-widest py-4 rounded-2xl transition-all shadow-xl shadow-indigo-100 active:scale-95">
                {editingUser ? 'CẬP NHẬT HỒ SƠ' : 'ĐĂNG KÝ NHÂN VIÊN'}
              </button>
            </form>
          </motion.div>
        </div>
      )}
      {/* Confirmation Modal */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white max-w-sm w-full rounded-[2rem] p-8 shadow-2xl text-center"
          >
            <div className="w-16 h-16 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Trash2 className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-black text-slate-800 mb-2">Xác nhận xóa?</h3>
            <p className="text-slate-500 text-sm mb-8">
              {confirmDelete.type === 'area' 
                ? 'Hành động này sẽ xóa toàn bộ khu vực và tất cả ghế bên trong. Dữ liệu không thể khôi phục.' 
                : confirmDelete.type === 'user'
                ? 'Hệ thống sẽ gỡ bỏ hồ sơ nhân viên này. Họ sẽ không thể đăng nhập vào ứng dụng nữa.'
                : 'Bạn có chắc chắn muốn gỡ bỏ ghế này khỏi hệ thống?'}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <button 
                onClick={() => setConfirmDelete(null)}
                className="py-4 bg-slate-100 hover:bg-slate-200 text-slate-600 font-black text-[10px] uppercase tracking-widest rounded-2xl transition-all"
              >
                Hủy bỏ
              </button>
              <button 
                onClick={() => {
                  if (confirmDelete.type === 'area') deleteArea(confirmDelete.id);
                  else if (confirmDelete.type === 'chair') deleteChair(confirmDelete.id);
                  else deleteUser(confirmDelete.data);
                }}
                className="py-4 bg-red-500 hover:bg-red-600 text-white font-black text-[10px] uppercase tracking-widest rounded-2xl transition-all shadow-lg shadow-red-100"
              >
                Xác nhận xóa
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
