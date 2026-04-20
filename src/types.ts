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
  fraudThreshold: number;
}

export interface ActivityLog {
  id: string;
  timestamp: string;
  userId: string;
  userName: string;
  action: string;
  details: string;
}
