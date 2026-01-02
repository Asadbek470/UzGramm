
export type MessageRole = 'user' | 'assistant' | 'system';
export type ChatType = 'private' | 'group' | 'channel';
export type AppLanguage = 'uz' | 'ru' | 'en';

export interface Message {
  id: string;
  text: string;
  sender: MessageRole;
  timestamp: number;
}

export interface Chat {
  id: string;
  name: string;
  avatar: string;
  lastMessage?: string;
  lastMessageTime?: number;
  unreadCount: number;
  type: ChatType;
  messages: Message[];
  isOnline?: boolean;
  ownerId: string;
  admins: string[]; // List of user IDs
  coOwners: string[]; // List of user IDs
  members: string[]; // IDs of members
}

export interface User {
  id: string; // Unique ID like @uz_12345
  username?: string;
  name: string;
  bio?: string;
  phone?: string;
  email?: string;
  avatar: string;
  cloudPassword?: string;
  isBlocked?: boolean;
  blockReason?: string;
  isPermanentlyBlocked?: boolean;
  blockedUntil?: number;
  isPremium?: boolean;
  language: AppLanguage;
  contacts: string[]; // List of contact IDs
  premiumBonusesClaimed?: number; // timestamp
}
