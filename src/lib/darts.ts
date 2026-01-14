// Common dart scores for quick input
export const QUICK_SCORES = [26, 41, 45, 60, 100, 140, 180] as const;

// Checkout combinations for scores 170 and below
// Format: [total, [dart1, dart2, dart3]] where dartN is like "T20" or "D16"
export const CHECKOUTS: Record<number, string[]> = {
  170: ["T20", "T20", "Bull"],
  167: ["T20", "T19", "Bull"],
  164: ["T20", "T18", "Bull"],
  161: ["T20", "T17", "Bull"],
  160: ["T20", "T20", "D20"],
  158: ["T20", "T20", "D19"],
  157: ["T20", "T19", "D20"],
  156: ["T20", "T20", "D18"],
  155: ["T20", "T19", "D19"],
  154: ["T20", "T18", "D20"],
  153: ["T20", "T19", "D18"],
  152: ["T20", "T20", "D16"],
  151: ["T20", "T17", "D20"],
  150: ["T20", "T18", "D18"],
  149: ["T20", "T19", "D16"],
  148: ["T20", "T20", "D14"],
  147: ["T20", "T17", "D18"],
  146: ["T20", "T18", "D16"],
  145: ["T20", "T19", "D14"],
  144: ["T20", "T20", "D12"],
  143: ["T20", "T17", "D16"],
  142: ["T20", "T14", "D20"],
  141: ["T20", "T19", "D12"],
  140: ["T20", "T20", "D10"],
  139: ["T20", "T13", "D20"],
  138: ["T20", "T18", "D12"],
  137: ["T20", "T19", "D10"],
  136: ["T20", "T20", "D8"],
  135: ["T20", "T17", "D12"],
  134: ["T20", "T14", "D16"],
  133: ["T20", "T19", "D8"],
  132: ["T20", "T16", "D12"],
  131: ["T20", "T13", "D16"],
  130: ["T20", "T18", "D8"],
  129: ["T19", "T16", "D12"],
  128: ["T18", "T14", "D16"],
  127: ["T20", "T17", "D8"],
  126: ["T19", "T19", "D6"],
  125: ["T20", "T19", "D4"],
  124: ["T20", "T14", "D11"],
  123: ["T19", "T16", "D9"],
  122: ["T18", "T18", "D7"],
  121: ["T20", "T11", "D14"],
  120: ["T20", "S20", "D20"],
  119: ["T19", "T12", "D13"],
  118: ["T20", "S18", "D20"],
  117: ["T20", "S17", "D20"],
  116: ["T20", "S16", "D20"],
  115: ["T20", "S15", "D20"],
  114: ["T20", "S14", "D20"],
  113: ["T20", "S13", "D20"],
  112: ["T20", "T12", "D8"],
  111: ["T20", "S19", "D16"],
  110: ["T20", "S18", "D16"],
  109: ["T20", "S17", "D16"],
  108: ["T20", "S16", "D16"],
  107: ["T19", "S18", "D16"],
  106: ["T20", "S14", "D16"],
  105: ["T20", "S13", "D16"],
  104: ["T18", "S18", "D16"],
  103: ["T19", "S14", "D16"],
  102: ["T20", "S10", "D16"],
  101: ["T17", "S18", "D16"],
  100: ["T20", "D20"],
  99: ["T19", "S10", "D16"],
  98: ["T20", "D19"],
  97: ["T19", "D20"],
  96: ["T20", "D18"],
  95: ["T19", "D19"],
  94: ["T18", "D20"],
  93: ["T19", "D18"],
  92: ["T20", "D16"],
  91: ["T17", "D20"],
  90: ["T18", "D18"],
  89: ["T19", "D16"],
  88: ["T20", "D14"],
  87: ["T17", "D18"],
  86: ["T18", "D16"],
  85: ["T15", "D20"],
  84: ["T20", "D12"],
  83: ["T17", "D16"],
  82: ["T14", "D20"],
  81: ["T19", "D12"],
  80: ["T20", "D10"],
  79: ["T13", "D20"],
  78: ["T18", "D12"],
  77: ["T19", "D10"],
  76: ["T20", "D8"],
  75: ["T17", "D12"],
  74: ["T14", "D16"],
  73: ["T19", "D8"],
  72: ["T16", "D12"],
  71: ["T13", "D16"],
  70: ["T18", "D8"],
  69: ["T19", "D6"],
  68: ["T20", "D4"],
  67: ["T17", "D8"],
  66: ["T10", "D18"],
  65: ["T19", "D4"],
  64: ["T16", "D8"],
  63: ["T13", "D12"],
  62: ["T10", "D16"],
  61: ["T15", "D8"],
  60: ["S20", "D20"],
  59: ["S19", "D20"],
  58: ["S18", "D20"],
  57: ["S17", "D20"],
  56: ["T16", "D4"],
  55: ["S15", "D20"],
  54: ["S14", "D20"],
  53: ["S13", "D20"],
  52: ["T12", "D8"],
  51: ["S19", "D16"],
  50: ["S18", "D16"],
  49: ["S17", "D16"],
  48: ["S16", "D16"],
  47: ["S15", "D16"],
  46: ["S14", "D16"],
  45: ["S13", "D16"],
  44: ["S12", "D16"],
  43: ["S11", "D16"],
  42: ["S10", "D16"],
  41: ["S9", "D16"],
  40: ["D20"],
  39: ["S7", "D16"],
  38: ["D19"],
  37: ["S5", "D16"],
  36: ["D18"],
  35: ["S3", "D16"],
  34: ["D17"],
  33: ["S1", "D16"],
  32: ["D16"],
  31: ["S15", "D8"],
  30: ["D15"],
  29: ["S13", "D8"],
  28: ["D14"],
  27: ["S11", "D8"],
  26: ["D13"],
  25: ["S9", "D8"],
  24: ["D12"],
  23: ["S7", "D8"],
  22: ["D11"],
  21: ["S5", "D8"],
  20: ["D10"],
  19: ["S3", "D8"],
  18: ["D9"],
  17: ["S1", "D8"],
  16: ["D8"],
  15: ["S7", "D4"],
  14: ["D7"],
  13: ["S5", "D4"],
  12: ["D6"],
  11: ["S3", "D4"],
  10: ["D5"],
  9: ["S1", "D4"],
  8: ["D4"],
  7: ["S3", "D2"],
  6: ["D3"],
  5: ["S1", "D2"],
  4: ["D2"],
  3: ["S1", "D1"],
  2: ["D1"],
};

export function getCheckoutSuggestion(remaining: number, dartsRemaining: number = 3): string[] | null {
  if (remaining > 170 || remaining < 2) return null;

  const checkout = CHECKOUTS[remaining];
  if (!checkout) return null;

  // If we have enough darts for the standard checkout, use it
  if (checkout.length <= dartsRemaining) {
    return checkout;
  }

  // Need to find a shorter checkout
  // Single-dart checkouts (doubles only, or Bull for 50)
  if (dartsRemaining === 1) {
    if (remaining === 50) return ["Bull"];
    if (remaining <= 40 && remaining % 2 === 0) return [`D${remaining / 2}`];
    return null; // Can't checkout in 1 dart
  }

  // Two-dart checkouts
  if (dartsRemaining === 2) {
    // Check if there's a 2-dart checkout in our table
    if (checkout.length === 2) return checkout;

    // For 50, we can do S10 + D20 or just Bull (but Bull is 1 dart, so prefer a 2-dart)
    if (remaining === 50) return ["S10", "D20"];

    // Try to find a 2-dart solution: single + double
    // For scores up to 60, try S(x) + D(remaining-x)/2
    for (let single = 1; single <= 20; single++) {
      const afterSingle = remaining - single;
      if (afterSingle >= 2 && afterSingle <= 40 && afterSingle % 2 === 0) {
        return [`S${single}`, `D${afterSingle / 2}`];
      }
    }

    // Try treble + double for higher scores
    for (let treble = 1; treble <= 20; treble++) {
      const afterTreble = remaining - (treble * 3);
      if (afterTreble >= 2 && afterTreble <= 40 && afterTreble % 2 === 0) {
        return [`T${treble}`, `D${afterTreble / 2}`];
      }
    }

    // Try double + double (e.g., for 64: D16 + D16)
    for (let double1 = 1; double1 <= 20; double1++) {
      const afterDouble = remaining - (double1 * 2);
      if (afterDouble >= 2 && afterDouble <= 40 && afterDouble % 2 === 0) {
        return [`D${double1}`, `D${afterDouble / 2}`];
      }
    }

    return null; // Can't find a 2-dart checkout
  }

  return checkout;
}

export function isBust(remaining: number, score: number): boolean {
  const newRemaining = remaining - score;
  return newRemaining < 0 || newRemaining === 1;
}

export function isValidCheckout(remaining: number): boolean {
  return remaining >= 2 && remaining <= 170 && CHECKOUTS[remaining] !== undefined;
}

export function calculateAverage(scores: number[], darts: number): number {
  if (darts === 0) return 0;
  const total = scores.reduce((sum, score) => sum + score, 0);
  return Math.round((total / darts) * 3 * 100) / 100; // 3-dart average
}
