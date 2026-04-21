import { collection, doc, getDoc, getDocs, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
import { db } from './firebase';
import { format } from 'date-fns';

export async function checkAndPerformMaintenance() {
  const today = format(new Date(), 'yyyy-MM-dd');
  const maintenanceRef = doc(db, 'settings', 'maintenance');
  
  try {
    const snap = await getDoc(maintenanceRef);
    const lastReset = snap.exists() ? snap.data().lastResetDate : '';
    
    if (lastReset !== today) {
      console.log('🌅 New day detected. Performing system reset...');
      
      // 1. Reset all chairs
      const chairsSnap = await getDocs(collection(db, 'chairs'));
      const batch = writeBatch(db);
      
      chairsSnap.forEach((chairDoc) => {
        batch.update(chairDoc.ref, {
          status: 'available',
          waitingCount: 0,
          currentTicketId: null,
          currentBarberId: null,
          lastStartTime: null
        });
      });
      
      // 2. Clear old tickets (optional: you might want to ARCHIVE them instead)
      // For now, let's just mark them as processed or move them if we had a history collection.
      // The user said "xóa hết phiếu để nhập lại bắt đầu 1 ngày mới".
      const ticketsSnap = await getDocs(collection(db, 'tickets'));
      ticketsSnap.forEach((ticketDoc) => {
        batch.delete(ticketDoc.ref);
      });
      
      // 3. Clear logs (optional)
      const logsSnap = await getDocs(collection(db, 'logs'));
      logsSnap.forEach((logDoc) => {
        batch.delete(logDoc.ref);
      });

      // Update maintenance record
      batch.set(maintenanceRef, { lastResetDate: today }, { merge: true });
      
      await batch.commit();
      console.log('✅ System reset complete for', today);
    }
  } catch (error) {
    console.error('❌ Maintenance error:', error);
  }
}
