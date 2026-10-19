export type TrapStatus = 'ACTIVE' | 'CHECKED' | 'EMPTY' | 'WITH_CATCH' | 'RETRIEVED';

export type Trap = {
  id: number;
  trapCode: string;
  latitude: number;
  longitude: number;
  gpsAccuracy: number;
  status: TrapStatus;
  depth?: number;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  lastCheckedAt?: string;
  retrievedAt?: string;
  tripId?: number;
};

export type Trip = { id: number; startedAt: string; endedAt?: string; title?: string };
