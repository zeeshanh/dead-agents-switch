import {
  Connection,
  PublicKey,
  Keypair,
  Transaction,
  TransactionInstruction,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
import { Program, AnchorProvider, Wallet, BN } from '@coral-xyz/anchor';
import {
  Will,
  Beneficiary,
  WillConfig,
  BeneficiaryConfig,
  HeartbeatResult,
  TriggerResult,
  ClaimResult,
  WillStatus,
} from './types';

// Program ID - will be updated after deployment
const PROGRAM_ID = new PublicKey('DAS1111111111111111111111111111111111111111');

export class DeadAgentsSwitchClient {
  private connection: Connection;
  private wallet: Wallet;
  private provider: AnchorProvider;
  private programId: PublicKey;

  constructor(
    connection: Connection,
    wallet: Wallet,
    programId: PublicKey = PROGRAM_ID
  ) {
    this.connection = connection;
    this.wallet = wallet;
    this.provider = new AnchorProvider(connection, wallet, {
      commitment: 'confirmed',
    });
    this.programId = programId;
  }

  // === PDA Derivation ===

  findWillPda(owner: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('will'), owner.toBuffer()],
      this.programId
    );
  }

  findBeneficiaryPda(will: PublicKey, recipient: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('beneficiary'), will.toBuffer(), recipient.toBuffer()],
      this.programId
    );
  }

  findVaultPda(will: PublicKey): [PublicKey, number] {
    return PublicKey.findProgramAddressSync(
      [Buffer.from('vault'), will.toBuffer()],
      this.programId
    );
  }

  // === Core Operations ===

  /**
   * Create a new will
   */
  async createWill(config: WillConfig): Promise<string> {
    const [willPda] = this.findWillPda(this.wallet.publicKey);

    // Build instruction data
    const data = Buffer.alloc(1000);
    let offset = 0;
    
    // Instruction discriminator for create_will
    const discriminator = Buffer.from([0x01]); // Simplified - real impl uses anchor
    discriminator.copy(data, offset);
    offset += 8;

    // timeout_seconds (i64)
    const timeoutBn = new BN(config.timeoutSeconds);
    timeoutBn.toArrayLike(Buffer, 'le', 8).copy(data, offset);
    offset += 8;

    // message (string)
    const message = config.message || '';
    const messageBytes = Buffer.from(message, 'utf-8');
    new BN(messageBytes.length).toArrayLike(Buffer, 'le', 4).copy(data, offset);
    offset += 4;
    messageBytes.copy(data, offset);
    offset += messageBytes.length;

    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: willPda, isSigner: false, isWritable: true },
        { pubkey: this.wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: this.programId,
      data: data.slice(0, offset),
    });

    const tx = new Transaction().add(instruction);
    const signature = await this.provider.sendAndConfirm(tx);
    
    return signature;
  }

  /**
   * Add a beneficiary to your will
   */
  async addBeneficiary(config: BeneficiaryConfig): Promise<string> {
    const [willPda] = this.findWillPda(this.wallet.publicKey);
    const [beneficiaryPda] = this.findBeneficiaryPda(willPda, config.recipient);

    const data = Buffer.alloc(100);
    let offset = 0;

    // Discriminator
    Buffer.from([0x02]).copy(data, offset);
    offset += 8;

    // share_bps (u16)
    data.writeUInt16LE(config.shareBps, offset);
    offset += 2;

    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: willPda, isSigner: false, isWritable: true },
        { pubkey: beneficiaryPda, isSigner: false, isWritable: true },
        { pubkey: config.recipient, isSigner: false, isWritable: false },
        { pubkey: this.wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: this.programId,
      data: data.slice(0, offset),
    });

    const tx = new Transaction().add(instruction);
    const signature = await this.provider.sendAndConfirm(tx);

    return signature;
  }

  /**
   * Send a heartbeat to prove liveness
   */
  async heartbeat(): Promise<HeartbeatResult> {
    const [willPda] = this.findWillPda(this.wallet.publicKey);

    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: willPda, isSigner: false, isWritable: true },
        { pubkey: this.wallet.publicKey, isSigner: true, isWritable: false },
      ],
      programId: this.programId,
      data: Buffer.from([0x03]), // heartbeat discriminator
    });

    const tx = new Transaction().add(instruction);
    const signature = await this.provider.sendAndConfirm(tx);

    const will = await this.getWill(this.wallet.publicKey);
    const nextDeadline = new Date(
      will.lastHeartbeat.getTime() + will.timeoutSeconds * 1000
    );

    return {
      signature,
      timestamp: new Date(),
      nextDeadline,
    };
  }

  /**
   * Trigger a will (anyone can call if timeout reached)
   */
  async triggerWill(owner: PublicKey): Promise<TriggerResult> {
    const [willPda] = this.findWillPda(owner);

    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: willPda, isSigner: false, isWritable: true },
        { pubkey: this.wallet.publicKey, isSigner: true, isWritable: false },
      ],
      programId: this.programId,
      data: Buffer.from([0x04]), // trigger_will discriminator
    });

    const tx = new Transaction().add(instruction);
    const signature = await this.provider.sendAndConfirm(tx);

    const will = await this.getWill(owner);

    return {
      signature,
      triggeredAt: will.triggeredAt!,
      message: will.message,
    };
  }

  /**
   * Claim inheritance as a beneficiary
   */
  async claimInheritance(willOwner: PublicKey): Promise<ClaimResult> {
    const [willPda] = this.findWillPda(willOwner);
    const [beneficiaryPda] = this.findBeneficiaryPda(willPda, this.wallet.publicKey);
    const [vaultPda] = this.findVaultPda(willPda);

    // This would need token account setup in real implementation
    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: willPda, isSigner: false, isWritable: false },
        { pubkey: beneficiaryPda, isSigner: false, isWritable: true },
        { pubkey: vaultPda, isSigner: false, isWritable: true },
        { pubkey: this.wallet.publicKey, isSigner: true, isWritable: true },
      ],
      programId: this.programId,
      data: Buffer.from([0x05]), // claim_inheritance discriminator
    });

    const tx = new Transaction().add(instruction);
    const signature = await this.provider.sendAndConfirm(tx);

    return {
      signature,
      amount: 0, // Would be calculated from vault
      recipient: this.wallet.publicKey,
    };
  }

  /**
   * Cancel your will
   */
  async cancelWill(): Promise<string> {
    const [willPda] = this.findWillPda(this.wallet.publicKey);

    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: willPda, isSigner: false, isWritable: true },
        { pubkey: this.wallet.publicKey, isSigner: true, isWritable: false },
      ],
      programId: this.programId,
      data: Buffer.from([0x06]), // cancel_will discriminator
    });

    const tx = new Transaction().add(instruction);
    return await this.provider.sendAndConfirm(tx);
  }

  /**
   * Update timeout period
   */
  async updateTimeout(newTimeoutSeconds: number): Promise<string> {
    const [willPda] = this.findWillPda(this.wallet.publicKey);

    const data = Buffer.alloc(16);
    Buffer.from([0x07]).copy(data, 0);
    new BN(newTimeoutSeconds).toArrayLike(Buffer, 'le', 8).copy(data, 8);

    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: willPda, isSigner: false, isWritable: true },
        { pubkey: this.wallet.publicKey, isSigner: true, isWritable: false },
      ],
      programId: this.programId,
      data: data.slice(0, 16),
    });

    const tx = new Transaction().add(instruction);
    return await this.provider.sendAndConfirm(tx);
  }

  /**
   * Update final message
   */
  async updateMessage(newMessage: string): Promise<string> {
    const [willPda] = this.findWillPda(this.wallet.publicKey);

    const messageBytes = Buffer.from(newMessage, 'utf-8');
    const data = Buffer.alloc(8 + 4 + messageBytes.length);
    Buffer.from([0x08]).copy(data, 0);
    data.writeUInt32LE(messageBytes.length, 8);
    messageBytes.copy(data, 12);

    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: willPda, isSigner: false, isWritable: true },
        { pubkey: this.wallet.publicKey, isSigner: true, isWritable: false },
      ],
      programId: this.programId,
      data,
    });

    const tx = new Transaction().add(instruction);
    return await this.provider.sendAndConfirm(tx);
  }

  /**
   * Deposit SOL into the will's vault
   */
  async depositSol(amount: number): Promise<string> {
    const [willPda] = this.findWillPda(this.wallet.publicKey);
    const [vaultPda] = this.findVaultPda(willPda);

    const lamports = Math.floor(amount * LAMPORTS_PER_SOL);
    const data = Buffer.alloc(16);
    Buffer.from([0x09]).copy(data, 0);
    new BN(lamports).toArrayLike(Buffer, 'le', 8).copy(data, 8);

    const instruction = new TransactionInstruction({
      keys: [
        { pubkey: willPda, isSigner: false, isWritable: false },
        { pubkey: vaultPda, isSigner: false, isWritable: true },
        { pubkey: this.wallet.publicKey, isSigner: true, isWritable: true },
        { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      ],
      programId: this.programId,
      data: data.slice(0, 16),
    });

    const tx = new Transaction().add(instruction);
    return await this.provider.sendAndConfirm(tx);
  }

  // === Query Operations ===

  /**
   * Get will details
   */
  async getWill(owner: PublicKey): Promise<Will> {
    const [willPda] = this.findWillPda(owner);
    const accountInfo = await this.connection.getAccountInfo(willPda);
    
    if (!accountInfo) {
      throw new Error('Will not found');
    }

    // Parse account data (simplified - real impl uses anchor)
    const data = accountInfo.data;
    
    return {
      address: willPda,
      owner: new PublicKey(data.slice(8, 40)),
      timeoutSeconds: new BN(data.slice(40, 48), 'le').toNumber(),
      lastHeartbeat: new Date(new BN(data.slice(48, 56), 'le').toNumber() * 1000),
      createdAt: new Date(new BN(data.slice(56, 64), 'le').toNumber() * 1000),
      message: '', // Would parse string from data
      isActive: data[64] === 1,
      isTriggered: data[65] === 1,
      triggeredAt: null, // Would parse optional i64
      beneficiaryCount: data[66],
    };
  }

  /**
   * Get will status with all details
   */
  async getWillStatus(owner: PublicKey): Promise<WillStatus> {
    const will = await this.getWill(owner);
    const [vaultPda] = this.findVaultPda(will.address);
    
    const vaultBalance = await this.connection.getBalance(vaultPda);
    const now = Date.now();
    const deadline = will.lastHeartbeat.getTime() + will.timeoutSeconds * 1000;
    const timeRemaining = Math.max(0, Math.floor((deadline - now) / 1000));

    return {
      will,
      beneficiaries: [], // Would fetch all beneficiary PDAs
      timeRemaining,
      canTrigger: timeRemaining === 0 && !will.isTriggered,
      vaultBalance: vaultBalance / LAMPORTS_PER_SOL,
    };
  }

  /**
   * Check if a will can be triggered
   */
  async canTrigger(owner: PublicKey): Promise<boolean> {
    const status = await this.getWillStatus(owner);
    return status.canTrigger;
  }

  /**
   * Get all wills that can currently be triggered
   * (Would need indexing service in production)
   */
  async getTriggableWills(): Promise<PublicKey[]> {
    // In production, this would query an indexer
    // For now, return empty array
    return [];
  }
}
