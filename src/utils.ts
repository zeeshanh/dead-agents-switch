import { PublicKey, Keypair, Connection } from '@solana/web3.js';
import { TIME } from './types';

/**
 * Format seconds into human readable string
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds} seconds`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} days`;
  if (seconds < 2592000) return `${Math.floor(seconds / 604800)} weeks`;
  return `${Math.floor(seconds / 2592000)} months`;
}

/**
 * Parse duration string into seconds
 * Supports: "7d", "1w", "30d", "1m", "1y"
 */
export function parseDuration(duration: string): number {
  const match = duration.match(/^(\d+)([hdwmy])$/i);
  if (!match) throw new Error(`Invalid duration: ${duration}`);
  
  const value = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  
  switch (unit) {
    case 'h': return value * TIME.HOUR;
    case 'd': return value * TIME.DAY;
    case 'w': return value * TIME.WEEK;
    case 'm': return value * TIME.MONTH;
    case 'y': return value * TIME.YEAR;
    default: throw new Error(`Unknown unit: ${unit}`);
  }
}

/**
 * Calculate time remaining until deadline
 */
export function timeUntilDeadline(lastHeartbeat: Date, timeoutSeconds: number): number {
  const deadline = lastHeartbeat.getTime() + timeoutSeconds * 1000;
  return Math.max(0, Math.floor((deadline - Date.now()) / 1000));
}

/**
 * Check if deadline has passed
 */
export function isDeadlinePassed(lastHeartbeat: Date, timeoutSeconds: number): boolean {
  return timeUntilDeadline(lastHeartbeat, timeoutSeconds) === 0;
}

/**
 * Generate a random keypair for testing
 */
export function generateKeypair(): Keypair {
  return Keypair.generate();
}

/**
 * Get devnet connection
 */
export function getDevnetConnection(): Connection {
  return new Connection('https://api.devnet.solana.com', 'confirmed');
}

/**
 * Get mainnet connection
 */
export function getMainnetConnection(): Connection {
  return new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
}

/**
 * Validate public key string
 */
export function isValidPublicKey(address: string): boolean {
  try {
    new PublicKey(address);
    return true;
  } catch {
    return false;
  }
}

/**
 * Shorten address for display
 */
export function shortenAddress(address: string | PublicKey, chars = 4): string {
  const str = address.toString();
  return `${str.slice(0, chars)}...${str.slice(-chars)}`;
}

/**
 * Calculate share amount from basis points
 */
export function calculateShare(totalAmount: number, shareBps: number): number {
  return (totalAmount * shareBps) / 10000;
}

/**
 * Validate share percentages add up to 100%
 */
export function validateShares(shares: number[]): boolean {
  const total = shares.reduce((sum, share) => sum + share, 0);
  return total === 10000; // 10000 bps = 100%
}
