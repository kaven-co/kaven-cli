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

const HEX_PATTERN = /^[0-9a-fA-F]+$/;

/**
 * Decode a signature string that may be hex or base64 encoded.
 * Ed25519 signatures are always 64 bytes:
 *   - hex: 128 chars, only [0-9a-fA-F]
 *   - base64: 88 chars, may contain +/=
 */
function decodeSignature(encoded: string): Buffer {
  if (HEX_PATTERN.test(encoded) && encoded.length === 128) {
    return Buffer.from(encoded, "hex");
  }
  return Buffer.from(encoded, "base64");
}

/**
 * Verify Ed25519 signature against a SHA-256 checksum.
 *
 * Accepts signature in either hex or base64 encoding.
 * Tolerates signatures made over checksum with trailing newline
 * (common when signing via `echo checksum > file && openssl sign`).
 */
export function verifyEd25519Signature(
  checksum: string,
  signature: string,
  publicKeyBase64: string
): boolean {
  try {
    const publicKey = crypto.createPublicKey({
      key: Buffer.from(publicKeyBase64, "base64"),
      type: "spki",
      format: "der",
    });

    const sigBuffer = decodeSignature(signature);

    if (crypto.verify(null, Buffer.from(checksum), publicKey, sigBuffer)) {
      return true;
    }
    // Tolerate trailing newline from shell-based signing
    return crypto.verify(
      null,
      Buffer.from(checksum + "\n"),
      publicKey,
      sigBuffer
    );
  } catch {
    return false;
  }
}

export interface VerifyDownloadOptions {
  filePath: string;
  expectedChecksum: string;
  signature: string;
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
    opts.signature,
    opts.publicKeyBase64
  );

  if (!valid) {
    throw new SignatureVerificationError(
      "Ed25519 signature verification failed. " +
      "The package may have been tampered with."
    );
  }
}
