import { PublicKey } from '@solana/web3.js';

export interface Will {
  address: PublicKey;
  owner: PublicKey;
  timeoutSeconds: number;
  lastHeartbeat: Date;
  createdAt: Date;
  message: string;
  isActive: boolean;
  isTriggered: boolean;
  triggeredAt: Date | null;
  beneficiaryCount: number;
}

export interface Beneficiary {
  address: PublicKey;
  will: PublicKey;
  recipient: PublicKey;
  shareBps: number; // Basis points (100 = 1%)
  hasClaimed: boolean;
}

export interface WillConfig {
  /** Timeout in seconds (min: 86400 = 1 day, max: 31536000 = 1 year) */
  timeoutSeconds: number;
  /** Optional message to be revealed when will triggers (max 500 chars) */
  message?: string;
}

export interface BeneficiaryConfig {
  /** Recipient's public key */
  recipient: PublicKey;
  /** Share in basis points (100 = 1%, 10000 = 100%) */
  shareBps: number;
}

export interface HeartbeatResult {
  signature: string;
  timestamp: Date;
  nextDeadline: Date;
}

export interface TriggerResult {
  signature: string;
  triggeredAt: Date;
  message: string;
}

export interface ClaimResult {
  signature: string;
  amount: number;
  recipient: PublicKey;
}

export interface WillStatus {
  will: Will;
  beneficiaries: Beneficiary[];
  timeRemaining: number; // seconds until can be triggered
  canTrigger: boolean;
  vaultBalance: number;
}

// Time constants for convenience
export const TIME = {
  HOUR: 3600,
  DAY: 86400,
  WEEK: 604800,
  MONTH: 2592000,
  YEAR: 31536000,
} as const;
