import React, { useState } from 'react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { setDoc, doc } from 'firebase/firestore';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../lib/firebase';
import { Scissors, ShieldCheck } from 'lucide-react';
import { motion } from 'motion/react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
      navigate('/');
    } catch (err: any) {
      console.error(err);
      setError('Đăng nhập Google thất bại: ' + (err.message || 'Lỗi không xác định'));
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate('/');
    } catch (err: any) {
      if (err.code === 'auth/operation-not-allowed') {
        setError('Lỗi cấu hình: Phương thức Đăng nhập bằng Email/Mật khẩu chưa được bật trong Firebase Console.');
      } else if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        setError('Sai tài khoản hoặc mật khẩu. Nếu chưa có tài khoản, hãy nhấn "Khởi tạo Admin" bên dưới.');
      } else {
        setError('Đăng nhập thất bại. Vui lòng kiểm tra lại tài khoản và mật khẩu.');
      }
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleInitAdmin = async () => {
    // Tự động khởi tạo mà không cần confirm để tránh lỗi trong môi trường iframe
    setLoading(true);
    setError('');
    console.log("Starting Admin initialization...");
    try {
      const email = 'admin@barberflow.com';
      const pass = '123456';
      
      const res = await createUserWithEmailAndPassword(auth, email, pass);
      await setDoc(doc(db, 'users', res.user.uid), {
        uid: res.user.uid,
        email: email,
        name: 'Hệ thống Admin',
        role: 'admin',
        phone: '0900000000'
      });
      
      setError('✅ Khởi tạo Admin thành công! Đang tự động đăng nhập...');
      setEmail(email);
      setPassword(pass);
      
      // Tự động đăng nhập sau 1s
      setTimeout(() => {
        signInWithEmailAndPassword(auth, email, pass).then(() => navigate('/'));
      }, 1500);
      
    } catch (err: any) {
      console.error("Admin init error:", err);
      if (err.code === 'auth/email-already-in-use') {
        setError('Tài khoản admin@barberflow.com đã tồn tại. Đang tiến hành đăng nhập...');
        const adminEmail = 'admin@barberflow.com';
        const adminPass = '123456';
        setEmail(adminEmail);
        setPassword(adminPass);
        
        try {
          const loginRes = await signInWithEmailAndPassword(auth, adminEmail, adminPass);
          // Đảm bảo Firestore doc tồn tại
          await setDoc(doc(db, 'users', loginRes.user.uid), {
            uid: loginRes.user.uid,
            email: adminEmail,
            name: 'Hệ thống Admin',
            role: 'admin',
            phone: '0900000000'
          }, { merge: true });
          navigate('/');
        } catch (loginErr) {
          setError('Tài khoản admin@barberflow.com đã tồn tại nhưng sai mật khẩu mặc định.');
        }
      } else if (err.code === 'auth/operation-not-allowed') {
        setError('LỖI: Bạn chưa bật "Email/Password" trong Firebase Console -> Authentication -> Sign-in method.');
      } else {
        setError('Lỗi khởi tạo: ' + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white border border-slate-200 p-10 rounded-[2rem] shadow-2xl"
      >
        <div className="flex flex-col items-center mb-10">
          <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center mb-6 shadow-xl shadow-indigo-200 transform rotate-12">
            <Scissors className="text-white w-10 h-10" />
          </div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tighter">BARBER<span className="text-indigo-600">FLOW</span></h1>
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em] mt-2">Hệ thống quản trị chuyên nghiệp</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Email Access</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-50 border-2 border-slate-100 text-slate-800 rounded-2xl px-5 py-4 focus:outline-none focus:border-indigo-600 focus:bg-white transition-all font-sans font-bold"
              placeholder="admin@barberflow.com"
              required
            />
          </div>
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Security Token</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-slate-50 border-2 border-slate-100 text-slate-800 rounded-2xl px-5 py-4 focus:outline-none focus:border-indigo-600 focus:bg-white transition-all font-sans font-bold"
              placeholder="••••••••"
              required
            />
          </div>

          {error && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-4 bg-red-50 border border-red-100 rounded-xl">
              <p className="text-red-600 text-xs text-center font-bold">{error}</p>
            </motion.div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black py-4 rounded-2xl transition-all shadow-xl shadow-indigo-200 disabled:opacity-50 active:scale-[0.98]"
          >
            {loading ? 'AUTHENTICATING...' : 'SIGN IN TO DASHBOARD'}
          </button>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-slate-100"></span></div>
            <div className="relative flex justify-center text-[10px] font-black uppercase tracking-widest"><span className="bg-white px-2 text-slate-400">OR</span></div>
          </div>

          <button
            type="button"
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full bg-white border-2 border-slate-100 hover:border-indigo-600 text-slate-800 font-black py-4 rounded-2xl transition-all flex items-center justify-center gap-3 active:scale-[0.98]"
          >
            <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" referrerPolicy="no-referrer" />
            SIGN IN WITH GOOGLE
          </button>
        </form>
        
        <div className="mt-10 pt-8 border-t border-slate-100 text-center space-y-4">
          <button 
            type="button" 
            onClick={handleInitAdmin}
            className="flex items-center justify-center gap-2 w-full text-[10px] font-black text-slate-400 hover:text-indigo-600 uppercase tracking-widest transition-colors py-2 border border-dashed border-slate-200 rounded-xl hover:border-indigo-200"
          >
            <ShieldCheck className="w-3.5 h-3.5" /> Khởi tạo Admin (Lần đầu)
          </button>
          <p className="text-slate-300 text-[10px] font-black uppercase tracking-widest">
            ZenCut x BarberFlow Pro v2.4
          </p>
        </div>
      </motion.div>
    </div>
  );
}
