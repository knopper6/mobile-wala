function maskName(name) {
  if (!name || typeof name !== "string") return "R**R";
  const clean = name.trim().replace(/\s+/g, "");
  if (clean.length <= 1) return `${clean || "R"}**${clean || "R"}`;
  return `${clean[0].toUpperCase()}**${clean[clean.length - 1].toUpperCase()}`;
}

module.exports = { maskName };
