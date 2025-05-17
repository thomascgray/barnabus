import { RollType, type RollResult } from "./types";

export const parseRoll = (diceNotation: string): RollResult => {
  const dicePattern = /(\d*)d(\d+)([dk]\d+)?([><]=?\d+)?([+\-]\d+)?(!{1,2})?/;
  const match = diceNotation.match(dicePattern);

  if (!match) throw new Error("Invalid dice notation");

  const [
    ,
    countStr,
    sidesStr,
    dropKeepStr,
    thresholdStr,
    modifierStr,
    explode,
  ] = match;
  const count = parseInt(countStr || "1", 10);
  const sides = parseInt(sidesStr, 10);
  const modifier = modifierStr ? parseInt(modifierStr, 10) : 0;

  const originalRolls = Array.from(
    { length: count },
    () => Math.floor(Math.random() * sides) + 1
  );
  let keptRolls = originalRolls;

  // Determine roll type
  let rollType: RollType = RollType.Basic;

  // Apply Drop/Keep logic and update roll type
  if (dropKeepStr) {
    const isDrop = dropKeepStr.startsWith("d");
    const dropKeepCount = parseInt(dropKeepStr.slice(1), 10);
    keptRolls = isDrop
      ? originalRolls.sort((a, b) => a - b).slice(dropKeepCount)
      : originalRolls.sort((a, b) => b - a).slice(0, dropKeepCount);
    rollType = RollType.DropKeep;
  }

  // Handle exploding dice and update roll type
  if (explode) {
    keptRolls = keptRolls.flatMap((roll) => {
      const rollSequence = [roll];
      while (
        explode === "!!"
          ? rollSequence.slice(-1)[0] >= sides
          : rollSequence.slice(-1)[0] === sides
      ) {
        rollSequence.push(Math.floor(Math.random() * sides) + 1);
      }
      return rollSequence;
    });
    rollType = RollType.Exploding;
  }

  // Handle threshold (Success/Failure) count and update roll type
  let successCount = 0;
  if (thresholdStr) {
    const thresholdMatch = thresholdStr.match(/([><]=?)(\d+)/);
    if (thresholdMatch) {
      const operator = thresholdMatch[1];
      const threshold = parseInt(thresholdMatch[2], 10);
      successCount = keptRolls.filter((roll) =>
        evaluateThreshold(roll, operator, threshold)
      ).length;
      rollType = RollType.SuccessCount;
    }
  }

  // Calculate the highest individual roll and the final total with modifier
  const highestRoll = Math.max(...originalRolls);
  const total = keptRolls.reduce((sum, roll) => sum + roll, 0) + modifier;

  return {
    originalRolls,
    keptRolls,
    total,
    highestRoll,
    successCount,
    rollType,
  };
};

// Helper function for evaluating threshold
function evaluateThreshold(
  roll: number,
  operator: string,
  threshold: number
): boolean {
  switch (operator) {
    case ">":
      return roll > threshold;
    case ">=":
      return roll >= threshold;
    case "<":
      return roll < threshold;
    case "<=":
      return roll <= threshold;
    default:
      return false;
  }
}
