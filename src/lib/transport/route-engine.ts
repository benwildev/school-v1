export interface StopSequenceItem {
  id?: string;
  stopName: string;
  sequenceNumber: number;
}

/**
 * Validates that stop sequence numbers within a route are unique and strictly positive.
 */
export function validateStopSequences(stops: StopSequenceItem[]): { valid: boolean; error?: string } {
  if (!stops || stops.length === 0) return { valid: true };

  const seen = new Set<number>();
  for (const stop of stops) {
    if (stop.sequenceNumber <= 0) {
      return { valid: false, error: `Stop sequence number must be positive. Found: ${stop.sequenceNumber}` };
    }
    if (seen.has(stop.sequenceNumber)) {
      return { valid: false, error: `Duplicate stop sequence number detected: ${stop.sequenceNumber}` };
    }
    seen.add(stop.sequenceNumber);
  }

  return { valid: true };
}

/**
 * Checks whether duplicate sequence numbers exist in an array of stops.
 */
export function hasDuplicateSequenceNumbers(stops: { sequenceNumber: number }[]): boolean {
  const seen = new Set<number>();
  for (const s of stops) {
    if (seen.has(s.sequenceNumber)) return true;
    seen.add(s.sequenceNumber);
  }
  return false;
}

/**
 * Sorts route stops deterministically by sequence number.
 */
export function sortStopsBySequence<T extends { sequenceNumber: number }>(stops: T[]): T[] {
  return [...stops].sort((a, b) => a.sequenceNumber - b.sequenceNumber);
}

/**
 * Calculates total or segment fare based on pickup and dropoff stop sequence.
 */
export function calculateSegmentFare(
  pickupStop: { sequenceNumber: number; fareAmount?: number | null },
  dropoffStop: { sequenceNumber: number; fareAmount?: number | null },
  baseFare = 0
): number {
  if (pickupStop.sequenceNumber >= dropoffStop.sequenceNumber) {
    // If pickup is at or after dropoff in sequence, return max of fares or base fare
    return Math.max(Number(pickupStop.fareAmount || 0), Number(dropoffStop.fareAmount || 0), baseFare);
  }
  return Number(dropoffStop.fareAmount || pickupStop.fareAmount || baseFare);
}
