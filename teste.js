// Teste da função daysSince
function daysSince(timestamp) {
  if (!timestamp) return 0;

  const timestampNum =
    typeof timestamp === "string" ? parseInt(timestamp) : timestamp;

  if (isNaN(timestampNum) || timestampNum <= 0) return 0;

  const now = Date.now();
  const diff = now - timestampNum;

  if (diff < 0) return 0;
  if (diff > 365 * 24 * 60 * 60 * 1000) return 365;

  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

console.log("Teste daysSince:");
console.log(
  "Dias desde 1 dia atrás:",
  daysSince(Date.now() - 24 * 60 * 60 * 1000),
);
console.log("Dias desde null:", daysSince(null));
console.log("Dias desde string:", daysSince("1700000000000"));
