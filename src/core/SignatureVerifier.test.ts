import path from "node:path";
import { before, describe, it } from 'node:test';
import assert from 'node:assert';
import crypto from "crypto";
import fs from "fs-extra";
import path from "path";
import os from "os";
import {
  computeFileChecksum,
  verifyEd25519Signature,
  verifyDownload,
} from "./SignatureVerifier.js";
import { SignatureVerificationError } from "../infrastructure/errors.js";

describe("SignatureVerifier", () => {
  let privateKey: crypto.KeyObject;
  let publicKey: crypto.KeyObject;
  let publicKeyBase64: string;
  let tempDir: string;

  before(async () => {
    const keyPair = crypto.generateKeyPairSync("ed25519");
    privateKey = keyPair.privateKey;
    publicKey = keyPair.publicKey;
    publicKeyBase64 = (
      publicKey.export({ type: "spki", format: "der" }) as Buffer
    ).toString("base64");
    tempDir = await fs.mkdtemp(
      path.join(os.tmpdir(), "sig-verify-test-")
    );
  });

  describe("computeFileChecksum", () => {
    it("computes correct SHA-256 hex digest", async () => {
      const filePath = path.join(tempDir, "test-file.bin");
      const content = Buffer.from("hello kaven module");
      await fs.writeFile(filePath, content);

      const checksum = await computeFileChecksum(filePath);

      const expected = crypto
        .createHash("sha256")
        .update(content)
        .digest("hex");
      assert.strictEqual(checksum, expected);
    });

    it("returns different checksums for different content", async () => {
      const file1 = path.join(tempDir, "file1.bin");
      const file2 = path.join(tempDir, "file2.bin");
      await fs.writeFile(file1, "content-a");
      await fs.writeFile(file2, "content-b");

      const checksum1 = await computeFileChecksum(file1);
      const checksum2 = await computeFileChecksum(file2);
      assert.notStrictEqual(checksum1, checksum2);
    });
  });

  describe("verifyEd25519Signature", () => {
    it("returns true for valid hex signature", () => {
      const checksum = "abc123deadbeef";
      const signature = crypto.sign(
        null,
        Buffer.from(checksum),
        privateKey
      );
      const signatureHex = signature.toString("hex");

      const result = verifyEd25519Signature(
        checksum,
        signatureHex,
        publicKeyBase64
      );
      assert.strictEqual(result, true);
    });

    it("returns true for valid base64 signature", () => {
      const checksum = "abc123deadbeef";
      const signature = crypto.sign(
        null,
        Buffer.from(checksum),
        privateKey
      );
      const signatureBase64 = signature.toString("base64");

      const result = verifyEd25519Signature(
        checksum,
        signatureBase64,
        publicKeyBase64
      );
      assert.strictEqual(result, true);
    });

    it("returns true when signature was made with trailing newline", () => {
      const checksum = "abc123deadbeef";
      const signature = crypto.sign(
        null,
        Buffer.from(checksum + "\n"),
        privateKey
      );

      const result = verifyEd25519Signature(
        checksum,
        signature.toString("base64"),
        publicKeyBase64
      );
      assert.strictEqual(result, true);
    });

    it("returns false for tampered checksum", () => {
      const checksum = "abc123deadbeef";
      const signature = crypto.sign(
        null,
        Buffer.from(checksum),
        privateKey
      );
      const signatureHex = signature.toString("hex");

      const result = verifyEd25519Signature(
        "tampered-checksum",
        signatureHex,
        publicKeyBase64
      );
      assert.strictEqual(result, false);
    });

    it("returns false for wrong public key", () => {
      const checksum = "abc123deadbeef";
      const signature = crypto.sign(
        null,
        Buffer.from(checksum),
        privateKey
      );
      const signatureHex = signature.toString("hex");

      const otherKey = crypto.generateKeyPairSync("ed25519");
      const otherPubBase64 = (
        otherKey.publicKey.export({
          type: "spki",
          format: "der",
        }) as Buffer
      ).toString("base64");

      const result = verifyEd25519Signature(
        checksum,
        signatureHex,
        otherPubBase64
      );
      assert.strictEqual(result, false);
    });

    it("returns false for invalid public key data", () => {
      const result = verifyEd25519Signature(
        "checksum",
        "aabbccdd",
        "not-a-valid-base64-key!!!"
      );
      assert.strictEqual(result, false);
    });
  });

  describe("verifyDownload", () => {
    it("succeeds with hex signature", async () => {
      const filePath = path.join(tempDir, "valid-module.tar.gz");
      const content = Buffer.from("valid module content");
      await fs.writeFile(filePath, content);

      const checksum = crypto
        .createHash("sha256")
        .update(content)
        .digest("hex");
      const signature = crypto.sign(
        null,
        Buffer.from(checksum),
        privateKey
      );

      await verifyDownload({
          filePath,
          expectedChecksum: checksum,
          signature: signature.toString("hex"),
          publicKeyBase64,
        });
    });

    it("succeeds with base64 signature", async () => {
      const filePath = path.join(tempDir, "valid-b64-module.tar.gz");
      const content = Buffer.from("valid module content base64");
      await fs.writeFile(filePath, content);

      const checksum = crypto
        .createHash("sha256")
        .update(content)
        .digest("hex");
      const signature = crypto.sign(
        null,
        Buffer.from(checksum),
        privateKey
      );

      await verifyDownload({
        filePath,
        expectedChecksum: checksum,
        signature: signature.toString("base64"),
        publicKeyBase64,
      });

    });

    it("succeeds when signature has trailing newline", async () => {
      const filePath = path.join(tempDir, "newline-sig-module.tar.gz");
      const content = Buffer.from("newline signed content");
      await fs.writeFile(filePath, content);

      const checksum = crypto
        .createHash("sha256")
        .update(content)
        .digest("hex");
      const signature = crypto.sign(
        null,
        Buffer.from(checksum + "\n"),
        privateKey
      );

      await verifyDownload({
          filePath,
          expectedChecksum: checksum,
          signature: signature.toString("base64"),
          publicKeyBase64,
        })

    });

    it("throws on checksum mismatch", async () => {
      const filePath = path.join(tempDir, "tampered-module.tar.gz");
      await fs.writeFile(filePath, "tampered content");

      const fakeChecksum = "0".repeat(64);
      const signature = crypto.sign(
        null,
        Buffer.from(fakeChecksum),
        privateKey
      );

      await assert.rejects(async () => {
        await verifyDownload({
          filePath,
          expectedChecksum: fakeChecksum,
          signature: signature.toString("hex"),
          publicKeyBase64,
        });
      }, (err) => err instanceof SignatureVerificationError);

      await assert.rejects(async () => {
        await verifyDownload({
          filePath,
          expectedChecksum: fakeChecksum,
          signature: signature.toString("hex"),
          publicKeyBase64,
        });
      }, { message: /Checksum mismatch/ });
    });

    it("throws on invalid signature with correct checksum", async () => {
      const filePath = path.join(tempDir, "bad-sig-module.tar.gz");
      const content = Buffer.from("module with bad sig");
      await fs.writeFile(filePath, content);

      const checksum = crypto
        .createHash("sha256")
        .update(content)
        .digest("hex");

      const otherKey = crypto.generateKeyPairSync("ed25519");
      const wrongSignature = crypto.sign(
        null,
        Buffer.from(checksum),
        otherKey.privateKey
      );

      await assert.rejects(async () => {
        await verifyDownload({
          filePath,
          expectedChecksum: checksum,
          signature: wrongSignature.toString("hex"),
          publicKeyBase64,
        })
      ; }, { name: 'SignatureVerificationError' });

      await assert.rejects(async () => {
        await verifyDownload({
          filePath,
          expectedChecksum: checksum,
          signature: wrongSignature.toString("base64"),
          publicKeyBase64,
        });
      }, { message: /Ed25519 signature verification failed/i });
    });
  });
});
