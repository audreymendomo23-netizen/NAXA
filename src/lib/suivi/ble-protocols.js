const MEASUREMENTS = {
  heart_rate: "frequence_cardiaque",
  blood_pressure: ["tension_systolique", "tension_diastolique", "tension_arterielle_moyenne"],
  temperature: "temperature",
  spo2: ["saturation_oxygene", "frequence_cardiaque"],
  glucose: "glycemie",
  weight: "poids",
  body_fat: "masse_grasse",
  respiratory_rate: "frequence_respiratoire",
  running_speed: ["vitesse_course", "cadence_course", "longueur_foulee"],
};

export const OPTIONAL_GATT_SERVICES = [
  "heart_rate", "blood_pressure", "health_thermometer", "pulse_oximeter",
  "glucose", "weight_scale", "body_composition", "respiratory_rate",
  "running_speed_cadence", "cycling_speed_cadence", "fitness_machine", "device_information",
  "battery_service"
];

export const STANDARD_GATT_CHARACTERISTICS = {
  heart_rate: { service: "heart_rate", characteristic: "heart_rate_measurement" },
  blood_pressure: { service: "blood_pressure", characteristic: "blood_pressure_measurement" },
  temperature: { service: "health_thermometer", characteristic: "temperature_measurement" },
  spo2: { service: "pulse_oximeter", characteristic: "plx_spot_check_measurement" },
  glucose: { service: "glucose", characteristic: "glucose_measurement" },
  weight: { service: "weight_scale", characteristic: "weight_measurement" },
  body_composition: { service: "body_composition", characteristic: "body_composition_measurement" },
  respiratory_rate: { service: "respiratory_rate", characteristic: "respiration_rate_measurement" },
  running_speed: { service: "running_speed_cadence", characteristic: "rsc_measurement" },
};

function requireBytes(data, length, label) {
  if (!(data instanceof DataView) || data.byteLength < length) throw new Error(label + ": payload too short");
}

export function decodeSfloat(raw) {
  const value = raw & 0xffff;
  if (value === 0x07ff || value === 0x0800 || value === 0x0801 || value === 0x0802 || value === 0x0803) {
    throw new Error("Bluetooth SFLOAT is not a finite measurement");
  }
  let mantissa = value & 0x0fff;
  if (mantissa & 0x0800) mantissa -= 0x1000;
  let exponent = (value >> 12) & 0x0f;
  if (exponent & 0x08) exponent -= 0x10;
  const decoded = mantissa * Math.pow(10, exponent);
  if (!Number.isFinite(decoded)) throw new Error("Invalid SFLOAT");
  return decoded;
}

export function decodeFloat11073(data, offset) {
  requireBytes(data, offset + 4, "IEEE-11073 FLOAT");
  const raw = data.getUint32(offset, true);
  let mantissa = raw & 0x00ffffff;
  if (mantissa & 0x00800000) mantissa -= 0x01000000;
  let exponent = (raw >>> 24) & 0xff;
  if (exponent & 0x80) exponent -= 0x100;
  const value = mantissa * Math.pow(10, exponent);
  if (!Number.isFinite(value)) throw new Error("Invalid IEEE-11073 FLOAT");
  return value;
}

function readDateTime(data, offset) {
  requireBytes(data, offset + 7, "Date Time");
  const year = data.getUint16(offset, true);
  const month = data.getUint8(offset + 2);
  const day = data.getUint8(offset + 3);
  const hour = data.getUint8(offset + 4);
  const minute = data.getUint8(offset + 5);
  const second = data.getUint8(offset + 6);
  if (year < 2000 || month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59) return null;
  const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function result(type, value, unit, measuredAt = null) {
  if (!Number.isFinite(value)) return [];
  return [{ measurement_type: type, value_numeric: Number(value.toFixed(4)), unit, measured_at: measuredAt }];
}

function parseHeartRate(data) {
  requireBytes(data, 2, "Heart Rate");
  const flags = data.getUint8(0);
  const bpm = flags & 1 ? (requireBytes(data, 3, "Heart Rate 16-bit"), data.getUint16(1, true)) : data.getUint8(1);
  if (bpm <= 0 || bpm > 300) throw new Error("Heart rate out of supported range");
  return result("frequence_cardiaque", bpm, "bpm");
}

function parseBloodPressure(data) {
  requireBytes(data, 7, "Blood Pressure");
  const flags = data.getUint8(0);
  const unit = flags & 1 ? "kPa" : "mmHg";
  const multiplier = flags & 1 ? 7.50062 : 1;
  let offset = 1;
  const systolic = decodeSfloat(data.getUint16(offset, true)) * multiplier; offset += 2;
  const diastolic = decodeSfloat(data.getUint16(offset, true)) * multiplier; offset += 2;
  const mean = decodeSfloat(data.getUint16(offset, true)) * multiplier; offset += 2;
  let measuredAt = null;
  if (flags & 2) { measuredAt = readDateTime(data, offset); offset += 7; }
  if (flags & 4) { requireBytes(data, offset + 2, "Blood Pressure pulse rate"); offset += 2; }
  if (flags & 8) { requireBytes(data, offset + 1, "Blood Pressure user id"); offset += 1; }
  if (flags & 16) { requireBytes(data, offset + 2, "Blood Pressure measurement status"); offset += 2; }
  if (![systolic, diastolic, mean].every(v => Number.isFinite(v) && v > 0 && v < 400)) throw new Error("Invalid blood pressure values");
  return [
    ...result("tension_systolique", systolic, "mmHg", measuredAt),
    ...result("tension_diastolique", diastolic, "mmHg", measuredAt),
    ...result("tension_arterielle_moyenne", mean, "mmHg", measuredAt),
  ];
}

function parseTemperature(data) {
  requireBytes(data, 5, "Temperature");
  const flags = data.getUint8(0);
  let measuredAt = null;
  let offset = 1;
  if (flags & 2) { measuredAt = readDateTime(data, offset); offset += 7; }
  const raw = decodeFloat11073(data, offset);
  const celsius = flags & 1 ? (raw - 32) * 5 / 9 : raw;
  if (celsius < 20 || celsius > 50) throw new Error("Temperature outside supported range");
  return result("temperature", celsius, "°C", measuredAt);
}

function parsePulseOximeter(data) {
  requireBytes(data, 5, "Pulse Oximeter");
  const flags = data.getUint8(0);
  let offset = 1;
  const spo2 = decodeSfloat(data.getUint16(offset, true)); offset += 2;
  const pulse = decodeSfloat(data.getUint16(offset, true)); offset += 2;
  let measuredAt = null;
  if (flags & 1) { measuredAt = readDateTime(data, offset); offset += 7; }
  if (flags & 2) offset += 2;
  if (flags & 4) offset += 3;
  if (flags & 8) offset += 2;
  requireBytes(data, Math.min(offset, data.byteLength), "Pulse Oximeter");
  if (spo2 < 50 || spo2 > 100 || pulse < 0 || pulse > 300) throw new Error("Invalid pulse oximeter result");
  return [
    ...result("saturation_oxygene", spo2, "%", measuredAt),
    ...(pulse > 0 ? result("frequence_cardiaque", pulse, "bpm", measuredAt) : []),
  ];
}

function parseGlucose(data) {
  requireBytes(data, 10, "Glucose");
  const flags = data.getUint8(0);
  let offset = 3; // flags + sequence number
  const measuredAt = readDateTime(data, offset);
  offset += 7;
  if (flags & 1) offset += 2; // optional time offset
  if (!(flags & 2)) throw new Error("Glucose concentration missing from packet");
  requireBytes(data, offset + 3, "Glucose concentration/type");
  const unit = flags & 4 ? "mol/L" : "kg/L";
  const concentration = decodeSfloat(data.getUint16(offset, true));
  offset += 2;
  offset += 1; // type and sample location
  if (flags & 8) offset += 2; // sensor status annunciation
  if (!Number.isFinite(concentration) || concentration <= 0) throw new Error("Invalid glucose concentration");
  const unit = flags & 4 ? "mol/L" : "kg/L";
  return result("glycemie", concentration, unit, measuredAt);
}

function parseWeight(data) {
  requireBytes(data, 3, "Weight Scale");
  const flags = data.getUint8(0);
  let offset = 1;
  let weight = decodeSfloat(data.getUint16(offset, true)); offset += 2;
  if (flags & 1) weight *= 0.45359237; // imperial pounds to kg
  let measuredAt = null;
  if (flags & 2) { measuredAt = readDateTime(data, offset); offset += 7; }
  if (flags & 4) offset += 1; // user id
  const values = result("poids", weight, "kg", measuredAt);
  if (flags & 8) {
    requireBytes(data, offset + 4, "Weight Scale BMI/height");
    const bmi = decodeSfloat(data.getUint16(offset, true)); offset += 2;
    const height = decodeSfloat(data.getUint16(offset, true));
    if (bmi > 0 && bmi < 100) values.push({ measurement_type: "imc", value_numeric: Number(bmi.toFixed(4)), unit: "kg/m²", measured_at: measuredAt });
    if (height > 0 && height < 3) values.push({ measurement_type: "taille", value_numeric: Number((height * 100).toFixed(2)), unit: "cm", measured_at: measuredAt });
  }
  if (!(weight > 0 && weight < 500)) throw new Error("Invalid weight");
  return values;
}

function parseBodyComposition(data) {
  requireBytes(data, 4, "Body Composition");
  const flags = data.getUint16(0, true);
  if (flags & 0x1000) throw new Error("Fragmented Body Composition packets require a complete multi-packet decoder");
  const imperial = !!(flags & 1);
  let offset = 2;
  let measuredAt = null;
  if (flags & 2) { measuredAt = readDateTime(data, offset); offset += 7; }
  if (flags & 4) offset += 1;
  if (flags & 8) offset += 2; // basal metabolism: not currently in the client catalogue
  const values = [];
  const add = (type, value, unit, min, max) => {
    if (Number.isFinite(value) && value >= min && value <= max) {
      values.push({ measurement_type: type, value_numeric: Number(value.toFixed(4)), unit, measured_at: measuredAt });
    }
  };
  const readU16 = (label) => {
    requireBytes(data, offset + 2, label);
    const raw = data.getUint16(offset, true);
    offset += 2;
    return raw;
  };
  if (flags & 16) add("pourcentage_musculaire", readU16("Muscle percentage") / 10, "%", 0, 100);
  const mass = () => {
    const raw = readU16("Body mass");
    return imperial ? raw * 0.01 * 0.45359237 : raw * 0.005;
  };
  if (flags & 32) add("masse_musculaire", mass(), "kg", 0, 300);
  if (flags & 64) add("masse_maigre", mass(), "kg", 0, 300);
  if (flags & 128) add("masse_maigre_molle", mass(), "kg", 0, 300);
  if (flags & 256) add("masse_eau_corporelle", mass(), "kg", 0, 300);
  if (flags & 512) readU16("Impedance"); // ohms: retained in raw device diagnostics, not a patient measure.
  if (flags & 1024) add("poids", mass(), "kg", 0, 500);
  if (flags & 2048) {
    const raw = readU16("Height");
    const heightCm = imperial ? raw * 0.1 * 2.54 : raw * 0.001 * 100;
    add("taille", heightCm, "cm", 0, 300);
  }
  return values;
}
function parseRespiratoryRate(data) {
  requireBytes(data, 2, "Respiratory Rate");
  const value = decodeSfloat(data.getUint16(0, true));
  if (value <= 0 || value > 100) throw new Error("Invalid respiratory rate");
  return result("frequence_respiratoire", value, "/min");
}

function parseRunningSpeedCadence(data) {
  requireBytes(data, 4, "Running Speed and Cadence");
  const flags = data.getUint8(0);
  const speed = data.getUint16(1, true) / 256;
  const cadence = data.getUint8(3);
  let offset = 4;
  if (flags & 1) offset += 2;
  if (flags & 2) offset += 4;
  const values = [];
  if (speed >= 0 && speed <= 25) values.push({ measurement_type:"vitesse_course", value_numeric:Number(speed.toFixed(3)), unit:"m/s", measured_at:null });
  if (cadence <= 250) values.push({ measurement_type:"cadence_course", value_numeric:cadence, unit:"pas/min", measured_at:null });
  if (flags & 1 && data.byteLength >= 6) {
    const stride = data.getUint16(4, true);
    if (stride <= 300) values.push({ measurement_type:"longueur_foulee", value_numeric:stride, unit:"cm", measured_at:null });
  }
  return values;
}

export function decodeStandardGattMeasurement(serviceId, characteristicId, data) {
  const service = String(serviceId || "").toLowerCase().replace(/^0x/, "");
  const characteristic = String(characteristicId || "").toLowerCase().replace(/^0x/, "");
  if (service === "180d" || service === "heart_rate") if (characteristic === "2a37" || characteristic === "heart_rate_measurement") return parseHeartRate(data);
  if (service === "1810" || service === "blood_pressure") if (characteristic === "2a35" || characteristic === "blood_pressure_measurement") return parseBloodPressure(data);
  if (service === "1809" || service === "health_thermometer") if (characteristic === "2a1c" || characteristic === "temperature_measurement") return parseTemperature(data);
  if (service === "1822" || service === "pulse_oximeter") if (characteristic === "2a5e" || characteristic === "plx_spot_check_measurement" || characteristic === "2a5f" || characteristic === "plx_continuous_measurement") return parsePulseOximeter(data);
  if (service === "1808" || service === "glucose") if (characteristic === "2a18" || characteristic === "glucose_measurement") return parseGlucose(data);
  if ((service === "1826" || service === "fitness_machine" || service === "181d" || service === "respiratory_rate") && (characteristic === "2aab" || characteristic === "respiration_rate_measurement")) return parseRespiratoryRate(data);
  if (service === "1814" || service === "running_speed_cadence") if (characteristic === "2a53" || characteristic === "rsc_measurement") return parseRunningSpeedCadence(data);
  if (service === "181b" || service === "body_composition") if (characteristic === "2a9c" || characteristic === "body_composition_measurement") return parseBodyComposition(data);
  if (service === "181d" || service === "weight_scale") if (characteristic === "2a9d" || characteristic === "weight_measurement") return parseWeight(data);
  throw new Error("No verified decoder for GATT " + service + "/" + characteristic);
}

export function supportsNotifications(characteristic) {
  return !!(characteristic && characteristic.properties && (characteristic.properties.notify || characteristic.properties.indicate));
}
