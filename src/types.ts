export type UserRole = 'admin' | 'cashier' | 'barber';

export interface UserProfile {
  uid: string;
  name: string;
  email: string;
  role: UserRole;
  phone?: string;
  areaId?: string;
  chairId?: string;
}

export interface Area {
  id: string;
  name: string;
}

export interface Chair {
  id: string;
  areaId: string;
  number: number;
  name?: string;
  status: 'available' | 'in-service' | 'almost-done' | 'break';
  waitingCount: number;
  currentTicketId?: string;
  currentBarberId?: string;
  lastStartTime?: string; // ISO String
}

export interface Ticket {
  id: string;
  ticketNumber: string;
  barberId: string;
  barberName: string;
  areaId: string;
  chairId: string;
  startTime: string; // ISO String
  endTime?: string; // ISO String
  duration?: number; // In minutes
  status: 'in-progress' | 'finished';
  isFraudulent?: boolean;
}

export interface SystemSettings {
  avgServiceTime: number;
  maxServiceTime: number;
  kpiThreshold: number;
  ticketKpiThreshold: number; // For the new "Phiếu thực tế" vs "Phiếu App" KPI
  fraudThreshold: number;
}

export interface DailyKpiRecord {
  id: string;
  date: string; // YYYY-MM-DD
  userId: string;
  userName: string;
  actualTicketsCount: number;
  appTicketsCount: number; // Sync this from tickets collection
  updatedAt: string;
  updatedBy: string;
}

export interface ActivityLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  action: string;
  details: string;
}
