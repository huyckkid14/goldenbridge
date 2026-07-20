import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const canvas = document.querySelector("#scene");
const statusEl = document.querySelector("#status");
const hintEl = document.querySelector("#hint");
const cockpitEl = document.querySelector("#driverCockpit");
const driveHelpEl = document.querySelector("#driveHelp");
const driveCameraButton = document.querySelector("#driveCameraButton");
const ambulanceButton = document.querySelector("#ambulanceButton");
const centerLaneButton = document.querySelector("#centerLaneButton");
const soundButton = document.querySelector("#soundControls button");
const steeringWheelEl = document.querySelector(".wheel");
const fpsOverlay = document.querySelector("#fpsOverlay");

const scene = new THREE.Scene();
const clock = new THREE.Clock();
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.35));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.BasicShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const camera = new THREE.PerspectiveCamera(
  58,
  window.innerWidth / window.innerHeight,
  0.1,
  1600,
);
camera.position.set(120, 72, 150);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 18, 0);
controls.minDistance = 42;
controls.maxDistance = 360;
controls.maxPolarAngle = Math.PI * 0.49;

const root = new THREE.Group();
scene.add(root);

const state = {
  pov: "normal",
  setting: "summer",
  cars: [],
  lanes: [],
  trafficSpeed: 1,
  fps: {
    frames: 0,
    lastUpdate: performance.now(),
  },
  audio: {
    enabled: false,
    context: null,
    master: null,
    engine: null,
    engineGain: null,
    roadNoise: null,
    roadGain: null,
    wind: null,
    windGain: null,
    siren: null,
    sirenGain: null,
  },
  snow: null,
  leaves: null,
  fogBank: [],
  trees: [],
  lamps: [],
  bridgeLights: [],
  water: null,
  landNorth: null,
  landSouth: null,
  sun: null,
  moon: null,
  ambient: null,
  hemi: null,
  driverCar: null,
  drive: {
    keys: new Set(),
    collisionCooldown: new Map(),
    camera: "dash",
    ambulance: false,
    signal: null,
    cruise: {
      active: false,
      adaptive: false,
      speed: 0,
    },
  },
};

const mats = {
  bridge: new THREE.MeshStandardMaterial({
    color: 0xb24124,
    roughness: 0.5,
    metalness: 0.2,
  }),
  bridgeDark: new THREE.MeshStandardMaterial({
    color: 0x7d2e1e,
    roughness: 0.55,
    metalness: 0.25,
  }),
  cable: new THREE.MeshStandardMaterial({
    color: 0xd5774f,
    roughness: 0.35,
    metalness: 0.35,
  }),
  road: new THREE.MeshStandardMaterial({ color: 0x25282a, roughness: 0.78 }),
  lane: new THREE.MeshStandardMaterial({
    color: 0xf3e8c2,
    roughness: 0.45,
    emissive: 0x1b1306,
    emissiveIntensity: 0.08,
  }),
  divider: new THREE.MeshStandardMaterial({
    color: 0xf28b24,
    roughness: 0.38,
    emissive: 0x6e2c08,
    emissiveIntensity: 0.16,
  }),
  water: new THREE.MeshStandardMaterial({
    color: 0x1d6d8d,
    roughness: 0.24,
    metalness: 0.02,
  }),
  land: new THREE.MeshStandardMaterial({ color: 0x2f704b, roughness: 0.86 }),
  cliff: new THREE.MeshStandardMaterial({ color: 0x7d7568, roughness: 0.92 }),
  asphalt: new THREE.MeshStandardMaterial({ color: 0x1f2224, roughness: 0.8 }),
  black: new THREE.MeshStandardMaterial({ color: 0x08090a, roughness: 0.55 }),
  glass: new THREE.MeshStandardMaterial({
    color: 0x8ed6f4,
    roughness: 0.05,
    metalness: 0.04,
    transparent: true,
    opacity: 0.72,
  }),
  white: new THREE.MeshStandardMaterial({ color: 0xf7f2e2, roughness: 0.45 }),
  trunk: new THREE.MeshStandardMaterial({ color: 0x6a3f2b, roughness: 0.82 }),
};

function makeMesh(geometry, material, position, castShadow = true, receiveShadow = true) {
  const item = new THREE.Mesh(geometry, material);
  item.position.copy(position);
  item.castShadow = castShadow;
  item.receiveShadow = receiveShadow;
  return item;
}

function addLights() {
  state.ambient = new THREE.AmbientLight(0xffffff, 0.5);
  state.hemi = new THREE.HemisphereLight(0xbbe6ff, 0x2f513d, 0.74);
  state.sun = new THREE.DirectionalLight(0xffffff, 2.25);
  state.sun.position.set(-120, 170, 95);
  state.sun.castShadow = true;
  state.sun.shadow.mapSize.set(1024, 1024);
  state.sun.shadow.camera.left = -260;
  state.sun.shadow.camera.right = 260;
  state.sun.shadow.camera.top = 220;
  state.sun.shadow.camera.bottom = -220;
  state.sun.shadow.camera.far = 460;

  state.moon = new THREE.DirectionalLight(0xb6cbff, 0);
  state.moon.position.set(90, 130, -110);
  scene.add(state.ambient, state.hemi, state.sun, state.moon);
}

function createWorld() {
  const water = makeMesh(
    new THREE.PlaneGeometry(620, 460, 1, 1),
    mats.water,
    new THREE.Vector3(0, -0.35, 0),
    false,
    true,
  );
  water.rotation.x = -Math.PI / 2;
  state.water = water;
  root.add(water);

  state.landSouth = createLandMass(-178, 52, 125, 230, 0.06);
  state.landNorth = createLandMass(178, -58, 126, 238, -0.08);
  root.add(state.landSouth, state.landNorth);

  createHeadland(-180, -75, 70, 90, 16);
  createHeadland(178, 72, 76, 96, 20);
  createApproachRoad(-220, 15, 95, -0.22);
  createApproachRoad(220, -14, 95, -0.22);
  createCitySkyline();
  createTrees();
  createFog();
  createWeather();
}

function createLandMass(x, z, width, depth, rotation) {
  const group = new THREE.Group();
  const land = makeMesh(
    new THREE.BoxGeometry(width, 8, depth),
    mats.land,
    new THREE.Vector3(0, 0, 0),
    false,
    true,
  );
  const cliff = makeMesh(
    new THREE.BoxGeometry(width + 7, 15, 20),
    mats.cliff,
    new THREE.Vector3(0, -4, -depth / 2 + 5),
    false,
    true,
  );
  group.add(land, cliff);
  group.position.set(x, 0, z);
  group.rotation.y = rotation;
  return group;
}

function createHeadland(x, z, width, depth, height) {
  const headland = makeMesh(
    new THREE.CylinderGeometry(width * 0.56, width * 0.72, height, 8),
    mats.cliff,
    new THREE.Vector3(x, height / 2 - 3, z),
    false,
    true,
  );
  headland.scale.z = depth / width;
  headland.rotation.y = Math.PI / 8;
  root.add(headland);
}

function createApproachRoad(x, z, length, rotation) {
  const road = makeMesh(
    new THREE.BoxGeometry(length, 0.38, 20),
    mats.asphalt,
    new THREE.Vector3(x, 4.35, z),
    false,
    true,
  );
  road.rotation.y = rotation;
  root.add(road);
}

function createCitySkyline() {
  const city = new THREE.Group();
  const rng = [
    [-58, 14, 16], [-43, 28, 13], [-28, 20, 18], [-10, 38, 14], [10, 24, 20],
    [29, 32, 15], [48, 18, 17], [66, 26, 14],
  ];
  rng.forEach(([x, h, d], i) => {
    const material = new THREE.MeshStandardMaterial({
      color: i % 2 ? 0xb7c1c8 : 0xd0d5d8,
      roughness: 0.72,
    });
    const building = makeMesh(
      new THREE.BoxGeometry(12 + (i % 3) * 4, h, d),
      material,
      new THREE.Vector3(x, h / 2, 0),
      true,
      true,
    );
    city.add(building);
  });
  city.position.set(-196, 6, 118);
  city.rotation.y = -0.24;
  root.add(city);
}

function createBridge() {
  const bridge = new THREE.Group();
  const deckY = 18;
  const deckLength = 360;
  const deckWidth = 34;

  const deck = makeMesh(
    new THREE.BoxGeometry(deckLength, 4.8, deckWidth),
    mats.road,
    new THREE.Vector3(0, deckY, 0),
    true,
    true,
  );
  bridge.add(deck);

  const underTruss = makeMesh(
    new THREE.BoxGeometry(deckLength, 8, 5),
    mats.bridgeDark,
    new THREE.Vector3(0, deckY - 7, 0),
  );
  bridge.add(underTruss);

  for (let z of [-18.5, 18.5]) {
    const rail = makeMesh(
      new THREE.BoxGeometry(deckLength + 6, 4.2, 2.1),
      mats.bridge,
      new THREE.Vector3(0, deckY + 4.2, z),
    );
    bridge.add(rail);
  }

  for (let x = -170; x <= 170; x += 17) {
    const cross = makeMesh(
      new THREE.BoxGeometry(1.25, 4.2, deckWidth + 5),
      mats.bridgeDark,
      new THREE.Vector3(x, deckY - 0.7, 0),
    );
    bridge.add(cross);
  }

  for (let z of [-7.4, 7.4]) {
    for (let x = -170; x <= 170; x += 17) {
      const lane = makeMesh(
        new THREE.BoxGeometry(8.5, 0.08, 0.42),
        mats.lane,
        new THREE.Vector3(x, deckY + 2.48, z),
        false,
        false,
      );
      bridge.add(lane);
    }
  }

  const divider = makeMesh(
    new THREE.BoxGeometry(deckLength - 18, 0.1, 0.7),
    mats.divider,
    new THREE.Vector3(0, deckY + 2.52, 0),
    false,
    false,
  );
  bridge.add(divider);

  [-92, 92].forEach((x) => createTower(bridge, x, deckY));
  createSuspension(bridge, deckY);
  createBridgeLights(bridge, deckY);
  root.add(bridge);
}

function createTower(parent, x, deckY) {
  const tower = new THREE.Group();
  const legGeo = new THREE.BoxGeometry(7.5, 95, 7.5);
  [-23, 23].forEach((z) => {
    const leg = makeMesh(legGeo, mats.bridge, new THREE.Vector3(0, 45, z));
    tower.add(leg);
  });

  [24, 48, 73, 92].forEach((y) => {
    const beam = makeMesh(
      new THREE.BoxGeometry(12, 4.4, 55),
      mats.bridgeDark,
      new THREE.Vector3(0, y, 0),
    );
    tower.add(beam);
  });

  [-23, 23].forEach((z) => {
    const cap = makeMesh(
      new THREE.BoxGeometry(10.5, 5.8, 10.5),
      mats.bridge,
      new THREE.Vector3(0, 96, z),
    );
    tower.add(cap);
  });

  const base = makeMesh(
    new THREE.BoxGeometry(24, 10, 62),
    mats.bridgeDark,
    new THREE.Vector3(0, -4, 0),
    true,
    true,
  );
  tower.add(base);
  tower.position.set(x, deckY - 7, 0);
  parent.add(tower);
}

function createSuspension(parent, deckY) {
  [-16.5, 16.5].forEach((z) => {
    const mainPoints = [];
    for (let i = 0; i <= 80; i += 1) {
      const x = -190 + (380 * i) / 80;
      const towerDistance = Math.min(Math.abs(x - 92), Math.abs(x + 92));
      const arch = 88 - Math.min(towerDistance * 0.32, 46);
      mainPoints.push(new THREE.Vector3(x, deckY + arch, z));
    }
    const curve = new THREE.CatmullRomCurve3(mainPoints);
    parent.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 180, 0.72, 12), mats.cable));

    for (let x = -176; x <= 176; x += 8) {
      const t = (x + 190) / 380;
      const top = curve.getPointAt(THREE.MathUtils.clamp(t, 0, 1));
      const drop = new THREE.CurvePath();
      drop.add(
        new THREE.LineCurve3(
          new THREE.Vector3(x, deckY + 6.2, z),
          new THREE.Vector3(x, top.y, z),
        ),
      );
      parent.add(new THREE.Mesh(new THREE.TubeGeometry(drop, 2, 0.16, 8), mats.cable));
    }
  });
}

function createBridgeLights(parent, deckY) {
  for (let x = -172; x <= 172; x += 20) {
    [-20.3, 20.3].forEach((z) => {
      const post = makeMesh(
        new THREE.CylinderGeometry(0.18, 0.22, 5.6, 8),
        mats.black,
        new THREE.Vector3(x, deckY + 5.8, z),
      );
      const bulb = makeMesh(
        new THREE.SphereGeometry(0.6, 14, 10),
        mats.white,
        new THREE.Vector3(x, deckY + 8.9, z),
      );
      const light = new THREE.PointLight(0xffd9a0, 0.08, 34, 2);
      light.position.set(x, deckY + 8.9, z);
      state.bridgeLights.push(light);
      parent.add(post, bulb, light);
    });
  }
}

function createTraffic() {
  const colors = [0xc73b2a, 0x1c78c0, 0xf0c84b, 0xf5f1e8, 0x111315, 0x2e9b63];
  const laneData = [
    { z: -11, dir: -1, offset: 0, speed: 0.058 },
    { z: -4.5, dir: -1, offset: 0.5, speed: 0.05 },
    { z: 4.5, dir: 1, offset: 0.08, speed: 0.054 },
    { z: 11, dir: 1, offset: 0.58, speed: 0.061 },
  ];

  laneData.forEach((lane, laneIndex) => {
    const laneCars = [];
    for (let i = 0; i < 7; i += 1) {
      const car = createCar(colors[(i + laneIndex) % colors.length], i % 5 === 0);
      const progress = (i / 7 + lane.offset) % 1;
      car.userData = {
        lane: laneIndex,
        progress,
        dir: lane.dir,
        z: lane.z,
        currentZ: lane.z,
        speed: lane.speed,
        baseSpeed: lane.speed,
        targetSpeed: lane.speed,
        cooldown: THREE.MathUtils.randFloat(0.8, 2.6),
        changingLane: false,
        changeT: 0,
        laneChangeDuration: 3.25,
        intendedLane: null,
        targetLane: null,
        targetZ: lane.z,
        signalLights: car.userData.signalLights,
        frontSignalLights: car.userData.frontSignalLights,
        brakeLights: car.userData.brakeLights,
        bodyMaterial: car.userData.bodyMaterial,
        originalBodyColor: car.userData.originalBodyColor,
        ambulanceRig: car.userData.ambulanceRig,
        ambulanceLights: car.userData.ambulanceLights,
        isDriver: false,
        length: car.userData.length,
        mass: car.userData.mass,
        collisionHalfWidth: 1.96,
        collisionMinY: -0.4,
        collisionMaxY: truck ? 3.15 : 2.85,
        physicsXVelocity: 0,
        physicsY: 0,
        physicsYVelocity: 0,
        physicsZ: 0,
        physicsZVelocity: 0,
        spin: 0,
        spinVelocity: 0,
        pitch: 0,
        pitchVelocity: 0,
        roll: 0,
        rollVelocity: 0,
        crashedUntil: 0,
        crossedYellowForWreck: null,
        returnLaneAfterWreck: null,
        driveSteer: 0,
        steeringWheelAngle: 0,
        driveThrottle: 0,
        driveLateralVelocity: 0,
        driveHeading: null,
        braking: false,
      };
      updateCarPosition(car, 0);
      state.cars.push(car);
      laneCars.push(car);
      root.add(car);
    }
    state.lanes.push({
      id: laneIndex,
      cars: laneCars,
      dir: lane.dir,
      z: lane.z,
      speed: lane.speed,
      minGap: 1 / laneCars.length - 0.025,
    });
  });

  state.lanes.forEach((lane) => {
    lane.neighbor = state.lanes
      .filter((candidate) => candidate.dir === lane.dir && candidate.id !== lane.id)
      .sort((a, b) => Math.abs(a.z - lane.z) - Math.abs(b.z - lane.z))[0];
  });

  state.lanes.forEach((lane, laneIndex) => {
    const demoCar = lane.cars[(laneIndex * 2 + 1) % lane.cars.length];
    demoCar.userData.cooldown = 0.3 + laneIndex * 0.45;
  });

  state.driverCar = state.cars[5];
  state.driverCar.userData.isDriver = true;
}

function createCar(color, truck = false) {
  const group = new THREE.Group();
  group.userData.signalLights = [];
  group.userData.frontSignalLights = [];
  group.userData.brakeLights = [];
  const bodyMat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.36,
    metalness: 0.16,
  });
  const length = truck ? 9.8 : 6.2;
  group.userData.length = length;
  group.userData.mass = truck ? 1.85 : 1;
  group.userData.bodyMaterial = bodyMat;
  group.userData.originalBodyColor = color;
  const height = truck ? 2.6 : 1.65;
  const body = makeMesh(
    new THREE.BoxGeometry(3.2, height, length),
    bodyMat,
    new THREE.Vector3(0, 0.9, 0),
  );
  const cabin = makeMesh(
    new THREE.BoxGeometry(2.8, 1.35, truck ? 3.4 : 3.1),
    mats.glass,
    new THREE.Vector3(0, 2.15, truck ? -2.3 : -0.2),
  );
  group.add(body, cabin);

  if (truck) {
    group.add(
      makeMesh(
        new THREE.BoxGeometry(3.35, 2.8, 5.2),
        bodyMat,
        new THREE.Vector3(0, 1.7, 2.4),
      ),
    );
  }

  const ambulanceRig = new THREE.Group();
  const ambulanceWhite = new THREE.MeshStandardMaterial({ color: 0xf7f7f2, roughness: 0.38 });
  const ambulanceRed = new THREE.MeshStandardMaterial({ color: 0xd62424, roughness: 0.35 });
  const redLight = new THREE.MeshStandardMaterial({
    color: 0xff2424,
    emissive: 0xff1010,
    emissiveIntensity: 0.25,
  });
  const blueLight = new THREE.MeshStandardMaterial({
    color: 0x2570ff,
    emissive: 0x1555ff,
    emissiveIntensity: 0.25,
  });
  ambulanceRig.add(
    makeMesh(
      new THREE.BoxGeometry(3.38, 2.55, length * 0.58),
      ambulanceWhite,
      new THREE.Vector3(0, 2.05, length * 0.08),
    ),
    makeMesh(
      new THREE.BoxGeometry(3.48, 0.42, length * 0.63),
      ambulanceRed,
      new THREE.Vector3(0, 1.55, length * 0.08),
    ),
    makeMesh(new THREE.BoxGeometry(1.25, 0.34, 0.7), redLight, new THREE.Vector3(-0.72, 3.55, -0.7)),
    makeMesh(new THREE.BoxGeometry(1.25, 0.34, 0.7), blueLight, new THREE.Vector3(0.72, 3.55, -0.7)),
  );
  ambulanceRig.visible = false;
  group.userData.ambulanceRig = ambulanceRig;
  group.userData.ambulanceLights = { red: redLight, blue: blueLight };
  group.add(ambulanceRig);

  const wheelGeo = new THREE.CylinderGeometry(0.62, 0.62, 0.42, 16);
  [-length * 0.31, length * 0.31].forEach((z) => {
    [-1.75, 1.75].forEach((x) => {
      const wheel = makeMesh(wheelGeo, mats.black, new THREE.Vector3(x, 0.22, z));
      wheel.rotation.x = Math.PI / 2;
      group.add(wheel);
    });
  });

  const headlightMat = new THREE.MeshStandardMaterial({
    color: 0xfff4c0,
    emissive: 0xffd18a,
    emissiveIntensity: 0.5,
  });
  const makeTailLight = (side) => {
    const material = new THREE.MeshStandardMaterial({
      color: 0xff0000,
      emissive: 0xff0000,
      emissiveIntensity: 0.35,
    });
    const light = makeMesh(
      new THREE.BoxGeometry(0.7, 0.38, 0.22),
      material,
      new THREE.Vector3(side === "left" ? -0.9 : 0.9, 1, -length / 2 - 0.04),
      false,
      false,
    );
    group.userData.signalLights.push({ side, material });
    return light;
  };
  group.add(makeMesh(new THREE.BoxGeometry(0.75, 0.42, 0.22), headlightMat, new THREE.Vector3(-0.9, 1.05, length / 2 + 0.04)));
  group.add(makeMesh(new THREE.BoxGeometry(0.75, 0.42, 0.22), headlightMat, new THREE.Vector3(0.9, 1.05, length / 2 + 0.04)));
  ["left", "right"].forEach((side) => {
    const material = new THREE.MeshBasicMaterial({
      color: 0x4d2100,
      toneMapped: false,
    });
    group.userData.frontSignalLights.push({ side, material });
    group.add(makeMesh(
      new THREE.BoxGeometry(0.34, 0.42, 0.24),
      material,
      new THREE.Vector3(side === "left" ? -1.38 : 1.38, 1.04, length / 2 + 0.06),
      false,
      false,
    ));
  });
  group.add(makeTailLight("left"));
  group.add(makeTailLight("right"));
  [-0.34, 0.34].forEach((x) => {
    const brakeMaterial = new THREE.MeshBasicMaterial({
      color: 0x660000,
      toneMapped: false,
    });
    group.userData.brakeLights.push(brakeMaterial);
    group.add(makeMesh(
      new THREE.BoxGeometry(0.48, 0.4, 0.24),
      brakeMaterial,
      new THREE.Vector3(x, 1.02, -length / 2 - 0.06),
      false,
      false,
    ));
  });
  group.traverse((item) => {
    if (item.isMesh) {
      item.castShadow = false;
      item.receiveShadow = false;
    }
  });
  return group;
}

function trafficPoint(progress, laneZ) {
  const p = ((progress % 1) + 1) % 1;
  const bridgeLeft = -184;
  const bridgeRight = 184;
  const x = bridgeLeft + (bridgeRight - bridgeLeft) * p;
  return { x, y: 20.8, z: laneZ, heading: Math.PI / 2 };
}

function updateCarPosition(car, delta) {
  const data = car.userData;
  data.progress = (data.progress + delta * data.speed * state.trafficSpeed * data.dir) % 1;
  const laneZ = data.currentZ ?? data.z;
  const point = trafficPoint(data.progress, laneZ);
  car.position.set(point.x, point.y + (data.physicsY ?? 0), point.z + (data.physicsZ ?? 0));
  const laneHeading = data.dir === 1 ? point.heading : point.heading + Math.PI;
  car.rotation.y = (data.driveHeading ?? laneHeading) + (data.spin ?? 0);
  car.rotation.x = data.pitch ?? 0;
  car.rotation.z = data.roll ?? 0;
}

function setDriveMode(enabled) {
  const car = state.driverCar;
  releaseDriveInputs();
  state.drive.signal = null;
  state.drive.cruise.active = false;
  state.drive.cruise.adaptive = false;
  state.drive.cruise.speed = 0;
  if (enabled) {
    state.lanes.forEach((lane) => {
      lane.cars = lane.cars.filter((item) => item !== car);
    });
    car.userData.changingLane = false;
    car.userData.targetLane = null;
    car.userData.currentZ = car.position.z;
    car.userData.speed = Math.max(car.userData.speed, 0.035);
    car.userData.driveSteer = 0;
    car.userData.steeringWheelAngle = 0;
    car.userData.driveThrottle = 0;
    car.userData.driveHeading = car.rotation.y;
    return;
  }

  const data = car.userData;
  setAmbulanceMode(false);
  data.dir = Math.sin(data.driveHeading) >= 0 ? 1 : -1;
  const nearestLane = state.lanes
    .filter((lane) => lane.dir === data.dir)
    .sort((a, b) => Math.abs(a.z - data.currentZ) - Math.abs(b.z - data.currentZ))[0];
  data.lane = nearestLane.id;
  data.z = nearestLane.z;
  data.currentZ = nearestLane.z;
  data.baseSpeed = nearestLane.speed;
  data.targetSpeed = nearestLane.speed;
  data.physicsZ = 0;
  data.physicsXVelocity = 0;
  data.physicsZVelocity = 0;
  data.spin = 0;
  data.spinVelocity = 0;
  data.driveSteer = 0;
  data.steeringWheelAngle = 0;
  data.driveThrottle = 0;
  data.driveLateralVelocity = 0;
  data.driveHeading = null;
  steeringWheelEl.style.transform = "";
  if (!nearestLane.cars.includes(car)) nearestLane.cars.push(car);
}

function setAmbulanceMode(enabled) {
  const data = state.driverCar.userData;
  state.drive.ambulance = enabled;
  if (enabled) {
    const protectedLaneId = getAmbulanceLaneId();
    state.cars.forEach((car) => {
      const carData = car.userData;
      if (car !== state.driverCar) {
        carData.intendedLane = null;
        if (!carData.changingLane) carData.indicatorSide = null;
      }
      if (car === state.driverCar || !carData.changingLane) return;
      const movingIntoAmbulanceLane = carData.targetLane === protectedLaneId;
      const outsideLane = getOuterLane(carData.dir);
      const opposingMoveTowardDivider = carData.dir !== data.dir
        && carData.targetLane !== outsideLane.id;
      if (!movingIntoAmbulanceLane && !opposingMoveTowardDivider) return;
      state.lanes[carData.targetLane].cars = state.lanes[carData.targetLane].cars
        .filter((item) => item !== car);
      carData.changingLane = false;
      carData.targetLane = null;
      carData.currentZ = carData.z;
      carData.targetZ = carData.z;
      carData.indicatorSide = null;
      carData.cooldown = THREE.MathUtils.randFloat(1.2, 2.2);
    });
  } else {
    state.cars.forEach((car) => {
      const carData = car.userData;
      carData.ambulanceYielding = false;
      if (!carData.changingLane) carData.indicatorSide = null;
    });
  }
  data.bodyMaterial.color.setHex(enabled ? 0xffffff : data.originalBodyColor);
  data.ambulanceRig.visible = enabled;
  ambulanceButton.textContent = enabled ? "Ambulance: ON" : "Ambulance: Off";
  ambulanceButton.classList.toggle("emergency-active", enabled);
  if (enabled) {
    setSoundEnabled(true);
    soundButton.classList.add("active");
    soundButton.textContent = "Sound On";
  }
}

function getAdaptiveCruiseTargetSpeed(player, setSpeed) {
  const data = player.userData;
  const forwardX = Math.sin(data.driveHeading);
  const forwardZ = Math.cos(data.driveHeading);
  const sideX = forwardZ;
  const sideZ = -forwardX;
  let nearestDistance = Infinity;
  let leadSpeed = setSpeed;

  state.cars.forEach((car) => {
    if (car === player) return;
    const carHeading = car.userData.driveHeading ?? car.rotation.y;
    const sameDirection = Math.cos(carHeading - data.driveHeading) > 0.35;
    if (!sameDirection) return;

    const dx = car.position.x - player.position.x;
    const dz = car.position.z - player.position.z;
    const distanceAhead = dx * forwardX + dz * forwardZ;
    const lateralDistance = Math.abs(dx * sideX + dz * sideZ);
    if (distanceAhead <= 0 || distanceAhead > 125 || lateralDistance > 4.6) return;
    if (distanceAhead < nearestDistance) {
      nearestDistance = distanceAhead;
      leadSpeed = Math.max(car.userData.speed ?? 0, 0);
    }
  });

  if (!Number.isFinite(nearestDistance)) return setSpeed;
  const speedMph = data.speed * 760;
  const desiredGap = 12 + speedMph * 0.72;
  const clearGap = desiredGap + 25;
  if (nearestDistance >= clearGap) return setSpeed;

  const gapBlend = THREE.MathUtils.smoothstep(nearestDistance, 7, clearGap);
  const followSpeed = nearestDistance < 8 ? 0 : leadSpeed;
  return Math.min(setSpeed, THREE.MathUtils.lerp(followSpeed, setSpeed, gapBlend));
}

function updatePlayerDriving(delta) {
  if (state.pov !== "drive") return;

  const data = state.driverCar.userData;
  const keys = state.drive.keys;
  const accelerating = keys.has("KeyW") || keys.has("ArrowUp");
  const braking = keys.has("KeyS") || keys.has("ArrowDown");
  const targetSteer = Number(keys.has("KeyD") || keys.has("ArrowRight"))
    - Number(keys.has("KeyA") || keys.has("ArrowLeft"));
  data.braking = braking;

  if (braking && state.drive.cruise.active) {
    state.drive.cruise.active = false;
    state.drive.cruise.adaptive = false;
  }
  const throttleTarget = (accelerating || state.drive.cruise.active) && !braking ? 1 : 0;
  data.driveThrottle = throttleTarget === 0
    ? 0
    : THREE.MathUtils.lerp(
      data.driveThrottle,
      throttleTarget,
      1 - Math.exp(-delta * 4.5),
    );
  data.driveSteer = THREE.MathUtils.lerp(
    data.driveSteer,
    targetSteer,
    1 - Math.exp(-delta * (targetSteer === 0 ? 8.5 : 5.5)),
  );

  const steeringWheelLock = Math.PI * 2.5;
  const wheelTarget = targetSteer * steeringWheelLock;
  data.steeringWheelAngle = THREE.MathUtils.lerp(
    data.steeringWheelAngle,
    wheelTarget,
    1 - Math.exp(-delta * (targetSteer === 0 ? 5.8 : 3.6)),
  );
  steeringWheelEl.style.transform = `translateX(-50%) rotateX(18deg) rotateZ(${data.steeringWheelAngle}rad)`;

  if (braking) {
    data.speed = Math.max(data.speed - delta * 0.13, 0);
    data.physicsXVelocity *= Math.exp(-delta * 5.5);
  } else if (accelerating) {
    const acceleration = 0.025 + data.driveThrottle * 0.035;
    data.speed = Math.min(data.speed + delta * acceleration, 0.105);
  } else if (state.drive.cruise.active) {
    if (state.drive.cruise.adaptive) {
      const targetSpeed = getAdaptiveCruiseTargetSpeed(state.driverCar, state.drive.cruise.speed);
      data.braking = targetSpeed < data.speed - 0.0005;
      const response = targetSpeed < data.speed ? 0.1 : 0.035;
      data.speed += THREE.MathUtils.clamp(
        targetSpeed - data.speed,
        -delta * response,
        delta * response,
      );
    } else {
      data.speed = state.drive.cruise.speed;
    }
  } else {
    data.speed = Math.max(data.speed - delta * 0.006, 0);
    if (data.speed < 0.0015) data.speed = 0;
  }

  const roadWheelAngle = (data.steeringWheelAngle / steeringWheelLock) * THREE.MathUtils.degToRad(22);
  const speedUnits = data.speed * 368;
  const wheelbase = 4.4;
  const yawRate = THREE.MathUtils.clamp(
    speedUnits / wheelbase * Math.tan(roadWheelAngle),
    -0.72,
    0.72,
  );
  data.driveHeading -= yawRate * delta;

  const driveXVelocity = Math.sin(data.driveHeading) * speedUnits;
  data.driveLateralVelocity = Math.cos(data.driveHeading) * speedUnits;
  data.progress = (data.progress + driveXVelocity * delta / 368) % 1;
  data.currentZ = THREE.MathUtils.clamp(
    data.currentZ + data.driveLateralVelocity * delta,
    -14.2,
    14.2,
  );

  const actualLongitudinalSpeed = driveXVelocity + data.physicsXVelocity;
  const actualLateralSpeed = data.driveLateralVelocity + data.physicsZVelocity;
  const displaySpeed = Math.max(
    0,
    Math.round(Math.hypot(actualLongitudinalSpeed, actualLateralSpeed) * (760 / 368)),
  );
  const cruiseStatus = state.drive.cruise.active
    ? ` · ${state.drive.cruise.adaptive ? "ADAPTIVE" : "CRUISE"} ${Math.round(state.drive.cruise.speed * 760)} mph`
    : "";
  statusEl.textContent = `YOU DRIVE · ${displaySpeed} mph${displaySpeed === 0 ? " · STOPPED" : ""}${cruiseStatus}`;
  updateCenterLaneButton();
}

function getClearlyOccupiedLane() {
  if (state.pov !== "drive") return null;
  const data = state.driverCar.userData;
  const carCenterZ = data.currentZ + (data.physicsZ ?? 0);
  const heading = data.driveHeading;
  const halfLength = data.length / 2;
  const halfWidth = 1.6;
  const lateralHalfExtent = Math.abs(Math.cos(heading)) * halfLength
    + Math.abs(Math.sin(heading)) * halfWidth;
  const usableLaneHalfWidth = 3.25 - 0.3;
  const occupiedLanes = state.lanes.filter((lane) => (
    Math.abs(carCenterZ - lane.z) + lateralHalfExtent < usableLaneHalfWidth
  ));
  return occupiedLanes.length === 1 ? occupiedLanes[0] : null;
}

function updateCenterLaneButton() {
  const lane = getClearlyOccupiedLane();
  centerLaneButton.disabled = !lane;
  centerLaneButton.title = lane
    ? "Center and straighten the car in this lane"
    : "Move fully inside one lane to enable centering";
}

function centerPlayerInLane() {
  const lane = getClearlyOccupiedLane();
  if (!lane) return;
  const data = state.driverCar.userData;
  data.lane = lane.id;
  data.dir = lane.dir;
  data.z = lane.z;
  data.currentZ = lane.z;
  data.targetZ = lane.z;
  data.physicsZ = 0;
  data.physicsZVelocity = 0;
  data.physicsXVelocity = 0;
  data.spin = 0;
  data.spinVelocity = 0;
  data.driveLateralVelocity = 0;
  data.driveSteer = 0;
  data.steeringWheelAngle = 0;
  data.driveHeading = lane.dir === 1 ? Math.PI / 2 : Math.PI * 1.5;
  state.drive.signal = null;
  steeringWheelEl.style.transform = "translateX(-50%) rotateX(18deg) rotateZ(0rad)";
  statusEl.textContent = "Centered and straightened in lane";
  updateCenterLaneButton();
}

function circularDistance(a, b) {
  return Math.abs((((a - b) % 1) + 1.5) % 1 - 0.5);
}

function progressDistanceAhead(car, other) {
  const data = car.userData;
  const otherData = other.userData;
  if (data.dir === 1) {
    return (otherData.progress - data.progress + 1) % 1;
  }
  return (data.progress - otherData.progress + 1) % 1;
}

function minimumProgressGap(car, other, buffer = 3) {
  const roadLength = 368;
  return (car.userData.length / 2 + other.userData.length / 2 + buffer) / roadLength;
}

function isBlockedVehicle(car) {
  return car.userData.speed < 0.008 || car.userData.targetSpeed < 0.008;
}

function isLaneGapClear(car, lane) {
  if (state.pov === "drive" && car !== state.driverCar) {
    const player = state.driverCar;
    const playerData = player.userData;
    const playerNearTargetLane = Math.abs(playerData.currentZ - lane.z) < 5.5;
    const distanceToPlayer = circularDistance(car.userData.progress, playerData.progress) * 368;
    if (playerNearTargetLane) {
      const playerAhead = progressDistanceAhead(car, player);
      const botWouldMergeAheadOfPlayer = playerAhead > 0.5;
      if (distanceToPlayer < minimumProgressGap(car, player, 10) * 368) return false;
      if (isBlockedVehicle(player)) {
        if (botWouldMergeAheadOfPlayer && distanceToPlayer < 90) return false;
      } else if (distanceToPlayer < 55) {
        return false;
      }
    }
  }

  const wouldMergeAheadOfBlockage = state.cars.some((other) => {
    if (
      other === car
      || !isBlockedVehicle(other)
      || !physicallyOccupiesLane(other, lane)
    ) return false;
    const distanceBehind = progressDistanceAhead(other, car);
    return distanceBehind > 0 && distanceBehind < 0.245;
  });
  if (wouldMergeAheadOfBlockage) return false;

  return lane.cars.every((other) => (
    other === car
    || circularDistance(car.userData.progress, other.userData.progress) > minimumProgressGap(car, other, 10)
  ));
}

function isAmbulanceMergeGapClear(car, lane, mergeSpeed) {
  const roadLength = 368;
  return lane.cars.every((other) => {
    if (other === car) return true;
    const combinedHalfLength = car.userData.length / 2 + other.userData.length / 2;
    const distanceAhead = progressDistanceAhead(car, other) * roadLength;
    const distanceBehind = progressDistanceAhead(other, car) * roadLength;
    const frontClearance = combinedHalfLength + 12
      + Math.max(0, mergeSpeed - other.userData.speed) * 90;
    const rearClearance = combinedHalfLength + 16
      + Math.max(0, other.userData.speed - mergeSpeed) * 140;
    return distanceAhead > frontClearance && distanceBehind > rearClearance;
  });
}

function requestAmbulanceMergeGap(car, targetLane) {
  targetLane.cars.forEach((other) => {
    if (other === car || other === state.driverCar) return;
    const distanceBehind = progressDistanceAhead(other, car);
    if (distanceBehind > 0.12) return;

    const urgency = THREE.MathUtils.clamp(1 - distanceBehind / 0.12, 0, 1);
    const cooperativeSpeed = urgency > 0.9
      ? 0
      : other.userData.baseSpeed * THREE.MathUtils.lerp(0.82, 0.18, urgency);
    other.userData.targetSpeed = Math.min(other.userData.targetSpeed, cooperativeSpeed);
  });
}

function getAmbulanceLaneId() {
  const ambulanceZ = state.driverCar.userData.currentZ;
  return state.lanes.reduce((nearest, lane) => (
    Math.abs(lane.z - ambulanceZ) < Math.abs(nearest.z - ambulanceZ) ? lane : nearest
  )).id;
}

function getOuterLane(dir) {
  return state.lanes
    .filter((lane) => lane.dir === dir)
    .sort((a, b) => Math.abs(b.z) - Math.abs(a.z))[0];
}

function setAmbulanceYieldIndicator(carData, targetLane) {
  const targetIsWorldRight = targetLane.z < carData.currentZ;
  carData.ambulanceYielding = true;
  carData.indicatorSide = carData.dir === 1
    ? (targetIsWorldRight ? "right" : "left")
    : (targetIsWorldRight ? "left" : "right");
}

function startLaneChange(car, targetLane, duration = 3.25) {
  const data = car.userData;
  const ambulanceData = state.driverCar.userData;
  if (
    state.drive.ambulance
    && car !== state.driverCar
    && (
      targetLane.id === getAmbulanceLaneId()
      || (data.dir !== ambulanceData.dir && targetLane.id !== getOuterLane(data.dir).id)
    )
  ) {
    data.intendedLane = null;
    data.indicatorSide = null;
    data.cooldown = THREE.MathUtils.randFloat(0.8, 1.5);
    return false;
  }
  data.intendedLane = null;
  data.changingLane = true;
  data.changeT = 0;
  data.laneChangeDuration = duration;
  data.targetLane = targetLane.id;
  // Reserve the destination immediately. This makes every following gap check
  // and spacing pass account for the car throughout the entire merge.
  if (!targetLane.cars.includes(car)) {
    targetLane.cars.push(car);
  }
  data.targetZ = targetLane.z;
  data.startZ = data.currentZ ?? data.z;
  const targetIsWorldRight = targetLane.z < data.startZ;
  data.indicatorSide = data.dir === 1
    ? (targetIsWorldRight ? "right" : "left")
    : (targetIsWorldRight ? "left" : "right");
  return true;
}

function finishLaneChange(car) {
  const data = car.userData;
  const sourceLane = state.lanes[data.lane];
  const targetLane = state.lanes[data.targetLane];
  sourceLane.cars = sourceLane.cars.filter((item) => item !== car);
  if (!targetLane.cars.includes(car)) {
    targetLane.cars.push(car);
  }
  data.lane = targetLane.id;
  data.z = targetLane.z;
  data.currentZ = targetLane.z;
  data.targetZ = targetLane.z;
  data.changingLane = false;
  data.laneChangeDuration = 3.25;
  data.intendedLane = null;
  data.targetLane = null;
  data.indicatorSide = null;
  data.cooldown = THREE.MathUtils.randFloat(2.4, 5.2);
}

function updateLaneChangeIntent(car, delta) {
  const data = car.userData;
  if (car === state.driverCar && state.pov === "drive") return;
  if (data.crashedUntil > clock.elapsedTime) return;
  if (data.crossedYellowForWreck !== null) return;
  if (data.changingLane) return;
  if (state.drive.ambulance && !data.ambulanceYielding) {
    data.intendedLane = null;
    data.indicatorSide = null;
    return;
  }

  if (data.intendedLane === null) {
    data.cooldown -= delta;
    if (data.cooldown > 0) return;

    const lane = state.lanes[data.lane];
    const targetLane = lane.neighbor;
    if (!targetLane) {
      data.cooldown = THREE.MathUtils.randFloat(0.7, 1.7);
      return;
    }
    data.intendedLane = targetLane.id;
    const targetIsWorldRight = targetLane.z < data.currentZ;
    data.indicatorSide = data.dir === 1
      ? (targetIsWorldRight ? "right" : "left")
      : (targetIsWorldRight ? "left" : "right");
  }

  const targetLane = state.lanes[data.intendedLane];
  if (isLaneGapClear(car, targetLane)) {
    startLaneChange(car, targetLane);
  }
}

function updateLaneChangeMotion(car, delta) {
  const data = car.userData;
  if (car === state.driverCar && state.pov === "drive") return;
  if (data.crashedUntil > clock.elapsedTime) return;
  if (!data.changingLane) {
    data.currentZ = data.z;
    return;
  }

  data.changeT = Math.min(data.changeT + delta / data.laneChangeDuration, 1);
  const eased = 0.5 - Math.cos(data.changeT * Math.PI) * 0.5;
  data.currentZ = THREE.MathUtils.lerp(data.startZ, data.targetZ, eased);
  if (data.changeT >= 1) {
    finishLaneChange(car);
  }
}

function updateTurnIndicators() {
  const blinkOn = Math.sin(clock.elapsedTime * 10) > 0;
  state.cars.forEach((car) => {
    const data = car.userData;
    const driverSignal = car === state.driverCar && state.pov === "drive"
      ? state.drive.signal
      : null;
    const playerLampSide = driverSignal === "left"
      ? "right"
      : (driverSignal === "right" ? "left" : driverSignal);
    const signalIsOn = (side) => (
      playerLampSide === "hazard"
      || data.crashedUntil > clock.elapsedTime
      || playerLampSide === side
      || ((data.changingLane || data.ambulanceYielding || data.intendedLane !== null)
        && data.indicatorSide === side)
    );
    data.signalLights.forEach(({ side, material }) => {
      const isTurningSide = signalIsOn(side);
      if (isTurningSide && blinkOn) {
        material.color.setHex(0xff0000);
        material.emissive.setHex(0xff0000);
        material.emissiveIntensity = 3.2;
      } else {
        material.color.setHex(0xff0000);
        material.emissive.setHex(0xff0000);
        material.emissiveIntensity = 0.35;
      }
    });
    data.frontSignalLights.forEach(({ side, material }) => {
      material.color.setHex(signalIsOn(side) && blinkOn ? 0xff9800 : 0x4d2100);
    });
  });
}

function updateBrakeLights() {
  state.cars.forEach((car) => {
    const braking = car.userData.braking;
    car.userData.brakeLights.forEach((material) => {
      material.color.setHex(braking ? 0xff0000 : 0x660000);
    });
  });
}

function physicallyOccupiesLane(car, lane) {
  const lateralPosition = car.userData.currentZ + (car.userData.physicsZ ?? 0);
  return Math.abs(lateralPosition - lane.z) <= 3.3;
}

function updateYieldingSpeeds() {
  state.cars.forEach((car) => {
    if (car === state.driverCar && state.pov === "drive") return;
    const data = car.userData;
    if (data.crashedUntil > clock.elapsedTime) {
      data.targetSpeed = 0;
      return;
    }
    const lateralPosition = data.currentZ + (data.physicsZ ?? 0);
    const lane = state.lanes
      .filter((candidate) => candidate.dir === data.dir)
      .reduce((nearest, candidate) => (
        Math.abs(candidate.z - lateralPosition) < Math.abs(nearest.z - lateralPosition)
          ? candidate
          : nearest
      ));
    const nearestAhead = lane.cars.reduce((nearest, other) => {
      if (other === car || !physicallyOccupiesLane(other, lane)) return nearest;
      const distance = progressDistanceAhead(car, other);
      if (distance <= 0 || distance > 0.5) return nearest;
      return Math.min(nearest, distance);
    }, Infinity);

    const openRoad = nearestAhead === Infinity || nearestAhead > 0.095;
    const followBlend = nearestAhead === Infinity
      ? 1
      : THREE.MathUtils.clamp((nearestAhead - 0.055) / 0.12, 0, 1);
    const cruiseMultiplier = openRoad ? 1.55 : THREE.MathUtils.lerp(0.82, 1.2, followBlend);
    data.targetSpeed = data.baseSpeed * cruiseMultiplier;
  });

  if (state.pov === "drive") updateDriverAvoidance();

  state.cars.forEach((mergingCar) => {
    const merge = mergingCar.userData;
    if (!merge.changingLane || merge.targetLane === null) return;

    merge.targetSpeed = merge.baseSpeed * 0.76;
  });
}

function requestSignalMergeGap(mergingCar, targetLane) {
  targetLane.cars.forEach((other) => {
    if (other === mergingCar || other === state.driverCar) return;
    const distanceBehind = progressDistanceAhead(other, mergingCar);
    if (distanceBehind <= 0 || distanceBehind > 0.16) return;

    const urgency = THREE.MathUtils.clamp(1 - distanceBehind / 0.16, 0, 1);
    const yieldingSpeed = other.userData.baseSpeed
      * THREE.MathUtils.lerp(1.05, 0.38, urgency);
    other.userData.targetSpeed = Math.min(other.userData.targetSpeed, yieldingSpeed);
  });
}

function applyTurnSignalYielding() {
  if (state.drive.ambulance) return;

  state.cars.forEach((car) => {
    const intendedLane = car.userData.intendedLane;
    if (intendedLane === null) return;
    requestSignalMergeGap(car, state.lanes[intendedLane]);
  });

  if (state.pov !== "drive" || !["left", "right"].includes(state.drive.signal)) return;
  const player = state.driverCar;
  const data = player.userData;
  const currentLane = state.lanes
    .filter((lane) => lane.dir === data.dir)
    .sort((a, b) => Math.abs(a.z - data.currentZ) - Math.abs(b.z - data.currentZ))[0];
  const targetLane = currentLane?.neighbor;
  if (!targetLane) return;

  const targetIsWorldRight = targetLane.z < data.currentZ;
  const requiredLampSide = data.dir === 1
    ? (targetIsWorldRight ? "right" : "left")
    : (targetIsWorldRight ? "left" : "right");
  const playerLampSide = state.drive.signal === "left" ? "right" : "left";
  if (playerLampSide === requiredLampSide) requestSignalMergeGap(player, targetLane);
}

function updateDriverAvoidance() {
  const player = state.driverCar;
  const playerData = player.userData;

  if (state.drive.ambulance) {
    updateAmbulanceClearance();
    return;
  }

  state.cars.forEach((car) => {
    if (car === player) return;
    const data = car.userData;
    const longitudinal = (player.position.x - car.position.x) * data.dir;
    const lateral = Math.abs((playerData.currentZ + playerData.physicsZ) - (data.currentZ + data.physicsZ));
    // Adjacent lane centers are 6.5 units apart. Only brake or evade when the
    // vehicle bodies genuinely share the same lateral path (including while
    // either vehicle is crossing the divider).
    if (longitudinal <= 0 || longitudinal > 72 || lateral > 3.9) return;

    const urgency = THREE.MathUtils.clamp(1 - longitudinal / 72, 0, 1);
    const targetLane = state.lanes[data.lane]?.neighbor;
    const canEvade = targetLane
      && !data.changingLane
      && Math.abs(targetLane.z - playerData.currentZ) > 5.5
      && isLaneGapClear(car, targetLane);

    if (canEvade && longitudinal < 48) {
      startLaneChange(car, targetLane);
    } else {
      data.targetSpeed = Math.min(data.targetSpeed, data.baseSpeed * (1 - urgency) * 0.7);
      if (longitudinal < 22) data.targetSpeed = 0;
    }
  });
}

function updateAmbulanceClearance() {
  const player = state.driverCar;
  const data = player.userData;
  const forwardX = Math.sin(data.driveHeading);
  const forwardZ = Math.cos(data.driveHeading);
  const protectedLaneId = getAmbulanceLaneId();

  state.cars.forEach((car) => {
    const carData = car.userData;
    if (car !== player && !carData.changingLane) {
      carData.ambulanceYielding = false;
      carData.indicatorSide = null;
    }
  });

  state.cars.forEach((car) => {
    if (car === player) return;
    const carData = car.userData;
    const currentLane = state.lanes[carData.lane];
    if (!currentLane) return;

    if (carData.dir !== data.dir) {
      const outsideLane = getOuterLane(carData.dir);
      if (!carData.changingLane && currentLane.id !== outsideLane.id) {
        setAmbulanceYieldIndicator(carData, outsideLane);
        requestAmbulanceMergeGap(car, outsideLane);
        if (isAmbulanceMergeGapClear(car, outsideLane, data.speed)) {
          startLaneChange(car, outsideLane);
        }
      }
      return;
    }

    const dx = car.position.x - player.position.x;
    const dz = car.position.z - player.position.z;
    const ahead = dx * forwardX + dz * forwardZ;
    const lateral = Math.abs(dx * forwardZ - dz * forwardX);
    if (ahead <= 0 || ahead > 145 || lateral > 18) return;

    if (currentLane.id !== protectedLaneId) return;
    const outsideLane = getOuterLane(carData.dir);
    const targetLane = outsideLane.id !== protectedLaneId ? outsideLane : currentLane.neighbor;
    const targetMovesAway = targetLane && targetLane.id !== protectedLaneId;

    if (!carData.changingLane && targetMovesAway) {
      setAmbulanceYieldIndicator(carData, targetLane);
      requestAmbulanceMergeGap(car, targetLane);
    }

    if (
      !carData.changingLane
      && targetMovesAway
      && isAmbulanceMergeGapClear(car, targetLane, data.speed)
    ) {
      startLaneChange(car, targetLane);
    }
  });
}

function enforceAmbulanceLaneFlow() {
  if (!state.drive.ambulance) return;
  const protectedLaneId = getAmbulanceLaneId();
  const ambulanceSpeed = state.driverCar.userData.speed;
  state.cars.forEach((car) => {
    if (
      car === state.driverCar
      || (car.userData.lane !== protectedLaneId && !car.userData.ambulanceYielding)
    ) return;
    car.userData.speed = ambulanceSpeed;
    car.userData.targetSpeed = ambulanceSpeed;
  });
}

function updateAmbulanceLights() {
  const data = state.driverCar.userData;
  if (!state.drive.ambulance) return;
  const redOn = Math.sin(clock.elapsedTime * 18) > 0;
  data.ambulanceLights.red.emissiveIntensity = redOn ? 3.2 : 0.18;
  data.ambulanceLights.blue.emissiveIntensity = redOn ? 0.18 : 3.2;
}

function easeTrafficSpeeds(delta) {
  state.cars.forEach((car) => {
    if (car === state.driverCar && state.pov === "drive") return;
    const data = car.userData;
    data.braking = data.targetSpeed < data.speed - 0.0005;
    const easing = data.targetSpeed < data.speed ? 0.7 : 1.15;
    data.speed = THREE.MathUtils.lerp(data.speed, data.targetSpeed, Math.min(delta * easing, 1));
  });
}

function enforceLaneSpacing(lane) {
  const cars = lane.cars
    .filter((car) => physicallyOccupiesLane(car, lane))
    .map((car) => ({ car, progress: ((car.userData.progress % 1) + 1) % 1 }))
    .sort((a, b) => a.progress - b.progress);

  for (let i = 0; i < cars.length; i += 1) {
    const current = cars[i];
    const next = cars[(i + 1) % cars.length];
    const nextProgress = next.progress + (i === cars.length - 1 ? 1 : 0);
    const gap = nextProgress - current.progress;

    if (gap < lane.minGap) {
      const trailing = lane.dir === 1 ? current.car : next.car;
      const blend = THREE.MathUtils.clamp(1 - gap / lane.minGap, 0, 1);
      const safeSpeed = THREE.MathUtils.lerp(trailing.userData.baseSpeed, trailing.userData.baseSpeed * 0.65, blend);
      trailing.userData.targetSpeed = Math.min(trailing.userData.targetSpeed, safeSpeed);
    }
  }
}

function enforceTrafficClearance() {
  const minProgressGap = 0.074;
  for (let i = 0; i < state.cars.length; i += 1) {
    for (let j = i + 1; j < state.cars.length; j += 1) {
      const a = state.cars[i];
      const b = state.cars[j];
      const ad = a.userData;
      const bd = b.userData;
      if (ad.dir !== bd.dir) continue;
      const lateralGap = Math.abs(
        (ad.currentZ + (ad.physicsZ ?? 0)) - (bd.currentZ + (bd.physicsZ ?? 0)),
      );
      if (lateralGap > 3.9) continue;

      const gap = circularDistance(ad.progress, bd.progress);
      if (gap >= minProgressGap) continue;

      const aToB = ad.dir === 1
        ? (bd.progress - ad.progress + 1) % 1
        : (ad.progress - bd.progress + 1) % 1;
      const trailing = aToB <= 0.5 ? a : b;
      const trailingData = trailing.userData;
      const blend = THREE.MathUtils.clamp(1 - gap / minProgressGap, 0, 1);
      const safeSpeed = THREE.MathUtils.lerp(trailingData.baseSpeed, trailingData.baseSpeed * 0.58, blend);
      trailingData.targetSpeed = Math.min(trailingData.targetSpeed, safeSpeed);
    }
  }
}

function enforceHardLaneClearance(lane) {
  const occupyingCars = lane.cars.filter((car) => physicallyOccupiesLane(car, lane));
  if (occupyingCars.length < 2) return;

  // Work in a coordinate that always increases in the lane's travel direction.
  // If easing cannot slow a trailing car quickly enough, move it back to the
  // nearest physically safe point before rendering the frame.
  for (let pass = 0; pass < occupyingCars.length; pass += 1) {
    const cars = occupyingCars
      .map((car) => {
        const progress = ((car.userData.progress % 1) + 1) % 1;
        return { car, travel: lane.dir === 1 ? progress : (1 - progress) % 1 };
      })
      .sort((a, b) => a.travel - b.travel);

    let corrected = false;
    for (let i = 0; i < cars.length; i += 1) {
      const trailing = cars[i];
      const leading = cars[(i + 1) % cars.length];
      const leadingTravel = leading.travel + (i === cars.length - 1 ? 1 : 0);
      const requiredGap = minimumProgressGap(trailing.car, leading.car);
      if (leadingTravel - trailing.travel >= requiredGap) continue;

      const safeTravel = ((leadingTravel - requiredGap) % 1 + 1) % 1;
      trailing.car.userData.progress = lane.dir === 1 ? safeTravel : (1 - safeTravel) % 1;
      trailing.car.userData.speed = Math.min(
        trailing.car.userData.speed,
        leading.car.userData.speed,
      );
      corrected = true;
    }
    if (!corrected) break;
  }
}

function updateCrashNavigation() {
  state.cars.forEach((car) => {
    const data = car.userData;
    if (car === state.driverCar || data.crashedUntil > clock.elapsedTime || data.changingLane) return;

    if (data.crossedYellowForWreck !== null) {
      const wreck = state.cars[data.crossedYellowForWreck];
      const returnLane = state.lanes[data.returnLaneAfterWreck];
      const passedWreck = !wreck
        || wreck.userData.crashedUntil <= clock.elapsedTime
        || progressDistanceAhead(wreck, car) < 0.075;
      if (passedWreck && returnLane && isLaneGapClear(car, returnLane)) {
        startLaneChange(car, returnLane, 1.35);
        data.crossedYellowForWreck = null;
        data.returnLaneAfterWreck = null;
      }
      data.targetSpeed = Math.min(data.targetSpeed, data.baseSpeed * 0.52);
      return;
    }

    const lane = state.lanes[data.lane];
    const wreck = state.cars
      .filter((other) => (
        other !== car
        && other.userData.crashedUntil > clock.elapsedTime
        && physicallyOccupiesLane(other, lane)
      ))
      .map((other) => ({ other, distance: progressDistanceAhead(car, other) }))
      .filter(({ distance }) => distance > 0 && distance < 0.2)
      .sort((a, b) => a.distance - b.distance)[0];
    if (!wreck) return;

    const targetLane = lane.neighbor;
    const regularLaneClear = targetLane && isLaneGapClear(car, targetLane);
    if (targetLane) {
      data.intendedLane = targetLane.id;
      const targetIsWorldRight = targetLane.z < data.currentZ;
      data.indicatorSide = data.dir === 1
        ? (targetIsWorldRight ? "right" : "left")
        : (targetIsWorldRight ? "left" : "right");
      if (regularLaneClear) startLaneChange(car, targetLane);
    }

    if (!regularLaneClear && Math.abs(lane.z) < 7 && wreck.distance < 0.09) {
      const opposingInsideLane = state.lanes
        .filter((candidate) => candidate.dir !== data.dir)
        .sort((a, b) => Math.abs(a.z) - Math.abs(b.z))[0];
      const yellowLineSafetyDistance = 85;
      const yellowLineClear = opposingInsideLane
        && state.cars.every((other) => (
          other === car
          || other.userData.dir === data.dir
          || circularDistance(data.progress, other.userData.progress) * 368
            > yellowLineSafetyDistance
        ))
        && !(
          state.pov === "drive"
          && state.driverCar !== car
          && circularDistance(data.progress, state.driverCar.userData.progress) * 368
            <= yellowLineSafetyDistance
        );
      if (yellowLineClear) {
        data.crossedYellowForWreck = state.cars.indexOf(wreck.other);
        data.returnLaneAfterWreck = lane.id;
        data.intendedLane = null;
        startLaneChange(car, opposingInsideLane, 1.35);
      }
    }

    const stoppingDistance = 0.065;
    if (wreck.distance < stoppingDistance) {
      const blend = THREE.MathUtils.clamp(wreck.distance / stoppingDistance, 0, 1);
      data.targetSpeed = Math.min(data.targetSpeed, data.baseSpeed * blend * 0.7);
    }
  });
}

function vehicleVelocity(car) {
  const data = car.userData;
  if (car === state.driverCar && state.pov === "drive") {
    return new THREE.Vector2(
      Math.sin(data.driveHeading) * data.speed * 368 + data.physicsXVelocity,
      data.driveLateralVelocity + data.physicsZVelocity,
    );
  }
  return new THREE.Vector2(
    data.dir * data.speed * 368 + data.physicsXVelocity,
    data.physicsZVelocity,
  );
}

function requiredGroundLift(car) {
  const data = car.userData;
  const halfWidth = data.collisionHalfWidth;
  const halfHeight = (data.collisionMaxY - data.collisionMinY) * 0.5;
  const centerY = (data.collisionMaxY + data.collisionMinY) * 0.5;
  const halfLength = data.length * 0.5 + 0.65;
  const cosPitch = Math.cos(data.pitch);
  const sinPitch = Math.sin(data.pitch);
  const cosRoll = Math.cos(data.roll);
  const sinRoll = Math.sin(data.roll);
  const rotatedCenterY = centerY * cosPitch * cosRoll;
  const rotatedHalfHeight = Math.abs(sinRoll) * halfWidth
    + Math.abs(cosPitch * cosRoll) * halfHeight
    + Math.abs(sinPitch * cosRoll) * halfLength;
  const rotatedLowestPoint = rotatedCenterY - rotatedHalfHeight;
  return Math.max(0, data.collisionMinY - rotatedLowestPoint);
}

function updateCollisionPhysics(delta) {
  state.cars.forEach((car) => {
    const data = car.userData;
    if (data.crashedUntil && data.crashedUntil <= clock.elapsedTime) {
      const lateralPosition = data.currentZ + (data.physicsZ ?? 0);
      const recoveryLane = state.lanes
        .filter((lane) => lane.dir === data.dir && isLaneGapClear(car, lane))
        .sort((a, b) => Math.abs(a.z - lateralPosition) - Math.abs(b.z - lateralPosition))[0];
      if (!recoveryLane) {
        data.crashedUntil = clock.elapsedTime + 0.5;
        return;
      }

      state.lanes.forEach((lane) => {
        lane.cars = lane.cars.filter((item) => item !== car);
      });
      recoveryLane.cars.push(car);
      data.crashedUntil = 0;
      data.lane = recoveryLane.id;
      data.z = recoveryLane.z;
      data.currentZ = recoveryLane.z;
      data.targetZ = recoveryLane.z;
      data.targetLane = null;
      data.intendedLane = null;
      data.changingLane = false;
      data.changeT = 0;
      data.laneChangeDuration = 3.25;
      data.indicatorSide = null;
      data.crossedYellowForWreck = null;
      data.returnLaneAfterWreck = null;
      data.physicsXVelocity = 0;
      data.physicsZ = 0;
      data.physicsZVelocity = 0;
      data.physicsY = 0;
      data.physicsYVelocity = 0;
      data.spin = 0;
      data.spinVelocity = 0;
      data.pitch = 0;
      data.pitchVelocity = 0;
      data.roll = 0;
      data.rollVelocity = 0;
      data.driveHeading = null;
      data.baseSpeed = recoveryLane.speed;
      data.speed = Math.max(data.speed, data.baseSpeed * 0.45);
      data.targetSpeed = data.baseSpeed;
      data.cooldown = THREE.MathUtils.randFloat(1.2, 2.4);
    }
    data.progress = (data.progress + data.physicsXVelocity * delta / 368) % 1;
    const crashed = data.crashedUntil > clock.elapsedTime;
    data.physicsXVelocity *= Math.exp(-delta * (crashed ? 0.72 : 2.2));
    data.physicsZ += data.physicsZVelocity * delta;
    data.physicsZVelocity += crashed
      ? -data.physicsZVelocity * 0.9 * delta
      : (-data.physicsZ * 8 - data.physicsZVelocity * 4.5) * delta;
    data.physicsY += data.physicsYVelocity * delta;
    data.physicsYVelocity -= 24 * delta;
    const groundLift = requiredGroundLift(car);
    if (data.physicsY < groundLift) {
      data.physicsY = groundLift;
      if (Math.abs(data.physicsYVelocity) > 2.5) {
        data.physicsYVelocity *= -0.24;
      } else {
        data.physicsYVelocity = 0;
      }
    }
    if (crashed || data.physicsY > groundLift + 0.02) {
      data.spinVelocity *= Math.exp(-delta * 0.8);
      data.pitchVelocity *= Math.exp(-delta * 1.15);
      data.rollVelocity *= Math.exp(-delta * 1.05);
    } else {
      // Once a controllable car is back on its wheels, converge the collision
      // body's rotation with its real driving heading instead of leaving a
      // permanent visual yaw that makes steering appear reversed or crooked.
      data.spin = Math.atan2(Math.sin(data.spin), Math.cos(data.spin));
      data.pitch = Math.atan2(Math.sin(data.pitch), Math.cos(data.pitch));
      data.roll = Math.atan2(Math.sin(data.roll), Math.cos(data.roll));
      data.spinVelocity += (-data.spin * 8.5 - data.spinVelocity * 4.8) * delta;
      data.pitchVelocity += (-data.pitch * 10 - data.pitchVelocity * 4.6) * delta;
      data.rollVelocity += (-data.roll * 10 - data.rollVelocity * 4.4) * delta;
    }
    data.spin += data.spinVelocity * delta;
    data.pitch += data.pitchVelocity * delta;
    data.roll += data.rollVelocity * delta;
  });

  if (state.pov !== "drive") return;
  for (let i = 0; i < state.cars.length; i += 1) {
    for (let j = i + 1; j < state.cars.length; j += 1) {
    const first = state.cars[i];
    const second = state.cars[j];
    const dx = second.position.x - first.position.x;
    const dz = second.position.z - first.position.z;
    const xLimit = (first.userData.length + second.userData.length) * 0.5;
    const zLimit = 3.35;
    const scaledDistance = Math.hypot(dx / xLimit, dz / zLimit);
    if (scaledDistance >= 1) continue;

    const pairKey = `${i}:${j}`;
    const cooldown = state.drive.collisionCooldown.get(pairKey) ?? 0;
    if (clock.elapsedTime < cooldown) continue;
    state.drive.collisionCooldown.set(pairKey, clock.elapsedTime + 0.14);

    const normal = new THREE.Vector2(dx / (xLimit * xLimit), dz / (zLimit * zLimit));
    if (normal.lengthSq() < 0.0001) normal.set(first.userData.dir, 0.25);
    normal.normalize();

    const firstVelocity = vehicleVelocity(first);
    const secondVelocity = vehicleVelocity(second);
    const relativeNormalSpeed = secondVelocity.clone().sub(firstVelocity).dot(normal);
    const firstInverseMass = 1 / first.userData.mass;
    const secondInverseMass = 1 / second.userData.mass;
    const impactImpulse = relativeNormalSpeed < 0
      ? -(1 + 0.34) * relativeNormalSpeed / (firstInverseMass + secondInverseMass)
      : 0;
    const penetration = 1 - scaledDistance;
    const impulse = Math.max(
      impactImpulse,
      penetration * 18 / (firstInverseMass + secondInverseMass),
    );

    first.userData.physicsXVelocity -= impulse * firstInverseMass * normal.x;
    first.userData.physicsZVelocity -= impulse * firstInverseMass * normal.y;
    second.userData.physicsXVelocity += impulse * secondInverseMass * normal.x;
    second.userData.physicsZVelocity += impulse * secondInverseMass * normal.y;

    const hitSide = Math.sign(dz) || (Math.random() < 0.5 ? -1 : 1);
    const spinImpulse = Math.min(impulse * 0.11, 6.5);
    first.userData.spinVelocity -= hitSide * spinImpulse * firstInverseMass;
    second.userData.spinVelocity += hitSide * spinImpulse * secondInverseMass;

    const totalInverseMass = firstInverseMass + secondInverseMass;
    const separationX = normal.x * penetration * xLimit * 0.72;
    const separationZ = normal.y * penetration * zLimit * 0.72;
    first.userData.progress -= separationX * (firstInverseMass / totalInverseMass) / 368;
    second.userData.progress += separationX * (secondInverseMass / totalInverseMass) / 368;
    first.userData.physicsZ -= separationZ * (firstInverseMass / totalInverseMass);
    second.userData.physicsZ += separationZ * (secondInverseMass / totalInverseMass);

    const energyLoss = THREE.MathUtils.clamp(impulse / 65, 0, 0.42);
    first.userData.speed *= 1 - energyLoss * 0.85;
    second.userData.speed *= 1 - energyLoss * 0.85;

    [first, second].forEach((car, index) => {
      const data = car.userData;
      if (impulse < 9 || data.crashedUntil > clock.elapsedTime) return;
      const direction = index === 0 ? -1 : 1;
      const severity = THREE.MathUtils.clamp((impulse - 7) / 24, 0.15, 1);
      data.physicsYVelocity = Math.max(data.physicsYVelocity, severity * 9.5);
      data.rollVelocity += direction * hitSide * severity * 5.8;
      data.pitchVelocity += direction * severity * 2.8;
      data.spinVelocity += direction * hitSide * severity * 2.4;
      if (car !== state.driverCar) {
        data.crashedUntil = clock.elapsedTime + 10;
        data.speed = 0;
        data.targetSpeed = 0;
        data.intendedLane = null;
        data.indicatorSide = null;
      }
    });
    }
  }
}

function createTrees() {
  const positions = [
    [-238, 84], [-215, 128], [-184, 116], [-160, 76], [-228, -105], [-195, -126],
    [165, 122], [198, 104], [232, 64], [206, -112], [176, -133], [242, -86],
  ];
  positions.forEach(([x, z], index) => {
    const tree = new THREE.Group();
    tree.add(makeMesh(new THREE.CylinderGeometry(1.2, 1.6, 8, 8), mats.trunk, new THREE.Vector3(0, 4, 0)));
    const crown = makeMesh(
      new THREE.SphereGeometry(5.8 + (index % 3), 16, 12),
      new THREE.MeshStandardMaterial({ color: 0x176d42, roughness: 0.84 }),
      new THREE.Vector3(0, 11, 0),
    );
    tree.add(crown);
    tree.position.set(x, 5, z);
    tree.userData.crown = crown;
    state.trees.push(tree);
    root.add(tree);
  });
}

function createFog() {
  const fogMat = new THREE.MeshStandardMaterial({
    color: 0xe8f3f6,
    transparent: true,
    opacity: 0.22,
    roughness: 1,
    depthWrite: false,
  });
  for (let i = 0; i < 18; i += 1) {
    const fog = makeMesh(
      new THREE.SphereGeometry(18 + (i % 4) * 6, 16, 8),
      fogMat.clone(),
      new THREE.Vector3(-220 + i * 26, 28 + (i % 3) * 4, -90 + Math.sin(i) * 28),
      false,
      false,
    );
    fog.scale.y = 0.18;
    state.fogBank.push(fog);
    root.add(fog);
  }
}

function createWeather() {
  state.snow = createParticles(900, 0xffffff, 0.18, 260, 145);
  state.leaves = createParticles(430, 0xc35b21, 0.34, 230, 90);
  root.add(state.snow, state.leaves);
}

function createParticles(count, color, size, rangeX, rangeZ) {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    positions[i * 3] = THREE.MathUtils.randFloatSpread(rangeX * 2);
    positions[i * 3 + 1] = THREE.MathUtils.randFloat(34, 122);
    positions[i * 3 + 2] = THREE.MathUtils.randFloatSpread(rangeZ * 2);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  const material = new THREE.PointsMaterial({ color, size, sizeAttenuation: true });
  const points = new THREE.Points(geometry, material);
  points.visible = false;
  return points;
}

function updateWeather(points, delta, speed, bottom, top, sway) {
  if (!points.visible) return;
  const position = points.geometry.attributes.position;
  for (let i = 0; i < position.count; i += 1) {
    let y = position.getY(i) - delta * speed;
    if (y < bottom) y = top;
    position.setY(i, y);
    position.setX(i, position.getX(i) + Math.sin(clock.elapsedTime * 1.4 + i) * delta * sway);
  }
  position.needsUpdate = true;
}

function applySetting(setting) {
  state.setting = setting;
  const settings = {
    summer: {
      sky: 0x74c9ee,
      fog: 0x9bdced,
      fogNear: 210,
      fogFar: 520,
      water: 0x1d7897,
      land: 0x2f8a55,
      tree: 0x167842,
      bridge: 0xb24124,
      ambient: 0.58,
      hemi: 0.78,
      sun: 2.35,
      moon: 0,
      lamp: 0.08,
      snow: false,
      leaves: false,
      fogOpacity: 0.18,
    },
    winter: {
      sky: 0xcbdde7,
      fog: 0xe5f1f4,
      fogNear: 120,
      fogFar: 395,
      water: 0x607f8f,
      land: 0xe7eef0,
      tree: 0xdbe8e8,
      bridge: 0xa94831,
      ambient: 0.76,
      hemi: 0.92,
      sun: 1.42,
      moon: 0,
      lamp: 0.25,
      snow: true,
      leaves: false,
      fogOpacity: 0.28,
    },
    fall: {
      sky: 0xf0aa65,
      fog: 0xf3c58c,
      fogNear: 170,
      fogFar: 460,
      water: 0x326f82,
      land: 0x8c7b37,
      tree: 0xb45c22,
      bridge: 0xb64b29,
      ambient: 0.62,
      hemi: 0.74,
      sun: 1.9,
      moon: 0,
      lamp: 0.18,
      snow: false,
      leaves: true,
      fogOpacity: 0.16,
    },
    night: {
      sky: 0x061225,
      fog: 0x08162a,
      fogNear: 100,
      fogFar: 340,
      water: 0x071f33,
      land: 0x0d3328,
      tree: 0x082b22,
      bridge: 0x8d3323,
      ambient: 0.22,
      hemi: 0.3,
      sun: 0,
      moon: 1.5,
      lamp: 1.2,
      snow: false,
      leaves: false,
      fogOpacity: 0.2,
    },
  };

  const config = settings[setting];
  scene.background = new THREE.Color(config.sky);
  scene.fog = new THREE.Fog(config.fog, config.fogNear, config.fogFar);
  mats.water.color.setHex(config.water);
  mats.land.color.setHex(config.land);
  mats.bridge.color.setHex(config.bridge);
  state.sun.intensity = config.sun;
  state.moon.intensity = config.moon;
  state.ambient.intensity = config.ambient;
  state.hemi.intensity = config.hemi;
  state.snow.visible = config.snow;
  state.leaves.visible = config.leaves;
  state.bridgeLights.forEach((light) => {
    light.intensity = config.lamp;
  });
  state.trees.forEach((tree) => tree.userData.crown.material.color.setHex(config.tree));
  state.fogBank.forEach((fog) => {
    fog.material.opacity = config.fogOpacity;
    fog.visible = setting !== "night" || fog.position.z < 0;
  });
}

function updateTraffic(delta) {
  updateCrashNavigation();
  state.cars.forEach((car) => updateLaneChangeIntent(car, delta));
  updateYieldingSpeeds();
  applyTurnSignalYielding();
  state.lanes.forEach(enforceLaneSpacing);
  enforceTrafficClearance();
  enforceAmbulanceLaneFlow();
  easeTrafficSpeeds(delta);
  state.cars.forEach((car) => {
    if (car === state.driverCar && state.pov === "drive") return;
    const data = car.userData;
    if (data.crashedUntil > clock.elapsedTime) return;
    data.progress = (data.progress + delta * data.speed * state.trafficSpeed * data.dir) % 1;
  });
  state.lanes.forEach(enforceHardLaneClearance);
  state.cars.forEach((car) => updateLaneChangeMotion(car, delta));
  updatePlayerDriving(delta);
  updateCollisionPhysics(delta);
  updateTurnIndicators();
  updateBrakeLights();
  updateAmbulanceLights();
  state.cars.forEach((car) => updateCarPosition(car, 0));
}

function countFrame() {
  state.fps.frames += 1;
}

function refreshFpsOverlay() {
  const now = performance.now();
  const elapsed = Math.max((now - state.fps.lastUpdate) / 1000, 0.001);
  fpsOverlay.textContent = `FPS ${Math.round(state.fps.frames / elapsed)}`;
  state.fps.frames = 0;
  state.fps.lastUpdate = now;
}

function makeNoiseSource(context, seconds = 2) {
  const buffer = context.createBuffer(1, context.sampleRate * seconds, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) {
    data[i] = Math.random() * 2 - 1;
  }
  const source = context.createBufferSource();
  source.buffer = buffer;
  source.loop = true;
  return source;
}

function initAudio() {
  if (state.audio.context) return;

  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return;

  const context = new AudioContext();
  const master = context.createGain();
  master.gain.value = 0;
  master.connect(context.destination);

  const engine = context.createOscillator();
  const engineFilter = context.createBiquadFilter();
  const engineGain = context.createGain();
  engine.type = "sawtooth";
  engine.frequency.value = 72;
  engineFilter.type = "lowpass";
  engineFilter.frequency.value = 290;
  engineGain.gain.value = 0.12;
  engine.connect(engineFilter).connect(engineGain).connect(master);

  const roadNoise = makeNoiseSource(context);
  const roadFilter = context.createBiquadFilter();
  const roadGain = context.createGain();
  roadFilter.type = "bandpass";
  roadFilter.frequency.value = 135;
  roadFilter.Q.value = 0.8;
  roadGain.gain.value = 0.05;
  roadNoise.connect(roadFilter).connect(roadGain).connect(master);

  const wind = makeNoiseSource(context);
  const windFilter = context.createBiquadFilter();
  const windGain = context.createGain();
  windFilter.type = "highpass";
  windFilter.frequency.value = 620;
  windGain.gain.value = 0.018;
  wind.connect(windFilter).connect(windGain).connect(master);

  const siren = context.createOscillator();
  const sirenGain = context.createGain();
  siren.type = "triangle";
  siren.frequency.value = 760;
  sirenGain.gain.value = 0;
  siren.connect(sirenGain).connect(master);

  engine.start();
  roadNoise.start();
  wind.start();
  siren.start();

  state.audio.context = context;
  state.audio.master = master;
  state.audio.engine = engine;
  state.audio.engineGain = engineGain;
  state.audio.roadNoise = roadNoise;
  state.audio.roadGain = roadGain;
  state.audio.wind = wind;
  state.audio.windGain = windGain;
  state.audio.siren = siren;
  state.audio.sirenGain = sirenGain;
}

function setSoundEnabled(enabled) {
  initAudio();
  const { context, master } = state.audio;
  if (!context || !master) return;

  state.audio.enabled = enabled;
  if (context.state === "suspended") {
    context.resume();
  }
  const now = context.currentTime;
  master.gain.cancelScheduledValues(now);
  master.gain.linearRampToValueAtTime(enabled ? 0.55 : 0, now + 0.18);
}

function playControlClick() {
  if (!state.audio.enabled || !state.audio.context) return;

  const context = state.audio.context;
  const click = context.createOscillator();
  const gain = context.createGain();
  click.type = "triangle";
  click.frequency.setValueAtTime(760, context.currentTime);
  click.frequency.exponentialRampToValueAtTime(280, context.currentTime + 0.06);
  gain.gain.setValueAtTime(0.08, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.08);
  click.connect(gain).connect(state.audio.master);
  click.start();
  click.stop(context.currentTime + 0.09);
}

function updateAudio(delta) {
  if (!state.audio.context || !state.audio.enabled) return;

  const carSpeed = state.driverCar?.userData.speed ?? 0.04;
  const targetEngine = 70 + carSpeed * 1450 + Math.sin(clock.elapsedTime * 5.5) * 4;
  const now = state.audio.context.currentTime;
  state.audio.engine.frequency.setTargetAtTime(targetEngine, now, 0.08);
  const inCar = state.pov === "driver" || state.pov === "drive";
  state.audio.engineGain.gain.setTargetAtTime(inCar ? 0.18 : 0.09, now, 0.12);
  state.audio.roadGain.gain.setTargetAtTime(inCar ? 0.08 : 0.035, now, 0.12);
  state.audio.windGain.gain.setTargetAtTime(inCar ? 0.03 : 0.016, now, 0.12);
  const sirenWave = (Math.sin(clock.elapsedTime * 3.8) + 1) * 0.5;
  state.audio.siren.frequency.setTargetAtTime(650 + sirenWave * 430, now, 0.035);
  state.audio.sirenGain.gain.setTargetAtTime(state.drive.ambulance ? 0.2 : 0, now, 0.04);
}

function updateEnvironment(delta) {
  const time = clock.elapsedTime;
  state.water.material.roughness = 0.22 + Math.sin(time * 1.4) * 0.035;

  state.fogBank.forEach((fog, i) => {
    fog.position.x += delta * (1.8 + (i % 4) * 0.25);
    fog.position.y += Math.sin(time * 0.5 + i) * delta * 0.5;
    if (fog.position.x > 250) fog.position.x = -250;
  });

  updateWeather(state.snow, delta, 18, 5, 125, 2.2);
  updateWeather(state.leaves, delta, 10, 8, 92, 7.5);
}

function updateCamera(delta) {
  if (state.pov === "normal") {
    controls.enabled = true;
    controls.update();
    return;
  }

  controls.enabled = false;
  const car = state.driverCar;
  if (state.pov === "drive" && state.drive.camera === "normal") {
    const chaseForward = new THREE.Vector3(Math.sin(car.rotation.y), 0, Math.cos(car.rotation.y));
    const chasePosition = car.position
      .clone()
      .add(new THREE.Vector3(0, 8.5, 0))
      .add(chaseForward.clone().multiplyScalar(-17));
    camera.position.lerp(chasePosition, 1 - Math.exp(-delta * 7.5));
    camera.lookAt(
      car.position
        .clone()
        .add(chaseForward.multiplyScalar(15))
        .add(new THREE.Vector3(0, 1.4, 0)),
    );
    return;
  }

  const forward = new THREE.Vector3(Math.sin(car.rotation.y), 0, Math.cos(car.rotation.y));
  const side = new THREE.Vector3(Math.cos(car.rotation.y), 0, -Math.sin(car.rotation.y));
  camera.position
    .copy(car.position)
    .add(new THREE.Vector3(0, 3.8, 0))
    .add(forward.clone().multiplyScalar(2.9))
    .add(side.clone().multiplyScalar(-0.18));
  camera.lookAt(
    car.position
      .clone()
      .add(forward.multiplyScalar(44))
      .add(new THREE.Vector3(0, 2.5, 0)),
  );
}

function setDriveCamera(cameraMode) {
  state.drive.camera = cameraMode;
  const external = cameraMode === "normal";
  driveCameraButton.textContent = external ? "Camera: Normal" : "Camera: Dash";
  cockpitEl.classList.toggle("active", state.pov === "driver" || (state.pov === "drive" && !external));

  if (external && state.pov === "drive") {
    const car = state.driverCar;
    const forward = new THREE.Vector3(Math.sin(car.rotation.y), 0, Math.cos(car.rotation.y));
    camera.position
      .copy(car.position)
      .add(new THREE.Vector3(0, 8.5, 0))
      .add(forward.multiplyScalar(-17));
  }
}

function bindControls() {
  document.querySelector("#povControls").addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    document.querySelectorAll("[data-pov]").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    const wasDriving = state.pov === "drive";
    state.pov = button.dataset.pov;
    if (wasDriving !== (state.pov === "drive")) setDriveMode(state.pov === "drive");
    statusEl.textContent = `${button.textContent} POV`;
    const inCar = state.pov === "driver" || state.pov === "drive";
    cockpitEl.classList.toggle("active", inCar && (state.pov !== "drive" || state.drive.camera === "dash"));
    driveHelpEl.classList.toggle("active", state.pov === "drive");
    driveHelpEl.setAttribute("aria-hidden", String(state.pov !== "drive"));
    hintEl.textContent = state.pov === "drive"
      ? "WASD or arrow keys to drive"
      : (state.pov === "driver" ? "Driver dashboard POV" : "Drag to move. Scroll to zoom.");
    playControlClick();
  });

  document.querySelector("#settingControls").addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    document.querySelectorAll("[data-setting]").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    applySetting(button.dataset.setting);
    playControlClick();
  });

  document.querySelector("#soundControls").addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    const nextEnabled = !state.audio.enabled;
    setSoundEnabled(nextEnabled);
    button.classList.toggle("active", nextEnabled);
    button.textContent = nextEnabled ? "Sound On" : "Sound Off";
    playControlClick();
  });

  driveCameraButton.addEventListener("click", () => {
    setDriveCamera(state.drive.camera === "dash" ? "normal" : "dash");
    playControlClick();
  });

  ambulanceButton.addEventListener("click", () => {
    setAmbulanceMode(!state.drive.ambulance);
    playControlClick();
  });

  centerLaneButton.addEventListener("click", () => {
    centerPlayerInLane();
    playControlClick();
  });
}

function setDriveKey(event, pressed) {
  // Always release physical driving inputs before handling mode-specific
  // shortcuts. In particular, cruise control consumes ArrowUp to adjust its
  // set speed, so its keyup must not leave a previously pressed throttle key
  // latched in the driving-key set.
  if (!pressed) {
    state.drive.keys.delete(event.code);
    if (event.code === "KeyW" || event.code === "ArrowUp") {
      state.driverCar.userData.driveThrottle = 0;
    }
  }

  const signalModes = {
    KeyQ: "left",
    KeyE: "right",
    KeyZ: "hazard",
  };
  if (signalModes[event.code] && state.pov === "drive") {
    event.preventDefault();
    if (pressed && !event.repeat) {
      const nextSignal = signalModes[event.code];
      state.drive.signal = state.drive.signal === nextSignal ? null : nextSignal;
      const signalLabel = state.drive.signal
        ? `${state.drive.signal[0].toUpperCase()}${state.drive.signal.slice(1)}`
        : "Off";
      statusEl.textContent = `Turn signals: ${signalLabel}`;
      playControlClick();
    }
    return;
  }
  if (event.code === "KeyC" && state.pov === "drive") {
    event.preventDefault();
    if (pressed && !event.repeat) {
      state.drive.cruise.active = !state.drive.cruise.active;
      state.drive.cruise.adaptive = false;
      state.drive.cruise.speed = state.driverCar.userData.speed;
      statusEl.textContent = state.drive.cruise.active
        ? `Cruise control: ${Math.round(state.drive.cruise.speed * 760)} mph`
        : "Cruise control: Off";
      playControlClick();
    }
    return;
  }
  if (event.code === "Digit1" && state.pov === "drive") {
    event.preventDefault();
    if (pressed && !event.repeat) {
      const enabled = !(state.drive.cruise.active && state.drive.cruise.adaptive);
      state.drive.cruise.active = enabled;
      state.drive.cruise.adaptive = enabled;
      state.drive.cruise.speed = state.driverCar.userData.speed;
      statusEl.textContent = enabled
        ? `Adaptive cruise: ${Math.round(state.drive.cruise.speed * 760)} mph`
        : "Adaptive cruise: Off";
      playControlClick();
    }
    return;
  }
  if (event.code === "ArrowUp" && state.pov === "drive" && state.drive.cruise.active) {
    event.preventDefault();
    if (pressed) {
      state.drive.cruise.speed = Math.min(state.drive.cruise.speed + 1 / 760, 0.105);
      const cruiseLabel = state.drive.cruise.adaptive ? "Adaptive cruise" : "Cruise control";
      statusEl.textContent = `${cruiseLabel}: ${Math.round(state.drive.cruise.speed * 760)} mph`;
    }
    return;
  }
  const driveKeys = ["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight"];
  if (!driveKeys.includes(event.code)) return;
  if (state.pov !== "drive") {
    state.drive.keys.delete(event.code);
    return;
  }
  event.preventDefault();
  if (pressed && (event.code === "KeyS" || event.code === "ArrowDown") && state.drive.cruise.active) {
    state.drive.cruise.active = false;
    state.drive.cruise.adaptive = false;
    statusEl.textContent = "Cruise control: Cancelled by brake";
  }
  if (pressed) {
    state.drive.keys.add(event.code);
  }
}

function releaseDriveInputs() {
  state.drive.keys.clear();
  if (!state.driverCar) return;
  state.driverCar.userData.driveThrottle = 0;
  state.driverCar.userData.driveSteer = 0;
}

function onResize() {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function animate() {
  const delta = Math.min(clock.getDelta(), 0.06);
  countFrame();
  updateTraffic(delta);
  updateEnvironment(delta);
  updateAudio(delta);
  updateCamera(delta);
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

addLights();
createWorld();
createBridge();
createTraffic();
applySetting("summer");
bindControls();
window.addEventListener("resize", onResize);
document.addEventListener("keydown", (event) => setDriveKey(event, true), true);
document.addEventListener("keyup", (event) => setDriveKey(event, false), true);
window.addEventListener("blur", releaseDriveInputs);
window.addEventListener("pagehide", releaseDriveInputs);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) releaseDriveInputs();
});
setInterval(refreshFpsOverlay, 500);
animate();
