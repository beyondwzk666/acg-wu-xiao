import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

// 全局变量声明
let scene, camera, renderer, character, clock, mixer, currentAction;
let idleAction, runAction, jumpAction;
let keysPressed = {};
let isJumping = false, velocity = 0;

const gravity = -9.8, jumpSpeed = 5;
const selectedCharacter = localStorage.getItem('selectedCharacter') || 'character.fbx';

// 地面与碰撞相关变量
let ground;
let obstacles = []; // 障碍物数组

// 初始化场景
function init() {
  initializeScene();
  clock = new THREE.Clock();

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.update();

  // 添加键盘事件
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);

  animate();
}

// 初始化场景：创建背景、地面、模型和光源等
function initializeScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb); // 设置天空背景色

  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 3, 10);  // 初始相机视角

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  ground = createGround();
  scene.add(ground);

  setupLights();
  loadModel();
  createObstacles(); // 创建障碍物
}

// 创建地面
function createGround() {
  const planeGeometry = new THREE.PlaneGeometry(100, 10);
  const planeMaterial = new THREE.MeshBasicMaterial({ color: 0x228B22, side: THREE.DoubleSide });
  const ground = new THREE.Mesh(planeGeometry, planeMaterial);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0;
  return ground;
}

// 设置光源
function setupLights() {
  const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambientLight);

  const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
  directionalLight.position.set(10, 20, 10);
  scene.add(directionalLight);
}

// 加载人物模型和动画
function loadModel() {
  const loader = new FBXLoader();

  loader.load(`models/${selectedCharacter}`, (fbx) => {
    character = fbx;
    character.scale.set(0.01, 0.01, 0.01);
    character.position.set(0, 0, 0);
    character.rotation.y = Math.PI / 2; // 初始面朝右
    scene.add(character);

    mixer = new THREE.AnimationMixer(character);

    // 加载动画
    loadAnimations(loader);
  });
}

// 加载动画
function loadAnimations(loader) {
  loader.load('models/Standing Idle.fbx', (idle) => {
    idleAction = mixer.clipAction(idle.animations[0]);
    idleAction.play();
    currentAction = idleAction;
  });

  loader.load('models/Fast Run.fbx', (run) => {
    runAction = mixer.clipAction(run.animations[0]);
  });

  loader.load('models/Jumping Up.fbx', (jump) => {
    jumpAction = mixer.clipAction(jump.animations[0]);
    jumpAction.loop = THREE.LoopOnce;
    jumpAction.clampWhenFinished = true; // 动画播放完后停在最后一帧
  });
}

// 创建障碍物
function createObstacles() {
  const obstacleGeometry = new THREE.BoxGeometry(2, 1, 1);
  const obstacleMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });

  // 创建多个障碍物并添加到场景中
  for (let i = 0; i < 5; i++) {
    const obstacle = new THREE.Mesh(obstacleGeometry, obstacleMaterial);
    obstacle.position.set(i * 5 - 10, 0, 0); // 设置障碍物的位置
    scene.add(obstacle);
    obstacles.push(obstacle); // 将障碍物加入数组
  }
}

window.onbeforeunload = () => {
  localStorage.removeItem('selectedCharacter');
};

// 键盘按下事件
function onKeyDown(event) {
  keysPressed[event.key] = true;

  // 如果按下跳跃键，并且当前不是跳跃状态，执行跳跃
  if (event.key === 'ArrowUp' && !isJumping) {
    initiateJump();
  }

  // 如果按下左或右键，播放跑步动画
  if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
    switchAnimation();
    updateCharacterDirection();
  }
}

// 键盘松开事件
function onKeyUp(event) {
  keysPressed[event.key] = false;
  updateCharacterDirection();
  // 跳跃和跑步状态结束后，切换回站立动画
  if (!keysPressed['ArrowLeft'] && !keysPressed['ArrowRight'] && !isJumping) {
    setAction(idleAction);
  }
}

// 更新角色朝向
function updateCharacterDirection() {
  if (character) {
    if (keysPressed['ArrowLeft']) {
      character.rotation.y = -Math.PI / 2;
    } else if (keysPressed['ArrowRight']) {
      character.rotation.y = Math.PI / 2;
    }
  }
}

// 切换动画
function switchAnimation() {
  if (character && mixer && !isJumping) {
    if (keysPressed['ArrowLeft'] || keysPressed['ArrowRight']) {
      setAction(runAction);
    } else {
      setAction(idleAction);
    }
  }
}

// 设置当前动画
function setAction(action) {
  if (currentAction !== action) {
    if (currentAction) currentAction.stop();
    action.play();
    currentAction = action;
  }
}

// 跳跃逻辑
function initiateJump() {
  isJumping = true;
  velocity = jumpSpeed; // 设置跳跃初始速度
  if (currentAction !== jumpAction) {
    setAction(jumpAction);
  }
}

// 应用重力和支撑检测
function applyGravity(delta) {
  if (!character) return;

  let isSupported = false;

  // 检查是否有地面或障碍物支撑
  const characterBox = new THREE.Box3().setFromObject(character);
  obstacles.forEach(obstacle => {
    const obstacleBox = new THREE.Box3().setFromObject(obstacle);
    if (
      characterBox.intersectsBox(obstacleBox) &&
      characterBox.min.y - velocity * delta >= obstacleBox.max.y &&
      characterBox.min.y <= obstacleBox.max.y
    ) {
      isSupported = true;
      character.position.y = obstacleBox.max.y;
    }
  });
  const groundBox = new THREE.Box3().setFromObject(ground);

  if (characterBox.min.y <= groundBox.max.y && character.position.y <= 0) {
    isSupported = true;
    character.position.y = 0;
  }
  if (!isSupported) {
    velocity += gravity * delta;
    character.position.y += velocity * delta;
  } else {
    isJumping = false;
    velocity = 0;
    switchAnimation();
  }
}

function checkHorizontalCollision(nextX) {
  if (!character) return false;

  const characterBox = new THREE.Box3().setFromObject(character);

  // 假设角色移动后的边界盒
  const nextCharacterBox = characterBox.clone();
  nextCharacterBox.translate(new THREE.Vector3(nextX - character.position.x, 0, 0));

  // 遍历所有障碍物，检查是否发生水平碰撞
  for (const obstacle of obstacles) {
    const obstacleBox = new THREE.Box3().setFromObject(obstacle);
    if (nextCharacterBox.intersectsBox(obstacleBox)) {
      return true; // 如果发生碰撞，返回 true
    }
  }
  return false; // 没有碰撞
}

// 动画与物理更新
function animate() {
  requestAnimationFrame(animate);
  const delta = clock.getDelta();

  if (mixer) mixer.update(delta);

  applyGravity(delta);

  // 禁止 z 轴方向移动，处理水平移动并检测碰撞
  if (keysPressed['ArrowLeft']) {
    if (!checkHorizontalCollision(character.position.x - 5 * delta)) {
      character.position.x -= 5 * delta;
    }
  }
  if (keysPressed['ArrowRight']) {
    if (!checkHorizontalCollision(character.position.x + 5 * delta)) {
      character.position.x += 5 * delta;
    }
  }

  renderer.render(scene, camera);
}


init();
