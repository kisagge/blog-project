// 관리자 2FA용 TOTP 시크릿 생성기. 외부 의존성 없음.
// 실행: pnpm totp:setup  (또는 node scripts/totp-setup.mjs)
import { randomBytes } from "crypto";

const BASE32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(buf) {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const b of buf) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += BASE32[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32[(value << (5 - bits)) & 31];
  return out;
}

const secret = base32Encode(randomBytes(20)); // 160-bit
const issuer = "BY Playground";
const account = "admin";
const uri =
  `otpauth://totp/${encodeURIComponent(issuer)}:${account}` +
  `?secret=${secret}&issuer=${encodeURIComponent(issuer)}` +
  `&algorithm=SHA1&digits=6&period=30`;

console.log("\n=== 관리자 TOTP 시크릿 ===\n");
console.log(`ADMIN_TOTP_SECRET=${secret}\n`);
console.log("Google Authenticator 등록 (둘 중 하나):");
console.log(
  "  1) 수동 입력: 위 시크릿을 '직접 키 입력'으로 추가 (계정 이름: admin)",
);
console.log("  2) QR 스캔: 아래 otpauth URI로 QR을 만들어 스캔\n");
console.log(`${uri}\n`);
console.log(
  "이 시크릿을 서버 /srv/byjang/.env 와 로컬 .env 의 ADMIN_TOTP_SECRET 에 넣고",
);
console.log(
  "컨테이너를 재기동하면 다음 로그인부터 비밀번호 + OTP 2단계가 적용됩니다.\n",
);
