import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { ISLAND_STUDIES } from './map-island-designs.js?v=1';

const DEG = Math.PI / 180;
const R = 3.25;
const PHI_MAX = 82 * DEG;
const UP = new THREE.Vector3(0, 1, 0);
const FORWARD = new THREE.Vector3(0, 0, 1);
const ORIGIN = new THREE.Vector3();

function seeded(seedText){
  let value = 2166136261;
  for (const letter of seedText){ value ^= letter.charCodeAt(0); value = Math.imul(value, 16777619); }
  return () => {
    value += 0x6d2b79f5;
    let n = value;
    n = Math.imul(n ^ n >>> 15, n | 1);
    n ^= n + Math.imul(n ^ n >>> 7, n | 61);
    return ((n ^ n >>> 14) >>> 0) / 4294967296;
  };
}

function geoVector(lon, lat, radius = R){
  const theta = lon - Math.PI / 2;
  const cosLat = Math.cos(lat);
  return new THREE.Vector3(radius * cosLat * Math.sin(theta), radius * Math.sin(lat), radius * cosLat * Math.cos(theta));
}
function mapPosition(x, y, altitude = 0.045){
  return geoVector((x / 4000) * Math.PI * 2, (1 - 2 * y / 2400) * PHI_MAX, R + altitude);
}
function orient(object, position, source = UP){
  object.position.copy(position);
  object.quaternion.setFromUnitVectors(source, position.clone().normalize());
}

const canvas = document.getElementById('mapLab');
const renderer = new THREE.WebGLRenderer({canvas, antialias:true, powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.8));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.08;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x04151d);
const camera = new THREE.OrthographicCamera(-5, 5, 5, -5, 0.1, 80);
camera.position.set(0, 0.4, 13);
camera.lookAt(ORIGIN);
const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.065;
controls.enablePan = false;
controls.minZoom = 0.78;
controls.maxZoom = 5.2;
controls.rotateSpeed = 0.52;

scene.add(new THREE.HemisphereLight(0xbce6e8, 0x180d0b, 1.75));
const sun = new THREE.DirectionalLight(0xffddb0, 2.7);
sun.position.set(-5, 7, 9);
scene.add(sun);
const rim = new THREE.DirectionalLight(0x4bb2cc, 1.5);
rim.position.set(7, -2, -6);
scene.add(rim);

const world = new THREE.Group();
scene.add(world);

function oceanTexture(){
  const textureCanvas = document.createElement('canvas');
  textureCanvas.width = 1400; textureCanvas.height = 700;
  const ctx = textureCanvas.getContext('2d');
  const gradient = ctx.createLinearGradient(0, 0, 0, 700);
  gradient.addColorStop(0, '#123d50'); gradient.addColorStop(.3, '#347b8d');
  gradient.addColorStop(.5, '#4b92a0'); gradient.addColorStop(.7, '#347b8d'); gradient.addColorStop(1, '#123d50');
  ctx.fillStyle = gradient; ctx.fillRect(0, 0, 1400, 700);
  const random = seeded('painted-ocean');
  for (let index = 0; index < 2300; index++){
    const x = random() * 1400, y = random() * 700;
    const length = 4 + random() * 34;
    ctx.strokeStyle = random() > .48 ? `rgba(222,242,235,${.018 + random() * .035})` : `rgba(0,27,39,${.018 + random() * .032})`;
    ctx.lineWidth = .4 + random() * 1.6;
    ctx.beginPath(); ctx.moveTo(x, y);
    ctx.bezierCurveTo(x + length * .3, y - 2, x + length * .7, y + 2, x + length, y);
    ctx.stroke();
  }
  for (let band = 0; band < 13; band++){
    const y = band * 58 + random() * 25;
    ctx.fillStyle = band % 2 ? 'rgba(225,244,238,.018)' : 'rgba(5,38,49,.022)';
    ctx.fillRect(0, y, 1400, 14 + random() * 26);
  }
  const texture = new THREE.CanvasTexture(textureCanvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = THREE.RepeatWrapping;
  texture.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 8);
  return texture;
}

world.add(new THREE.Mesh(
  new THREE.SphereGeometry(R, 128, 80),
  new THREE.MeshStandardMaterial({map:oceanTexture(),roughness:.95,metalness:0})
));

function latitudeBand(min, max, radius, segments = 256){
  const positions = [], indices = [];
  for (let step = 0; step <= segments; step++){
    const lon = step / segments * Math.PI * 2;
    for (const lat of [min, max]){
      const point = geoVector(lon, lat, radius);
      positions.push(point.x, point.y, point.z);
    }
    if (step < segments){ const start = step * 2; indices.push(start,start+1,start+2,start+1,start+3,start+2); }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return geometry;
}
const addBand = (min,max,color,opacity,offset) => world.add(new THREE.Mesh(
  latitudeBand(min*DEG,max*DEG,R+offset),
  new THREE.MeshBasicMaterial({color,transparent:true,opacity,depthWrite:false,side:THREE.DoubleSide})
));
addBand(-12,-6.8,0x06151b,.82,.018); addBand(6.8,12,0x06151b,.82,.018);
addBand(-6.6,6.6,0x8bc5cf,.32,.025); addBand(-.65,.65,0xd3ebea,.2,.032);

function redCenter(sample){ return DEG * (.55*Math.sin(sample*2+.4)+.28*Math.sin(sample*7-1.2)+.13*Math.sin(sample*19)); }
function redWidth(sample, side){
  const phase = side < 0 ? -.7 : 1.5;
  return 7.1 * DEG * THREE.MathUtils.clamp(1 + .23*Math.sin(sample*3+phase)+.11*Math.sin(sample*11-phase)+.045*Math.sin(sample*37+phase), .7, 1.42);
}
function wrapPi(value){ return Math.atan2(Math.sin(value), Math.cos(value)); }
function segmentDistance(px,py,ax,ay,bx,by){
  const dx=bx-ax,dy=by-ay;
  const t=THREE.MathUtils.clamp(((px-ax)*dx+(py-ay)*dy)/(dx*dx+dy*dy),0,1);
  return Math.hypot(px-(ax+dx*t),py-(ay+dy*t));
}
const channelRoutes = [
  {cut:[-.98,-1.35],mouth:[-1.3,-1.55],curve:-.05},
  {cut:[.98,-1.25],mouth:[1.3,-1.43],curve:.045},
  {cut:[-.98,1.35],mouth:[-1.3,1.56],curve:.05},
  {cut:[.98,1.28],mouth:[1.3,1.47],curve:-.045},
  {cut:[.99,0],mouth:[1.33,.01],curve:.025}
];
function channelInfluence(sample,cross){
  const vertical = wrapPi(sample) / .18;
  if (Math.abs(vertical) > 1.7 || Math.abs(cross) > 1.2) return 0;
  let influence = Math.exp(-Math.pow(Math.hypot(cross,vertical)/.22,4));
  for (const {cut:[endX,endY]} of channelRoutes){
    const distance = segmentDistance(cross,vertical,0,0,endX,endY);
    influence = Math.max(influence, Math.exp(-Math.pow(distance/.115,2)));
  }
  return THREE.MathUtils.clamp(influence,0,1);
}
function redRadius(sample,cross){
  const ridge = Math.pow(Math.max(0,Math.cos(cross*Math.PI*.5)),1.05);
  const terraces = .018*Math.sin(sample*23+cross*9)+.01*Math.sin(sample*51-cross*17);
  const natural = R+.026+ridge*(.18+terraces)+ridge*ridge*.075;
  const channel = channelInfluence(sample,cross);
  return THREE.MathUtils.lerp(natural,R+.034,channel*.97);
}
function redPoint(cross,sample,radius){
  const center=redCenter(sample), width=redWidth(sample,cross<0?-1:1);
  const offset=center+cross*width,co=Math.cos(offset);
  return new THREE.Vector3(radius*Math.sin(offset),radius*co*Math.sin(sample),radius*co*Math.cos(sample));
}
function redTerrain({segments=420,across=38,base=false}={}){
  const positions=[],colors=[],indices=[];
  const edge=new THREE.Color(base?0x54251f:0x74342d),slope=new THREE.Color(0xa94b3d),summit=new THREE.Color(0xce6652),water=new THREE.Color(0x5fa7b5);
  for(let row=0;row<=segments;row++){
    const sample=row/segments*Math.PI*2;
    for(let col=0;col<=across;col++){
      const cross=col/across*2-1;
      const point=redPoint(cross,sample,base?R+.02:redRadius(sample,cross));
      const ridge=Math.pow(Math.max(0,Math.cos(cross*Math.PI*.5)),1.1);
      const color=edge.clone().lerp(slope,ridge).lerp(summit,ridge*ridge*.38).lerp(water,channelInfluence(sample,cross)*.88);
      positions.push(point.x,point.y,point.z); colors.push(color.r,color.g,color.b);
    }
    if(row<segments) for(let col=0;col<across;col++){
      const width=across+1,start=row*width+col;
      indices.push(start,start+1,start+width,start+1,start+width+1,start+width);
    }
  }
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geometry.setIndex(indices);geometry.computeVertexNormals();return geometry;
}
world.add(new THREE.Mesh(redTerrain({across:12,base:true}),new THREE.MeshBasicMaterial({vertexColors:true,side:THREE.DoubleSide})));
world.add(new THREE.Mesh(redTerrain({across:60}),new THREE.MeshStandardMaterial({vertexColors:true,roughness:.98,metalness:0,emissive:0x210604,emissiveIntensity:.24,side:THREE.DoubleSide})));

const waterMaterial=new THREE.MeshBasicMaterial({color:0x5d9fa5,transparent:true,opacity:.94,side:THREE.DoubleSide,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3});
const channelWaterMaterial=new THREE.ShaderMaterial({
  transparent:true,depthWrite:false,side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3,
  vertexShader:'attribute float flowAlpha;varying float vFlowAlpha;void main(){vFlowAlpha=flowAlpha;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:'varying float vFlowAlpha;void main(){gl_FragColor=vec4(.365,.624,.647,.95*vFlowAlpha);}'
});
const channelBankMaterial=new THREE.MeshStandardMaterial({color:0x173e45,roughness:.9,metalness:0,side:THREE.DoubleSide});
function channelRibbon(route,widthScale,lift,material,flowIntoSea=true){
  const positions=[],indices=[],alphas=[],steps=54;
  const [cutX,cutY]=route.cut,[mouthX,mouthY]=route.mouth;
  const finalStep=flowIntoSea?steps:Math.floor(steps*.74);
  for(let step=0;step<=finalStep;step++){
    const t=step/steps;
    const inMountain=Math.min(1,t/.74),atSea=Math.max(0,(t-.74)/.26);
    const eased=inMountain*inMountain*(3-2*inMountain);
    let centerX=THREE.MathUtils.lerp(0,cutX,eased),centerY=THREE.MathUtils.lerp(0,cutY,eased);
    const length=Math.hypot(cutX,cutY),normalX=-cutY/length,normalY=cutX/length;
    const curve=Math.sin(inMountain*Math.PI)*route.curve;
    centerX+=normalX*curve;centerY+=normalY*curve;
    if(atSea>0){
      const seaEase=atSea*atSea*(3-2*atSea);
      centerX=THREE.MathUtils.lerp(cutX,mouthX,seaEase);centerY=THREE.MathUtils.lerp(cutY,mouthY,seaEase);
    }
    const nextT=Math.min(1,t+1/steps),nextIn=Math.min(1,nextT/.74),nextSea=Math.max(0,(nextT-.74)/.26);
    const nextEase=nextIn*nextIn*(3-2*nextIn);
    let nextX=THREE.MathUtils.lerp(0,cutX,nextEase),nextY=THREE.MathUtils.lerp(0,cutY,nextEase);
    const nextCurve=Math.sin(nextIn*Math.PI)*route.curve;nextX+=normalX*nextCurve;nextY+=normalY*nextCurve;
    if(nextSea>0){
      const seaEase=nextSea*nextSea*(3-2*nextSea);
      nextX=THREE.MathUtils.lerp(cutX,mouthX,seaEase);nextY=THREE.MathUtils.lerp(cutY,mouthY,seaEase);
    }
    const tangentX=nextX-centerX,tangentY=nextY-centerY,tangentLength=Math.hypot(tangentX,tangentY)||1;
    const perpX=-tangentY/tangentLength,perpY=tangentX/tangentLength;
    const seaMouth=(1-atSea)*(1+.4*Math.sin(atSea*Math.PI));
    const halfWidth=widthScale*(atSea>0?seaMouth:THREE.MathUtils.lerp(.38,1,eased));
    const flowAlpha=flowIntoSea?Math.pow(1-atSea,2.4):1;
    for(const side of [-1,1]){
      const cross=centerX+perpX*halfWidth*side;
      const vertical=centerY+perpY*halfWidth*side;
      const sample=vertical*.18;
      const mountainRadius=redRadius(sample,cross)+lift;
      const radius=THREE.MathUtils.lerp(mountainRadius,R-.018,Math.pow(atSea,.82));
      const point=redPoint(cross,sample,radius);
      positions.push(point.x,point.y,point.z);alphas.push(flowAlpha);
    }
    if(step<finalStep){const start=step*2;indices.push(start,start+1,start+2,start+1,start+3,start+2);}
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setAttribute('flowAlpha',new THREE.Float32BufferAttribute(alphas,1));geometry.setIndex(indices);geometry.computeVertexNormals();
  return new THREE.Mesh(geometry,material);
}
for(const route of channelRoutes){
  world.add(channelRibbon(route,.079,.012,channelBankMaterial,false));
  world.add(channelRibbon(route,.068,.027,channelWaterMaterial));
}
const basinPosition=redPoint(0,0,redRadius(0,0)+.015);
const basinBank=new THREE.Mesh(new THREE.CircleGeometry(.155,36),channelBankMaterial);orient(basinBank,basinPosition.clone().multiplyScalar(.9995),FORWARD);world.add(basinBank);
const basin=new THREE.Mesh(new THREE.CircleGeometry(.115,32),waterMaterial);
orient(basin,basinPosition,FORWARD);world.add(basin);

const materials={
  green:new THREE.MeshStandardMaterial({color:0x829a4e,roughness:.96}),
  jungle:new THREE.MeshStandardMaterial({color:0x54763d,roughness:.98}),
  sand:new THREE.MeshStandardMaterial({color:0xc9a45a,roughness:.96}),
  rock:new THREE.MeshStandardMaterial({color:0x7b5038,roughness:1}),
  snow:new THREE.MeshStandardMaterial({color:0xe7ece5,roughness:.9}),
  dark:new THREE.MeshStandardMaterial({color:0x3b4538,roughness:1}),
  city:new THREE.MeshStandardMaterial({color:0xd9cfad,roughness:.88}),
  roof:new THREE.MeshStandardMaterial({color:0x9d3b32,roughness:.9}),
  wood:new THREE.MeshStandardMaterial({color:0x5f3d29,roughness:1}),
  cloud:new THREE.MeshStandardMaterial({color:0xe8efeb,roughness:.88,transparent:true,opacity:.94}),
  gold:new THREE.MeshStandardMaterial({color:0xd7a93d,roughness:.55,metalness:.25}),
  future:new THREE.MeshStandardMaterial({color:0xd8e6e4,roughness:.36,metalness:.18}),
  glass:new THREE.MeshStandardMaterial({color:0x79c7d3,roughness:.18,metalness:.08,transparent:true,opacity:.82}),
  ice:new THREE.MeshStandardMaterial({color:0xaad6dc,roughness:.82}),
  fire:new THREE.MeshStandardMaterial({color:0xd45b35,roughness:.88,emissive:0x571308,emissiveIntensity:.42}),
  pink:new THREE.MeshStandardMaterial({color:0xe78e9d,roughness:.9}),
  candy:new THREE.MeshStandardMaterial({color:0xe7b27e,roughness:.82}),
  navy:new THREE.MeshStandardMaterial({color:0x334e60,roughness:.85}),
};

function islandBase(seedText,size,material,aspect=1,height=.045){
  const random=seeded(seedText),segments=24,positions=[0,height,0,0,-.018,0],indices=[];
  for(let index=0;index<segments;index++){
    const angle=index/segments*Math.PI*2;
    const radius=size*(.78+random()*.34)*(1+.08*Math.sin(angle*3+random()*2));
    positions.push(Math.cos(angle)*radius,height*(.82+random()*.24),Math.sin(angle)*radius*aspect);
    positions.push(Math.cos(angle)*radius*1.04,-.018,Math.sin(angle)*radius*aspect*1.04);
  }
  for(let index=0;index<segments;index++){
    const next=(index+1)%segments,top=2+index*2,bottom=top+1,nextTop=2+next*2,nextBottom=nextTop+1;
    indices.push(0,top,nextTop,1,nextBottom,bottom,top,bottom,nextTop,nextTop,bottom,nextBottom);
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();
  return new THREE.Mesh(geometry,material);
}
function addTree(group,x,z,scale=1,color=materials.jungle){
  const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.006*scale,.009*scale,.055*scale,5),materials.wood);trunk.position.set(x,.065*scale,z);group.add(trunk);
  const crown=new THREE.Mesh(new THREE.ConeGeometry(.03*scale,.085*scale,7),color);crown.position.set(x,.13*scale,z);group.add(crown);
}
function addHouse(group,x,z,scale=1){
  const body=new THREE.Mesh(new THREE.BoxGeometry(.055*scale,.045*scale,.045*scale),materials.city);body.position.set(x,.065*scale,z);group.add(body);
  const roof=new THREE.Mesh(new THREE.ConeGeometry(.045*scale,.035*scale,4),materials.roof);roof.position.set(x,.105*scale,z);roof.rotation.y=Math.PI/4;group.add(roof);
}
function addClouds(group,size){
  const random=seeded('clouds'+size);
  for(let index=0;index<13;index++){
    const puff=new THREE.Mesh(new THREE.SphereGeometry(size*(.16+random()*.12),12,8),materials.cloud);
    const angle=random()*Math.PI*2,radius=size*(.25+random()*.6);
    puff.position.set(Math.cos(angle)*radius,-.08+random()*.025,Math.sin(angle)*radius*.65);puff.scale.y=.46;group.add(puff);
  }
}
function addPagoda(group,x,z,scale=1){
  for(let tier=0;tier<3;tier++){
    const body=new THREE.Mesh(new THREE.CylinderGeometry(.025*scale,.03*scale,.045*scale,6),materials.wood);body.position.set(x,.075*scale+tier*.045*scale,z);group.add(body);
    const roof=new THREE.Mesh(new THREE.ConeGeometry((.065-tier*.009)*scale,.025*scale,6),materials.roof);roof.position.set(x,.1*scale+tier*.045*scale,z);group.add(roof);
  }
}
function addPeak(group,x,z,height=.13,material=materials.rock,radius=.04){
  const peak=new THREE.Mesh(new THREE.ConeGeometry(radius,height,7),material);peak.position.set(x,height/2+.04,z);group.add(peak);return peak;
}
function addTower(group,x,z,height=.13,material=materials.city,radius=.022){
  const tower=new THREE.Mesh(new THREE.CylinderGeometry(radius*.72,radius,height,7),material);tower.position.set(x,height/2+.045,z);group.add(tower);return tower;
}
function addBubble(group,x,z,radius,offset=.09){
  const bubble=new THREE.Mesh(new THREE.SphereGeometry(radius,20,14),new THREE.MeshPhysicalMaterial({color:0x9bd8df,roughness:.08,transmission:.35,transparent:true,opacity:.25,side:THREE.DoubleSide,depthWrite:false}));
  bubble.position.set(x,offset,z);group.add(bubble);return bubble;
}
function addFlowers(group,points){
  for(const [x,z,scale=1] of points){const bloom=new THREE.Mesh(new THREE.SphereGeometry(.022*scale,9,6),materials.pink);bloom.position.set(x,.095*scale,z);group.add(bloom);}
}

const studies=[
  {id:'reverse',name:'Reverse Mountain',position:basinPosition.clone(),major:true,description:'Five recessed rivers now curve through the slope, widen beyond the mountain, and sink beneath the surrounding seas without exposed end caps.'},
  ...ISLAND_STUDIES
];

function buildStudy(study){
  if(study.id==='reverse') return;
  const position=mapPosition(study.x,study.y,study.altitude||.05);
  study.position=position;
  const group=new THREE.Group();orient(group,position);world.add(group);study.group=group;
  const size=study.size||((study.kind==='watercity'||study.kind==='wano') ? .17 : .15);
  if(study.kind==='lighthouse'){
    group.add(islandBase(study.id,size*.82,materials.green,.66));
    const tower=addTower(group,-.03,0,.15,materials.city,.021);
    const stripe=new THREE.Mesh(new THREE.CylinderGeometry(.016,.016,.026,8),materials.roof);stripe.position.copy(tower.position);stripe.position.y=.125;group.add(stripe);
    const lamp=new THREE.Mesh(new THREE.SphereGeometry(.023,10,8),new THREE.MeshStandardMaterial({color:0xffe3a1,emissive:0xe5a84c,emissiveIntensity:1.6}));lamp.position.set(-.03,.21,0);group.add(lamp);addHouse(group,.055,.02,.62);
  } else if(study.kind==='cactus'){
    group.add(islandBase(study.id,size,materials.sand,.72));
    for(const x of [-.052,.055]){const mesa=addTower(group,x,0,.15,materials.rock,.034);mesa.scale.z=.8;const arm=new THREE.Mesh(new THREE.CylinderGeometry(.012,.015,.07,6),materials.rock);arm.position.set(x+(x<0?-.03:.03),.13,.005);arm.rotation.z=Math.PI/2;group.add(arm);}
    for(let i=0;i<6;i++){const angle=i/6*Math.PI*2;addHouse(group,Math.cos(angle)*.092,Math.sin(angle)*.055,.42);}
  } else if(study.kind==='prehistoric'){
    group.add(islandBase(study.id,size*1.08,materials.jungle,.82));
    for(let i=0;i<10;i++){const angle=i/10*Math.PI*2;addTree(group,Math.cos(angle)*(.055+(i%3)*.025),Math.sin(angle)*.075,.55+(i%2)*.18);}
    addPeak(group,-.055,.015,.15,materials.rock,.046);addPeak(group,.062,-.018,.13,materials.rock,.042);
    const beast=new THREE.Mesh(new THREE.SphereGeometry(.025,8,6),materials.rock);beast.scale.set(1.8,.8,1);beast.position.set(.015,.09,.065);group.add(beast);
    const neck=new THREE.Mesh(new THREE.CylinderGeometry(.007,.01,.075,6),materials.rock);neck.position.set(.045,.125,.065);neck.rotation.z=-.35;group.add(neck);
  } else if(study.kind==='tropical'){
    group.add(islandBase(study.id,size,materials.green,.78));
    [[-.08,-.03],[.04,.05],[.08,-.04],[-.02,-.07],[-.1,.05]].forEach(([x,z],i)=>addTree(group,x,z,.72+i*.04));
    [[-.02,.015],[.045,-.02]].forEach(([x,z])=>addHouse(group,x,z,.7));
  } else if(study.kind==='winter'){
    group.add(islandBase(study.id,size,materials.rock,.86));
    [[-.07,0,.13],[0,.02,.18],[.065,-.015,.145],[-.025,-.05,.12],[.03,.065,.11]].forEach(([x,z,h],i)=>{
      const peak=new THREE.Mesh(new THREE.ConeGeometry(.038+i*.002,h,7),i<3?materials.snow:materials.rock);peak.position.set(x,h/2+.04,z);group.add(peak);
    });
  } else if(study.kind==='desert'){
    group.add(islandBase(study.id,size*1.12,materials.sand,.72));
    const mesa=new THREE.Mesh(new THREE.CylinderGeometry(.07,.095,.075,9),materials.rock);mesa.position.y=.075;group.add(mesa);
    for(let i=0;i<9;i++){const angle=i/9*Math.PI*2;addHouse(group,Math.cos(angle)*.105,Math.sin(angle)*.065,.52);}
    const river=new THREE.Mesh(new THREE.BoxGeometry(.018,.006,.25),waterMaterial);river.position.set(.055,.052,0);river.rotation.y=.16;group.add(river);
  } else if(study.kind==='half-island'){
    const left=islandBase(study.id+'a',size*.82,materials.jungle,.68);left.position.x=-.052;left.rotation.y=.25;group.add(left);
    const right=islandBase(study.id+'b',size*.55,materials.green,.5);right.position.set(.07,-.002,-.035);group.add(right);
    [[-.08,.02],[-.025,-.045],[.06,-.02]].forEach(([x,z])=>addTree(group,x,z,.62));
  } else if(study.kind==='sky'){
    addClouds(group,size*1.25);group.add(islandBase(study.id,size,materials.green,.76,.035));
    const stalk=new THREE.Mesh(new THREE.CylinderGeometry(.009,.014,.21,7),materials.gold);stalk.position.y=.14;group.add(stalk);
    const bell=new THREE.Mesh(new THREE.ConeGeometry(.028,.05,8),materials.gold);bell.position.y=.265;group.add(bell);
  } else if(study.kind==='long-ring'){
    for(let i=0;i<6;i++){const angle=i/6*Math.PI*2;const patch=islandBase(study.id+i,size*.35,materials.green,.28,.025);patch.position.set(Math.cos(angle)*.085,0,Math.sin(angle)*.065);patch.rotation.y=-angle;group.add(patch);if(i%2===0)addTree(group,Math.cos(angle)*.085,Math.sin(angle)*.065,1.35);}
  } else if(study.kind==='watercity'){
    group.add(islandBase(study.id,size,materials.green,.82));
    for(let tier=0;tier<4;tier++){
      const terrace=new THREE.Mesh(new THREE.CylinderGeometry(.125-tier*.024,.14-tier*.024,.035,18),materials.city);terrace.position.y=.055+tier*.034;terrace.scale.z=.78;group.add(terrace);
      const canal=new THREE.Mesh(new THREE.TorusGeometry(.125-tier*.025,.007,5,28),waterMaterial);canal.position.y=.076+tier*.034;canal.rotation.x=Math.PI/2;canal.scale.z=.78;group.add(canal);
    }
    const tower=new THREE.Mesh(new THREE.CylinderGeometry(.018,.026,.13,8),materials.city);tower.position.y=.24;group.add(tower);
  } else if(study.kind==='government'){
    group.add(islandBase(study.id,size,materials.city,.72));
    const court=new THREE.Mesh(new THREE.BoxGeometry(.11,.1,.07),materials.city);court.position.y=.1;group.add(court);
    for(const x of [-.07,.07])addTower(group,x,.005,.15,materials.city,.022);
    const gate=new THREE.Mesh(new THREE.TorusGeometry(.05,.012,6,18,Math.PI),materials.navy);gate.position.set(0,.08,.09);group.add(gate);
  } else if(study.kind==='gothic'){
    const base=islandBase(study.id,size*1.15,materials.dark,.62);base.rotation.y=.18;group.add(base);
    const castle=new THREE.Mesh(new THREE.BoxGeometry(.085,.12,.065),materials.rock);castle.position.y=.11;group.add(castle);
    for(const x of [-.055,.055]){const tower=new THREE.Mesh(new THREE.CylinderGeometry(.019,.026,.15,7),materials.rock);tower.position.set(x,.13,0);group.add(tower);const roof=new THREE.Mesh(new THREE.ConeGeometry(.035,.07,7),materials.roof);roof.position.set(x,.235,0);group.add(roof);}
    [[-.11,.03],[.1,-.05],[-.08,-.07]].forEach(([x,z])=>addTree(group,x,z,.6,materials.dark));
  } else if(study.kind==='mangrove'){
    for(let i=0;i<7;i++){const angle=i/7*Math.PI*2,radius=.035+(i%3)*.028;const patch=islandBase(study.id+i,size*.31,materials.green,.72,.025);patch.position.set(Math.cos(angle)*radius,0,Math.sin(angle)*radius);group.add(patch);const trunk=addTower(group,Math.cos(angle)*radius,Math.sin(angle)*radius,.13,materials.wood,.013);trunk.scale.y=1+(i%2)*.25;if(i%2===0)addBubble(group,Math.cos(angle)*radius+.02,Math.sin(angle)*radius,.025,.14);}
  } else if(study.kind==='serpent'){
    group.add(islandBase(study.id,size,materials.jungle,.74));
    const wall=new THREE.Mesh(new THREE.TorusGeometry(.09,.012,6,28,Math.PI*1.6),materials.city);wall.position.y=.07;wall.rotation.x=Math.PI/2;wall.rotation.z=.35;group.add(wall);addPagoda(group,0,0,.65);
  } else if(study.kind==='undersea-fortress'){
    group.add(islandBase(study.id,size*.75,materials.dark,.72,.025));addBubble(group,0,0,.16,.09);
    for(let tier=0;tier<5;tier++){const prison=new THREE.Mesh(new THREE.CylinderGeometry(.065-tier*.008,.075-tier*.005,.035,9),materials.navy);prison.position.y=.035+tier*.035;group.add(prison);}
  } else if(study.kind==='marine-fortress'){
    group.add(islandBase(study.id,size*1.08,materials.city,.65));
    const bay=new THREE.Mesh(new THREE.TorusGeometry(.105,.018,6,28,Math.PI*1.55),materials.navy);bay.position.y=.06;bay.rotation.x=Math.PI/2;bay.rotation.z=.7;group.add(bay);
    const headquarters=new THREE.Mesh(new THREE.BoxGeometry(.095,.13,.06),materials.city);headquarters.position.set(0,.12,-.025);group.add(headquarters);for(const x of [-.075,.075])addTower(group,x,-.02,.12,materials.city,.019);
  } else if(study.kind==='holyland'){
    const plateau=new THREE.Mesh(new THREE.CylinderGeometry(.145,.18,.055,12),materials.sand);plateau.scale.z=.7;plateau.position.y=.025;group.add(plateau);
    for(let tier=0;tier<3;tier++){const terrace=new THREE.Mesh(new THREE.BoxGeometry(.2-tier*.04,.025,.115-tier*.02),materials.city);terrace.position.y=.062+tier*.027;group.add(terrace);}
    const palace=new THREE.Mesh(new THREE.BoxGeometry(.105,.115,.07),materials.city);palace.position.y=.17;group.add(palace);
    const palaceRoof=new THREE.Mesh(new THREE.ConeGeometry(.078,.045,4),materials.gold);palaceRoof.position.y=.25;palaceRoof.rotation.y=Math.PI/4;group.add(palaceRoof);
    for(const x of [-.068,.068]){addTower(group,x,0,.145,materials.city,.018);const roof=new THREE.Mesh(new THREE.ConeGeometry(.031,.04,6),materials.gold);roof.position.set(x,.207,0);group.add(roof);}
    for(const x of [-.105,.105]){const garden=new THREE.Mesh(new THREE.SphereGeometry(.028,9,6),materials.jungle);garden.position.set(x,.105,.025);group.add(garden);}
  } else if(study.kind==='bubble-city'){
    group.add(islandBase(study.id,size*.92,materials.jungle,.78,.025));addBubble(group,0,0,.175,.1);
    for(let i=0;i<7;i++){const angle=i/7*Math.PI*2;addTower(group,Math.cos(angle)*.08,Math.sin(angle)*.055,.07+(i%3)*.025,i%2?materials.pink:materials.gold,.012);}
    const sunTree=addTower(group,0,0,.2,materials.wood,.018);sunTree.scale.y=1.1;const crown=new THREE.Mesh(new THREE.SphereGeometry(.06,12,8),materials.gold);crown.position.y=.24;group.add(crown);
  } else if(study.kind==='split-climate'){
    const fire=islandBase(study.id+'fire',size*.75,materials.fire,.82);fire.position.x=-.052;group.add(fire);const ice=islandBase(study.id+'ice',size*.75,materials.ice,.82);ice.position.x=.052;group.add(ice);
    for(const [x,material] of [[-.07,materials.fire],[.07,materials.ice]]){addPeak(group,x,.015,.15,material,.045);addPeak(group,x*.72,-.055,.1,material,.03);}
  } else if(study.kind==='flowercity'){
    group.add(islandBase(study.id,size*1.05,materials.green,.82));
    const colosseum=new THREE.Mesh(new THREE.TorusGeometry(.055,.016,6,22),materials.sand);colosseum.position.set(-.055,.075,.01);colosseum.rotation.x=Math.PI/2;group.add(colosseum);
    for(let i=0;i<8;i++){const angle=i/8*Math.PI*2;addHouse(group,Math.cos(angle)*.095,Math.sin(angle)*.065,.45);}
    addFlowers(group,[[.065,.02,1.1],[-.015,-.07,.9],[.105,-.04,.75]]);
  } else if(study.kind==='elephant'){
    const body=new THREE.Mesh(new THREE.SphereGeometry(.11,14,10),materials.rock);body.scale.set(1,.72,.75);body.position.y=.12;group.add(body);
    for(const [x,z] of [[-.07,-.045],[.07,-.045],[-.07,.045],[.07,.045]]){const leg=new THREE.Mesh(new THREE.CylinderGeometry(.025,.03,.16,7),materials.rock);leg.position.set(x,.015,z);group.add(leg);}
    const head=new THREE.Mesh(new THREE.SphereGeometry(.065,12,9),materials.rock);head.position.set(.13,.145,0);group.add(head);const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.015,.025,.15,7),materials.rock);trunk.position.set(.175,.07,0);trunk.rotation.z=-.35;group.add(trunk);
    const back=islandBase(study.id,size*.8,materials.jungle,.62,.025);back.position.y=.18;group.add(back);for(const x of [-.05,0,.05])addTree(group,x,0,.55);
  } else if(study.kind==='candy'){
    group.add(islandBase(study.id,size,materials.candy,.82));
    for(let tier=0;tier<4;tier++){const cake=new THREE.Mesh(new THREE.CylinderGeometry(.09-tier*.015,.1-tier*.014,.035,14),tier%2?materials.city:materials.pink);cake.position.y=.055+tier*.035;group.add(cake);}
    for(const x of [-.1,.1]){const cane=addTower(group,x,.015,.13,x<0?materials.pink:materials.gold,.012);cane.rotation.z=x<0?-.12:.12;}
    addFlowers(group,[[.08,-.055,.8],[-.085,-.05,.8]]);
  } else if(study.kind==='wano'){
    group.add(islandBase(study.id,size*1.12,materials.green,.86));
    const mountain=new THREE.Mesh(new THREE.ConeGeometry(.075,.24,9),materials.rock);mountain.position.set(-.055,.15,.025);group.add(mountain);
    const cap=new THREE.Mesh(new THREE.ConeGeometry(.04,.07,9),materials.snow);cap.position.set(-.055,.285,.025);group.add(cap);
    addPagoda(group,.06,-.02,.9);
    addFlowers(group,[[.1,.06,1.15],[-.11,-.045,1.15],[.03,.08,1.15]]);
    const waterfall=new THREE.Mesh(new THREE.BoxGeometry(.018,.16,.008),waterMaterial);waterfall.position.set(-.055,.14,.094);waterfall.rotation.x=.2;group.add(waterfall);
  } else if(study.kind==='future'){
    group.add(islandBase(study.id,size,materials.green,.76));
    for(const [x,z,s] of [[0,0,1],[-.075,.02,.65],[.075,-.03,.72]]){
      const dome=new THREE.Mesh(new THREE.SphereGeometry(.06*s,16,10,0,Math.PI*2,0,Math.PI/2),materials.future);dome.position.set(x,.045,z);group.add(dome);
      const glass=new THREE.Mesh(new THREE.SphereGeometry(.045*s,14,8,0,Math.PI*2,0,Math.PI/2),materials.glass);glass.position.set(x,.065,z);group.add(glass);
    }
    const ring=new THREE.Mesh(new THREE.TorusGeometry(.13,.008,6,36),materials.future);ring.position.y=.14;ring.rotation.x=Math.PI/2;group.add(ring);
    for(const x of [-.1,.1])addTower(group,x,.04,.16,materials.future,.009);
  } else if(study.kind==='giant'){
    group.add(islandBase(study.id,size,materials.green,.76));
    const trunk=new THREE.Mesh(new THREE.CylinderGeometry(.035,.065,.32,9),materials.wood);trunk.position.y=.2;group.add(trunk);
    for(let i=0;i<8;i++){const angle=i/8*Math.PI*2;const crown=new THREE.Mesh(new THREE.SphereGeometry(.055,10,7),materials.jungle);crown.position.set(Math.cos(angle)*.065,.37+(i%2)*.025,Math.sin(angle)*.05);group.add(crown);}
    const hall=new THREE.Mesh(new THREE.BoxGeometry(.11,.065,.075),materials.wood);hall.position.set(.085,.085,-.02);group.add(hall);const roof=new THREE.Mesh(new THREE.ConeGeometry(.085,.055,4),materials.roof);roof.position.set(.085,.145,-.02);roof.rotation.y=Math.PI/4;group.add(roof);
  }
}
studies.forEach(buildStudy);

function addMinorIslets(){
  const random=seeded('dense-world-islets');
  const colors=[0x718a48,0x91a75c,0xb1a15b,0x536f43];
  for(let index=0;index<92;index++){
    const lon=random()*Math.PI*2,lat=(-67+random()*134)*DEG;
    if(Math.abs(lat)<14*DEG || Math.abs(Math.sin(lon-Math.PI/2))<.13) continue;
    const position=geoVector(lon,lat,R+.026),size=.012+random()*.024;
    const island=new THREE.Mesh(new THREE.CircleGeometry(size,6+Math.floor(random()*4)),new THREE.MeshStandardMaterial({color:colors[index%colors.length],roughness:1,side:THREE.DoubleSide}));
    orient(island,position,FORWARD);island.rotation.z=random()*Math.PI;world.add(island);
  }
}
addMinorIslets();

const atmosphere=new THREE.Mesh(new THREE.SphereGeometry(R*1.037,96,64),new THREE.ShaderMaterial({
  side:THREE.BackSide,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
  vertexShader:'varying vec3 vN;void main(){vN=normalize(normalMatrix*normal);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',
  fragmentShader:'varying vec3 vN;void main(){float r=pow(1.-abs(vN.z),2.6);gl_FragColor=vec4(.22,.7,.78,r*.28);}'
}));scene.add(atmosphere);

const labelRoot=document.getElementById('labels');
const labels=[];
function addLabel(text,position,className='',studyId=null){
  const element=document.createElement('div');element.className=`label ${className}`;element.textContent=text;labelRoot.appendChild(element);labels.push({element,position,studyId});
}
studies.forEach(study=>{
  const labelPosition=study.id==='reverse' ? redPoint(.7,-.075,redRadius(-.075,.7)+.16) : study.position.clone().addScaledVector(study.position.clone().normalize(),.12);
  addLabel(study.name,labelPosition,'major',study.id);
});
addLabel('NORTH BLUE',geoVector(45*DEG,53*DEG,R+.15),'region');addLabel('EAST BLUE',geoVector(140*DEG,53*DEG,R+.15),'region');
addLabel('WEST BLUE',geoVector(45*DEG,-53*DEG,R+.15),'region');addLabel('SOUTH BLUE',geoVector(140*DEG,-53*DEG,R+.15),'region');

const targets=document.getElementById('targets');
for(const study of studies){
  const button=document.createElement('button');button.textContent=study.name;button.dataset.target=study.id;button.onclick=()=>focus(study);targets.appendChild(button);study.button=button;
}
let tween=null,focusedStudyId=null;
function focus(study){
  focusedStudyId=study.id;
  document.querySelectorAll('#targets button').forEach(button=>button.classList.toggle('active',button===study.button));
  document.getElementById('noteTitle').textContent=`Review target: ${study.name}`;
  document.getElementById('noteText').textContent=study.description;
  tween={start:performance.now(),duration:760,from:camera.position.clone().normalize(),to:study.position.clone().normalize(),distance:camera.position.length(),fromZoom:camera.zoom,toZoom:study.id==='reverse'?2.55:5.2};controls.enabled=false;
}
document.getElementById('resetView').onclick=()=>{
  focusedStudyId=null;
  document.querySelectorAll('#targets button').forEach(button=>button.classList.remove('active'));
  tween={start:performance.now(),duration:760,from:camera.position.clone().normalize(),to:new THREE.Vector3(0,.03,1),distance:camera.position.length(),fromZoom:camera.zoom,toZoom:1};controls.enabled=false;
};

function updateLabels(){
  const direction=camera.position.clone().normalize();
  for(const label of labels){
    if(label.studyId && ((focusedStudyId && label.studyId!==focusedStudyId)||(!focusedStudyId && label.studyId!=='reverse'))){label.element.classList.remove('show');continue;}
    const facing=label.position.clone().normalize().dot(direction);
    if(facing<.14){label.element.classList.remove('show');continue;}
    const projected=label.position.clone().project(camera);
    label.element.style.left=`${(projected.x*.5+.5)*innerWidth}px`;label.element.style.top=`${(-projected.y*.5+.5)*innerHeight}px`;label.element.classList.add('show');
  }
}
function resize(){
  const width=innerWidth,height=innerHeight,aspect=width/height,half=4.15;
  camera.left=-half*aspect;camera.right=half*aspect;camera.top=half;camera.bottom=-half;camera.updateProjectionMatrix();renderer.setSize(width,height,false);
}
addEventListener('resize',resize);resize();
renderer.setAnimationLoop(time=>{
  if(tween){
    const p=Math.min(1,(time-tween.start)/tween.duration),e=1-Math.pow(1-p,3);
    const angle=Math.acos(THREE.MathUtils.clamp(tween.from.dot(tween.to),-1,1));
    const direction=angle<.001?tween.to.clone():tween.from.clone().multiplyScalar(Math.sin((1-e)*angle)/Math.sin(angle)).addScaledVector(tween.to,Math.sin(e*angle)/Math.sin(angle)).normalize();
    camera.position.copy(direction.multiplyScalar(tween.distance));camera.zoom=THREE.MathUtils.lerp(tween.fromZoom,tween.toZoom,e);camera.updateProjectionMatrix();camera.lookAt(ORIGIN);
    if(p===1){tween=null;controls.enabled=true;}
  }
  controls.update();renderer.render(scene,camera);updateLabels();
});
