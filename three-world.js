import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const DEG = Math.PI / 180;
const PHI_MAX = 82 * DEG;
const GLOBE_RADIUS = 3.25;
const UP = new THREE.Vector3(0, 1, 0);
const FORWARD = new THREE.Vector3(0, 0, 1);
const ORIGIN = new THREE.Vector3();
const WORLD_WIDTH = 4000;
const WORLD_HEIGHT = 2400;

const COLORS = {
  island:0xaeba66,
  landmark:0xd0a24c,
  filler:0xe3b341,
  sailed:0xe0503f,
  here:0xd3a03c,
  next:0xf2d28e,
  hidden:0x5fa6bc,
  undersea:0x71b9cc,
  sky:0xe8f4ed,
  roaming:0xbb9260
};

const islandLongitudeOffsets = new Map([
  ['twin-cape', 6 * DEG],
  ['loguetown', 7 * DEG]
]);

function seededRandom(seedText) {
  let seed = 2166136261;
  for (let index = 0; index < seedText.length; index += 1) {
    seed ^= seedText.charCodeAt(index);
    seed = Math.imul(seed, 16777619);
  }
  return () => {
    seed += 0x6d2b79f5;
    let value = seed;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function lonLatFromMap(x, y) {
  return {
    lon:(x / WORLD_WIDTH) * Math.PI * 2,
    lat:(1 - (2 * y) / WORLD_HEIGHT) * PHI_MAX
  };
}

function geoVector(lon, lat, radius = GLOBE_RADIUS) {
  const theta = lon - 90 * DEG;
  const cosLat = Math.cos(lat);
  return new THREE.Vector3(
    radius * cosLat * Math.sin(theta),
    radius * Math.sin(lat),
    radius * cosLat * Math.cos(theta)
  );
}

function redLineCenter(sample) {
  return DEG * (
    0.38 * Math.sin(sample * 2 + 0.7) +
    0.22 * Math.sin(sample * 5 - 1.1) +
    0.11 * Math.sin(sample * 13 + 2.2)
  );
}

function redLineWidth(sample, side) {
  const base = 6.15 * DEG;
  const phase = side > 0 ? 1.7 : -0.45;
  const wobble =
    0.2 * Math.sin(sample * 3 + phase) +
    0.11 * Math.sin(sample * 7 - phase * 0.4) +
    0.065 * Math.sin(sample * 17 + phase * 2) +
    0.028 * Math.sin(sample * 37 - phase);
  return base * THREE.MathUtils.clamp(1 + wobble, 0.72, 1.38);
}

function redLinePoint(offset, sample, radius) {
  const cosOffset = Math.cos(offset);
  return new THREE.Vector3(
    radius * Math.sin(offset),
    radius * cosOffset * Math.sin(sample),
    radius * cosOffset * Math.cos(sample)
  );
}

function redLineCrossCoordinate(sample, offset) {
  const delta = offset - redLineCenter(sample);
  return delta / redLineWidth(sample, delta < 0 ? -1 : 1);
}

function redLineTerrainRadius(sample, cross) {
  const ridgeProfile = Math.pow(Math.max(0, Math.cos(cross * Math.PI * 0.5)), 1.12);
  const crag = ridgeProfile * (
    0.006 * Math.sin(sample * 11 + cross * 8) +
    0.004 * Math.sin(sample * 29 - cross * 15)
  );
  return GLOBE_RADIUS + 0.03 + ridgeProfile * 0.155 + crag;
}

function islandAltitude(island) {
  if (island.type === 'sky') return 0.52;
  if (island.type === 'undersea') return 0.035;
  return 0.068;
}

function ordinaryIslandVector(island, radius = GLOBE_RADIUS + islandAltitude(island)) {
  const {lon, lat} = lonLatFromMap(island.x, island.y);
  return geoVector(lon + (islandLongitudeOffsets.get(island.id) || 0), lat, radius);
}

function redLineLandmarkVector(island, clearance) {
  const direction = ordinaryIslandVector(island, 1).normalize();
  const sample = Math.atan2(direction.y, direction.z);
  return redLinePoint(redLineCenter(sample), sample, redLineTerrainRadius(sample, 0) + clearance);
}

function islandVector(island) {
  if (island.id === 'reverse-mountain') return redLineLandmarkVector(island, 0.012);
  if (island.id === 'mary-geoise') return redLineLandmarkVector(island, 0.14);
  return ordinaryIslandVector(island);
}

function orientTangent(object, position, sourceNormal = FORWARD) {
  object.position.copy(position);
  object.quaternion.setFromUnitVectors(sourceNormal, position.clone().normalize());
}

function createLine(points, material) {
  return new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), material);
}

function createOceanTexture(renderer) {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const context = canvas.getContext('2d');
  const gradient = context.createLinearGradient(0, 0, 0, 512);
  gradient.addColorStop(0, '#0d3447');
  gradient.addColorStop(0.28, '#174d62');
  gradient.addColorStop(0.5, '#246b7e');
  gradient.addColorStop(0.72, '#174d62');
  gradient.addColorStop(1, '#0d3447');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 1024, 512);
  const random = seededRandom('grand-line-ocean');
  for (let index = 0; index < 850; index += 1) {
    const x = random() * 1024;
    const y = random() * 512;
    const length = 3 + random() * 24;
    context.strokeStyle = random() > 0.52 ? 'rgba(180,225,231,.035)' : 'rgba(0,16,25,.045)';
    context.lineWidth = 0.4 + random() * 1.2;
    context.beginPath();
    context.moveTo(x, y);
    context.bezierCurveTo(x + length * 0.3, y - 2, x + length * 0.7, y + 2, x + length, y);
    context.stroke();
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
  return texture;
}

function latitudeBandGeometry(latMin, latMax, radius, segments = 256) {
  const positions = [];
  const normals = [];
  const indices = [];
  for (let index = 0; index <= segments; index += 1) {
    const lon = (index / segments) * Math.PI * 2;
    for (const lat of [latMin, latMax]) {
      const point = geoVector(lon, lat, radius);
      const normal = point.clone().normalize();
      positions.push(point.x, point.y, point.z);
      normals.push(normal.x, normal.y, normal.z);
    }
    if (index < segments) {
      const start = index * 2;
      indices.push(start, start + 1, start + 2, start + 1, start + 3, start + 2);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setIndex(indices);
  return geometry;
}

function redLineTerrainGeometry({segments = 360, acrossSegments = 32, widthScale = 1, terrain = true} = {}) {
  const positions = [];
  const normals = [];
  const colors = [];
  const indices = [];
  const edgeColor = new THREE.Color(0x71352f);
  const slopeColor = new THREE.Color(0xa7463b);
  const summitColor = new THREE.Color(0xc45b49);
  for (let index = 0; index <= segments; index += 1) {
    const sample = (index / segments) * Math.PI * 2;
    const center = redLineCenter(sample);
    const leftWidth = redLineWidth(sample, -1) * widthScale;
    const rightWidth = redLineWidth(sample, 1) * widthScale;
    for (let across = 0; across <= acrossSegments; across += 1) {
      const cross = (across / acrossSegments) * 2 - 1;
      const offset = center + (cross < 0 ? leftWidth * cross : rightWidth * cross);
      const ridgeProfile = Math.pow(Math.max(0, Math.cos(cross * Math.PI * 0.5)), 1.12);
      const radius = terrain ? redLineTerrainRadius(sample, cross) : GLOBE_RADIUS + 0.022;
      const point = redLinePoint(offset, sample, radius);
      const normal = point.clone().normalize();
      const color = edgeColor.clone().lerp(slopeColor, ridgeProfile).lerp(summitColor, ridgeProfile * 0.34);
      positions.push(point.x, point.y, point.z);
      normals.push(normal.x, normal.y, normal.z);
      colors.push(color.r, color.g, color.b);
    }
    if (index < segments) {
      for (let across = 0; across < acrossSegments; across += 1) {
        const row = acrossSegments + 1;
        const start = index * row + across;
        indices.push(start, start + 1, start + row, start + 1, start + row + 1, start + row);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function slerpUnit(start, end, progress, target = new THREE.Vector3()) {
  const dot = THREE.MathUtils.clamp(start.dot(end), -1, 1);
  if (dot > 0.9995) return target.copy(start).lerp(end, progress).normalize();
  if (dot < -0.9995) {
    const axis = new THREE.Vector3(1, 0, 0).cross(start);
    if (axis.lengthSq() < 0.0001) axis.set(0, 1, 0).cross(start);
    return target.copy(start).applyAxisAngle(axis.normalize(), Math.PI * progress).normalize();
  }
  const angle = Math.acos(dot);
  const sinAngle = Math.sin(angle);
  return target.copy(start)
    .multiplyScalar(Math.sin((1 - progress) * angle) / sinAngle)
    .addScaledVector(end, Math.sin(progress * angle) / sinAngle)
    .normalize();
}

function routeRadiusAboveRedLine(direction, baseRadius) {
  const sample = Math.atan2(direction.y, direction.z);
  const offset = Math.asin(THREE.MathUtils.clamp(direction.x, -1, 1));
  const cross = redLineCrossCoordinate(sample, offset);
  const distance = Math.abs(cross);
  if (distance >= 1.18) return baseRadius;
  const clearance = 1 - THREE.MathUtils.smoothstep(distance, 0.76, 1.18);
  const mountainRadius = redLineTerrainRadius(sample, cross) + 0.06;
  return THREE.MathUtils.lerp(baseRadius, Math.max(baseRadius, mountainRadius), clearance);
}

function sphericalRoutePath(start, end, minimumSegments = 18) {
  const a = start.clone().normalize();
  const b = end.clone().normalize();
  const angle = Math.acos(THREE.MathUtils.clamp(a.dot(b), -1, 1));
  const segments = Math.max(minimumSegments, Math.ceil(angle / (3.5 * DEG)));
  const points = [];
  for (let index = 0; index <= segments; index += 1) {
    const progress = index / segments;
    const eased = progress * progress * (3 - 2 * progress);
    const direction = slerpUnit(a, b, progress);
    const baseRadius = THREE.MathUtils.lerp(start.length(), end.length(), eased);
    points.push(direction.multiplyScalar(routeRadiusAboveRedLine(direction, baseRadius)));
  }
  return points;
}

function tubeFromPoints(points, radius, material, radialSegments = 5) {
  const curve = new THREE.CatmullRomCurve3(points, false, 'centripetal', 0.25);
  return new THREE.Mesh(
    new THREE.TubeGeometry(curve, Math.max(18, points.length * 2), radius, radialSegments, false),
    material
  );
}

function islandShapeGeometry(island, size) {
  const random = seededRandom(island.id);
  const shape = new THREE.Shape();
  const count = island.major ? 15 : 11;
  for (let index = 0; index < count; index += 1) {
    const angle = (index / count) * Math.PI * 2;
    const radius = size * (0.72 + random() * 0.46);
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius * (0.68 + random() * 0.25);
    if (index === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  }
  shape.closePath();
  return new THREE.ShapeGeometry(shape, 2);
}

function boxesOverlap(a, b) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function disposeGroup(group) {
  for (const child of [...group.children]) {
    child.traverse(object => object.geometry?.dispose?.());
    group.remove(child);
  }
}

export class ThreeWorldMap {
  constructor({canvas, container, labelLayer, islands, onSelect}) {
    this.canvas = canvas;
    this.container = container;
    this.labelLayer = labelLayer;
    this.islands = islands;
    this.islandById = new Map(islands.map(island => [island.id, island]));
    this.onSelect = onSelect;
    this.view = null;
    this.routeSignature = '';
    this.markerRecords = new Map();
    this.pickables = [];
    this.labelEntries = [];
    this.pointer = new THREE.Vector2();
    this.raycaster = new THREE.Raycaster();
    this.pointerStart = null;
    this.hoveredId = null;
    this.cameraTween = null;

    this.renderer = new THREE.WebGLRenderer({canvas, antialias:true, alpha:true, powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.06;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x061720);
    this.camera = new THREE.OrthographicCamera(-4, 4, 4, -4, 0.1, 80);
    this.camera.position.set(0, 0.55, 14);
    this.camera.lookAt(ORIGIN);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.065;
    this.controls.enablePan = false;
    this.controls.rotateSpeed = 0.55;
    this.controls.zoomSpeed = 0.8;
    this.controls.minZoom = 0.72;
    this.controls.maxZoom = 5;

    this.world = new THREE.Group();
    this.gridGroup = new THREE.Group();
    this.bandGroup = new THREE.Group();
    this.routeGroup = new THREE.Group();
    this.islandGroup = new THREE.Group();
    this.world.add(this.gridGroup, this.bandGroup, this.routeGroup, this.islandGroup);
    this.scene.add(this.world);

    this.scene.add(new THREE.HemisphereLight(0x9fd8e6, 0x061016, 1.45));
    const keyLight = new THREE.DirectionalLight(0xffe4ae, 2.3);
    keyLight.position.set(-5, 7, 9);
    this.scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0x4fb8d8, 1.25);
    rimLight.position.set(7, -2, -5);
    this.scene.add(rimLight);

    this.buildGlobe();
    this.buildIslands();
    this.buildRegionLabels();
    this.buildInteraction();
    this.resize();
    this.renderer.setAnimationLoop(time => this.render(time));
  }

  buildGlobe() {
    this.world.add(new THREE.Mesh(
      new THREE.SphereGeometry(GLOBE_RADIUS, 128, 72),
      new THREE.MeshBasicMaterial({map:createOceanTexture(this.renderer),color:0xffffff})
    ));

    for (let lat = -60; lat <= 60; lat += 30) {
      const points = [];
      for (let step = 0; step <= 180; step += 1) points.push(geoVector((step / 180) * Math.PI * 2, lat * DEG, GLOBE_RADIUS + 0.012));
      this.gridGroup.add(createLine(points, new THREE.LineBasicMaterial({color:0x6fb1c0,transparent:true,opacity:0.13,depthWrite:false})));
    }
    for (let lon = 0; lon < 360; lon += 30) {
      const points = [];
      for (let step = 0; step <= 120; step += 1) points.push(geoVector(lon * DEG, -Math.PI / 2 + (step / 120) * Math.PI, GLOBE_RADIUS + 0.013));
      this.gridGroup.add(createLine(points, new THREE.LineBasicMaterial({color:0x6fb1c0,transparent:true,opacity:0.13,depthWrite:false})));
    }

    const addBand = (min, max, color, opacity, offset) => {
      const mesh = new THREE.Mesh(
        latitudeBandGeometry(min * DEG, max * DEG, GLOBE_RADIUS + offset),
        new THREE.MeshBasicMaterial({color,transparent:true,opacity,side:THREE.DoubleSide,depthWrite:false})
      );
      this.bandGroup.add(mesh);
    };
    addBand(-11.8, -6.7, 0x04141d, 0.82, 0.022);
    addBand(6.7, 11.8, 0x04141d, 0.82, 0.022);
    addBand(-6.5, 6.5, 0x73b7c9, 0.34, 0.028);
    addBand(-0.7, 0.7, 0xb4dce3, 0.22, 0.034);

    this.bandGroup.add(new THREE.Mesh(
      redLineTerrainGeometry({acrossSegments:8,widthScale:1.08,terrain:false}),
      new THREE.MeshBasicMaterial({color:0x52231f,side:THREE.DoubleSide})
    ));
    this.bandGroup.add(new THREE.Mesh(
      redLineTerrainGeometry(),
      new THREE.MeshStandardMaterial({vertexColors:true,roughness:0.93,metalness:0,emissive:0x2a0806,emissiveIntensity:0.38,side:THREE.DoubleSide})
    ));

    const atmosphere = new THREE.Mesh(
      new THREE.SphereGeometry(GLOBE_RADIUS * 1.035, 96, 56),
      new THREE.ShaderMaterial({
        side:THREE.BackSide,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
        vertexShader:'varying vec3 vNormal; void main(){vNormal=normalize(normalMatrix*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
        fragmentShader:'varying vec3 vNormal; void main(){float rim=pow(1.0-abs(vNormal.z),2.6);gl_FragColor=vec4(0.20,0.65,0.78,rim*0.27);}'
      })
    );
    this.scene.add(atmosphere);
  }

  buildIslands() {
    const cloudMaterial = new THREE.MeshBasicMaterial({color:0xe8f3ef,transparent:true,opacity:0.86,depthWrite:false});
    for (const island of this.islands) {
      const size = island.major ? 0.092 : island.type === 'filler' ? 0.07 : 0.059;
      const position = islandVector(island);
      const baseColor = COLORS[island.type] || COLORS.island;
      const material = new THREE.MeshStandardMaterial({
        color:baseColor,roughness:0.86,metalness:0,side:THREE.DoubleSide,
        transparent:island.type === 'undersea',opacity:island.type === 'undersea' ? 0.82 : 1
      });
      const blob = new THREE.Mesh(islandShapeGeometry(island, size), material);
      orientTangent(blob, position, FORWARD);
      blob.userData.island = island;
      this.islandGroup.add(blob);

      const peak = new THREE.Mesh(new THREE.ConeGeometry(size * 0.34, size * 0.36, island.major ? 7 : 5), material);
      orientTangent(peak, position.clone().addScaledVector(position.clone().normalize(), size * 0.14), UP);
      this.islandGroup.add(peak);

      if (island.type === 'sky') {
        const normal = position.clone().normalize();
        const surface = ordinaryIslandVector(island, GLOBE_RADIUS + 0.075);
        const altitudeLine = createLine([surface, position.clone().addScaledVector(normal, -0.015)], new THREE.LineDashedMaterial({
          color:0xdceef0,transparent:true,opacity:0.38,dashSize:0.055,gapSize:0.042,depthWrite:false
        }));
        altitudeLine.computeLineDistances();
        this.islandGroup.add(altitudeLine);
        const cloud = new THREE.Group();
        orientTangent(cloud, position.clone().addScaledVector(normal, -0.035), UP);
        const cloudGeometry = new THREE.SphereGeometry(size * 0.82, 14, 9);
        for (const [x,y,z,scale] of [[-0.52,0,0,1.18],[0,0.025,0,1.42],[0.52,0,0,1.05],[-0.18,0,0.34,1],[0.28,0,-0.3,0.92]]) {
          const puff = new THREE.Mesh(cloudGeometry, cloudMaterial);
          puff.position.set(x * size * 1.35, y, z * size * 1.35);
          puff.scale.set(1.35 * scale, 0.48 * scale, scale);
          cloud.add(puff);
        }
        this.islandGroup.add(cloud);
      }

      const pick = new THREE.Mesh(
        new THREE.SphereGeometry(Math.max(0.095, size * 1.45), 10, 8),
        new THREE.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false})
      );
      pick.position.copy(position);
      pick.userData.island = island;
      this.islandGroup.add(pick);
      this.pickables.push(pick);

      const progressRing = new THREE.Mesh(
        new THREE.RingGeometry(size * 1.22, size * 1.42, 36, 1, Math.PI * -0.5, 0.001),
        new THREE.MeshBasicMaterial({color:COLORS.sailed,side:THREE.DoubleSide,depthWrite:false})
      );
      orientTangent(progressRing, position.clone().multiplyScalar(1.004), FORWARD);
      progressRing.visible = false;
      this.world.add(progressRing);

      const labelPosition = island.id === 'mary-geoise'
        ? redLineLandmarkVector({...island,y:island.y - 58}, 0.23)
        : position.clone().addScaledVector(position.clone().normalize(), 0.07);
      const label = this.addLabel(island.n, 'island ' + (island.major || island.type === 'landmark' ? 'major' : 'minor'), {
        position:labelPosition,
        priority:island.major || island.type === 'landmark' ? 2 : 4,
        minor:!island.major && island.type !== 'landmark',
        islandId:island.id
      });
      this.markerRecords.set(island.id, {island,position,size,blob,peak,pick,material,progressRing,progressFraction:0,label});
    }

    this.selectionRing = new THREE.Mesh(
      new THREE.RingGeometry(0.11, 0.15, 40),
      new THREE.MeshBasicMaterial({color:0xf2d28e,transparent:true,opacity:0.95,side:THREE.DoubleSide,depthWrite:false})
    );
    this.selectionRing.visible = false;
    this.world.add(this.selectionRing);
  }

  addLabel(text, className, options = {}) {
    const element = document.createElement('div');
    element.className = `globe-label ${className}`;
    element.textContent = text;
    this.labelLayer.appendChild(element);
    const entry = {
      element,
      position:options.position,
      priority:options.priority ?? 3,
      rotation:options.rotation || 0,
      minor:Boolean(options.minor),
      region:Boolean(options.region),
      islandId:options.islandId || null
    };
    this.labelEntries.push(entry);
    return entry;
  }

  buildRegionLabels() {
    const region = (text, lon, lat, className, options = {}) => this.addLabel(text, className, {
      position:geoVector(lon * DEG, lat * DEG, GLOBE_RADIUS + (options.altitude || 0.14)),
      priority:options.priority ?? 0,rotation:options.rotation || 0,region:true
    });
    region('NORTH BLUE',45,53,'region');
    region('EAST BLUE',140,53,'region');
    region('WEST BLUE',45,-53,'region');
    region('SOUTH BLUE',140,-53,'region');
    region('PARADISE',104,4.35,'zone',{priority:1});
    region('NEW WORLD',284,4.35,'zone',{priority:1});
    for (const lon of [45,135,225,315]) {
      region('CALM BELT',lon,9.2,'band',{priority:1});
      region('CALM BELT',lon,-9.2,'band',{priority:1});
    }
    for (const lon of [90,270]) {
      region('RED LINE',lon,40,'redline',{priority:1,rotation:-90,altitude:0.29});
      region('RED LINE',lon,-40,'redline',{priority:1,rotation:-90,altitude:0.29});
    }
  }

  buildInteraction() {
    const setPointer = event => {
      const rect = this.canvas.getBoundingClientRect();
      this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    };
    const pick = event => {
      setPointer(event);
      this.raycaster.setFromCamera(this.pointer, this.camera);
      const cameraDirection = this.camera.position.clone().normalize();
      return this.raycaster.intersectObjects(this.pickables, false)
        .find(hit => hit.object.position.clone().normalize().dot(cameraDirection) > 0.08)?.object.userData.island || null;
    };
    this.canvas.addEventListener('pointerdown', event => {
      this.pointerStart = {x:event.clientX,y:event.clientY};
      this.canvas.classList.add('dragging');
    });
    this.canvas.addEventListener('pointermove', event => {
      if (event.pointerType === 'touch' || this.pointerStart) return;
      const island = pick(event);
      this.hoveredId = island?.id || null;
      this.canvas.style.cursor = island ? 'pointer' : 'grab';
    });
    this.canvas.addEventListener('pointerup', event => {
      if (!this.pointerStart) return;
      const moved = Math.hypot(event.clientX - this.pointerStart.x, event.clientY - this.pointerStart.y);
      this.pointerStart = null;
      this.canvas.classList.remove('dragging');
      if (moved < 7) this.onSelect(pick(event)?.id || null);
    });
    this.canvas.addEventListener('pointercancel', () => {
      this.pointerStart = null;
      this.canvas.classList.remove('dragging');
    });
    this.canvas.addEventListener('pointerleave', () => {
      this.hoveredId = null;
      this.canvas.classList.remove('dragging');
    });
  }

  update(view) {
    this.view = view;
    for (const [id, record] of this.markerRecords) {
      const hiddenFiller = record.island.type === 'filler' && !view.fillerVisible;
      const status = view.statusById.get(id) || 'unreached';
      const shielded = view.shieldedIds.has(id);
      const color = shielded ? COLORS.hidden
        : status === 'here' ? COLORS.here
        : status === 'sailed' ? COLORS.sailed
        : status === 'next' ? COLORS.next
        : record.island.type === 'filler' ? COLORS.filler
        : COLORS[record.island.type] || COLORS.island;
      record.blob.visible = record.peak.visible = record.pick.visible = !hiddenFiller;
      record.material.color.setHex(color);
      record.label.element.textContent = shielded ? '???' : record.island.n;
      record.label.element.classList.toggle('sailed', status === 'sailed');
      record.label.element.classList.toggle('here', status === 'here');
      record.label.element.classList.toggle('filler', record.island.type === 'filler');
      const selected = view.selectedId === id;
      record.blob.scale.setScalar(selected ? 1.22 : 1);
      record.peak.scale.setScalar(selected ? 1.18 : 1);
      const fraction = view.progressById.get(id) || 0;
      if (fraction > 0 && fraction < 1 && Math.abs(fraction - record.progressFraction) > 0.001) {
        record.progressRing.geometry.dispose();
        record.progressRing.geometry = new THREE.RingGeometry(record.size * 1.22, record.size * 1.42, 36, 1, -Math.PI / 2, fraction * Math.PI * 2);
        record.progressFraction = fraction;
      }
      record.progressRing.visible = !hiddenFiller && fraction > 0 && fraction < 1;
    }

    const selected = view.selectedId && this.markerRecords.get(view.selectedId);
    if (selected) {
      orientTangent(this.selectionRing, selected.position.clone().multiplyScalar(1.008), FORWARD);
      this.selectionRing.scale.setScalar(selected.island.major || selected.island.type === 'landmark' ? 1.14 : 0.88);
      this.selectionRing.visible = true;
    } else this.selectionRing.visible = false;

    const signature = JSON.stringify({
      route:view.routeStops.map(stop => [stop.id,stop.reached]),
      filler:view.fillerVisible ? [...view.fillerDoneIds].sort() : []
    });
    if (signature !== this.routeSignature) {
      this.routeSignature = signature;
      this.rebuildRoute(view);
    }
  }

  rebuildRoute(view) {
    disposeGroup(this.routeGroup);
    const sailedGlow = new THREE.MeshBasicMaterial({color:0xe75747,transparent:true,opacity:0.24,depthWrite:false});
    const sailedCore = new THREE.MeshBasicMaterial({color:0xff8f75});
    const aheadMaterial = new THREE.LineDashedMaterial({color:0xeadfc8,transparent:true,opacity:0.34,dashSize:0.055,gapSize:0.06,depthWrite:false});
    for (let index = 0; index < view.routeStops.length - 1; index += 1) {
      const from = this.markerRecords.get(view.routeStops[index].id);
      const to = this.markerRecords.get(view.routeStops[index + 1].id);
      if (!from || !to) continue;
      const points = sphericalRoutePath(from.position, to.position);
      if (view.routeStops[index + 1].reached) {
        this.routeGroup.add(tubeFromPoints(points, 0.034, sailedGlow), tubeFromPoints(points, 0.012, sailedCore, 6));
      } else {
        const line = createLine(points, aheadMaterial);
        line.computeLineDistances();
        this.routeGroup.add(line);
      }
    }

    if (view.fillerVisible) {
      for (const island of this.islands.filter(item => item.type === 'filler')) {
        const from = this.markerRecords.get(island.from);
        const filler = this.markerRecords.get(island.id);
        const to = this.markerRecords.get(island.to);
        if (!from || !filler || !to) continue;
        const material = new THREE.LineDashedMaterial({
          color:0xe3b341,transparent:true,opacity:view.fillerDoneIds.has(island.id) ? 0.82 : 0.42,
          dashSize:0.035,gapSize:0.055,depthWrite:false
        });
        const line = createLine([...sphericalRoutePath(from.position, filler.position), ...sphericalRoutePath(filler.position, to.position).slice(1)], material);
        line.computeLineDistances();
        this.routeGroup.add(line);
      }
    }
  }

  updateLabels() {
    if (!this.view) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    const cameraDirection = this.camera.position.clone().normalize();
    const candidates = [];
    for (const entry of this.labelEntries) {
      const record = entry.islandId ? this.markerRecords.get(entry.islandId) : null;
      if (record?.island.type === 'filler' && !this.view.fillerVisible) {
        entry.element.classList.remove('visible');
        continue;
      }
      const facing = entry.position.clone().normalize().dot(cameraDirection);
      const selected = entry.islandId && this.view.selectedId === entry.islandId;
      const pinned = selected || entry.islandId === 'mary-geoise';
      const status = entry.islandId ? this.view.statusById.get(entry.islandId) : null;
      const minorVisible = !entry.minor || this.camera.zoom > 1.75 || selected || status === 'here';
      if (facing < 0.12 || !minorVisible) {
        entry.element.classList.remove('visible');
        continue;
      }
      const projected = entry.position.clone().project(this.camera);
      const x = (projected.x * 0.5 + 0.5) * width;
      const y = (-projected.y * 0.5 + 0.5) * height;
      const textWidth = entry.region ? Math.max(76, entry.element.textContent.length * 10) : entry.element.textContent.length * 6.1 + 12;
      const textHeight = entry.region ? 24 : 16;
      candidates.push({entry,x,y,selected,pinned,box:{left:x-textWidth/2,right:x+textWidth/2,top:y-textHeight/2,bottom:y+textHeight/2}});
    }
    candidates.sort((a,b) => (a.pinned ? -1 : a.entry.priority) - (b.pinned ? -1 : b.entry.priority));
    const placed = [];
    for (const candidate of candidates) {
      const collision = !candidate.entry.region && placed.some(box => boxesOverlap(candidate.box, box));
      if (collision && !candidate.pinned) {
        candidate.entry.element.classList.remove('visible');
        continue;
      }
      placed.push(candidate.box);
      candidate.entry.element.style.transform = `translate(-50%,-50%) translate(${candidate.x}px,${candidate.y}px) rotate(${candidate.entry.rotation}deg)`;
      candidate.entry.element.classList.add('visible');
    }
  }

  focusIsland(id) {
    const record = this.markerRecords.get(id);
    if (!record) return;
    const distance = this.camera.position.length();
    this.cameraTween = {
      start:performance.now(),duration:720,
      from:this.camera.position.clone().normalize(),to:record.position.clone().normalize(),distance,
      fromZoom:this.camera.zoom,toZoom:Math.max(1.35,this.camera.zoom)
    };
    this.controls.enabled = false;
  }

  reset() {
    const distance = this.camera.position.length();
    this.cameraTween = {
      start:performance.now(),duration:720,
      from:this.camera.position.clone().normalize(),to:new THREE.Vector3(0,0.04,1).normalize(),distance,
      fromZoom:this.camera.zoom,toZoom:1
    };
    this.controls.enabled = false;
  }

  setZoom(value) {
    this.camera.zoom = THREE.MathUtils.clamp(value, this.controls.minZoom, this.controls.maxZoom);
    this.camera.updateProjectionMatrix();
  }

  resize() {
    const width = Math.max(1, this.container.clientWidth);
    const height = Math.max(1, this.container.clientHeight);
    const aspect = width / height;
    const half = 4;
    this.camera.left = -half * aspect;
    this.camera.right = half * aspect;
    this.camera.top = half;
    this.camera.bottom = -half;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }

  render(time) {
    if (this.cameraTween) {
      const progress = Math.min(1, (time - this.cameraTween.start) / this.cameraTween.duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      const direction = slerpUnit(this.cameraTween.from, this.cameraTween.to, eased);
      this.camera.position.copy(direction.multiplyScalar(this.cameraTween.distance));
      this.camera.zoom = THREE.MathUtils.lerp(this.cameraTween.fromZoom, this.cameraTween.toZoom, eased);
      this.camera.updateProjectionMatrix();
      this.camera.lookAt(ORIGIN);
      if (progress >= 1) {
        this.cameraTween = null;
        this.controls.enabled = true;
      }
    }
    this.controls.update();
    this.renderer.render(this.scene, this.camera);
    this.updateLabels();
  }
}
