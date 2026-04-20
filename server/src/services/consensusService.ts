// ============================================================
// Consensus Rating Service — standalone computation of analyst
// consensus from an array of individual rating strings.
// ============================================================

/** The five possible analyst rating categories. */
export type RatingType = 'Strong Buy' | 'Buy' | 'Hold' | 'Sell' | 'Strong Sell';

/** Result of computing a consensus from multiple ratings. */
export interface ConsensusResult {
  /** The consensus rating label (rounded mean mapped back to a category). */
  consensusRating: RatingType;
  /** The raw arithmetic mean of numeric scores (e.g. 3.67). */
  consensusScore: number;
}

/** Maps a rating string to its numeric score. */
const SCORE_MAP: Record<RatingType, number> = {
  'Strong Buy': 5,
  'Buy': 4,
  'Hold': 3,
  'Sell': 2,
  'Strong Sell': 1,
};

/** Maps a rounded numeric score back to a rating string. */
const RATING_MAP: Record<number, RatingType> = {
  5: 'Strong Buy',
  4: 'Buy',
  3: 'Hold',
  2: 'Sell',
  1: 'Strong Sell',
};

/**
 * Compute the consensus rating from an array of individual analyst ratings.
 *
 * - Each rating is mapped to a numeric score (Strong Buy=5 … Strong Sell=1).
 * - The arithmetic mean of all scores is computed.
 * - The mean is rounded to the nearest integer and mapped back to a rating string.
 *
 * @param ratings Non-empty array of analyst ratings.
 * @returns The consensus rating string and the raw mean score.
 * @throws {Error} If the ratings array is empty.
 */
export function computeConsensusRating(ratings: RatingType[]): ConsensusResult {
  if (ratings.length === 0) {
    throw new Error('Cannot compute consensus from an empty ratings array');
  }

  const sum = ratings.reduce((acc, r) => acc + SCORE_MAP[r], 0);
  const consensusScore = sum / ratings.length;
  const rounded = Math.round(consensusScore);
  const clamped = Math.max(1, Math.min(5, rounded));
  const consensusRating = RATING_MAP[clamped];

  return { consensusRating, consensusScore };
}
