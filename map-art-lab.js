import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

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
const channelEnds = [[-.98,-1.35],[.98,-1.25],[-.98,1.35],[.98,1.28],[.99,0]];
function channelInfluence(sample,cross){
  const vertical = wrapPi(sample) / .18;
  if (Math.abs(vertical) > 1.7 || Math.abs(cross) > 1.2) return 0;
  let influence = Math.exp(-Math.pow(Math.hypot(cross,vertical)/.22,4));
  for (const [endX,endY] of channelEnds){
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

const waterMaterial=new THREE.MeshBasicMaterial({color:0x619faa,transparent:true,opacity:.92,side:THREE.DoubleSide,toneMapped:false,polygonOffset:true,polygonOffsetFactor:-3,polygonOffsetUnits:-3});
const channelBankMaterial=new THREE.MeshStandardMaterial({color:0x173e45,roughness:.9,metalness:0,side:THREE.DoubleSide});
function channelRibbon(endX,endY,halfWidth,lift,material){
  const positions=[],indices=[],length=Math.hypot(endX,endY),perpX=-endY/length,perpY=endX/length,steps=34;
  for(let step=0;step<=steps;step++){
    const t=step/steps;
    const taper=THREE.MathUtils.lerp(.38,1,t);
    for(const side of [-1,1]){
      const cross=endX*t+perpX*halfWidth*taper*side;
      const vertical=endY*t+perpY*halfWidth*taper*side;
      const sample=vertical*.18;
      const point=redPoint(cross,sample,redRadius(sample,cross)+lift);
      positions.push(point.x,point.y,point.z);
    }
    if(step<steps){const start=step*2;indices.push(start,start+1,start+2,start+1,start+3,start+2);}
  }
  const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();
  return new THREE.Mesh(geometry,material);
}
for(const [endX,endY] of channelEnds){
  world.add(channelRibbon(endX,endY,.072,.026,waterMaterial));
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

const studies=[
  {id:'reverse',name:'Reverse Mountain',position:basinPosition.clone(),major:true,description:'Five recessed channels converge on a summit basin. Dark cut banks and lower water floors make the paths part of the mountain instead of lines floating above it.'},
  {id:'dawn',name:'Dawn Island',x:1860,y:600,kind:'tropical',description:'A tropical island study built from irregular terrain, clustered vegetation, and a tiny coastal settlement.'},
  {id:'drum',name:'Drum Island',x:1600,y:1132,kind:'winter',description:'Five steep drum-shaped peaks create the silhouette, with snow materials reserved for the highest faces.'},
  {id:'alabasta',name:'Alabasta',x:1785,y:1258,kind:'desert',description:'Warm desert terrain, a central rock mesa, and a ring of pale settlement blocks distinguish Alabasta at close zoom.'},
  {id:'skypiea',name:'Skypiea',x:2015,y:1108,kind:'sky',altitude:.54,description:'The terrain floats well above the globe on a broad bank of clouds, with a golden vertical landmark visible from regional zoom.'},
  {id:'water7',name:'Water 7',x:2360,y:1128,kind:'watercity',description:'Concentric city terraces and blue canal rings turn Water 7 into a recognizable miniature without copying an existing map asset.'},
  {id:'thriller',name:'Thriller Bark',x:2645,y:1140,kind:'gothic',description:'A dark elongated base, central castle, towers, and sparse dead vegetation form the gothic island archetype.'},
  {id:'wano',name:'Wano Country',x:3900,y:1272,kind:'wano',description:'Layered green terrain supports a snow-capped mountain, a small pagoda, and restrained blossom clusters.'},
  {id:'egghead',name:'Egghead',x:190,y:1170,kind:'future',description:'Clean domes, translucent glass, and an elevated technology ring create a futuristic silhouette.'},
];

function buildStudy(study){
  if(study.id==='reverse') return;
  const position=mapPosition(study.x,study.y,study.altitude||.05);
  study.position=position;
  const group=new THREE.Group();orient(group,position);world.add(group);study.group=group;
  const size=(study.kind==='watercity'||study.kind==='wano') ? .17 : .15;
  if(study.kind==='tropical'){
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
  } else if(study.kind==='sky'){
    addClouds(group,size*1.25);group.add(islandBase(study.id,size,materials.green,.76,.035));
    const stalk=new THREE.Mesh(new THREE.CylinderGeometry(.009,.014,.21,7),materials.gold);stalk.position.y=.14;group.add(stalk);
    const bell=new THREE.Mesh(new THREE.ConeGeometry(.028,.05,8),materials.gold);bell.position.y=.265;group.add(bell);
  } else if(study.kind==='watercity'){
    group.add(islandBase(study.id,size,materials.green,.82));
    for(let tier=0;tier<4;tier++){
      const terrace=new THREE.Mesh(new THREE.CylinderGeometry(.125-tier*.024,.14-tier*.024,.035,18),materials.city);terrace.position.y=.055+tier*.034;terrace.scale.z=.78;group.add(terrace);
      const canal=new THREE.Mesh(new THREE.TorusGeometry(.125-tier*.025,.007,5,28),waterMaterial);canal.position.y=.076+tier*.034;canal.rotation.x=Math.PI/2;canal.scale.z=.78;group.add(canal);
    }
    const tower=new THREE.Mesh(new THREE.CylinderGeometry(.018,.026,.13,8),materials.city);tower.position.y=.24;group.add(tower);
  } else if(study.kind==='gothic'){
    const base=islandBase(study.id,size*1.15,materials.dark,.62);base.rotation.y=.18;group.add(base);
    const castle=new THREE.Mesh(new THREE.BoxGeometry(.085,.12,.065),materials.rock);castle.position.y=.11;group.add(castle);
    for(const x of [-.055,.055]){const tower=new THREE.Mesh(new THREE.CylinderGeometry(.019,.026,.15,7),materials.rock);tower.position.set(x,.13,0);group.add(tower);const roof=new THREE.Mesh(new THREE.ConeGeometry(.035,.07,7),materials.roof);roof.position.set(x,.235,0);group.add(roof);}
    [[-.11,.03],[.1,-.05],[-.08,-.07]].forEach(([x,z])=>addTree(group,x,z,.6,materials.dark));
  } else if(study.kind==='wano'){
    group.add(islandBase(study.id,size*1.12,materials.green,.86));
    const mountain=new THREE.Mesh(new THREE.ConeGeometry(.075,.24,9),materials.rock);mountain.position.set(-.055,.15,.025);group.add(mountain);
    const cap=new THREE.Mesh(new THREE.ConeGeometry(.04,.07,9),materials.snow);cap.position.set(-.055,.285,.025);group.add(cap);
    addPagoda(group,.06,-.02,.9);
    for(const [x,z] of [[.1,.06],[-.11,-.045],[.03,.08]]){const bloom=new THREE.Mesh(new THREE.SphereGeometry(.026,9,6),new THREE.MeshStandardMaterial({color:0xe58f9f,roughness:.9}));bloom.position.set(x,.105,z);group.add(bloom);}
  } else if(study.kind==='future'){
    group.add(islandBase(study.id,size,materials.green,.76));
    for(const [x,z,s] of [[0,0,1],[-.075,.02,.65],[.075,-.03,.72]]){
      const dome=new THREE.Mesh(new THREE.SphereGeometry(.06*s,16,10,0,Math.PI*2,0,Math.PI/2),materials.future);dome.position.set(x,.045,z);group.add(dome);
      const glass=new THREE.Mesh(new THREE.SphereGeometry(.045*s,14,8,0,Math.PI*2,0,Math.PI/2),materials.glass);glass.position.set(x,.065,z);group.add(glass);
    }
    const ring=new THREE.Mesh(new THREE.TorusGeometry(.13,.008,6,36),materials.future);ring.position.y=.14;ring.rotation.x=Math.PI/2;group.add(ring);
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
function addLabel(text,position,className=''){
  const element=document.createElement('div');element.className=`label ${className}`;element.textContent=text;labelRoot.appendChild(element);labels.push({element,position});
}
studies.forEach(study=>{
  const labelPosition=study.id==='reverse' ? redPoint(.7,-.075,redRadius(-.075,.7)+.16) : study.position.clone().addScaledVector(study.position.clone().normalize(),.12);
  addLabel(study.name,labelPosition,'major');
});
addLabel('NORTH BLUE',geoVector(45*DEG,53*DEG,R+.15),'region');addLabel('EAST BLUE',geoVector(140*DEG,53*DEG,R+.15),'region');
addLabel('WEST BLUE',geoVector(45*DEG,-53*DEG,R+.15),'region');addLabel('SOUTH BLUE',geoVector(140*DEG,-53*DEG,R+.15),'region');

const targets=document.getElementById('targets');
for(const study of studies){
  const button=document.createElement('button');button.textContent=study.name;button.dataset.target=study.id;button.onclick=()=>focus(study);targets.appendChild(button);study.button=button;
}
let tween=null;
function focus(study){
  document.querySelectorAll('#targets button').forEach(button=>button.classList.toggle('active',button===study.button));
  document.getElementById('noteTitle').textContent=`Review target: ${study.name}`;
  document.getElementById('noteText').textContent=study.description;
  tween={start:performance.now(),duration:760,from:camera.position.clone().normalize(),to:study.position.clone().normalize(),distance:camera.position.length(),fromZoom:camera.zoom,toZoom:study.id==='reverse'?2.55:4.2};controls.enabled=false;
}
document.getElementById('resetView').onclick=()=>{
  document.querySelectorAll('#targets button').forEach(button=>button.classList.remove('active'));
  tween={start:performance.now(),duration:760,from:camera.position.clone().normalize(),to:new THREE.Vector3(0,.03,1),distance:camera.position.length(),fromZoom:camera.zoom,toZoom:1};controls.enabled=false;
};

function updateLabels(){
  const direction=camera.position.clone().normalize();
  for(const label of labels){
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
