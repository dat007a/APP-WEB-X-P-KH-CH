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
    
    // Default admin credentials
    const defaultAdminEmail = 'admin@gmail.com';
    const defaultAdminPass = 'admin2026';

    try {
      try {
        await signInWithEmailAndPassword(auth, email, password);
        navigate('/');
      } catch (loginErr: any) {
        // If it's the requested default admin account and it doesn't exist yet, create it automatically
        if (email === defaultAdminEmail && password === defaultAdminPass && 
           (loginErr.code === 'auth/user-not-found' || loginErr.code === 'auth/invalid-credential')) {
          console.log("Auto-creating default admin account...");
          const res = await createUserWithEmailAndPassword(auth, defaultAdminEmail, defaultAdminPass);
          await setDoc(doc(db, 'users', res.user.uid), {
            uid: res.user.uid,
            email: defaultAdminEmail,
            name: 'Hệ thống Admin',
            role: 'admin',
            phone: '0900000000'
          });
          navigate('/');
        } else {
          throw loginErr;
        }
      }
    } catch (err: any) {
      if (err.code === 'auth/operation-not-allowed') {
        setError('Lỗi cấu hình: Phương thức Đăng nhập bằng Email/Mật khẩu chưa được bật trong Firebase Console.');
      } else if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        setError('Sai tài khoản hoặc mật khẩu.');
      } else {
        setError('Đăng nhập thất bại: ' + (err.message || 'Vui lòng kiểm tra lại.'));
      }
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // We hide handleInitAdmin from UI but keep it for reference or internal debugging if ever needed
  // ... (the function remains in code but the button is removed from JSX below)

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
          <h1 className="text-3xl font-black text-slate-800 tracking-tighter">BARBER<span className="text-indigo-600">CONTROL</span></h1>
          <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em] mt-2">Hệ Thống Tường Barber Phát Triển</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Email Access</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-slate-50 border-2 border-slate-100 text-slate-800 rounded-2xl px-5 py-4 focus:outline-none focus:border-indigo-600 focus:bg-white transition-all font-sans font-bold"
              placeholder="admin@gmail.com"
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
        
        <div className="mt-10 pt-8 border-t border-slate-100 text-center">
          <p className="text-slate-300 text-[10px] font-black uppercase tracking-widest">
            ZenCut x Barber Control Pro v2.4
          </p>
        </div>
      </motion.div>
    </div>
  );
}
