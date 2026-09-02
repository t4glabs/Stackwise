// Short, readable, not security-critical — the account holder changes it on first real
// use. See DEPLOY.md / architecture plan: many CCI youth have no personal email, so
// facilitators/admins hand this off directly rather than an emailed reset link.
const WORDS = ["river", "cedar", "maple", "coral", "amber", "quartz", "willow", "sable"];

export function generateTempPassword() {
  const word = WORDS[Math.floor(Math.random() * WORDS.length)];
  const digits = Math.floor(100 + Math.random() * 900);
  return `${word}${digits}`;
}
