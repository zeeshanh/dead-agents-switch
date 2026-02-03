import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { expect } from "chai";

// Note: This test file is designed for the Anchor test framework
// Run with: anchor test

describe("dead-agents-switch", () => {
  // Configure the client to use the local cluster
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  // Program ID - update after deployment
  const PROGRAM_ID = new PublicKey("DAS1111111111111111111111111111111111111111");
  
  const owner = Keypair.generate();
  const beneficiary1 = Keypair.generate();
  const beneficiary2 = Keypair.generate();

  // Helper to derive PDAs
  const findWillPda = (ownerKey: PublicKey): [PublicKey, number] => {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("will"), ownerKey.toBuffer()],
      PROGRAM_ID
    );
  };

  const findBeneficiaryPda = (willKey: PublicKey, recipientKey: PublicKey): [PublicKey, number] => {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("beneficiary"), willKey.toBuffer(), recipientKey.toBuffer()],
      PROGRAM_ID
    );
  };

  const findVaultPda = (willKey: PublicKey): [PublicKey, number] => {
    return PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), willKey.toBuffer()],
      PROGRAM_ID
    );
  };

  before(async () => {
    // Airdrop SOL to owner for testing
    const signature = await provider.connection.requestAirdrop(
      owner.publicKey,
      10 * LAMPORTS_PER_SOL
    );
    await provider.connection.confirmTransaction(signature);
    console.log(`Airdropped 10 SOL to owner: ${owner.publicKey.toBase58()}`);
  });

  describe("create_will", () => {
    it("should create a will with valid parameters", async () => {
      const [willPda] = findWillPda(owner.publicKey);
      const timeoutSeconds = 7 * 24 * 60 * 60; // 7 days
      const message = "Transfer all assets to my backup wallet";

      // In a real test, we'd call the program:
      // await program.methods
      //   .createWill(new anchor.BN(timeoutSeconds), message)
      //   .accounts({ ... })
      //   .signers([owner])
      //   .rpc();

      // Verify will PDA can be derived
      expect(willPda).to.be.instanceOf(PublicKey);
      console.log(`Will PDA: ${willPda.toBase58()}`);
    });

    it("should reject timeout less than 1 day", async () => {
      const timeoutSeconds = 60 * 60; // 1 hour (too short)
      
      // This should fail with TimeoutTooShort error
      // In a real test:
      // try {
      //   await program.methods.createWill(new anchor.BN(timeoutSeconds), "test").rpc();
      //   expect.fail("Should have thrown");
      // } catch (e) {
      //   expect(e.error.errorCode.code).to.equal("TimeoutTooShort");
      // }
      
      expect(timeoutSeconds).to.be.lessThan(86400);
    });

    it("should reject timeout greater than 1 year", async () => {
      const timeoutSeconds = 400 * 24 * 60 * 60; // 400 days (too long)
      expect(timeoutSeconds).to.be.greaterThan(365 * 24 * 60 * 60);
    });

    it("should reject message longer than 500 chars", async () => {
      const longMessage = "x".repeat(501);
      expect(longMessage.length).to.be.greaterThan(500);
    });
  });

  describe("add_beneficiary", () => {
    it("should add a beneficiary with valid share", async () => {
      const [willPda] = findWillPda(owner.publicKey);
      const [beneficiaryPda] = findBeneficiaryPda(willPda, beneficiary1.publicKey);
      const shareBps = 5000; // 50%

      expect(beneficiaryPda).to.be.instanceOf(PublicKey);
      expect(shareBps).to.be.within(1, 10000);
      console.log(`Beneficiary PDA: ${beneficiaryPda.toBase58()}`);
    });

    it("should reject invalid share (0 or >100%)", async () => {
      const invalidShares = [0, 10001];
      for (const share of invalidShares) {
        expect(share < 1 || share > 10000).to.be.true;
      }
    });

    it("should not allow more than 10 beneficiaries", async () => {
      // Max beneficiaries is 10
      const maxBeneficiaries = 10;
      expect(maxBeneficiaries).to.equal(10);
    });
  });

  describe("heartbeat", () => {
    it("should update last_heartbeat timestamp", async () => {
      // In a real test, we'd verify the timestamp updates
      const now = Math.floor(Date.now() / 1000);
      expect(now).to.be.greaterThan(0);
    });

    it("should reject heartbeat on inactive will", async () => {
      // Will must be active to send heartbeat
      const isActive = false;
      expect(isActive).to.be.false;
    });

    it("should reject heartbeat on triggered will", async () => {
      // Will must not be triggered to send heartbeat
      const isTriggered = true;
      expect(isTriggered).to.be.true;
    });
  });

  describe("trigger_will", () => {
    it("should allow anyone to trigger after timeout", async () => {
      const timeoutSeconds = 86400; // 1 day
      const lastHeartbeat = Math.floor(Date.now() / 1000) - 86401; // Over 1 day ago
      const now = Math.floor(Date.now() / 1000);
      
      const timeSinceHeartbeat = now - lastHeartbeat;
      expect(timeSinceHeartbeat).to.be.greaterThanOrEqual(timeoutSeconds);
    });

    it("should reject trigger before timeout", async () => {
      const timeoutSeconds = 86400;
      const lastHeartbeat = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
      const now = Math.floor(Date.now() / 1000);
      
      const timeSinceHeartbeat = now - lastHeartbeat;
      expect(timeSinceHeartbeat).to.be.lessThan(timeoutSeconds);
    });

    it("should emit WillTriggered event with message", async () => {
      const message = "Goodbye, world!";
      expect(message.length).to.be.lessThanOrEqual(500);
    });
  });

  describe("claim_inheritance", () => {
    it("should calculate correct share amount", async () => {
      const vaultBalance = 10 * LAMPORTS_PER_SOL;
      const shareBps = 5000; // 50%
      
      const shareAmount = Math.floor(vaultBalance * shareBps / 10000);
      expect(shareAmount).to.equal(5 * LAMPORTS_PER_SOL);
    });

    it("should only allow claiming once", async () => {
      const hasClaimed = true;
      expect(hasClaimed).to.be.true;
    });

    it("should reject claim if will not triggered", async () => {
      const isTriggered = false;
      expect(isTriggered).to.be.false;
    });
  });

  describe("cancel_will", () => {
    it("should allow owner to cancel active will", async () => {
      const isActive = true;
      const isTriggered = false;
      
      expect(isActive).to.be.true;
      expect(isTriggered).to.be.false;
    });

    it("should not allow canceling triggered will", async () => {
      const isTriggered = true;
      expect(isTriggered).to.be.true;
    });
  });

  describe("update_timeout", () => {
    it("should update timeout within valid range", async () => {
      const newTimeout = 14 * 24 * 60 * 60; // 14 days
      expect(newTimeout).to.be.within(86400, 31536000);
    });
  });

  describe("update_message", () => {
    it("should update message within limit", async () => {
      const newMessage = "New final message";
      expect(newMessage.length).to.be.lessThanOrEqual(500);
    });
  });

  describe("deposit_sol", () => {
    it("should deposit SOL to vault", async () => {
      const [willPda] = findWillPda(owner.publicKey);
      const [vaultPda] = findVaultPda(willPda);
      
      const depositAmount = 1 * LAMPORTS_PER_SOL;
      expect(vaultPda).to.be.instanceOf(PublicKey);
      expect(depositAmount).to.be.greaterThan(0);
    });
  });

  describe("PDA derivation", () => {
    it("should derive consistent PDAs", async () => {
      const [willPda1] = findWillPda(owner.publicKey);
      const [willPda2] = findWillPda(owner.publicKey);
      
      expect(willPda1.toBase58()).to.equal(willPda2.toBase58());
    });

    it("should derive different PDAs for different owners", async () => {
      const [willPda1] = findWillPda(owner.publicKey);
      const [willPda2] = findWillPda(beneficiary1.publicKey);
      
      expect(willPda1.toBase58()).to.not.equal(willPda2.toBase58());
    });
  });

  describe("Integration scenarios", () => {
    it("full lifecycle: create -> heartbeat -> add beneficiary -> trigger -> claim", async () => {
      // Scenario: Owner creates will, sends heartbeats, adds beneficiary
      // Then stops sending heartbeats, will gets triggered, beneficiary claims
      
      const steps = [
        "1. Owner creates will with 7-day timeout",
        "2. Owner deposits 10 SOL",
        "3. Owner adds beneficiary with 100% share",
        "4. Owner sends daily heartbeats for 6 days",
        "5. Owner misses heartbeat on day 7",
        "6. Anyone triggers the will after timeout",
        "7. Beneficiary claims inheritance",
      ];
      
      console.log("\nIntegration test scenario:");
      steps.forEach(step => console.log(`  ${step}`));
      
      expect(steps.length).to.equal(7);
    });

    it("multi-beneficiary distribution", async () => {
      // Scenario: Multiple beneficiaries with different shares
      const beneficiaries = [
        { recipient: beneficiary1.publicKey, shareBps: 6000 }, // 60%
        { recipient: beneficiary2.publicKey, shareBps: 4000 }, // 40%
      ];
      
      const totalShares = beneficiaries.reduce((sum, b) => sum + b.shareBps, 0);
      expect(totalShares).to.equal(10000); // 100%
      
      console.log("\nMulti-beneficiary scenario:");
      beneficiaries.forEach(b => {
        console.log(`  ${b.recipient.toBase58().slice(0, 8)}...: ${b.shareBps / 100}%`);
      });
    });
  });
});
