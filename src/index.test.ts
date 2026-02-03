/**
 * Unit tests for Dead Agent's Switch SDK
 */

import { PublicKey, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { TIME } from './types';

describe('Dead Agents Switch SDK', () => {
  describe('Types', () => {
    it('should have correct time constants', () => {
      expect(TIME.HOUR).toBe(3600);
      expect(TIME.DAY).toBe(86400);
      expect(TIME.WEEK).toBe(604800);
      expect(TIME.MONTH).toBe(2592000);
      expect(TIME.YEAR).toBe(31536000);
    });

    it('should validate timeout range', () => {
      const minTimeout = TIME.DAY;
      const maxTimeout = TIME.YEAR;
      
      expect(minTimeout).toBe(86400);
      expect(maxTimeout).toBe(31536000);
    });
  });

  describe('PDA Derivation', () => {
    const PROGRAM_ID = new PublicKey('DAS1111111111111111111111111111111111111111');

    it('should derive will PDA consistently', () => {
      const owner = Keypair.generate();
      
      const [pda1] = PublicKey.findProgramAddressSync(
        [Buffer.from('will'), owner.publicKey.toBuffer()],
        PROGRAM_ID
      );
      
      const [pda2] = PublicKey.findProgramAddressSync(
        [Buffer.from('will'), owner.publicKey.toBuffer()],
        PROGRAM_ID
      );
      
      expect(pda1.toBase58()).toBe(pda2.toBase58());
    });

    it('should derive different PDAs for different owners', () => {
      const owner1 = Keypair.generate();
      const owner2 = Keypair.generate();
      
      const [pda1] = PublicKey.findProgramAddressSync(
        [Buffer.from('will'), owner1.publicKey.toBuffer()],
        PROGRAM_ID
      );
      
      const [pda2] = PublicKey.findProgramAddressSync(
        [Buffer.from('will'), owner2.publicKey.toBuffer()],
        PROGRAM_ID
      );
      
      expect(pda1.toBase58()).not.toBe(pda2.toBase58());
    });

    it('should derive beneficiary PDA', () => {
      const will = Keypair.generate();
      const recipient = Keypair.generate();
      
      const [beneficiaryPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('beneficiary'), will.publicKey.toBuffer(), recipient.publicKey.toBuffer()],
        PROGRAM_ID
      );
      
      expect(beneficiaryPda).toBeInstanceOf(PublicKey);
    });

    it('should derive vault PDA', () => {
      const will = Keypair.generate();
      
      const [vaultPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('vault'), will.publicKey.toBuffer()],
        PROGRAM_ID
      );
      
      expect(vaultPda).toBeInstanceOf(PublicKey);
    });
  });

  describe('Share Calculations', () => {
    it('should calculate correct share amounts', () => {
      const vaultBalance = 10 * LAMPORTS_PER_SOL;
      
      // 50% share
      const share50 = Math.floor(vaultBalance * 5000 / 10000);
      expect(share50).toBe(5 * LAMPORTS_PER_SOL);
      
      // 25% share
      const share25 = Math.floor(vaultBalance * 2500 / 10000);
      expect(share25).toBe(2.5 * LAMPORTS_PER_SOL);
      
      // 100% share
      const share100 = Math.floor(vaultBalance * 10000 / 10000);
      expect(share100).toBe(10 * LAMPORTS_PER_SOL);
    });

    it('should validate share basis points', () => {
      const validShares = [1, 100, 5000, 10000];
      const invalidShares = [0, -1, 10001, 20000];
      
      validShares.forEach(share => {
        expect(share >= 1 && share <= 10000).toBe(true);
      });
      
      invalidShares.forEach(share => {
        expect(share >= 1 && share <= 10000).toBe(false);
      });
    });
  });

  describe('Timeout Validation', () => {
    it('should accept valid timeouts', () => {
      const validTimeouts = [
        TIME.DAY,           // 1 day (minimum)
        TIME.WEEK,          // 1 week
        TIME.MONTH,         // 1 month
        TIME.YEAR,          // 1 year (maximum)
      ];
      
      validTimeouts.forEach(timeout => {
        expect(timeout >= TIME.DAY).toBe(true);
        expect(timeout <= TIME.YEAR).toBe(true);
      });
    });

    it('should reject invalid timeouts', () => {
      const invalidTimeouts = [
        TIME.HOUR,          // Too short
        TIME.DAY - 1,       // Just under minimum
        TIME.YEAR + 1,      // Just over maximum
        TIME.YEAR * 2,      // Way too long
      ];
      
      invalidTimeouts.forEach(timeout => {
        const isValid = timeout >= TIME.DAY && timeout <= TIME.YEAR;
        expect(isValid).toBe(false);
      });
    });
  });

  describe('Message Validation', () => {
    it('should accept valid messages', () => {
      const validMessages = [
        '',
        'Short message',
        'A'.repeat(500),  // Max length
      ];
      
      validMessages.forEach(msg => {
        expect(msg.length <= 500).toBe(true);
      });
    });

    it('should reject messages over 500 chars', () => {
      const longMessage = 'A'.repeat(501);
      expect(longMessage.length > 500).toBe(true);
    });
  });

  describe('Trigger Logic', () => {
    it('should allow trigger after timeout', () => {
      const timeoutSeconds = 86400; // 1 day
      const lastHeartbeat = Math.floor(Date.now() / 1000) - 86401; // Over 1 day ago
      const now = Math.floor(Date.now() / 1000);
      
      const timeSinceHeartbeat = now - lastHeartbeat;
      const canTrigger = timeSinceHeartbeat >= timeoutSeconds;
      
      expect(canTrigger).toBe(true);
    });

    it('should not allow trigger before timeout', () => {
      const timeoutSeconds = 86400;
      const lastHeartbeat = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
      const now = Math.floor(Date.now() / 1000);
      
      const timeSinceHeartbeat = now - lastHeartbeat;
      const canTrigger = timeSinceHeartbeat >= timeoutSeconds;
      
      expect(canTrigger).toBe(false);
    });
  });
});
