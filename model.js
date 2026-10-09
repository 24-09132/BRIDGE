/*
 * FLOOD-SENTINEL – shared flood probability model
 * The SAME coefficients and thresholds are used in:
 *   - BRIDGE.ino (ESP32 firmware)
 *   - FLOOD-SENTINEL_Data.xlsx ("Model" sheet)
 *   - this website (live view + simulation)
 * If you change a value here, change it in the other two as well.
 */
const FS_MODEL = {
  b0: -3.9822,      // intercept
  bRain: 0.2208,    // per mm of rainfall collected
  bPook: 0.7994,    // per cm of Pook-side water level
  bBay: 1.2461,     // per cm of Bay-connected river water level

  // Road condition thresholds on flood probability (%)
  tRestricted: 10,
  tMoreRestricted: 50,
  tImpassable: 75,
};

const FS_CLASSES = [
  { name: 'Passable',        sms: 'PASSABLE',          led: 'green',  color: '#22c55e' },
  { name: 'Restricted',      sms: 'RESTRICTED',        led: 'blue',   color: '#3b82f6' },
  { name: 'More Restricted', sms: 'HIGHLY RESTRICTED', led: 'yellow', color: '#eab308' },
  { name: 'Impassable',      sms: 'IMPASSABLE',        led: 'red',    color: '#ef4444' },
];

const FS_SMS_TEXTS = [
  'FLOOD-SENTINEL UPDATE: ROAD PASSABLE.\nWater-level conditions have returned to normal. All vehicles may pass. Please continue to exercise caution and follow official instructions from local authorities.',
  'FLOOD-SENTINEL WARNING: ROAD RESTRICTED.\nTwo-wheel vehicles are NOT ADVISED TO PASS due to monitored water-level conditions. Please exercise caution and follow official instructions from local authorities.',
  'FLOOD-SENTINEL WARNING: ROAD HIGHLY RESTRICTED.\nThree-wheel and four-wheel vehicles are NOT ADVISED TO PASS due to elevated or hazardous water-level conditions. Please avoid unnecessary travel, exercise extreme caution, and follow official instructions from local authorities.',
  'FLOOD-SENTINEL CRITICAL WARNING: ROAD IMPASSABLE.\nNO VEHICLES ARE ALLOWED TO PASS due to critical water-level conditions. DO NOT ATTEMPT TO CROSS. Follow official warnings and instructions from local authorities.',
];

// Trial results (paper Figure 2). paperProb = value printed in the paper.
const FS_TRIAL = [
  { time: '06:00', rain: 0.3,  pook: 0.0, bay: 0.1, obs: 0, paperProb: 2.2 },
  { time: '07:00', rain: 1.1,  pook: 0.3, bay: 0.2, obs: 0, paperProb: 3.7 },
  { time: '08:00', rain: 3.0,  pook: 0.5, bay: 0.3, obs: 0, paperProb: 7.3 },
  { time: '09:00', rain: 4.4,  pook: 0.8, bay: 0.4, obs: 0, paperProb: 13.3 },
  { time: '10:00', rain: 4.6,  pook: 0.9, bay: 0.5, obs: 0, paperProb: 16.5 },
  { time: '11:00', rain: 5.3,  pook: 0.8, bay: 0.6, obs: 0, paperProb: 19.4 },
  { time: '12:00', rain: 7.3,  pook: 0.9, bay: 0.7, obs: 1, paperProb: 31.5 },
  { time: '13:00', rain: 9.0,  pook: 1.4, bay: 0.8, obs: 0, paperProb: 53.0 },
  { time: '14:00', rain: 9.5,  pook: 1.3, bay: 1.0, obs: 0, paperProb: 59.9 },
  { time: '15:00', rain: 9.6,  pook: 1.5, bay: 1.1, obs: 1, paperProb: 67.0 },
  { time: '16:00', rain: 10.6, pook: 1.5, bay: 1.1, obs: 0, paperProb: 71.7 },
  { time: '09:30', rain: 11.6, pook: 1.8, bay: 1.3, obs: 1, paperProb: 83.7 },
];

function fsLogit(rain, pook, bay) {
  return FS_MODEL.b0 + FS_MODEL.bRain * rain + FS_MODEL.bPook * pook + FS_MODEL.bBay * bay;
}

function fsProbability(rain, pook, bay) {
  return 100 / (1 + Math.exp(-fsLogit(rain, pook, bay)));
}

function fsClassIndex(prob) {
  if (prob >= FS_MODEL.tImpassable) return 3;
  if (prob >= FS_MODEL.tMoreRestricted) return 2;
  if (prob >= FS_MODEL.tRestricted) return 1;
  return 0;
}

if (typeof module !== 'undefined') {
  module.exports = { FS_MODEL, FS_CLASSES, FS_SMS_TEXTS, FS_TRIAL, fsLogit, fsProbability, fsClassIndex };
}
