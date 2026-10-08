export interface NotificationMetadata {
  titleId?: string;
  championTitle?: string;
  icon?: string;
  previousValue?: number;
  newValue?: number;
  formattedValue?: string;
  overtakenByUserId?: string;
  overtakenByName?: string;
  code?: string;
  name?: string;
  category?: string;
  rarity?: string;
  level?: number;
  weekKey?: string;
  monthKey?: string;
  distanceKm?: string;
  [key: string]: unknown;
}

export interface NotificationItem {
  id: string;
  userId?: string;
  type: string;
  title: string;
  message: string;
  link: string | null;
  isRead: boolean;
  metadata?: NotificationMetadata | null;
  createdAt: string;
}
