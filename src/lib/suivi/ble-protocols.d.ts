export interface DecodedMeasurement {
  measurement_type: string;
  value_numeric: number;
  unit: string;
  measured_at: string | null;
}
export const OPTIONAL_GATT_SERVICES: string[];
export const STANDARD_GATT_CHARACTERISTICS: Record<string, { service: string; characteristic: string }>;
export function decodeSfloat(raw: number): number;
export function decodeFloat11073(data: DataView, offset: number): number;
export function decodeStandardGattMeasurement(serviceId: string, characteristicId: string, data: DataView, deviceId?: string): DecodedMeasurement[];
export function supportsNotifications(characteristic: { properties?: { notify?: boolean; indicate?: boolean } } | null | undefined): boolean;
