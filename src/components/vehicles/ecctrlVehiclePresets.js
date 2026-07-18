export const ECCTRL_CAR_CONFIG = {
  engineHorsepower: 600,
  engineMaxRPM: 6000,
  finalDriveRatio: 1,
  transmissionMode: "auto",
  shiftUpRPM: 5200,
  shiftDownRPM: 2200,
  shiftCooldown: 0.35,
  steerRate: Math.PI * 2,
  maxSteerAngle: Math.PI / 6,
  reverseTorqueScale: 1,
  reverseRPMScale: 0.5,
  engineTorqueCurveData: {
    points: [
      { x: 0, y: 1, r_out: 0 },
      { x: 1, y: 0, r_in: 0 },
    ],
    samples: 50,
  },
  steerAngleCurveData: {
    points: [
      { x: 0, y: 1, r_out: 0 },
      { x: 0.2, y: 1, r_in: 0, r_out: 0 },
      { x: 1, y: 0.4, r_in: 0 },
    ],
    samples: 50,
  },
};

export const ECCTRL_WHEEL_PROPS = {
  groundDetection: "shapeCast",
  rayShapeR: 0.5,
  rayShapeH: 0.15,
  rayLength: 0.5,
  springK: 38000,
  dampingC: 4000,
  maxBrakeTorque: 3000,
  rollingResistanceCoef: 0.007,
  lowVelThreshold: 0.4,
  tireGripFactor: 1.6,
  lngFrictionEllipseScale: 1,
  latFrictionEllipseScale: 1,
  relaxLngRate: 0.05,
  relaxLatRate: 0.1,
  minLngRelaxCoeff: 0.3,
  minLatRelaxCoeff: 0.3,
  lngSlipRatioCurveData: {
    points: [
      { x: 0, y: 0, r_out: 1.45 },
      { x: 0.25, y: 1, r_in: 0, r_out: 0 },
      { x: 1, y: 0.7, r_in: 0 },
    ],
    samples: 50,
  },
  latSlipRatioCurveData: {
    points: [
      { x: 0, y: 0, r_out: 1.45 },
      { x: 0.15, y: 1, r_in: 0, r_out: 0 },
      { x: 1, y: 0.9, r_in: 0 },
    ],
    samples: 50,
  },
  followPlatform: true,
  massRatioFallOffCurveData: {
    points: [
      { x: 0, y: 0.5, r_out: 0 },
      { x: 0.5, y: 1, r_in: 0, r_out: 0 },
      { x: 1, y: 1, r_in: 0 },
    ],
    samples: 50,
  },
  applyCounterMass: true,
  applyCounterFriction: true,
  showWheelModel: false,
  wheelModelDensity: 100,
  wheelModelUpdate: true,
  wheelModelRadius: 0.5,
  wheelModelLerpPosRate: 10,
  wheelModelReversRotation: false,
  debug: false,
  debuggerArrowScale: 0.02,
};

export const ECCTRL_DRONE_CONFIG = {
  controlMode: "VELOCITY",
  maxYawRate: 2,
  maxHorizSpeed: 20,
  maxVertSpeed: 8,
  maxTiltAngle: Math.PI / 4,
  airDragFactor: 0.2,
  TILT_P: 15,
  TILT_D: 3,
  YAW_P: 4,
  VERT_POS_P: 900,
  VERT_POS_D: 700,
  HORIZ_POS_P: 500,
  HORIZ_POS_D: 550,
  HORIZ_VEL_P: 1,
  VERT_VEL_P: 2,
};

export const ECCTRL_PROPELLER_PROPS = {
  maxThrust: 5000,
  torqueRatio: 0.6,
  showPropellerModel: false,
  propellerModelUpdate: true,
  propellerModelMaxSpin: 50,
  propellerModelLerpSpinRate: 10,
  debug: false,
  debuggerScale: 1,
  debuggerArrowScale: 5,
};

export const ECCTRL_VEHICLE_PRESETS = {
  longboard: { type: "car", wheelOffset: { x: 0.9, y: 0, z: 1.8 } },
  skateboard: { type: "car", wheelOffset: { x: 0.9, y: 0, z: 1.8 } },
  surfboard_lucid_sn1: { type: "drone", propellerOffset: { x: 1, y: -0.15, z: 1 } },
  arcadiaBoard: { type: "car", wheelOffset: { x: 0.9, y: 0, z: 1.8 } },
  goKart: { type: "car", wheelOffset: { x: 0.9, y: 0, z: 1.8 } },
  ufo: { type: "drone", propellerOffset: { x: 1, y: -0.15, z: 1 } },
};
