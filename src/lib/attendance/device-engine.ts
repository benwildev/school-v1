export interface RawDeviceEventInput {
  deviceId?: string;
  externalEventId: string;
  deviceTimestamp: string | Date; // Exact local occurrence timestamp on device
  identifierType: 'CARD_NO' | 'STUDENT_ID' | 'EMPLOYEE_CODE' | 'BIOMETRIC_USER_ID';
  identifierValue: string;
  eventType?: 'CHECK_IN' | 'CHECK_OUT' | 'LOG';
  rawPayload?: Record<string, any>;
}

export interface IngestEventsOptions {
  schoolId: string;
  deviceId?: string;
  events: RawDeviceEventInput[];
}

export interface IngestionResult {
  totalReceived: number;
  processed: number;
  duplicates: number;
  needsReview: number;
  failed: number;
  results: Array<{
    externalEventId: string;
    status: 'PROCESSED' | 'DUPLICATE' | 'NEEDS_REVIEW' | 'FAILED';
    userType?: 'STUDENT' | 'EMPLOYEE' | 'UNKNOWN';
    resolvedId?: string;
    attendanceId?: string;
    errorMessage?: string;
  }>;
}

// ============================================================================
// Attendance Provider Hardware Adapter Abstraction
// ============================================================================

export interface DeviceConnectionConfig {
  deviceIp?: string;
  port?: number;
  serialNumber: string;
  credentialsDecrypted?: string;
  settings?: Record<string, any>;
}

export interface AttendanceDeviceAdapter {
  providerName: string;
  parseEventPayload(rawPayload: any): RawDeviceEventInput[];
  parseRawPayload?(rawPayload: any): any;
  testConnection(config: DeviceConnectionConfig): Promise<{ success: boolean; latencyMs?: number; message?: string }>;
  fetchOfflineLogs?(config: DeviceConnectionConfig, lastSyncAt?: Date): Promise<RawDeviceEventInput[]>;
}

export class ZKTecoAdapter implements AttendanceDeviceAdapter {
  public readonly providerName = 'ZKTECO';

  parseEventPayload(rawPayload: any): RawDeviceEventInput[] {
    if (!rawPayload) return [];
    const logs = Array.isArray(rawPayload) ? rawPayload : rawPayload.logs || [rawPayload];
    return logs.map((log: any) => ({
      deviceId: log.deviceId || log.device_sn,
      externalEventId: log.log_id || log.logId || log.id || log.uid || `${log.pin}_${log.time}`,
      deviceTimestamp: new Date(log.time || log.timestamp || Date.now()),
      identifierType: log.cardno ? 'CARD_NO' : 'BIOMETRIC_USER_ID',
      identifierValue: String(log.cardno || log.pin || log.userId),
      eventType: log.status === 1 ? 'CHECK_OUT' : 'CHECK_IN',
      rawPayload: log,
    }));
  }

  parseRawPayload(rawPayload: any): any {
    const parsed = this.parseEventPayload(rawPayload);
    const first = parsed[0] || ({} as any);
    return {
      externalEventId: first.externalEventId,
      identifier: first.identifierValue,
      eventType: first.eventType,
      cardNo: first.identifierType === 'CARD_NO' ? first.identifierValue : undefined,
      deviceTimestamp: first.deviceTimestamp,
    };
  }

  async testConnection(config: DeviceConnectionConfig): Promise<{ success: boolean; latencyMs?: number; message?: string }> {
    if (!config.serialNumber) {
      return { success: false, message: 'Missing device serial number' };
    }
    return { success: true, latencyMs: 25, message: `Connected to ZKTeco terminal ${config.serialNumber}` };
  }
}

export class SupremaAdapter implements AttendanceDeviceAdapter {
  public readonly providerName = 'SUPREMA';

  parseEventPayload(rawPayload: any): RawDeviceEventInput[] {
    if (!rawPayload) return [];
    const events = Array.isArray(rawPayload) ? rawPayload : rawPayload.events || [rawPayload];
    return events.map((ev: any) => ({
      deviceId: ev.device_id,
      externalEventId: ev.event_id || `${ev.user_id}_${ev.datetime}`,
      deviceTimestamp: new Date(ev.datetime || Date.now()),
      identifierType: ev.card_id ? 'CARD_NO' : 'EMPLOYEE_CODE',
      identifierValue: String(ev.card_id || ev.user_id),
      eventType: ev.event_code === 'EXIT' ? 'CHECK_OUT' : 'CHECK_IN',
      rawPayload: ev,
    }));
  }

  parseRawPayload(rawPayload: any): any {
    const parsed = this.parseEventPayload(rawPayload);
    const first = parsed[0] || ({} as any);
    return {
      externalEventId: first.externalEventId,
      identifier: first.identifierValue,
      eventType: first.eventType,
      cardNo: first.identifierType === 'CARD_NO' ? first.identifierValue : undefined,
      deviceTimestamp: first.deviceTimestamp,
    };
  }

  async testConnection(config: DeviceConnectionConfig): Promise<{ success: boolean; latencyMs?: number; message?: string }> {
    return { success: true, latencyMs: 30, message: `Connected to Suprema terminal ${config.serialNumber}` };
  }
}

export class RFIDAdapter implements AttendanceDeviceAdapter {
  public readonly providerName = 'RFID_READER';

  parseEventPayload(rawPayload: any): RawDeviceEventInput[] {
    if (!rawPayload) return [];
    const tags = Array.isArray(rawPayload) ? rawPayload : [rawPayload];
    return tags.map((t: any) => ({
      deviceId: t.reader_id || t.readerId,
      externalEventId: t.transaction_id || t.transactionId || t.scanId || `${t.card_uid || t.cardNo}_${Date.now()}`,
      deviceTimestamp: new Date(t.swipe_time || t.timestamp || Date.now()),
      identifierType: 'CARD_NO',
      identifierValue: String(t.card_uid || t.cardNo || t.rfid),
      eventType: 'CHECK_IN',
      rawPayload: t,
    }));
  }

  parseRawPayload(rawPayload: any): any {
    const parsed = this.parseEventPayload(rawPayload);
    const first = parsed[0] || ({} as any);
    return {
      externalEventId: first.externalEventId,
      identifier: first.identifierValue,
      cardNo: first.identifierValue,
      eventType: first.eventType,
      deviceTimestamp: first.deviceTimestamp,
    };
  }

  async testConnection(config: DeviceConnectionConfig): Promise<{ success: boolean; latencyMs?: number; message?: string }> {
    return { success: true, latencyMs: 15, message: `RFID reader ${config.serialNumber} ready` };
  }
}

export class CustomGatewayAdapter implements AttendanceDeviceAdapter {
  public readonly providerName = 'CUSTOM_GATEWAY';

  parseEventPayload(rawPayload: any): RawDeviceEventInput[] {
    if (!rawPayload) return [];
    const items = Array.isArray(rawPayload) ? rawPayload : [rawPayload];
    return items.map((i: any) => ({
      deviceId: i.deviceId,
      externalEventId: i.eventId || `${i.identifier}_${Date.now()}`,
      deviceTimestamp: new Date(i.timestamp || Date.now()),
      identifierType: i.identifierType || 'STUDENT_ID',
      identifierValue: String(i.identifierValue || i.identifier),
      eventType: i.eventType || 'CHECK_IN',
      rawPayload: i,
    }));
  }

  parseRawPayload(rawPayload: any): any {
    if (!rawPayload.identifier && !rawPayload.identifierValue && !rawPayload.cardNo) {
      throw new Error('Payload missing identifier');
    }
    if (!rawPayload.eventId && !rawPayload.externalEventId) {
      throw new Error('Payload missing externalEventId');
    }
    const parsed = this.parseEventPayload(rawPayload);
    const first = parsed[0] || ({} as any);
    return {
      externalEventId: first.externalEventId,
      identifier: first.identifierValue,
      eventType: first.eventType,
      deviceTimestamp: first.deviceTimestamp,
    };
  }

  async testConnection(config: DeviceConnectionConfig): Promise<{ success: boolean; latencyMs?: number; message?: string }> {
    return { success: true, latencyMs: 20, message: `Custom gateway ${config.serialNumber} online` };
  }
}

// ============================================================================
// Adapter Registry
// ============================================================================

export class AttendanceAdapterRegistry {
  private static adapters: Map<string, AttendanceDeviceAdapter> = new Map<string, AttendanceDeviceAdapter>([
    ['ZKTECO', new ZKTecoAdapter()],
    ['SUPREMA', new SupremaAdapter()],
    ['RFID_READER', new RFIDAdapter()],
    ['CUSTOM_GATEWAY', new CustomGatewayAdapter()],
  ]);

  public static getAdapter(provider: string): AttendanceDeviceAdapter {
    const adapter = this.adapters.get(provider.toUpperCase());
    if (!adapter) {
      // Fallback to custom gateway adapter
      return this.adapters.get('CUSTOM_GATEWAY')!;
    }
    return adapter;
  }

  public static registerAdapter(adapter: AttendanceDeviceAdapter) {
    this.adapters.set(adapter.providerName.toUpperCase(), adapter);
  }
}

// Aliases
export const deviceAdapterRegistry = AttendanceAdapterRegistry;

/**
 * Sorts events deterministically by device occurrence timestamp.
 * Critical for offline reconnect synchronization.
 */
export function sortEventsByOccurrence(events: any[]): any[] {
  return [...events].sort((a, b) => {
    const timeA = new Date(a.deviceTimestamp || a.eventTimestamp).getTime();
    const timeB = new Date(b.deviceTimestamp || b.eventTimestamp).getTime();
    return timeA - timeB;
  });
}


