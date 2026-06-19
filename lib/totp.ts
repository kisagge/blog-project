import { createHmac, timingSafeEqual } from "crypto";

// Google Authenticator 호환 TOTP(RFC 6238, SHA1·6자리·30초) 검증. 외부 의존성 없음.

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

// RFC 4648 base32 디코드(대문자, 패딩/공백 무시).
function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[^A-Z2-7]/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    value = (value << 5) | BASE32.indexOf(ch);
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      out.push((value >>> bits) & 0xff);
    }
  }
  return Buffer.from(out);
}

// HOTP(RFC 4226): 카운터로 6자리 코드 생성.
function hotp(key: Buffer, counter: number): string {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64BE(BigInt(counter));
  const h = createHmac("sha1", key).update(buf).digest();
  const offset = h[h.length - 1] & 0x0f;
  const bin =
    ((h[offset] & 0x7f) << 24) |
    (h[offset + 1] << 16) |
    (h[offset + 2] << 8) |
    h[offset + 3];
  return (bin % 1_000_000).toString().padStart(6, "0");
}

// 코드 검증. 시계 오차 허용(window 스텝, 기본 ±1 = ±30초).
export function verifyTotp(
  secretBase32: string,
  code: string,
  now: number = Date.now(),
  window = 1,
): boolean {
  const c = code.trim();
  if (!/^\d{6}$/.test(c)) return false;
  const key = base32Decode(secretBase32);
  if (key.length === 0) return false;
  const step = Math.floor(now / 1000 / 30);
  const target = Buffer.from(c);
  for (let w = -window; w <= window; w++) {
    const counter = step + w;
    if (counter < 0) continue;
    const candidate = Buffer.from(hotp(key, counter));
    if (
      candidate.length === target.length &&
      timingSafeEqual(candidate, target)
    )
      return true;
  }
  return false;
}
