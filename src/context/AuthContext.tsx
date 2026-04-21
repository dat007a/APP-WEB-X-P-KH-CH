import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { UserProfile } from '../types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType>({ user: null, profile: null, loading: true });

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      
      if (!firebaseUser) {
        setProfile(null);
        setLoading(false);
      } else {
        // First, check if profile exists, if not and it's the owner email, create it
        const profileRef = doc(db, 'users', firebaseUser.uid);
        
        // Use a one-time check first for the admin emails to ensure they always have a profile
        const adminEmails = ['taypekaeb15885@gmail.com', 'admin@gmail.com'];
        if (firebaseUser.email && adminEmails.includes(firebaseUser.email)) {
          const snap = await getDoc(profileRef);
          if (!snap.exists()) {
             await setDoc(profileRef, {
               uid: firebaseUser.uid,
               email: firebaseUser.email,
               name: firebaseUser.displayName || 'Hệ thống Admin',
               role: 'admin',
               phone: ''
             });
          }
        }

        // Now listen to profile changes
        const profileUnsub = onSnapshot(profileRef, (docSnap) => {
          if (docSnap.exists()) {
            setProfile(docSnap.data() as UserProfile);
          } else {
            setProfile(null);
          }
          setLoading(false);
        }, (error) => {
          console.error("Profile sync error:", error);
          setLoading(false);
        });
        
        return () => profileUnsub();
      }
    });

    return () => unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading }}>
      {children}
    </AuthContext.Provider>
  );
};
