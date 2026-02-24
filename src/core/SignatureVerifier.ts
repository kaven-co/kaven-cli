import crypto from "crypto";
import fs from "fs-extra";
import { SignatureVerificationError } from "../infrastructure/errors";

/**
 * Compute SHA-256 hex checksum of a file.
 */
export async function computeFileChecksum(
  filePath: string
): Promise<string> {
  const data = await fs.readFile(filePath);
  return crypto.createHash("sha256").update(data).digest("hex");
}

/**
 * Verify Ed25519 signature against a SHA-256 checksum.
 *
 * The publisher signs the hex-encoded checksum with their
 * Ed25519 private key. We verify using the public key stored
 * in the release metadata.
 */
export function verifyEd25519Signature(
  checksum: string,
  signatureHex: string,
  publicKeyBase64: string
): boolean {
  try {
    const publicKey = crypto.createPublicKey({
      key: Buffer.from(publicKeyBase64, "base64"),
      type: "spki",
      format: "der",
    });

    const signature = Buffer.from(signatureHex, "hex");
    return crypto.verify(
      null,
      Buffer.from(checksum),
      publicKey,
      signature
    );
  } catch {
    return false;
  }
}

export interface VerifyDownloadOptions {
  filePath: string;
  expectedChecksum: string;
  signatureHex: string;
  publicKeyBase64: string;
}

/**
 * Verify a downloaded module tarball:
 * 1. Compute SHA-256 checksum and compare to expected
 * 2. Verify Ed25519 signature of checksum with publisher key
 *
 * Throws SignatureVerificationError on failure.
 */
export async function verifyDownload(
  opts: VerifyDownloadOptions
): Promise<void> {
  const actualChecksum = await computeFileChecksum(opts.filePath);

  if (actualChecksum !== opts.expectedChecksum) {
    throw new SignatureVerificationError(
      `Checksum mismatch: expected ${opts.expectedChecksum.substring(0, 16)}..., ` +
      `got ${actualChecksum.substring(0, 16)}...`
    );
  }

  const valid = verifyEd25519Signature(
    opts.expectedChecksum,
    opts.signatureHex,
    opts.publicKeyBase64
  );

  if (!valid) {
    throw new SignatureVerificationError(
      "Ed25519 signature verification failed. " +
      "The package may have been tampered with."
    );
  }
}
