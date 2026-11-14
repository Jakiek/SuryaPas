// Assessment ids appear in public URLs (/r/<id>), so anyone who guesses an id
// can read that result. SPEC 2.6 promises "random, unguessable".

const ID_BYTES = 16; // 16 bytes = 128 random bits, above the 120-bit minimum
// 16 bytes encode to 22 base64url characters (no padding).
const ID_LENGTH = 22;
const WELL_FORMED_ID = new RegExp(`^[A-Za-z0-9_-]{${ID_LENGTH}}$`);

// Turns raw bytes into URL-safe text: base64 with "+" -> "-", "/" -> "_" and
// the trailing "=" padding removed. Chosen over hex because it is shorter.
function toBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// Uses the Web Crypto random source, which is cryptographically secure and
// exists in Node, the browser and edge runtimes. Never use Math.random here.
export function generateAssessmentId(): string {
  const bytes = new Uint8Array(ID_BYTES);
  crypto.getRandomValues(bytes);
  return toBase64Url(bytes);
}

// True when the text has the exact shape generateAssessmentId produces.
// Lets the stores answer "not found" for junk (and for the reserved id
// "example", SPEC 5.1) without querying anything.
export function isWellFormedAssessmentId(id: string): boolean {
  return WELL_FORMED_ID.test(id);
}
