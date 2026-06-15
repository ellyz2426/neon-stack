import {
	createSystem,
	World,
	PanelUI,
	PanelDocument,
	UIKitDocument,
	UIKit,
	Follower,
	InputComponent,
	Entity,
	BoxGeometry,
	MeshStandardMaterial,
	Mesh,
	Color,
	Vector3,
	Group,
	AmbientLight,
	DirectionalLight,
	PointLight,
	Object3D,
	AdditiveBlending,
	BufferGeometry,
	Float32BufferAttribute,
	PointsMaterial,
	Points,
	FogExp2,
} from '@iwsdk/core';

// ── Types ──────────────────────────────────────────────────────────────────

interface Block {
	entity: Entity;
	mesh: Mesh;
	width: number;
	depth: number;
	x: number;
	z: number;
	y: number;
}

interface FallingPiece {
	mesh: Mesh;
	velocity: Vector3;
	life: number;
}

interface Particle {
	mesh: Mesh;
	velocity: Vector3;
	life: number;
	maxLife: number;
}

type GameMode = 'classic' | 'zen' | 'speed' | 'precision' | 'challenge' | 'endless';
type GameState = 'menu' | 'mode_select' | 'playing' | 'paused' | 'game_over' | 'settings' | 'achievements' | 'tutorial' | 'stats';

interface Achievement {
	id: string;
	name: string;
	description: string;
	unlocked: boolean;
}

interface GameStats {
	gamesPlayed: number;
	totalBlocks: number;
	totalPerfects: number;
	bestHeight: number;
	bestCombo: number;
	bestScore: number;
	totalScore: number;
}

// ── Audio Engine ───────────────────────────────────────────────────────────

class AudioEngine {
	private ctx: AudioContext | null = null;
	private masterGain: GainNode | null = null;
	volume = 0.7;
	sfxEnabled = true;
	musicEnabled = true;
	private droneOsc: OscillatorNode | null = null;
	private droneGain: GainNode | null = null;

	private ensure(): AudioContext {
		if (!this.ctx) {
			this.ctx = new AudioContext();
			this.masterGain = this.ctx.createGain();
			this.masterGain.gain.value = this.volume;
			this.masterGain.connect(this.ctx.destination);
		}
		if (this.ctx.state === 'suspended') this.ctx.resume();
		return this.ctx;
	}

	setVolume(v: number) {
		this.volume = v;
		if (this.masterGain) this.masterGain.gain.value = v;
	}

	playPlace(perfect: boolean, combo: number) {
		if (!this.sfxEnabled) return;
		const ctx = this.ensure();
		const t = ctx.currentTime;
		const osc = ctx.createOscillator();
		const gain = ctx.createGain();
		osc.connect(gain);
		gain.connect(this.masterGain!);
		const baseFreq = 220 + combo * 30;
		osc.frequency.setValueAtTime(baseFreq, t);
		osc.frequency.exponentialRampToValueAtTime(baseFreq * (perfect ? 2 : 1.5), t + 0.1);
		osc.type = perfect ? 'sine' : 'triangle';
		gain.gain.setValueAtTime(0.3, t);
		gain.gain.exponentialRampToValueAtTime(0.001, t + (perfect ? 0.4 : 0.2));
		osc.start(t);
		osc.stop(t + 0.5);
		if (perfect) {
			const notes = [baseFreq, baseFreq * 1.25, baseFreq * 1.5, baseFreq * 2];
			notes.forEach((freq, i) => {
				const o = ctx.createOscillator();
				const g = ctx.createGain();
				o.connect(g);
				g.connect(this.masterGain!);
				o.frequency.value = freq;
				o.type = 'sine';
				g.gain.setValueAtTime(0.15, t + i * 0.06);
				g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.06 + 0.3);
				o.start(t + i * 0.06);
				o.stop(t + i * 0.06 + 0.35);
			});
		}
	}

	playCut() {
		if (!this.sfxEnabled) return;
		const ctx = this.ensure();
		const t = ctx.currentTime;
		const osc = ctx.createOscillator();
		const gain = ctx.createGain();
		osc.connect(gain);
		gain.connect(this.masterGain!);
		osc.type = 'sawtooth';
		osc.frequency.setValueAtTime(400, t);
		osc.frequency.exponentialRampToValueAtTime(80, t + 0.15);
		gain.gain.setValueAtTime(0.15, t);
		gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
		osc.start(t);
		osc.stop(t + 0.25);
	}

	playGameOver() {
		if (!this.sfxEnabled) return;
		const ctx = this.ensure();
		const t = ctx.currentTime;
		[440, 349, 294, 220].forEach((freq, i) => {
			const osc = ctx.createOscillator();
			const gain = ctx.createGain();
			osc.connect(gain);
			gain.connect(this.masterGain!);
			osc.frequency.value = freq;
			osc.type = 'triangle';
			gain.gain.setValueAtTime(0.2, t + i * 0.15);
			gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.15 + 0.4);
			osc.start(t + i * 0.15);
			osc.stop(t + i * 0.15 + 0.5);
		});
	}

	playMenuSelect() {
		if (!this.sfxEnabled) return;
		const ctx = this.ensure();
		const t = ctx.currentTime;
		const osc = ctx.createOscillator();
		const gain = ctx.createGain();
		osc.connect(gain);
		gain.connect(this.masterGain!);
		osc.frequency.setValueAtTime(880, t);
		osc.frequency.exponentialRampToValueAtTime(1320, t + 0.08);
		osc.type = 'sine';
		gain.gain.setValueAtTime(0.15, t);
		gain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
		osc.start(t);
		osc.stop(t + 0.15);
	}

	playCountdown() {
		if (!this.sfxEnabled) return;
		const ctx = this.ensure();
		const t = ctx.currentTime;
		const osc = ctx.createOscillator();
		const gain = ctx.createGain();
		osc.connect(gain);
		gain.connect(this.masterGain!);
		osc.frequency.value = 660;
		osc.type = 'sine';
		gain.gain.setValueAtTime(0.2, t);
		gain.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
		osc.start(t);
		osc.stop(t + 0.2);
	}

	playCountdownGo() {
		if (!this.sfxEnabled) return;
		const ctx = this.ensure();
		const t = ctx.currentTime;
		const osc = ctx.createOscillator();
		const gain = ctx.createGain();
		osc.connect(gain);
		gain.connect(this.masterGain!);
		osc.frequency.value = 1320;
		osc.type = 'sine';
		gain.gain.setValueAtTime(0.3, t);
		gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
		osc.start(t);
		osc.stop(t + 0.35);
	}

	startDrone() {
		if (!this.musicEnabled) return;
		const ctx = this.ensure();
		if (this.droneOsc) return;
		this.droneOsc = ctx.createOscillator();
		this.droneGain = ctx.createGain();
		this.droneOsc.connect(this.droneGain);
		this.droneGain.connect(this.masterGain!);
		this.droneOsc.type = 'sine';
		this.droneOsc.frequency.value = 55;
		this.droneGain.gain.value = 0.08;
		this.droneOsc.start();
	}

	stopDrone() {
		if (this.droneOsc) {
			this.droneOsc.stop();
			this.droneOsc.disconnect();
			this.droneOsc = null;
			this.droneGain = null;
		}
	}

	playAchievement() {
		if (!this.sfxEnabled) return;
		const ctx = this.ensure();
		const t = ctx.currentTime;
		[523, 659, 784, 1047].forEach((freq, i) => {
			const osc = ctx.createOscillator();
			const gain = ctx.createGain();
			osc.connect(gain);
			gain.connect(this.masterGain!);
			osc.frequency.value = freq;
			osc.type = 'sine';
			gain.gain.setValueAtTime(0.12, t + i * 0.08);
			gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.08 + 0.25);
			osc.start(t + i * 0.08);
			osc.stop(t + i * 0.08 + 0.3);
		});
	}
}

// ── Constants ──────────────────────────────────────────────────────────────

const NEON_COLORS = [
	0x00ffff, 0xff00ff, 0x00ff88, 0xff4488, 0x44aaff,
	0xffaa00, 0xaa44ff, 0x88ff00, 0xff6644, 0x44ffaa,
];
const getBlockColor = (i: number) => NEON_COLORS[i % NEON_COLORS.length];

const BLOCK_HEIGHT = 0.3;
const BASE_WIDTH = 3.0;
const BASE_DEPTH = 3.0;
const BASE_SPEED = 2.5;
const SPEED_INCREMENT = 0.08;
const MAX_SPEED = 8.0;
const PERFECT_THRESHOLD = 0.08;
const SLIDE_RANGE = 5.0;

// ── Keyboard ───────────────────────────────────────────────────────────────

class KeyboardState {
	private pressed = new Set<string>();
	private justDown = new Set<string>();
	constructor() {
		window.addEventListener('keydown', (e) => {
			if (!this.pressed.has(e.code)) this.justDown.add(e.code);
			this.pressed.add(e.code);
		});
		window.addEventListener('keyup', (e) => { this.pressed.delete(e.code); });
	}
	getKeyDown(code: string) { return this.justDown.has(code); }
	endFrame() { this.justDown.clear(); }
}

// ── Main System ────────────────────────────────────────────────────────────

export class GameSystem extends createSystem({}) {
	private state: GameState = 'menu';
	private mode: GameMode = 'classic';
	private blocks: Block[] = [];
	private currentBlock: Block | null = null;
	private slideAxis: 'x' | 'z' = 'x';
	private slideDir = 1;
	private slideSpeed = BASE_SPEED;
	private score = 0;
	private combo = 0;
	private maxCombo = 0;
	private height = 0;
	private gameTime = 0;
	private countdownTimer = 0;
	private isCountingDown = false;
	private fallingPieces: FallingPiece[] = [];
	private particles: Particle[] = [];
	private particleGroup!: Group;
	private towerGroup!: Group;
	private starField!: Points;
	private audio = new AudioEngine();
	private kb = new KeyboardState();
	private menuEntity: Entity | null = null;
	private hudEntity: Entity | null = null;
	private gameOverEntity: Entity | null = null;
	private pauseEntity: Entity | null = null;
	private settingsEntity: Entity | null = null;
	private achievementsEntity: Entity | null = null;
	private modeSelectEntity: Entity | null = null;
	private tutorialEntity: Entity | null = null;
	private statsEntity: Entity | null = null;
	private countdownEntity: Entity | null = null;
	private w!: World;
	private achievements: Achievement[] = [];
	private stats: GameStats = {
		gamesPlayed: 0, totalBlocks: 0, totalPerfects: 0,
		bestHeight: 0, bestCombo: 0, bestScore: 0, totalScore: 0,
	};
	private speedTimeLeft = 60;
	private challengeTarget = 0;
	private cameraTargetY = 5;
	private cameraCurrentY = 5;
	private placeCooldown = 0;
	private lastCountdownNum = -1;

	bootstrap(world: World) {
		this.w = world;
		this.loadStats();
		this.loadAchievements();
		this.setupScene();
		this.setupPanels();
	}

	private setupScene() {
		const scene = this.w.scene;
		scene.fog = new FogExp2(0x050510, 0.015);
		scene.background = new Color(0x050510);
		scene.add(new AmbientLight(0x334466, 0.6));
		const dir = new DirectionalLight(0xffffff, 0.8);
		dir.position.set(5, 20, 10);
		scene.add(dir);
		const p1 = new PointLight(0x00ffff, 1, 30);
		p1.position.set(-5, 10, 5);
		scene.add(p1);
		const p2 = new PointLight(0xff00ff, 0.8, 30);
		p2.position.set(5, 15, -5);
		scene.add(p2);
		this.towerGroup = new Group();
		scene.add(this.towerGroup);
		this.particleGroup = new Group();
		scene.add(this.particleGroup);
		this.createGrid(scene);
		this.createStars(scene);
	}

	private createGrid(parent: Object3D) {
		const g = new Group();
		const size = 40; const divs = 40; const step = size / divs; const half = size / 2;
		for (let i = 0; i <= divs; i++) {
			const pos = -half + i * step;
			const main = i % 5 === 0;
			const c = main ? 0x00ffff : 0x112233;
			const e = main ? 0x004455 : 0x050510;
			const xL = new Mesh(new BoxGeometry(size, 0.005, 0.005), new MeshStandardMaterial({ color: c, emissive: e }));
			xL.position.set(0, 0, pos); g.add(xL);
			const zL = new Mesh(new BoxGeometry(0.005, 0.005, size), new MeshStandardMaterial({ color: c, emissive: e }));
			zL.position.set(pos, 0, 0); g.add(zL);
		}
		parent.add(g);
	}

	private createStars(parent: Object3D) {
		const n = 500; const p = new Float32Array(n * 3);
		for (let i = 0; i < n; i++) {
			p[i * 3] = (Math.random() - 0.5) * 100;
			p[i * 3 + 1] = Math.random() * 80 + 5;
			p[i * 3 + 2] = (Math.random() - 0.5) * 100;
		}
		const geo = new BufferGeometry();
		geo.setAttribute('position', new Float32BufferAttribute(p, 3));
		this.starField = new Points(geo, new PointsMaterial({
			color: 0xaabbff, size: 0.1, blending: AdditiveBlending, transparent: true, opacity: 0.6,
		}));
		parent.add(this.starField);
	}

	private setupPanels() {
		const w = this.w;
		const cam = w.camera;

		this.menuEntity = w.createTransformEntity();
		this.menuEntity.addComponent(PanelUI, { config: './ui/main-menu.json' });
		this.menuEntity.addComponent(Follower, { target: cam, offsetPosition: [0, 0, -2.5], speed: 6 });

		this.hudEntity = w.createTransformEntity();
		this.hudEntity.addComponent(PanelUI, { config: './ui/hud.json' });
		this.hudEntity.addComponent(Follower, { target: cam, offsetPosition: [0, -0.6, -1.5], speed: 8 });
		this.hudEntity.object3D!.visible = false;

		this.gameOverEntity = w.createTransformEntity();
		this.gameOverEntity.addComponent(PanelUI, { config: './ui/game-over.json' });
		this.gameOverEntity.addComponent(Follower, { target: cam, offsetPosition: [0, 0, -2.5], speed: 6 });
		this.gameOverEntity.object3D!.visible = false;

		this.pauseEntity = w.createTransformEntity();
		this.pauseEntity.addComponent(PanelUI, { config: './ui/pause.json' });
		this.pauseEntity.addComponent(Follower, { target: cam, offsetPosition: [0, 0.1, -2.2], speed: 6 });
		this.pauseEntity.object3D!.visible = false;

		this.settingsEntity = w.createTransformEntity();
		this.settingsEntity.addComponent(PanelUI, { config: './ui/settings.json' });
		this.settingsEntity.addComponent(Follower, { target: cam, offsetPosition: [0, 0, -2.5], speed: 6 });
		this.settingsEntity.object3D!.visible = false;

		this.achievementsEntity = w.createTransformEntity();
		this.achievementsEntity.addComponent(PanelUI, { config: './ui/ach.json' });
		this.achievementsEntity.addComponent(Follower, { target: cam, offsetPosition: [0, 0.1, -2.5], speed: 6 });
		this.achievementsEntity.object3D!.visible = false;

		this.modeSelectEntity = w.createTransformEntity();
		this.modeSelectEntity.addComponent(PanelUI, { config: './ui/mode-select.json' });
		this.modeSelectEntity.addComponent(Follower, { target: cam, offsetPosition: [0, 0, -2.5], speed: 6 });
		this.modeSelectEntity.object3D!.visible = false;

		this.tutorialEntity = w.createTransformEntity();
		this.tutorialEntity.addComponent(PanelUI, { config: './ui/tutorial.json' });
		this.tutorialEntity.addComponent(Follower, { target: cam, offsetPosition: [0, 0, -2.5], speed: 6 });
		this.tutorialEntity.object3D!.visible = false;

		this.statsEntity = w.createTransformEntity();
		this.statsEntity.addComponent(PanelUI, { config: './ui/stats.json' });
		this.statsEntity.addComponent(Follower, { target: cam, offsetPosition: [0, 0, -2.5], speed: 6 });
		this.statsEntity.object3D!.visible = false;

		this.countdownEntity = w.createTransformEntity();
		this.countdownEntity.addComponent(PanelUI, { config: './ui/countdown.json' });
		this.countdownEntity.addComponent(Follower, { target: cam, offsetPosition: [0, 0.2, -2], speed: 10 });
		this.countdownEntity.object3D!.visible = false;
	}

	// ── State ────────────────────────────────────────────────────────────

	private setState(s: GameState) {
		for (const e of [this.menuEntity, this.hudEntity, this.gameOverEntity, this.pauseEntity,
			this.settingsEntity, this.achievementsEntity, this.modeSelectEntity,
			this.tutorialEntity, this.statsEntity, this.countdownEntity]) {
			if (e?.object3D) e.object3D.visible = false;
		}
		this.state = s;
		switch (s) {
			case 'menu': this.showPanel(this.menuEntity); break;
			case 'mode_select': this.showPanel(this.modeSelectEntity); break;
			case 'playing': if (this.hudEntity?.object3D) this.hudEntity.object3D.visible = true; break;
			case 'paused':
				if (this.hudEntity?.object3D) this.hudEntity.object3D.visible = true;
				this.showPanel(this.pauseEntity); break;
			case 'game_over': this.showPanel(this.gameOverEntity); break;
			case 'settings': this.showPanel(this.settingsEntity); break;
			case 'achievements': this.showPanel(this.achievementsEntity); break;
			case 'tutorial': this.showPanel(this.tutorialEntity); break;
			case 'stats': this.showPanel(this.statsEntity); break;
		}
	}

	private showPanel(e: Entity | null) {
		if (!e?.object3D) return;
		e.object3D.visible = true;
		e.object3D.position.set(0, Math.max(5, this.cameraCurrentY), -3);
	}

	// ── Game Logic ───────────────────────────────────────────────────────

	private startGame(mode: GameMode) {
		this.mode = mode;
		this.score = 0; this.combo = 0; this.maxCombo = 0; this.height = 0;
		this.gameTime = 0; this.slideSpeed = BASE_SPEED; this.slideAxis = 'x';
		this.slideDir = 1; this.speedTimeLeft = 60; this.placeCooldown = 0;
		this.lastCountdownNum = -1;
		if (mode === 'challenge') this.challengeTarget = 15 + Math.floor(Math.random() * 20);
		this.clearTower();
		this.createBaseBlock();
		this.isCountingDown = true;
		this.countdownTimer = 3;
		if (this.countdownEntity?.object3D) this.countdownEntity.object3D.visible = true;
		if (this.hudEntity?.object3D) this.hudEntity.object3D.visible = true;
		this.updateCountdownPanel();
		this.audio.startDrone();
	}

	private clearTower() {
		for (const b of this.blocks) if (b.mesh) this.towerGroup.remove(b.mesh);
		this.blocks = []; this.currentBlock = null;
		for (const f of this.fallingPieces) this.towerGroup.remove(f.mesh);
		this.fallingPieces = [];
		for (const p of this.particles) this.particleGroup.remove(p.mesh);
		this.particles = [];
		this.cameraTargetY = 5; this.cameraCurrentY = 5;
	}

	private createBaseBlock() {
		const geo = new BoxGeometry(BASE_WIDTH, BLOCK_HEIGHT, BASE_DEPTH);
		const mat = new MeshStandardMaterial({
			color: getBlockColor(0), emissive: getBlockColor(0),
			emissiveIntensity: 0.3, metalness: 0.7, roughness: 0.3,
		});
		const mesh = new Mesh(geo, mat);
		const entity = this.w.createTransformEntity(mesh);
		mesh.position.set(0, BLOCK_HEIGHT / 2, 0);
		this.towerGroup.add(mesh);
		this.blocks.push({ entity, mesh, width: BASE_WIDTH, depth: BASE_DEPTH, x: 0, z: 0, y: BLOCK_HEIGHT / 2 });
		this.height = 1;
	}

	private spawnSlidingBlock() {
		const prev = this.blocks[this.blocks.length - 1];
		const color = getBlockColor(this.blocks.length);
		const geo = new BoxGeometry(prev.width, BLOCK_HEIGHT, prev.depth);
		const mat = new MeshStandardMaterial({
			color, emissive: color, emissiveIntensity: 0.4, metalness: 0.7, roughness: 0.3,
		});
		const mesh = new Mesh(geo, mat);
		const entity = this.w.createTransformEntity(mesh);
		const y = prev.y + BLOCK_HEIGHT;
		mesh.position.set(
			this.slideAxis === 'x' ? -SLIDE_RANGE : prev.x,
			y,
			this.slideAxis === 'z' ? -SLIDE_RANGE : prev.z,
		);
		this.towerGroup.add(mesh);
		this.currentBlock = { entity, mesh, width: prev.width, depth: prev.depth, x: mesh.position.x, z: mesh.position.z, y };
		this.slideDir = 1;
	}

	private placeBlock() {
		if (!this.currentBlock || this.placeCooldown > 0) return;
		this.placeCooldown = 0.2;
		const cur = this.currentBlock;
		const prev = this.blocks[this.blocks.length - 1];
		const offX = cur.mesh.position.x - prev.x;
		const offZ = cur.mesh.position.z - prev.z;

		if (this.slideAxis === 'z') {
			const overlap = prev.depth - Math.abs(offZ);
			if (overlap <= 0) { this.gameOver(); return; }
		} else {
			const overlap = prev.width - Math.abs(offX);
			if (overlap <= 0) { this.gameOver(); return; }
		}

		const slideOff = this.slideAxis === 'z' ? offZ : offX;
		const isPerfect = Math.abs(slideOff) < PERFECT_THRESHOLD;

		if (isPerfect) {
			cur.mesh.position.x = prev.x;
			cur.mesh.position.z = prev.z;
			cur.width = prev.width;
			cur.depth = prev.depth;
			this.combo++;
			this.score += 10 + this.combo * 5;
			this.spawnPerfectParticles(cur.mesh.position);
			if (this.combo >= 5 && this.mode !== 'precision') {
				cur.width = Math.min(BASE_WIDTH, cur.width + 0.05);
				cur.depth = Math.min(BASE_DEPTH, cur.depth + 0.05);
			}
			this.audio.playPlace(true, this.combo);
			this.stats.totalPerfects++;
		} else {
			this.combo = 0;
			this.score += 5;
			if (this.slideAxis === 'z') {
				const cMin = cur.mesh.position.z - cur.depth / 2;
				const cMax = cur.mesh.position.z + cur.depth / 2;
				const pMin = prev.z - prev.depth / 2;
				const pMax = prev.z + prev.depth / 2;
				const oMin = Math.max(cMin, pMin);
				const oMax = Math.min(cMax, pMax);
				const oCenter = (oMin + oMax) / 2;
				const oSize = oMax - oMin;
				const cutMin = offZ > 0 ? oMax : cMin;
				const cutMax = offZ > 0 ? cMax : oMin;
				const cutSz = cutMax - cutMin;
				if (cutSz > 0.01) this.spawnFallingPiece(cur.mesh.position.x, cur.y, (cutMin + cutMax) / 2, cur.width, cutSz, getBlockColor(this.blocks.length));
				cur.mesh.position.z = oCenter;
				cur.depth = oSize;
			} else {
				const cMin = cur.mesh.position.x - cur.width / 2;
				const cMax = cur.mesh.position.x + cur.width / 2;
				const pMin = prev.x - prev.width / 2;
				const pMax = prev.x + prev.width / 2;
				const oMin = Math.max(cMin, pMin);
				const oMax = Math.min(cMax, pMax);
				const oCenter = (oMin + oMax) / 2;
				const oSize = oMax - oMin;
				const cutMin = offX > 0 ? oMax : cMin;
				const cutMax = offX > 0 ? cMax : oMin;
				const cutSz = cutMax - cutMin;
				if (cutSz > 0.01) this.spawnFallingPiece((cutMin + cutMax) / 2, cur.y, cur.mesh.position.z, cutSz, cur.depth, getBlockColor(this.blocks.length));
				cur.mesh.position.x = oCenter;
				cur.width = oSize;
			}
			cur.mesh.geometry.dispose();
			cur.mesh.geometry = new BoxGeometry(cur.width, BLOCK_HEIGHT, cur.depth);
			this.audio.playPlace(false, 0);
			this.audio.playCut();
		}

		if (this.combo > this.maxCombo) this.maxCombo = this.combo;
		cur.x = cur.mesh.position.x;
		cur.z = cur.mesh.position.z;
		this.blocks.push(cur);
		this.currentBlock = null;
		this.height = this.blocks.length;
		this.stats.totalBlocks++;
		if (this.mode !== 'endless') this.slideSpeed = Math.min(MAX_SPEED, BASE_SPEED + (this.height - 1) * SPEED_INCREMENT);
		this.cameraTargetY = Math.max(5, cur.y + 3);
		this.checkAchievements();
		this.updateHUD();
		if (cur.width < 0.1 || cur.depth < 0.1) { this.gameOver(); return; }
		if (this.mode === 'challenge' && this.height >= this.challengeTarget) { this.score += 100; this.gameOver(); return; }
		this.slideAxis = this.slideAxis === 'x' ? 'z' : 'x';
		this.spawnSlidingBlock();
	}

	private spawnFallingPiece(x: number, y: number, z: number, w: number, d: number, col: number) {
		const mat = new MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.3, metalness: 0.7, roughness: 0.3, transparent: true });
		const mesh = new Mesh(new BoxGeometry(w, BLOCK_HEIGHT, d), mat);
		mesh.position.set(x, y, z);
		this.towerGroup.add(mesh);
		this.fallingPieces.push({ mesh, velocity: new Vector3((Math.random() - 0.5), 0, (Math.random() - 0.5)), life: 2 });
	}

	private spawnPerfectParticles(pos: Vector3) {
		for (let i = 0; i < 20; i++) {
			const mat = new MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1, transparent: true });
			const mesh = new Mesh(new BoxGeometry(0.05, 0.05, 0.05), mat);
			mesh.position.copy(pos);
			this.particleGroup.add(mesh);
			const a = (i / 20) * Math.PI * 2;
			const s = 2 + Math.random() * 3;
			this.particles.push({ mesh, velocity: new Vector3(Math.cos(a) * s, (Math.random() - 0.3) * s, Math.sin(a) * s), life: 1, maxLife: 1 });
		}
	}

	private gameOver() {
		this.audio.stopDrone();
		this.audio.playGameOver();
		this.stats.gamesPlayed++;
		this.stats.totalScore += this.score;
		if (this.score > this.stats.bestScore) this.stats.bestScore = this.score;
		if (this.height > this.stats.bestHeight) this.stats.bestHeight = this.height;
		if (this.maxCombo > this.stats.bestCombo) this.stats.bestCombo = this.maxCombo;
		this.saveStats();
		this.checkAchievements();
		this.updateGameOverPanel();
		this.setState('game_over');
	}

	// ── Update ───────────────────────────────────────────────────────────

	update(delta: number, _time: number) {
		this.placeCooldown = Math.max(0, this.placeCooldown - delta);
		this.tryWirePanelHandlers();

		if (this.isCountingDown) {
			this.countdownTimer -= delta;
			this.updateCountdownPanel();
			if (this.countdownTimer <= 0) {
				this.isCountingDown = false;
				if (this.countdownEntity?.object3D) this.countdownEntity.object3D.visible = false;
				this.setState('playing');
				this.spawnSlidingBlock();
			}
			this.updateCamera(delta);
			this.kb.endFrame();
			return;
		}

		this.handleInput();

		if (this.state === 'playing') {
			this.gameTime += delta;
			if (this.currentBlock) {
				const p = this.currentBlock.mesh.position;
				if (this.slideAxis === 'x') {
					p.x += this.slideSpeed * this.slideDir * delta;
					if (p.x > SLIDE_RANGE) { p.x = SLIDE_RANGE; this.slideDir = -1; }
					if (p.x < -SLIDE_RANGE) { p.x = -SLIDE_RANGE; this.slideDir = 1; }
				} else {
					p.z += this.slideSpeed * this.slideDir * delta;
					if (p.z > SLIDE_RANGE) { p.z = SLIDE_RANGE; this.slideDir = -1; }
					if (p.z < -SLIDE_RANGE) { p.z = -SLIDE_RANGE; this.slideDir = 1; }
				}
			}
			if (this.mode === 'speed') {
				this.speedTimeLeft -= delta;
				if (this.speedTimeLeft <= 0) this.gameOver();
			}
		}

		for (let i = this.fallingPieces.length - 1; i >= 0; i--) {
			const f = this.fallingPieces[i];
			f.velocity.y -= 9.8 * delta;
			f.mesh.position.add(f.velocity.clone().multiplyScalar(delta));
			f.mesh.rotation.x += delta * 2;
			f.life -= delta;
			(f.mesh.material as MeshStandardMaterial).opacity = Math.max(0, f.life / 2);
			if (f.life <= 0 || f.mesh.position.y < -10) {
				this.towerGroup.remove(f.mesh);
				f.mesh.geometry.dispose();
				(f.mesh.material as MeshStandardMaterial).dispose();
				this.fallingPieces.splice(i, 1);
			}
		}

		for (let i = this.particles.length - 1; i >= 0; i--) {
			const p = this.particles[i];
			p.velocity.y -= 5 * delta;
			p.mesh.position.add(p.velocity.clone().multiplyScalar(delta));
			p.life -= delta;
			(p.mesh.material as MeshStandardMaterial).opacity = Math.max(0, p.life / p.maxLife);
			p.mesh.scale.setScalar(p.life / p.maxLife);
			if (p.life <= 0) {
				this.particleGroup.remove(p.mesh);
				p.mesh.geometry.dispose();
				(p.mesh.material as MeshStandardMaterial).dispose();
				this.particles.splice(i, 1);
			}
		}

		this.updateCamera(delta);
		if (this.starField) this.starField.rotation.y += delta * 0.005;
		this.kb.endFrame();
	}

	private updateCamera(delta: number) {
		this.cameraCurrentY += (this.cameraTargetY - this.cameraCurrentY) * delta * 3;
		this.w.camera.position.set(0, this.cameraCurrentY, 8);
		this.w.camera.lookAt(0, this.cameraCurrentY - 2, 0);
		if (this.state === 'game_over' && this.gameOverEntity?.object3D) this.gameOverEntity.object3D.position.y = this.cameraCurrentY;
		if (this.state === 'paused' && this.pauseEntity?.object3D) this.pauseEntity.object3D.position.y = this.cameraCurrentY;
	}

	private handleInput() {
		const rg = this.w.input.gamepads.right;
		const lg = this.w.input.gamepads.left;
		const trigger = rg?.getButtonDown(InputComponent.Trigger) || lg?.getButtonDown(InputComponent.Trigger);
		const aBtn = rg?.getButtonDown(InputComponent.A_Button) || lg?.getButtonDown(InputComponent.A_Button);
		const bBtn = rg?.getButtonDown(InputComponent.B_Button) || lg?.getButtonDown(InputComponent.B_Button);

		if (this.state === 'playing') {
			if (this.kb.getKeyDown('Space') || trigger || aBtn) this.placeBlock();
			if (this.kb.getKeyDown('Escape') || bBtn) this.setState('paused');
		} else if (this.state === 'paused') {
			if (this.kb.getKeyDown('Escape') || bBtn) this.setState('playing');
		}
	}

	// ── Panel Docs ───────────────────────────────────────────────────────

	private getDoc(e: Entity | null): UIKitDocument | undefined {
		if (!e) return undefined;
		return e.getValue(PanelDocument, 'document') as UIKitDocument | undefined;
	}

	private updateHUD() {
		const d = this.getDoc(this.hudEntity);
		if (!d) return;
		(d.getElementById('score') as UIKit.Text | undefined)?.setProperties({ text: `${this.score}` });
		(d.getElementById('combo') as UIKit.Text | undefined)?.setProperties({ text: this.combo > 0 ? `x${this.combo}` : '' });
		(d.getElementById('height') as UIKit.Text | undefined)?.setProperties({ text: `${this.height}` });
		if (this.mode === 'speed') (d.getElementById('timer') as UIKit.Text | undefined)?.setProperties({ text: `${Math.ceil(this.speedTimeLeft)}s` });
	}

	private updateGameOverPanel() {
		const d = this.getDoc(this.gameOverEntity);
		if (!d) return;
		(d.getElementById('final-score') as UIKit.Text | undefined)?.setProperties({ text: `${this.score}` });
		(d.getElementById('final-height') as UIKit.Text | undefined)?.setProperties({ text: `${this.height}` });
		(d.getElementById('final-combo') as UIKit.Text | undefined)?.setProperties({ text: `${this.maxCombo}` });
		(d.getElementById('best-score') as UIKit.Text | undefined)?.setProperties({ text: `${this.stats.bestScore}` });
	}

	private updateCountdownPanel() {
		const d = this.getDoc(this.countdownEntity);
		if (!d) return;
		const num = Math.ceil(this.countdownTimer);
		if (num > 0 && num !== this.lastCountdownNum) {
			this.lastCountdownNum = num;
			(d.getElementById('count') as UIKit.Text | undefined)?.setProperties({ text: `${num}` });
			this.audio.playCountdown();
		} else if (num <= 0 && this.lastCountdownNum !== 0) {
			this.lastCountdownNum = 0;
			(d.getElementById('count') as UIKit.Text | undefined)?.setProperties({ text: 'GO!' });
			this.audio.playCountdownGo();
		}
	}

	private updateSettingsPanel() {
		const d = this.getDoc(this.settingsEntity);
		if (!d) return;
		(d.getElementById('volume-val') as UIKit.Text | undefined)?.setProperties({ text: `${Math.round(this.audio.volume * 100)}%` });
		(d.getElementById('sfx-val') as UIKit.Text | undefined)?.setProperties({ text: this.audio.sfxEnabled ? 'ON' : 'OFF' });
		(d.getElementById('music-val') as UIKit.Text | undefined)?.setProperties({ text: this.audio.musicEnabled ? 'ON' : 'OFF' });
	}

	private updateAchievementsPanel() {
		const d = this.getDoc(this.achievementsEntity);
		if (!d) return;
		const u = this.achievements.filter((a) => a.unlocked).length;
		(d.getElementById('ach-total') as UIKit.Text | undefined)?.setProperties({ text: `${u} / ${this.achievements.length}` });
		for (let i = 0; i < 12 && i < this.achievements.length; i++) {
			const a = this.achievements[i];
			(d.getElementById(`ach-name-${i}`) as UIKit.Text | undefined)?.setProperties({ text: a.unlocked ? a.name : '???' });
			(d.getElementById(`ach-desc-${i}`) as UIKit.Text | undefined)?.setProperties({ text: a.unlocked ? a.description : 'Locked' });
		}
	}

	private updateStatsPanel() {
		const d = this.getDoc(this.statsEntity);
		if (!d) return;
		const s = (id: string, v: string) => (d.getElementById(id) as UIKit.Text | undefined)?.setProperties({ text: v });
		s('stat-games', `${this.stats.gamesPlayed}`);
		s('stat-blocks', `${this.stats.totalBlocks}`);
		s('stat-perfects', `${this.stats.totalPerfects}`);
		s('stat-best-height', `${this.stats.bestHeight}`);
		s('stat-best-combo', `${this.stats.bestCombo}`);
		s('stat-best-score', `${this.stats.bestScore}`);
		s('stat-total-score', `${this.stats.totalScore}`);
		const pct = this.stats.totalBlocks > 0 ? ((this.stats.totalPerfects / this.stats.totalBlocks) * 100).toFixed(1) : '0.0';
		s('stat-perfect-pct', `${pct}%`);
	}

	// ── Panel Wiring ─────────────────────────────────────────────────────

	private wired = new Set<string>();
	private tryWirePanelHandlers() {
		this.wire('menu', this.menuEntity, (d) => {
			this.btn(d, 'btn-play', () => { this.audio.playMenuSelect(); this.setState('mode_select'); });
			this.btn(d, 'btn-settings', () => { this.audio.playMenuSelect(); this.updateSettingsPanel(); this.setState('settings'); });
			this.btn(d, 'btn-achievements', () => { this.audio.playMenuSelect(); this.updateAchievementsPanel(); this.setState('achievements'); });
			this.btn(d, 'btn-tutorial', () => { this.audio.playMenuSelect(); this.setState('tutorial'); });
			this.btn(d, 'btn-stats', () => { this.audio.playMenuSelect(); this.updateStatsPanel(); this.setState('stats'); });
		});
		this.wire('modes', this.modeSelectEntity, (d) => {
			this.btn(d, 'btn-classic', () => { this.audio.playMenuSelect(); this.startGame('classic'); });
			this.btn(d, 'btn-zen', () => { this.audio.playMenuSelect(); this.startGame('zen'); });
			this.btn(d, 'btn-speed', () => { this.audio.playMenuSelect(); this.startGame('speed'); });
			this.btn(d, 'btn-precision', () => { this.audio.playMenuSelect(); this.startGame('precision'); });
			this.btn(d, 'btn-challenge', () => { this.audio.playMenuSelect(); this.startGame('challenge'); });
			this.btn(d, 'btn-endless', () => { this.audio.playMenuSelect(); this.startGame('endless'); });
			this.btn(d, 'btn-mode-back', () => { this.audio.playMenuSelect(); this.setState('menu'); });
		});
		this.wire('gameover', this.gameOverEntity, (d) => {
			this.btn(d, 'btn-retry', () => { this.audio.playMenuSelect(); this.startGame(this.mode); });
			this.btn(d, 'btn-menu', () => { this.audio.playMenuSelect(); this.clearTower(); this.setState('menu'); });
		});
		this.wire('pause', this.pauseEntity, (d) => {
			this.btn(d, 'btn-resume', () => { this.audio.playMenuSelect(); this.setState('playing'); });
			this.btn(d, 'btn-pause-menu', () => { this.audio.playMenuSelect(); this.audio.stopDrone(); this.clearTower(); this.setState('menu'); });
		});
		this.wire('settings', this.settingsEntity, (d) => {
			this.btn(d, 'btn-vol-up', () => { this.audio.setVolume(Math.min(1, this.audio.volume + 0.1)); this.updateSettingsPanel(); });
			this.btn(d, 'btn-vol-down', () => { this.audio.setVolume(Math.max(0, this.audio.volume - 0.1)); this.updateSettingsPanel(); });
			this.btn(d, 'btn-sfx-toggle', () => { this.audio.sfxEnabled = !this.audio.sfxEnabled; this.updateSettingsPanel(); });
			this.btn(d, 'btn-music-toggle', () => { this.audio.musicEnabled = !this.audio.musicEnabled; this.updateSettingsPanel(); });
			this.btn(d, 'btn-settings-back', () => { this.audio.playMenuSelect(); this.setState('menu'); });
		});
		this.wire('ach', this.achievementsEntity, (d) => { this.btn(d, 'btn-ach-back', () => { this.audio.playMenuSelect(); this.setState('menu'); }); });
		this.wire('tut', this.tutorialEntity, (d) => { this.btn(d, 'btn-tutorial-back', () => { this.audio.playMenuSelect(); this.setState('menu'); }); });
		this.wire('stats', this.statsEntity, (d) => { this.btn(d, 'btn-stats-back', () => { this.audio.playMenuSelect(); this.setState('menu'); }); });
	}

	private wire(key: string, e: Entity | null, setup: (d: UIKitDocument) => void) {
		if (this.wired.has(key)) return;
		const d = this.getDoc(e);
		if (!d) return;
		this.wired.add(key);
		setup(d);
	}

	private btn(d: UIKitDocument, id: string, h: () => void) {
		const el = d.getElementById(id);
		if (el) (el as any).addEventListener('click', h);
	}

	// ── Achievements ─────────────────────────────────────────────────────

	private loadAchievements() {
		this.achievements = [
			{ id: 'first_stack', name: 'First Stack', description: 'Place your first block', unlocked: false },
			{ id: 'stack_5', name: 'Getting Started', description: 'Stack 5 blocks', unlocked: false },
			{ id: 'stack_10', name: 'Rising Tower', description: 'Stack 10 blocks', unlocked: false },
			{ id: 'stack_20', name: 'Sky Scraper', description: 'Stack 20 blocks', unlocked: false },
			{ id: 'stack_30', name: 'Cloud Piercer', description: 'Stack 30 blocks', unlocked: false },
			{ id: 'stack_50', name: 'Tower of Babel', description: 'Stack 50 blocks', unlocked: false },
			{ id: 'stack_75', name: 'Orbital Tower', description: 'Stack 75 blocks', unlocked: false },
			{ id: 'stack_100', name: 'To Infinity', description: 'Stack 100 blocks', unlocked: false },
			{ id: 'perfect_1', name: 'Precision', description: 'Get a perfect placement', unlocked: false },
			{ id: 'perfect_3', name: 'Triple Perfect', description: '3 perfects in a row', unlocked: false },
			{ id: 'perfect_5', name: 'Combo Master', description: '5 perfects in a row', unlocked: false },
			{ id: 'perfect_10', name: 'Perfect Ten', description: '10 perfects in a row', unlocked: false },
			{ id: 'perfect_15', name: 'Untouchable', description: '15 perfects in a row', unlocked: false },
			{ id: 'perfect_20', name: 'Godlike', description: '20 perfects in a row', unlocked: false },
			{ id: 'perfect_25', name: 'Beyond Perfect', description: '25 perfects in a row', unlocked: false },
			{ id: 'score_50', name: 'Half Century', description: 'Score 50 points', unlocked: false },
			{ id: 'score_100', name: 'Centurion', description: 'Score 100 points', unlocked: false },
			{ id: 'score_250', name: 'Quarter Grand', description: 'Score 250 points', unlocked: false },
			{ id: 'score_500', name: 'Half Grand', description: 'Score 500 points', unlocked: false },
			{ id: 'score_1000', name: 'Grand Master', description: 'Score 1000 points', unlocked: false },
			{ id: 'score_2000', name: 'Legend', description: 'Score 2000 points', unlocked: false },
			{ id: 'score_5000', name: 'Mythical', description: 'Score 5000 points', unlocked: false },
			{ id: 'games_5', name: 'Regular', description: 'Play 5 games', unlocked: false },
			{ id: 'games_10', name: 'Dedicated', description: 'Play 10 games', unlocked: false },
			{ id: 'games_25', name: 'Veteran', description: 'Play 25 games', unlocked: false },
			{ id: 'games_50', name: 'Addict', description: 'Play 50 games', unlocked: false },
			{ id: 'total_blocks_100', name: 'Brick Layer', description: 'Place 100 total blocks', unlocked: false },
			{ id: 'total_blocks_500', name: 'Architect', description: 'Place 500 total blocks', unlocked: false },
			{ id: 'total_blocks_1000', name: 'Master Builder', description: 'Place 1000 total blocks', unlocked: false },
			{ id: 'total_perfects_50', name: 'Perfectionist', description: '50 total perfect placements', unlocked: false },
			{ id: 'total_perfects_100', name: 'Zen Master', description: '100 total perfect placements', unlocked: false },
			{ id: 'total_perfects_250', name: 'Transcendent', description: '250 total perfect placements', unlocked: false },
			{ id: 'mode_classic', name: 'Classic Player', description: 'Play Classic mode', unlocked: false },
			{ id: 'mode_zen', name: 'Zen Player', description: 'Play Zen mode', unlocked: false },
			{ id: 'mode_speed', name: 'Speed Runner', description: 'Play Speed mode', unlocked: false },
			{ id: 'mode_precision', name: 'Precision Player', description: 'Play Precision mode', unlocked: false },
			{ id: 'mode_challenge', name: 'Challenger', description: 'Play Challenge mode', unlocked: false },
			{ id: 'mode_endless', name: 'Endless Player', description: 'Play Endless mode', unlocked: false },
			{ id: 'speed_20', name: 'Speed Stacker', description: 'Stack 20 in Speed mode', unlocked: false },
			{ id: 'precision_all', name: 'Perfect Run', description: 'All perfects in Precision (10+ blocks)', unlocked: false },
			{ id: 'challenge_win', name: 'Challenge Complete', description: 'Win a Challenge', unlocked: false },
			{ id: 'total_score_10000', name: 'Point Hoarder', description: '10,000 total points', unlocked: false },
			{ id: 'narrow_escape', name: 'Razor Thin', description: 'Place a block with < 0.3 width', unlocked: false },
			{ id: 'perfect_pct_50', name: 'Above Average', description: '50%+ perfect rate (20+ blocks)', unlocked: false },
		];
		try {
			const s = localStorage.getItem('neon-stack-achievements');
			if (s) { const ids = JSON.parse(s) as string[]; for (const a of this.achievements) if (ids.includes(a.id)) a.unlocked = true; }
		} catch { /* ignore */ }
	}

	private saveAchievements() {
		try { localStorage.setItem('neon-stack-achievements', JSON.stringify(this.achievements.filter((a) => a.unlocked).map((a) => a.id))); } catch { /* */ }
	}

	private unlock(id: string) {
		const a = this.achievements.find((x) => x.id === id);
		if (a && !a.unlocked) { a.unlocked = true; this.audio.playAchievement(); this.saveAchievements(); }
	}

	private checkAchievements() {
		if (this.height >= 1) this.unlock('first_stack');
		if (this.height >= 5) this.unlock('stack_5');
		if (this.height >= 10) this.unlock('stack_10');
		if (this.height >= 20) this.unlock('stack_20');
		if (this.height >= 30) this.unlock('stack_30');
		if (this.height >= 50) this.unlock('stack_50');
		if (this.height >= 75) this.unlock('stack_75');
		if (this.height >= 100) this.unlock('stack_100');
		if (this.combo >= 1) this.unlock('perfect_1');
		if (this.combo >= 3) this.unlock('perfect_3');
		if (this.combo >= 5) this.unlock('perfect_5');
		if (this.combo >= 10) this.unlock('perfect_10');
		if (this.combo >= 15) this.unlock('perfect_15');
		if (this.combo >= 20) this.unlock('perfect_20');
		if (this.combo >= 25) this.unlock('perfect_25');
		if (this.score >= 50) this.unlock('score_50');
		if (this.score >= 100) this.unlock('score_100');
		if (this.score >= 250) this.unlock('score_250');
		if (this.score >= 500) this.unlock('score_500');
		if (this.score >= 1000) this.unlock('score_1000');
		if (this.score >= 2000) this.unlock('score_2000');
		if (this.score >= 5000) this.unlock('score_5000');
		if (this.stats.gamesPlayed >= 5) this.unlock('games_5');
		if (this.stats.gamesPlayed >= 10) this.unlock('games_10');
		if (this.stats.gamesPlayed >= 25) this.unlock('games_25');
		if (this.stats.gamesPlayed >= 50) this.unlock('games_50');
		if (this.stats.totalBlocks >= 100) this.unlock('total_blocks_100');
		if (this.stats.totalBlocks >= 500) this.unlock('total_blocks_500');
		if (this.stats.totalBlocks >= 1000) this.unlock('total_blocks_1000');
		if (this.stats.totalPerfects >= 50) this.unlock('total_perfects_50');
		if (this.stats.totalPerfects >= 100) this.unlock('total_perfects_100');
		if (this.stats.totalPerfects >= 250) this.unlock('total_perfects_250');
		if (this.mode === 'classic') this.unlock('mode_classic');
		if (this.mode === 'zen') this.unlock('mode_zen');
		if (this.mode === 'speed') this.unlock('mode_speed');
		if (this.mode === 'precision') this.unlock('mode_precision');
		if (this.mode === 'challenge') this.unlock('mode_challenge');
		if (this.mode === 'endless') this.unlock('mode_endless');
		if (this.mode === 'speed' && this.height >= 20) this.unlock('speed_20');
		if (this.mode === 'precision' && this.height >= 10 && this.combo === this.height - 1) this.unlock('precision_all');
		if (this.mode === 'challenge' && this.height >= this.challengeTarget) this.unlock('challenge_win');
		if (this.stats.totalScore >= 10000) this.unlock('total_score_10000');
		const lb = this.blocks[this.blocks.length - 1];
		if (lb && (lb.width < 0.3 || lb.depth < 0.3)) this.unlock('narrow_escape');
		if (this.height >= 20 && this.stats.totalBlocks > 0 && this.stats.totalPerfects / this.stats.totalBlocks >= 0.5) this.unlock('perfect_pct_50');
	}

	// ── Persistence ──────────────────────────────────────────────────────

	private loadStats() { try { const s = localStorage.getItem('neon-stack-stats'); if (s) this.stats = JSON.parse(s); } catch { /* */ } }
	private saveStats() { try { localStorage.setItem('neon-stack-stats', JSON.stringify(this.stats)); } catch { /* */ } }
}
