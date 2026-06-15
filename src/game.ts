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
	SphereGeometry,
	MeshBasicMaterial,
	CylinderGeometry,
	RingGeometry,
	DoubleSide,
	TorusGeometry,
} from '@iwsdk/core';

// == Types ==================================================================

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

interface FloatingText {
	mesh: Mesh;
	velocity: Vector3;
	life: number;
	maxLife: number;
}

interface TrailParticle {
	mesh: Mesh;
	life: number;
}

interface LandingAnim {
	mesh: Mesh;
	time: number;
	duration: number;
	origScaleY: number;
}

type GameMode = 'classic' | 'zen' | 'speed' | 'precision' | 'challenge' | 'endless';
type GameState = 'menu' | 'mode_select' | 'playing' | 'paused' | 'game_over' | 'settings' | 'achievements' | 'tutorial' | 'stats' | 'leaderboard' | 'daily_challenge';
type PowerUpType = 'slowmo' | 'widthboost' | 'shield' | 'multiplier';
type ColorTheme = 'neon' | 'fire' | 'ice' | 'vapor';

interface PowerUp {
	type: PowerUpType;
	active: boolean;
	timer: number;
	duration: number;
}

const COLOR_THEMES: Record<ColorTheme, number[]> = {
	neon: [0x00ffff, 0xff00ff, 0x00ff88, 0xff4488, 0x44aaff, 0xffaa00, 0xaa44ff, 0x88ff00, 0xff6644, 0x44ffaa],
	fire: [0xff4400, 0xff6600, 0xff8800, 0xffaa00, 0xffcc00, 0xff3300, 0xff5500, 0xff7700, 0xff9900, 0xffbb00],
	ice: [0x88ccff, 0xaaddff, 0x44aaff, 0x66bbff, 0xccddff, 0x4488ff, 0x99ccff, 0xbbddff, 0x2277ff, 0xddeeff],
	vapor: [0xff66aa, 0xaa44ff, 0x44ffcc, 0xff88cc, 0x8844ff, 0x66ffdd, 0xff44aa, 0xbb66ff, 0x55ffbb, 0xff77bb],
};

const THEME_ACCENTS: Record<ColorTheme, { bg: number; fog: number; grid: number; gridEmit: number }> = {
	neon: { bg: 0x050510, fog: 0x050510, grid: 0x00ffff, gridEmit: 0x006688 },
	fire: { bg: 0x100505, fog: 0x100505, grid: 0xff6600, gridEmit: 0x882200 },
	ice: { bg: 0x050810, fog: 0x050810, grid: 0x88ccff, gridEmit: 0x224488 },
	vapor: { bg: 0x0a0510, fog: 0x0a0510, grid: 0xff66aa, gridEmit: 0x662244 },
};

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

interface LeaderboardEntry {
	score: number;
	height: number;
	combo: number;
	date: string;
}

type Leaderboards = Record<GameMode, LeaderboardEntry[]>;

interface DailyChallenge {
	seed: number;
	type: 'score' | 'height' | 'combo' | 'perfects';
	target: number;
	description: string;
	date: string;
}

interface AuroraWave {
	mesh: Mesh;
	speed: number;
	amplitude: number;
	phase: number;
	baseY: number;
}

interface RippleRing {
	mesh: Mesh;
	life: number;
	maxLife: number;
	maxScale: number;
}

interface ScorePopup {
	mesh: Mesh;
	life: number;
	velocity: Vector3;
}

interface ConfettiPiece {
	mesh: Mesh;
	velocity: Vector3;
	rotSpeed: Vector3;
	life: number;
}

interface MilestoneMarker {
	ring: Mesh;
	height: number;
}

interface SessionRecord {
	score: number;
	height: number;
	combo: number;
	mode: GameMode;
}

interface SpeedLine {
	mesh: Mesh;
	life: number;
	velocity: Vector3;
}

interface NearMissFlash {
	timer: number;
	text: string;
}

interface WeatherParticle {
	mesh: Mesh;
	velocity: Vector3;
	life: number;
}

interface WaveInfo {
	wave: number;
	speedMult: number;
	windMult: number;
	scoreBonus: number;
}

// == Audio Engine ===========================================================

class AudioEngine {
	private ctx: AudioContext | null = null;
	private masterGain: GainNode | null = null;
	volume = 0.7;
	sfxEnabled = true;
	musicEnabled = true;
	private droneLayers: { osc: OscillatorNode; gain: GainNode }[] = [];
	private droneActive = false;
	private heightTarget = 0;

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

	/** Multi-layered evolving drone - intensity grows with height */
	startDrone() {
		if (!this.musicEnabled) return;
		if (this.droneActive) return;
		const ctx = this.ensure();
		this.droneActive = true;
		this.heightTarget = 0;

		// Layer 0: deep sub bass
		const l0osc = ctx.createOscillator();
		const l0gain = ctx.createGain();
		l0osc.connect(l0gain);
		l0gain.connect(this.masterGain!);
		l0osc.type = 'sine';
		l0osc.frequency.value = 55;
		l0gain.gain.value = 0.08;
		l0osc.start();
		this.droneLayers.push({ osc: l0osc, gain: l0gain });

		// Layer 1: mid harmonic (starts silent, fades in with height)
		const l1osc = ctx.createOscillator();
		const l1gain = ctx.createGain();
		l1osc.connect(l1gain);
		l1gain.connect(this.masterGain!);
		l1osc.type = 'triangle';
		l1osc.frequency.value = 110;
		l1gain.gain.value = 0;
		l1osc.start();
		this.droneLayers.push({ osc: l1osc, gain: l1gain });

		// Layer 2: high shimmer (starts silent, fades in at greater heights)
		const l2osc = ctx.createOscillator();
		const l2gain = ctx.createGain();
		l2osc.connect(l2gain);
		l2gain.connect(this.masterGain!);
		l2osc.type = 'sine';
		l2osc.frequency.value = 220;
		l2gain.gain.value = 0;
		l2osc.start();
		this.droneLayers.push({ osc: l2osc, gain: l2gain });

		// Layer 3: tension pad (high altitude only)
		const l3osc = ctx.createOscillator();
		const l3gain = ctx.createGain();
		l3osc.connect(l3gain);
		l3gain.connect(this.masterGain!);
		l3osc.type = 'sawtooth';
		l3osc.frequency.value = 165;
		l3gain.gain.value = 0;
		l3osc.start();
		this.droneLayers.push({ osc: l3osc, gain: l3gain });
	}

	/** Crossfade drone layers based on tower height */
	updateDroneHeight(height: number) {
		if (!this.droneActive || this.droneLayers.length < 4) return;
		const ctx = this.ensure();
		const t = ctx.currentTime;
		const h = Math.max(0, height - 1);

		// Layer 0: always audible, slight intensity increase
		this.droneLayers[0].gain.gain.linearRampToValueAtTime(0.08 + Math.min(h / 80, 0.04), t + 0.3);
		// Layer 1: fades in from height 5
		this.droneLayers[1].gain.gain.linearRampToValueAtTime(Math.min(1, Math.max(0, (h - 5) / 20)) * 0.06, t + 0.3);
		// Layer 2: fades in from height 15
		this.droneLayers[2].gain.gain.linearRampToValueAtTime(Math.min(1, Math.max(0, (h - 15) / 25)) * 0.05, t + 0.3);
		// Layer 3: tension at height 30+
		this.droneLayers[3].gain.gain.linearRampToValueAtTime(Math.min(1, Math.max(0, (h - 30) / 30)) * 0.03, t + 0.3);

		// Subtle pitch drift on higher layers
		if (h > 10) {
			this.droneLayers[1].osc.frequency.linearRampToValueAtTime(110 + Math.sin(h * 0.1) * 3, t + 0.5);
		}
		if (h > 25) {
			this.droneLayers[2].osc.frequency.linearRampToValueAtTime(220 + Math.sin(h * 0.07) * 5, t + 0.5);
		}
	}

	stopDrone() {
		for (const layer of this.droneLayers) {
			try {
				layer.osc.stop();
				layer.osc.disconnect();
				layer.gain.disconnect();
			} catch { /* already stopped */ }
		}
		this.droneLayers = [];
		this.droneActive = false;
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

	playLevelUp() {
		if (!this.sfxEnabled) return;
		const ctx = this.ensure();
		const t = ctx.currentTime;
		[392, 494, 588, 784].forEach((freq, i) => {
			const o = ctx.createOscillator();
			const g = ctx.createGain();
			o.connect(g);
			g.connect(this.masterGain!);
			o.frequency.value = freq;
			o.type = 'sine';
			g.gain.setValueAtTime(0.2, t + i * 0.05);
			g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.05 + 0.2);
			o.start(t + i * 0.05);
			o.stop(t + i * 0.05 + 0.25);
		});
	}
}

// == Constants ==============================================================

let activeThemeColors = COLOR_THEMES.neon;
const getBlockColor = (i: number) => activeThemeColors[i % activeThemeColors.length];

const BLOCK_HEIGHT = 0.3;
const BASE_WIDTH = 3.0;
const BASE_DEPTH = 3.0;
const BASE_SPEED = 2.5;
const SPEED_INCREMENT = 0.08;
const MAX_SPEED = 8.0;
const PERFECT_THRESHOLD = 0.08;
const NEAR_MISS_THRESHOLD = 0.22;
const SLIDE_RANGE = 5.0;

// == Keyboard ===============================================================

class KeyboardState {
	private pressed = new Set<string>();
	private justDown = new Set<string>();
	clicked = false;
	constructor() {
		window.addEventListener('keydown', (e) => {
			if (!this.pressed.has(e.code)) this.justDown.add(e.code);
			this.pressed.add(e.code);
		});
		window.addEventListener('keyup', (e) => { this.pressed.delete(e.code); });
		window.addEventListener('pointerdown', (e) => {
			const t = e.target as HTMLElement;
			if (t.tagName === 'CANVAS') this.clicked = true;
		});
	}
	getKeyDown(code: string) { return this.justDown.has(code); }
	endFrame() { this.justDown.clear(); this.clicked = false; }
}

// == Main System ============================================================

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
	private trailParticles: TrailParticle[] = [];
	private landingAnims: LandingAnim[] = [];
	private particleGroup!: Group;
	private towerGroup!: Group;
	private trailGroup!: Group;
	private starField!: Points;
	private audio = new AudioEngine();
	private kb = new KeyboardState();

	// Panel entities
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
	private achievementPopupEntity: Entity | null = null;
	private leaderboardEntity: Entity | null = null;

	private w!: World;
	private achievements: Achievement[] = [];
	private stats: GameStats = {
		gamesPlayed: 0, totalBlocks: 0, totalPerfects: 0,
		bestHeight: 0, bestCombo: 0, bestScore: 0, totalScore: 0,
	};
	private leaderboards: Leaderboards = {
		classic: [], zen: [], speed: [], precision: [], challenge: [], endless: [],
	};
	private speedTimeLeft = 60;
	private challengeTarget = 0;
	private cameraTargetY = 5;
	private cameraCurrentY = 5;
	private placeCooldown = 0;
	private lastCountdownNum = -1;
	private towerLights: PointLight[] = [];
	private comboFlashTime = 0;

	// Ghost preview block
	private ghostMesh: Mesh | null = null;

	// Achievement popup
	private achievementPopupTimer = 0;
	private achievementQueue: string[] = [];

	// Menu camera orbit
	private menuOrbitAngle = 0;

	// Leaderboard state
	private lbViewMode: GameMode = 'classic';

	// Score milestone tracking
	private lastMilestone = 0;

	// Camera shake
	private shakeIntensity = 0;
	private shakeTime = 0;

	// New best indicator
	private isNewBest = false;

	// Power-ups
	private powerUps: PowerUp[] = [];
	private slowMoAwarded = false;
	private widthBoostAwarded = false;
	private powerupEntity: Entity | null = null;
	private powerupNotifyTimer = 0;

	// Color theme
	private colorTheme: ColorTheme = 'neon';
	private gridGroup: Group | null = null;

	// Shield power-up
	private shieldActive = false;
	private shieldMesh: Mesh | null = null;

	// Score multiplier
	private multiplierTimer = 0;
	private multiplierDuration = 8;

	// Combo announcer
	private comboAnnounceEntity: Entity | null = null;
	private comboAnnounceTimer = 0;

	// Daily challenge
	private dailyEntity: Entity | null = null;
	private dailyChallenge: DailyChallenge | null = null;
	private dailyBest: number = 0;
	private isDailyRun = false;

	// Aurora sky effect
	private auroraGroup: Group | null = null;
	private auroraWaves: AuroraWave[] = [];

	// Screen pulse (ambient flash on perfect)
	private screenPulseIntensity = 0;
	private ambientLight: AmbientLight | null = null;

	// Tower sway
	private towerSwayTime = 0;

	// Round 5: Ripple rings on block placement
	private rippleRings: RippleRing[] = [];

	// Round 5: Floating score popups
	private scorePopups: ScorePopup[] = [];
	private scorePopupGroup!: Group;

	// Round 5: Confetti system
	private confettiPieces: ConfettiPiece[] = [];
	private confettiGroup!: Group;

	// Round 5: Height milestone markers
	private milestoneMarkers: MilestoneMarker[] = [];
	private milestoneHeights = [25, 50, 75, 100, 120, 150];

	// Round 5: Session comparison
	private lastSession: SessionRecord | null = null;
	private sessionPerfects = 0;

	// Round 6: Wind effect
	private windStrength = 0;
	private windDirection = 0;
	private windTime = 0;

	// Round 6: Near-miss feedback
	private nearMissFlash: NearMissFlash = { timer: 0, text: '' };

	// Round 6: Game over tower orbit
	private gameOverOrbitAngle = 0;
	private gameOverOrbitActive = false;

	// Round 6: Magnet power-up
	private magnetActive = false;

	// Round 6: Speed lines
	private speedLines: SpeedLine[] = [];
	private speedLineGroup!: Group;

	// Round 6: Near-miss counter
	private sessionNearMisses = 0;

	// Round 6: Theme tracking (for all_themes achievement)
	private themesPlayed = new Set<ColorTheme>();

	// Round 7: Fever mode
	private feverActive = false;
	private feverIntensity = 0;
	private feverTime = 0;

	// Round 7: Freeze power-up
	private freezeActive = false;
	private freezeTimer = 0;
	private freezeDuration = 2.5;

	// Round 7: Weather particles
	private weatherParticles: WeatherParticle[] = [];
	private weatherGroup!: Group;
	private weatherSpawnTimer = 0;

	// Round 7: Endless wave system
	private endlessWave: WaveInfo = { wave: 1, speedMult: 1, windMult: 1, scoreBonus: 0 };
	private waveAnnouncerTimer = 0;
	private waveBlocksThreshold = 20;

	// Round 7: Power-up usage tracking
	private powerUpsUsed = 0;

	bootstrap(world: World) {
		this.w = world;
		this.loadTheme();
		this.loadStats();
		this.loadAchievements();
		this.loadLeaderboards();
		this.setupScene();
		this.setupPanels();
	}

	private setupScene() {
		const scene = this.w.scene;
		const accent = THEME_ACCENTS[this.colorTheme];
		scene.fog = new FogExp2(accent.fog, 0.015);
		scene.background = new Color(accent.bg);

		// Override the default environment lighting
		scene.environment = null;

		const amb = new AmbientLight(0x334466, 0.8);
		scene.add(amb);
		this.ambientLight = amb;
		const dir = new DirectionalLight(0x8888ff, 0.6);
		dir.position.set(5, 20, 10);
		scene.add(dir);
		const p1 = new PointLight(0x00ffff, 1.5, 40);
		p1.position.set(-5, 10, 5);
		scene.add(p1);
		const p2 = new PointLight(0xff00ff, 1.0, 40);
		p2.position.set(5, 15, -5);
		scene.add(p2);
		const p3 = new PointLight(0x44aaff, 0.6, 30);
		p3.position.set(0, 3, 8);
		scene.add(p3);
		this.towerGroup = new Group();
		scene.add(this.towerGroup);
		this.particleGroup = new Group();
		scene.add(this.particleGroup);
		this.trailGroup = new Group();
		scene.add(this.trailGroup);
		this.scorePopupGroup = new Group();
		scene.add(this.scorePopupGroup);
		this.confettiGroup = new Group();
		scene.add(this.confettiGroup);
		this.speedLineGroup = new Group();
		scene.add(this.speedLineGroup);
		this.weatherGroup = new Group();
		scene.add(this.weatherGroup);
		this.createGrid(scene);
		this.createStars(scene);
		this.createAurora(scene);
	}

	private createGrid(parent: Object3D) {
		if (this.gridGroup) parent.remove(this.gridGroup);
		const g = new Group();
		this.gridGroup = g;
		const accent = THEME_ACCENTS[this.colorTheme];
		const size = 40; const divs = 40; const step = size / divs; const half = size / 2;
		for (let i = 0; i <= divs; i++) {
			const pos = -half + i * step;
			const main = i % 5 === 0;
			const c = main ? accent.grid : 0x112233;
			const e = main ? accent.gridEmit : 0x060612;
			const xL = new Mesh(new BoxGeometry(size, 0.008, 0.008), new MeshStandardMaterial({ color: c, emissive: e, emissiveIntensity: main ? 0.8 : 0.3 }));
			xL.position.set(0, 0, pos); g.add(xL);
			const zL = new Mesh(new BoxGeometry(0.008, 0.008, size), new MeshStandardMaterial({ color: c, emissive: e, emissiveIntensity: main ? 0.8 : 0.3 }));
			zL.position.set(pos, 0, 0); g.add(zL);
		}
		parent.add(g);
	}

	private createStars(parent: Object3D) {
		const n = 800; const p = new Float32Array(n * 3);
		for (let i = 0; i < n; i++) {
			p[i * 3] = (Math.random() - 0.5) * 120;
			p[i * 3 + 1] = Math.random() * 100 + 5;
			p[i * 3 + 2] = (Math.random() - 0.5) * 120;
		}
		const geo = new BufferGeometry();
		geo.setAttribute('position', new Float32BufferAttribute(p, 3));
		this.starField = new Points(geo, new PointsMaterial({
			color: 0xaabbff, size: 0.12, blending: AdditiveBlending, transparent: true, opacity: 0.7,
		}));
		parent.add(this.starField);
	}

	private getAuroraColors(): number[] {
		switch (this.colorTheme) {
			case 'fire': return [0xff6600, 0xff4400, 0xff8800, 0xffaa00, 0xff3300];
			case 'ice': return [0x88ccff, 0x44aaff, 0xaaddff, 0x66bbff, 0x2277ff];
			case 'vapor': return [0xff66aa, 0xaa44ff, 0x44ffcc, 0xff88cc, 0xbb66ff];
			default: return [0x00ffaa, 0x00aaff, 0xff00aa, 0xaa00ff, 0x44ffcc];
		}
	}

	private createAurora(parent: Object3D) {
		if (this.auroraGroup) { parent.remove(this.auroraGroup); this.auroraWaves = []; }
		this.auroraGroup = new Group();
		const colors = this.getAuroraColors();
		for (let i = 0; i < 5; i++) {
			const width = 60;
			const segments = 40;
			const positions = new Float32Array((segments + 1) * 3);
			for (let s = 0; s <= segments; s++) {
				positions[s * 3] = (s / segments - 0.5) * width;
				positions[s * 3 + 1] = 0;
				positions[s * 3 + 2] = 0;
			}
			const geo = new BufferGeometry();
			geo.setAttribute('position', new Float32BufferAttribute(positions, 3));
			const mat = new PointsMaterial({
				color: colors[i % colors.length],
				size: 0.3,
				blending: AdditiveBlending,
				transparent: true,
				opacity: 0.15,
			});
			const mesh = new Points(geo, mat) as unknown as Mesh;
			const baseY = 40 + i * 6;
			mesh.position.set(0, baseY, -30 - i * 5);
			this.auroraGroup.add(mesh);
			this.auroraWaves.push({
				mesh,
				speed: 0.3 + i * 0.12,
				amplitude: 2 + i * 0.8,
				phase: i * 1.2,
				baseY,
			});
		}
		parent.add(this.auroraGroup);
	}

	private updateAurora(time: number) {
		for (const wave of this.auroraWaves) {
			const geo = wave.mesh.geometry as BufferGeometry;
			const pos = geo.getAttribute('position');
			if (!pos) continue;
			const arr = pos.array as Float32Array;
			const segments = (arr.length / 3) - 1;
			for (let s = 0; s <= segments; s++) {
				const x = arr[s * 3];
				arr[s * 3 + 1] = Math.sin(x * 0.05 + time * wave.speed + wave.phase) * wave.amplitude
					+ Math.sin(x * 0.03 + time * wave.speed * 0.7) * wave.amplitude * 0.5;
			}
			pos.needsUpdate = true;
			// Subtle opacity pulse
			const mat = wave.mesh.material as PointsMaterial;
			mat.opacity = 0.1 + Math.sin(time * 0.5 + wave.phase) * 0.06;
		}
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

		this.achievementPopupEntity = w.createTransformEntity();
		this.achievementPopupEntity.addComponent(PanelUI, { config: './ui/achievement-popup.json' });
		this.achievementPopupEntity.addComponent(Follower, { target: cam, offsetPosition: [0, 0.5, -1.8], speed: 10 });
		this.achievementPopupEntity.object3D!.visible = false;

		this.leaderboardEntity = w.createTransformEntity();
		this.leaderboardEntity.addComponent(PanelUI, { config: './ui/leaderboard.json' });
		this.leaderboardEntity.addComponent(Follower, { target: cam, offsetPosition: [0, 0, -2.5], speed: 6 });
		this.leaderboardEntity.object3D!.visible = false;

		this.powerupEntity = w.createTransformEntity();
		this.powerupEntity.addComponent(PanelUI, { config: './ui/powerup.json' });
		this.powerupEntity.addComponent(Follower, { target: cam, offsetPosition: [0, 0.35, -1.5], speed: 10 });
		this.powerupEntity.object3D!.visible = false;

		this.comboAnnounceEntity = w.createTransformEntity();
		this.comboAnnounceEntity.addComponent(PanelUI, { config: './ui/combo-announce.json' });
		this.comboAnnounceEntity.addComponent(Follower, { target: cam, offsetPosition: [0, 0.25, -1.8], speed: 10 });
		this.comboAnnounceEntity.object3D!.visible = false;

		this.dailyEntity = w.createTransformEntity();
		this.dailyEntity.addComponent(PanelUI, { config: './ui/daily.json' });
		this.dailyEntity.addComponent(Follower, { target: cam, offsetPosition: [0, 0, -2.5], speed: 6 });
		this.dailyEntity.object3D!.visible = false;
	}

	// == State ============================================================

	private setState(s: GameState) {
		for (const e of [this.menuEntity, this.hudEntity, this.gameOverEntity, this.pauseEntity,
			this.settingsEntity, this.achievementsEntity, this.modeSelectEntity,
			this.tutorialEntity, this.statsEntity, this.countdownEntity, this.leaderboardEntity,
			this.dailyEntity]) {
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
			case 'leaderboard': this.showPanel(this.leaderboardEntity); break;
			case 'daily_challenge': this.showPanel(this.dailyEntity); break;
		}
	}

	private showPanel(e: Entity | null) {
		if (!e?.object3D) return;
		e.object3D.visible = true;
		e.object3D.position.set(0, Math.max(5, this.cameraCurrentY), -3);
	}

	// == Ghost Preview ====================================================

	private createGhost(width: number, depth: number) {
		this.destroyGhost();
		const mat = new MeshBasicMaterial({
			color: 0xffffff, transparent: true, opacity: 0.12,
			blending: AdditiveBlending, depthWrite: false,
		});
		this.ghostMesh = new Mesh(new BoxGeometry(width, BLOCK_HEIGHT, depth), mat);
		this.towerGroup.add(this.ghostMesh);
	}

	private destroyGhost() {
		if (this.ghostMesh) {
			this.towerGroup.remove(this.ghostMesh);
			this.ghostMesh.geometry.dispose();
			(this.ghostMesh.material as MeshBasicMaterial).dispose();
			this.ghostMesh = null;
		}
	}

	private updateGhost() {
		if (!this.currentBlock || !this.ghostMesh) return;
		const prev = this.blocks[this.blocks.length - 1];
		if (!prev) return;
		// Ghost sits at the landing position with the current block's x/z
		this.ghostMesh.position.set(
			this.slideAxis === 'x' ? this.currentBlock.mesh.position.x : prev.x,
			prev.y + BLOCK_HEIGHT,
			this.slideAxis === 'z' ? this.currentBlock.mesh.position.z : prev.z,
		);
		// Pulse opacity
		const mat = this.ghostMesh.material as MeshBasicMaterial;
		mat.opacity = 0.08 + Math.sin(performance.now() * 0.005) * 0.04;
	}

	// == Game Logic =======================================================

	private startGame(mode: GameMode) {
		this.mode = mode;
		this.score = 0; this.combo = 0; this.maxCombo = 0; this.height = 0;
		this.gameTime = 0; this.slideSpeed = BASE_SPEED; this.slideAxis = 'x';
		this.slideDir = 1; this.speedTimeLeft = 60; this.placeCooldown = 0;
		this.lastCountdownNum = -1; this.lastMilestone = 0; this.isNewBest = false;
		this.powerUps = []; this.slowMoAwarded = false; this.widthBoostAwarded = false;
		this.powerupNotifyTimer = 0;
		this.shieldActive = false; this.multiplierTimer = 0;
		this.destroyShieldVisual();
		this.comboAnnounceTimer = 0;
		if (this.comboAnnounceEntity?.object3D) this.comboAnnounceEntity.object3D.visible = false;
		if (this.powerupEntity?.object3D) this.powerupEntity.object3D.visible = false;
		this.windStrength = 0; this.windDirection = 0; this.windTime = 0;
		this.nearMissFlash = { timer: 0, text: '' };
		this.gameOverOrbitActive = false; this.gameOverOrbitAngle = 0;
		this.magnetActive = false;
		this.sessionNearMisses = 0;
		this.themesPlayed.add(this.colorTheme);
		// Round 7 resets
		this.feverActive = false; this.feverIntensity = 0; this.feverTime = 0;
		this.freezeActive = false; this.freezeTimer = 0;
		this.endlessWave = { wave: 1, speedMult: 1, windMult: 1, scoreBonus: 0 };
		this.waveAnnouncerTimer = 0;
		this.powerUpsUsed = 0;
		// Clear weather particles
		for (const wp of this.weatherParticles) { this.weatherGroup.remove(wp.mesh); wp.mesh.geometry.dispose(); (wp.mesh.material as MeshBasicMaterial).dispose(); }
		this.weatherParticles = [];
		// Clear speed lines
		for (const sl of this.speedLines) { this.speedLineGroup.remove(sl.mesh); sl.mesh.geometry.dispose(); (sl.mesh.material as MeshBasicMaterial).dispose(); }
		this.speedLines = [];
		if (mode === 'challenge') this.challengeTarget = 15 + Math.floor(Math.random() * 20);
		this.clearTower();
		this.createBaseBlock();
		this.isCountingDown = true;
		this.countdownTimer = 3;
		if (this.countdownEntity?.object3D) this.countdownEntity.object3D.visible = true;
		if (this.hudEntity?.object3D) this.hudEntity.object3D.visible = true;
		this.updateCountdownPanel();
		this.updateModeInfo();
		this.audio.startDrone();
		this.lastSession = this.loadLastSession();
		this.sessionPerfects = 0;
	}

	private clearTower() {
		for (const b of this.blocks) if (b.mesh) this.towerGroup.remove(b.mesh);
		this.blocks = []; this.currentBlock = null;
		for (const f of this.fallingPieces) this.towerGroup.remove(f.mesh);
		this.fallingPieces = [];
		for (const p of this.particles) this.particleGroup.remove(p.mesh);
		this.particles = [];
		for (const tp of this.trailParticles) this.trailGroup.remove(tp.mesh);
		this.trailParticles = [];
		this.landingAnims = [];
		for (const tl of this.towerLights) this.towerGroup.remove(tl);
		this.towerLights = [];
		// Clear ripples
		for (const r of this.rippleRings) { this.towerGroup.remove(r.mesh); r.mesh.geometry.dispose(); (r.mesh.material as MeshBasicMaterial).dispose(); }
		this.rippleRings = [];
		// Clear score popups
		for (const sp of this.scorePopups) { this.scorePopupGroup.remove(sp.mesh); sp.mesh.geometry.dispose(); (sp.mesh.material as MeshBasicMaterial).dispose(); }
		this.scorePopups = [];
		// Clear confetti
		for (const c of this.confettiPieces) { this.confettiGroup.remove(c.mesh); c.mesh.geometry.dispose(); (c.mesh.material as MeshBasicMaterial).dispose(); }
		this.confettiPieces = [];
		// Clear milestone markers
		this.clearMilestoneMarkers();
		// Clear speed lines
		for (const sl of this.speedLines) { this.speedLineGroup.remove(sl.mesh); sl.mesh.geometry.dispose(); (sl.mesh.material as MeshBasicMaterial).dispose(); }
		this.speedLines = [];
		// Clear weather particles
		for (const wp of this.weatherParticles) { this.weatherGroup.remove(wp.mesh); wp.mesh.geometry.dispose(); (wp.mesh.material as MeshBasicMaterial).dispose(); }
		this.weatherParticles = [];
		this.destroyGhost();
		this.comboFlashTime = 0;
		this.shakeIntensity = 0;
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

		// Create ghost preview
		this.createGhost(prev.width, prev.depth);
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
			if (overlap <= 0) {
				if (this.mode === 'zen') {
					cur.mesh.position.z = prev.z;
					cur.depth = prev.depth;
					cur.mesh.geometry.dispose();
					cur.mesh.geometry = new BoxGeometry(cur.width, BLOCK_HEIGHT, cur.depth);
					this.combo = 0;
					this.audio.playCut();
					cur.x = cur.mesh.position.x;
					cur.z = cur.mesh.position.z;
					this.blocks.push(cur);
					this.currentBlock = null;
					this.height = this.blocks.length;
					this.stats.totalBlocks++;
					this.cameraTargetY = Math.max(5, cur.y + 3);
					this.updateHUD();
					this.destroyGhost();
					this.triggerLandingAnim(cur.mesh);
					this.slideAxis = 'x';
					this.spawnSlidingBlock();
					return;
				}
				if (this.shieldActive) {
					this.shieldActive = false;
					this.destroyShieldVisual();
					this.showPowerUpNotify('SHIELD USED!', '#00ccff');
					this.audio.playCut();
					cur.mesh.position.z = prev.z;
					cur.depth = prev.depth;
					cur.mesh.geometry.dispose();
					cur.mesh.geometry = new BoxGeometry(cur.width, BLOCK_HEIGHT, cur.depth);
					this.combo = 0;
					cur.x = cur.mesh.position.x; cur.z = cur.mesh.position.z;
					this.blocks.push(cur); this.currentBlock = null;
					this.height = this.blocks.length; this.stats.totalBlocks++;
					this.cameraTargetY = Math.max(5, cur.y + 3);
					this.updateHUD(); this.destroyGhost();
					this.triggerLandingAnim(cur.mesh);
					this.unlock('shield_use');
					this.slideAxis = 'x'; this.spawnSlidingBlock();
					return;
				}
				this.gameOver(); return;
			}
		} else {
			const overlap = prev.width - Math.abs(offX);
			if (overlap <= 0) {
				if (this.mode === 'zen') {
					cur.mesh.position.x = prev.x;
					cur.width = prev.width;
					cur.mesh.geometry.dispose();
					cur.mesh.geometry = new BoxGeometry(cur.width, BLOCK_HEIGHT, cur.depth);
					this.combo = 0;
					this.audio.playCut();
					cur.x = cur.mesh.position.x;
					cur.z = cur.mesh.position.z;
					this.blocks.push(cur);
					this.currentBlock = null;
					this.height = this.blocks.length;
					this.stats.totalBlocks++;
					this.cameraTargetY = Math.max(5, cur.y + 3);
					this.updateHUD();
					this.destroyGhost();
					this.triggerLandingAnim(cur.mesh);
					this.slideAxis = 'z';
					this.spawnSlidingBlock();
					return;
				}
				if (this.shieldActive) {
					this.shieldActive = false;
					this.destroyShieldVisual();
					this.showPowerUpNotify('SHIELD USED!', '#00ccff');
					this.audio.playCut();
					cur.mesh.position.x = prev.x;
					cur.width = prev.width;
					cur.mesh.geometry.dispose();
					cur.mesh.geometry = new BoxGeometry(cur.width, BLOCK_HEIGHT, cur.depth);
					this.combo = 0;
					cur.x = cur.mesh.position.x; cur.z = cur.mesh.position.z;
					this.blocks.push(cur); this.currentBlock = null;
					this.height = this.blocks.length; this.stats.totalBlocks++;
					this.cameraTargetY = Math.max(5, cur.y + 3);
					this.updateHUD(); this.destroyGhost();
					this.triggerLandingAnim(cur.mesh);
					this.unlock('shield_use');
					this.slideAxis = 'z'; this.spawnSlidingBlock();
					return;
				}
				this.gameOver(); return;
			}
		}

		const slideOff = this.slideAxis === 'z' ? offZ : offX;
		const isPerfect = Math.abs(slideOff) < PERFECT_THRESHOLD || this.magnetActive;
		const isNearMiss = !isPerfect && Math.abs(slideOff) < NEAR_MISS_THRESHOLD;

		// Consume magnet on use
		if (this.magnetActive && Math.abs(slideOff) >= PERFECT_THRESHOLD) {
			this.magnetActive = false;
			this.showPowerUpNotify('MAGNET SNAP!', '#bb44ff');
		} else if (this.magnetActive) {
			this.magnetActive = false;
		}

		if (isPerfect) {
			cur.mesh.position.x = prev.x;
			cur.mesh.position.z = prev.z;
			cur.width = prev.width;
			cur.depth = prev.depth;
			this.combo++;
			const comboBonus = this.combo * 5;
			const baseScore = 10 + comboBonus;
			this.score += this.multiplierTimer > 0 ? baseScore * 2 : baseScore;
			this.spawnPerfectParticles(cur.mesh.position);
			this.comboFlashTime = 0.15;
			this.triggerShake(0.03);
			this.screenPulseIntensity = 0.4;
			if (this.combo >= 5 && this.mode !== 'precision') {
				cur.width = Math.min(BASE_WIDTH, cur.width + 0.05);
				cur.depth = Math.min(BASE_DEPTH, cur.depth + 0.05);
			}
			this.audio.playPlace(true, this.combo);
			this.stats.totalPerfects++;
			this.sessionPerfects++;
			this.triggerHaptic(0.6, 120); // Strong haptic for perfect
			this.spawnRipple(cur.mesh.position, getBlockColor(this.blocks.length), true);
			this.spawnScorePopup(cur.mesh.position, 10 + this.combo * 5, true);
			// Show combo announcer for combo >= 2
			if (this.combo >= 2) this.showComboAnnounce(this.combo);
			// Dynamic tower light every 5 perfects
			if (this.combo % 5 === 0 && this.towerLights.length < 10) {
				const tl = new PointLight(getBlockColor(this.blocks.length), 1.5, 15);
				tl.position.copy(cur.mesh.position);
				this.towerGroup.add(tl);
				this.towerLights.push(tl);
			}
		} else {
			this.combo = 0;
			this.slowMoAwarded = false;
			this.widthBoostAwarded = false;
			this.shieldActive = false;
			this.destroyShieldVisual();
			this.score += this.multiplierTimer > 0 ? 10 : 5;
			this.triggerShake(0.015);
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
			this.triggerHaptic(0.3, 60); // Light haptic for imperfect
			this.spawnRipple(cur.mesh.position, getBlockColor(this.blocks.length), false);
			this.spawnScorePopup(cur.mesh.position, this.multiplierTimer > 0 ? 10 : 5, false);
			// Near-miss feedback
			if (isNearMiss) {
				this.nearMissFlash = { timer: 1.0, text: 'CLOSE!' };
				this.updateNearMissHUD();
				this.sessionNearMisses++;
			}
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

		// Score milestones
		const milestones = [50, 100, 250, 500, 1000, 2000, 5000];
		for (const m of milestones) {
			if (this.score >= m && this.lastMilestone < m) {
				this.lastMilestone = m;
				this.audio.playLevelUp();
			}
		}

		// Update drone layers based on height
		this.audio.updateDroneHeight(this.height);

		this.destroyGhost();
		this.triggerLandingAnim(cur.mesh);
		this.checkAchievements();
		this.checkPowerUpEarns();
		this.checkMilestones();
		this.checkEndlessWave();
		this.updateHUD();
		this.updateBlockGlows();
		if (cur.width < 0.1 || cur.depth < 0.1) { this.gameOver(); return; }
		if (this.mode === 'challenge' && this.height >= this.challengeTarget) {
			this.score += 100;
			this.spawnConfetti(cur.mesh.position, 80);
			this.gameOver(); return;
		}
		this.slideAxis = this.slideAxis === 'x' ? 'z' : 'x';
		this.spawnSlidingBlock();
	}

	private spawnFallingPiece(x: number, y: number, z: number, w: number, d: number, col: number) {
		const mat = new MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 0.3, metalness: 0.7, roughness: 0.3, transparent: true });
		const mesh = new Mesh(new BoxGeometry(w, BLOCK_HEIGHT, d), mat);
		mesh.position.set(x, y, z);
		this.towerGroup.add(mesh);
		this.fallingPieces.push({ mesh, velocity: new Vector3((Math.random() - 0.5) * 2, 0, (Math.random() - 0.5) * 2), life: 2 });
	}

	private spawnPerfectParticles(pos: Vector3) {
		const count = 25 + Math.min(this.combo * 3, 25);
		for (let i = 0; i < count; i++) {
			const col = getBlockColor(this.blocks.length + i);
			const mat = new MeshStandardMaterial({ color: col, emissive: col, emissiveIntensity: 1.2, transparent: true });
			const size = 0.03 + Math.random() * 0.04;
			const mesh = new Mesh(new BoxGeometry(size, size, size), mat);
			mesh.position.copy(pos);
			this.particleGroup.add(mesh);
			const a = (i / count) * Math.PI * 2;
			const s = 2 + Math.random() * 4;
			const vy = (Math.random() - 0.2) * s;
			this.particles.push({ mesh, velocity: new Vector3(Math.cos(a) * s, vy, Math.sin(a) * s), life: 1.2, maxLife: 1.2 });
		}
	}

	private triggerLandingAnim(mesh: Mesh) {
		this.landingAnims.push({ mesh, time: 0, duration: 0.2, origScaleY: 1 });
	}

	private triggerShake(intensity: number) {
		this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
		this.shakeTime = 0.15;
	}

	// == Power-ups ========================================================

	private activatePowerUp(type: PowerUpType) {
		const existing = this.powerUps.find(p => p.type === type);
		if (existing && existing.active) {
			existing.timer = existing.duration; // refresh
			return;
		}
		const duration = type === 'slowmo' ? 5 : type === 'multiplier' ? 8 : 0; // shield/widthboost are instant/passive
		const pu: PowerUp = { type, active: true, timer: duration, duration };
		this.powerUps.push(pu);

		if (type === 'slowmo') {
			this.slideSpeed *= 0.4;
			this.showPowerUpNotify('SLOW-MO!', '#ffaa00');
			this.powerUpsUsed++;
		} else if (type === 'widthboost') {
			if (this.currentBlock) {
				this.currentBlock.width = Math.min(BASE_WIDTH, this.currentBlock.width + 0.5);
				this.currentBlock.depth = Math.min(BASE_DEPTH, this.currentBlock.depth + 0.5);
				this.currentBlock.mesh.geometry.dispose();
				this.currentBlock.mesh.geometry = new BoxGeometry(this.currentBlock.width, BLOCK_HEIGHT, this.currentBlock.depth);
			}
			this.showPowerUpNotify('WIDTH BOOST!', '#00ff88');
			this.powerUpsUsed++;
			pu.active = false; // instant
		} else if (type === 'shield') {
			this.shieldActive = true;
			this.createShieldVisual();
			this.showPowerUpNotify('SHIELD!', '#00ccff');
			this.powerUpsUsed++;
			this.unlock('shield_earn');
			pu.active = false; // passive, not timer-based
		} else if (type === 'multiplier') {
			this.multiplierTimer = 8;
			this.showPowerUpNotify('2X SCORE!', '#ffdd00');
			this.powerUpsUsed++;
			this.unlock('multiplier_earn');
			pu.active = false; // tracked separately
		}
		this.audio.playLevelUp();
	}

	private updatePowerUps(delta: number) {
		for (let i = this.powerUps.length - 1; i >= 0; i--) {
			const pu = this.powerUps[i];
			if (!pu.active) { this.powerUps.splice(i, 1); continue; }
			pu.timer -= delta;
			if (pu.timer <= 0) {
				pu.active = false;
				if (pu.type === 'slowmo') {
					// Restore speed
					this.slideSpeed = Math.min(MAX_SPEED, BASE_SPEED + (this.height - 1) * SPEED_INCREMENT);
				}
				this.powerUps.splice(i, 1);
			}
		}
		// Update powerup HUD
		const activePU = this.powerUps.find(p => p.active && p.type === 'slowmo');
		if (activePU) {
			this.updatePowerUpPanel(activePU);
		} else if (this.powerupNotifyTimer <= 0 && this.powerupEntity?.object3D?.visible) {
			this.powerupEntity.object3D.visible = false;
		}
	}

	private showPowerUpNotify(text: string, _color: string) {
		const d = this.getDoc(this.powerupEntity);
		if (!d) return;
		(d.getElementById('powerup-name') as UIKit.Text | undefined)?.setProperties({ text });
		(d.getElementById('powerup-timer') as UIKit.Text | undefined)?.setProperties({ text: '' });
		if (this.powerupEntity?.object3D) this.powerupEntity.object3D.visible = true;
		this.powerupNotifyTimer = 2;
	}

	private updatePowerUpPanel(pu: PowerUp) {
		const d = this.getDoc(this.powerupEntity);
		if (!d) return;
		const timeLeft = Math.ceil(pu.timer);
		(d.getElementById('powerup-name') as UIKit.Text | undefined)?.setProperties({ text: 'SLOW-MO' });
		(d.getElementById('powerup-timer') as UIKit.Text | undefined)?.setProperties({ text: `${timeLeft}s` });
		if (this.powerupEntity?.object3D) this.powerupEntity.object3D.visible = true;
	}

	// == Shield Visual ====================================================

	private createShieldVisual() {
		this.destroyShieldVisual();
		const geo = new SphereGeometry(0.6, 16, 12);
		const mat = new MeshBasicMaterial({
			color: 0x00ccff,
			transparent: true,
			opacity: 0.12,
			blending: AdditiveBlending,
			depthWrite: false,
			wireframe: true,
		});
		this.shieldMesh = new Mesh(geo, mat);
		this.towerGroup.add(this.shieldMesh);
	}

	private destroyShieldVisual() {
		if (this.shieldMesh) {
			this.towerGroup.remove(this.shieldMesh);
			this.shieldMesh.geometry.dispose();
			(this.shieldMesh.material as MeshBasicMaterial).dispose();
			this.shieldMesh = null;
		}
	}

	private updateShieldVisual() {
		if (!this.shieldMesh || !this.currentBlock) return;
		this.shieldMesh.position.copy(this.currentBlock.mesh.position);
		this.shieldMesh.rotation.y += 0.02;
		const pulse = 0.1 + Math.sin(performance.now() * 0.003) * 0.05;
		(this.shieldMesh.material as MeshBasicMaterial).opacity = pulse;
	}

	// == Combo Announcer ==================================================

	private showComboAnnounce(combo: number) {
		const d = this.getDoc(this.comboAnnounceEntity);
		if (!d) return;
		const labels: Record<number, string> = {
			2: 'DOUBLE!', 3: 'TRIPLE!', 4: 'QUAD!', 5: 'PENTA!',
		};
		const text = combo <= 5 ? labels[combo] || '' : `PERFECT x${combo}!`;
		const sub = combo >= 10 ? 'UNSTOPPABLE' : combo >= 7 ? 'ON FIRE' : combo >= 5 ? 'AMAZING' : '';
		(d.getElementById('combo-text') as UIKit.Text | undefined)?.setProperties({ text });
		(d.getElementById('combo-sub') as UIKit.Text | undefined)?.setProperties({ text: sub });
		if (this.comboAnnounceEntity?.object3D) {
			this.comboAnnounceEntity.object3D.visible = true;
			this.comboAnnounceEntity.object3D.position.set(0, Math.max(5, this.cameraCurrentY) + 0.3, -2);
		}
		this.comboAnnounceTimer = 1.2;
	}

	// == Daily Challenge ==================================================

	private generateDailyChallenge(): DailyChallenge {
		const today = new Date().toISOString().slice(0, 10);
		// Simple seed from date string
		let seed = 0;
		for (let i = 0; i < today.length; i++) seed = ((seed << 5) - seed + today.charCodeAt(i)) | 0;
		seed = Math.abs(seed);
		const types: ('score' | 'height' | 'combo' | 'perfects')[] = ['score', 'height', 'combo', 'perfects'];
		const type = types[seed % types.length];
		let target = 0;
		let description = '';
		switch (type) {
			case 'score':
				target = 200 + (seed % 8) * 50;
				description = `Score ${target} points in Classic mode`;
				break;
			case 'height':
				target = 15 + (seed % 6) * 5;
				description = `Stack ${target} blocks in Classic mode`;
				break;
			case 'combo':
				target = 5 + (seed % 4) * 2;
				description = `Reach a ${target}x combo in Classic mode`;
				break;
			case 'perfects':
				target = 8 + (seed % 5) * 3;
				description = `Get ${target} perfect placements in one game`;
				break;
		}
		return { seed, type, target, description, date: today };
	}

	private checkDailyResult(): boolean {
		if (!this.dailyChallenge) return false;
		const dc = this.dailyChallenge;
		switch (dc.type) {
			case 'score': return this.score >= dc.target;
			case 'height': return this.height >= dc.target;
			case 'combo': return this.maxCombo >= dc.target;
			case 'perfects': return this.stats.totalPerfects >= dc.target;
		}
	}

	private getDailyMetric(): number {
		if (!this.dailyChallenge) return 0;
		switch (this.dailyChallenge.type) {
			case 'score': return this.score;
			case 'height': return this.height;
			case 'combo': return this.maxCombo;
			case 'perfects': return this.stats.totalPerfects;
		}
	}

	private updateDailyPanel() {
		const d = this.getDoc(this.dailyEntity);
		if (!d) return;
		if (!this.dailyChallenge) this.dailyChallenge = this.generateDailyChallenge();
		const dc = this.dailyChallenge;
		(d.getElementById('daily-date') as UIKit.Text | undefined)?.setProperties({ text: dc.date });
		(d.getElementById('daily-goal') as UIKit.Text | undefined)?.setProperties({ text: dc.description });
		(d.getElementById('daily-desc') as UIKit.Text | undefined)?.setProperties({
			text: `${dc.type.toUpperCase()} challenge - Target: ${dc.target}`
		});
		// Load daily best from localStorage
		try {
			const stored = localStorage.getItem(`neon-stack-daily-${dc.date}`);
			if (stored) this.dailyBest = parseInt(stored, 10);
			else this.dailyBest = 0;
		} catch { this.dailyBest = 0; }
		(d.getElementById('daily-best') as UIKit.Text | undefined)?.setProperties({
			text: this.dailyBest > 0 ? `${this.dailyBest}` : '---'
		});
		const completed = this.dailyBest >= dc.target;
		(d.getElementById('daily-status') as UIKit.Text | undefined)?.setProperties({
			text: completed ? 'COMPLETED!' : 'Not yet completed'
		});
	}

	private saveDailyResult() {
		if (!this.isDailyRun || !this.dailyChallenge) return;
		const metric = this.getDailyMetric();
		if (metric > this.dailyBest) {
			this.dailyBest = metric;
			try { localStorage.setItem(`neon-stack-daily-${this.dailyChallenge.date}`, `${metric}`); } catch { /* */ }
		}
		if (this.checkDailyResult()) {
			this.unlock('daily_win');
			// Celebrate daily challenge completion
			const lastBlock = this.blocks[this.blocks.length - 1];
			if (lastBlock) this.spawnConfetti(lastBlock.mesh.position, 60);
		}
	}

	private checkPowerUpEarns() {
		// Slow-Mo at 3 combo (resets each game)
		if (this.combo >= 3 && !this.slowMoAwarded) {
			this.slowMoAwarded = true;
			this.activatePowerUp('slowmo');
		}
		// Shield at 5 combo
		if (this.combo >= 5 && !this.shieldActive) {
			this.activatePowerUp('shield');
		}
		// Width Boost at 7 combo
		if (this.combo >= 7 && !this.widthBoostAwarded) {
			this.widthBoostAwarded = true;
			this.activatePowerUp('widthboost');
		}
		// Score Multiplier at 10 combo
		if (this.combo >= 10 && this.multiplierTimer <= 0) {
			this.activatePowerUp('multiplier');
		}
		// Magnet at 12 combo
		if (this.combo >= 12 && !this.magnetActive) {
			this.magnetActive = true;
			this.showPowerUpNotify('MAGNET!', '#bb44ff');
			this.audio.playLevelUp();
			this.unlock('magnet_earn');
		}
		// Freeze at 15 combo
		if (this.combo >= 15 && !this.freezeActive && this.freezeTimer <= 0) {
			this.freezeActive = true;
			this.freezeTimer = this.freezeDuration;
			this.showPowerUpNotify('FREEZE!', '#aaddff');
			this.audio.playLevelUp();
			this.powerUpsUsed++;
			this.unlock('freeze_earn');
		}
		// Fever mode at 8+ combo
		if (this.combo >= 8 && !this.feverActive) {
			this.feverActive = true;
			this.feverIntensity = 1;
			this.feverTime = 0;
			this.unlock('fever_mode');
		} else if (this.combo < 5) {
			this.feverActive = false;
			this.feverIntensity = 0;
		}
		// Reset flags when combo breaks so they can be re-earned
	}

	private setTheme(theme: ColorTheme) {
		this.colorTheme = theme;
		activeThemeColors = COLOR_THEMES[theme];
		this.themesPlayed.add(theme);
		const accent = THEME_ACCENTS[theme];
		this.w.scene.background = new Color(accent.bg);
		(this.w.scene.fog as FogExp2).color.set(accent.fog);
		this.createGrid(this.w.scene);
		this.createAurora(this.w.scene);
		try { localStorage.setItem('neon-stack-theme', theme); } catch { /* */ }
	}

	private loadTheme() {
		try {
			const t = localStorage.getItem('neon-stack-theme') as ColorTheme | null;
			if (t && COLOR_THEMES[t]) {
				this.colorTheme = t;
				activeThemeColors = COLOR_THEMES[t];
			}
		} catch { /* */ }
	}

	// == Ripple Ring Effect ================================================

	private spawnRipple(pos: Vector3, color: number, isPerfect: boolean) {
		const geo = new RingGeometry(0.1, 0.15, 32);
		const mat = new MeshBasicMaterial({
			color, transparent: true, opacity: 0.7, side: DoubleSide,
			blending: AdditiveBlending, depthWrite: false,
		});
		const mesh = new Mesh(geo, mat);
		mesh.position.set(pos.x, pos.y, pos.z);
		mesh.rotation.x = -Math.PI / 2;
		this.towerGroup.add(mesh);
		this.rippleRings.push({
			mesh, life: isPerfect ? 0.8 : 0.5, maxLife: isPerfect ? 0.8 : 0.5,
			maxScale: isPerfect ? 8 : 5,
		});
	}

	private updateRipples(delta: number) {
		for (let i = this.rippleRings.length - 1; i >= 0; i--) {
			const r = this.rippleRings[i];
			r.life -= delta;
			const t = 1 - r.life / r.maxLife;
			const scale = 1 + t * r.maxScale;
			r.mesh.scale.set(scale, scale, 1);
			(r.mesh.material as MeshBasicMaterial).opacity = Math.max(0, (1 - t) * 0.7);
			if (r.life <= 0) {
				this.towerGroup.remove(r.mesh);
				r.mesh.geometry.dispose();
				(r.mesh.material as MeshBasicMaterial).dispose();
				this.rippleRings.splice(i, 1);
			}
		}
	}

	// == Score Popup Effect ================================================

	private spawnScorePopup(pos: Vector3, points: number, isPerfect: boolean) {
		const color = isPerfect ? 0xffdd00 : 0x88ccff;
		const mat = new MeshBasicMaterial({
			color, transparent: true, opacity: 1, blending: AdditiveBlending, depthWrite: false,
		});
		// Small diamond shape as score indicator
		const size = isPerfect ? 0.08 : 0.05;
		const mesh = new Mesh(new BoxGeometry(size, size, size), mat);
		mesh.position.set(
			pos.x + (Math.random() - 0.5) * 0.5,
			pos.y + 0.3,
			pos.z + (Math.random() - 0.5) * 0.5,
		);
		mesh.rotation.set(Math.PI / 4, 0, Math.PI / 4);
		this.scorePopupGroup.add(mesh);
		// Spawn multiple for bigger scores
		const count = Math.min(Math.floor(points / 10), 5);
		for (let j = 0; j < count; j++) {
			const m2 = new Mesh(new BoxGeometry(size * 0.7, size * 0.7, size * 0.7), mat.clone());
			m2.position.set(
				pos.x + (Math.random() - 0.5) * 1,
				pos.y + 0.2 + Math.random() * 0.3,
				pos.z + (Math.random() - 0.5) * 1,
			);
			m2.rotation.set(Math.PI / 4, 0, Math.PI / 4);
			this.scorePopupGroup.add(m2);
			this.scorePopups.push({
				mesh: m2,
				life: 0.8 + Math.random() * 0.3,
				velocity: new Vector3((Math.random() - 0.5) * 1.5, 2 + Math.random() * 2, (Math.random() - 0.5) * 1.5),
			});
		}
		this.scorePopups.push({
			mesh, life: 1.0,
			velocity: new Vector3((Math.random() - 0.5) * 0.8, 3 + Math.random(), (Math.random() - 0.5) * 0.8),
		});
	}

	private updateScorePopups(delta: number) {
		for (let i = this.scorePopups.length - 1; i >= 0; i--) {
			const sp = this.scorePopups[i];
			sp.life -= delta;
			sp.mesh.position.add(sp.velocity.clone().multiplyScalar(delta));
			sp.velocity.y -= 3 * delta;
			const t = Math.max(0, sp.life);
			(sp.mesh.material as MeshBasicMaterial).opacity = t;
			sp.mesh.scale.setScalar(0.5 + t * 0.5);
			if (sp.life <= 0) {
				this.scorePopupGroup.remove(sp.mesh);
				sp.mesh.geometry.dispose();
				(sp.mesh.material as MeshBasicMaterial).dispose();
				this.scorePopups.splice(i, 1);
			}
		}
	}

	// == Confetti Celebration =============================================

	private spawnConfetti(origin: Vector3, count: number) {
		const colors = [0xff4444, 0x44ff44, 0x4444ff, 0xffff44, 0xff44ff, 0x44ffff, 0xff8844, 0xaa44ff];
		for (let i = 0; i < count; i++) {
			const color = colors[i % colors.length];
			const w = 0.04 + Math.random() * 0.06;
			const h = 0.08 + Math.random() * 0.1;
			const mat = new MeshBasicMaterial({ color, transparent: true, opacity: 1, side: DoubleSide });
			const mesh = new Mesh(new BoxGeometry(w, h, 0.005), mat);
			mesh.position.copy(origin);
			mesh.position.x += (Math.random() - 0.5) * 0.5;
			mesh.position.z += (Math.random() - 0.5) * 0.5;
			this.confettiGroup.add(mesh);
			const angle = Math.random() * Math.PI * 2;
			const speed = 3 + Math.random() * 5;
			this.confettiPieces.push({
				mesh,
				velocity: new Vector3(
					Math.cos(angle) * speed * 0.6,
					4 + Math.random() * 6,
					Math.sin(angle) * speed * 0.6,
				),
				rotSpeed: new Vector3(
					(Math.random() - 0.5) * 10,
					(Math.random() - 0.5) * 10,
					(Math.random() - 0.5) * 10,
				),
				life: 3 + Math.random() * 2,
			});
		}
	}

	private updateConfetti(delta: number) {
		for (let i = this.confettiPieces.length - 1; i >= 0; i--) {
			const c = this.confettiPieces[i];
			c.life -= delta;
			c.velocity.y -= 6 * delta; // gravity
			// Air resistance on horizontal
			c.velocity.x *= 1 - delta * 0.5;
			c.velocity.z *= 1 - delta * 0.5;
			// Flutter effect
			c.velocity.x += Math.sin(c.life * 5) * delta * 2;
			c.mesh.position.add(c.velocity.clone().multiplyScalar(delta));
			c.mesh.rotation.x += c.rotSpeed.x * delta;
			c.mesh.rotation.y += c.rotSpeed.y * delta;
			c.mesh.rotation.z += c.rotSpeed.z * delta;
			if (c.life < 1) {
				(c.mesh.material as MeshBasicMaterial).opacity = Math.max(0, c.life);
			}
			if (c.life <= 0 || c.mesh.position.y < -10) {
				this.confettiGroup.remove(c.mesh);
				c.mesh.geometry.dispose();
				(c.mesh.material as MeshBasicMaterial).dispose();
				this.confettiPieces.splice(i, 1);
			}
		}
	}

	// == Height Milestone Markers =========================================

	private checkMilestones() {
		for (const mh of this.milestoneHeights) {
			if (this.height >= mh && !this.milestoneMarkers.find(m => m.height === mh)) {
				this.spawnMilestoneMarker(mh);
			}
		}
	}

	private spawnMilestoneMarker(h: number) {
		const y = h * BLOCK_HEIGHT + BLOCK_HEIGHT / 2;
		const geo = new TorusGeometry(2.5, 0.02, 8, 64);
		const color = h >= 150 ? 0xff00ff : h >= 120 ? 0xffffff : h >= 100 ? 0xffdd00 : h >= 75 ? 0xff4488 : h >= 50 ? 0x44ffaa : 0x44aaff;
		const mat = new MeshBasicMaterial({
			color, transparent: true, opacity: 0.4, blending: AdditiveBlending, depthWrite: false,
		});
		const ring = new Mesh(geo, mat);
		ring.position.set(0, y, 0);
		ring.rotation.x = Math.PI / 2;
		this.towerGroup.add(ring);
		this.milestoneMarkers.push({ ring, height: h });
		// Play a celebratory sound
		this.audio.playLevelUp();
	}

	private updateMilestoneMarkers(time: number) {
		for (const m of this.milestoneMarkers) {
			m.ring.rotation.z = time * 0.3;
			const pulse = 0.3 + Math.sin(time * 2 + m.height) * 0.15;
			(m.ring.material as MeshBasicMaterial).opacity = pulse;
		}
	}

	private clearMilestoneMarkers() {
		for (const m of this.milestoneMarkers) {
			this.towerGroup.remove(m.ring);
			m.ring.geometry.dispose();
			(m.ring.material as MeshBasicMaterial).dispose();
		}
		this.milestoneMarkers = [];
	}

	// == XR Haptics =======================================================

	private triggerHaptic(intensity: number, duration: number) {
		try {
			const rg = this.w.input.gamepads.right;
			const lg = this.w.input.gamepads.left;
			if (rg?.gamepad?.hapticActuators?.[0]) {
				(rg.gamepad.hapticActuators[0] as any).pulse(intensity, duration);
			}
			if (lg?.gamepad?.hapticActuators?.[0]) {
				(lg.gamepad.hapticActuators[0] as any).pulse(intensity, duration);
			}
			// Also try vibrationActuator (WebXR standard)
			if ((rg?.gamepad as any)?.vibrationActuator) {
				(rg!.gamepad as any).vibrationActuator.playEffect('dual-rumble', {
					duration, strongMagnitude: intensity, weakMagnitude: intensity * 0.5,
				});
			}
			if ((lg?.gamepad as any)?.vibrationActuator) {
				(lg!.gamepad as any).vibrationActuator.playEffect('dual-rumble', {
					duration, strongMagnitude: intensity, weakMagnitude: intensity * 0.5,
				});
			}
		} catch { /* haptics not available */ }
	}

	// == Session Tracking =================================================

	private loadLastSession(): SessionRecord | null {
		try {
			const s = localStorage.getItem('neon-stack-last-session');
			if (s) return JSON.parse(s);
		} catch { /* */ }
		return null;
	}

	private saveSession() {
		const rec: SessionRecord = {
			score: this.score,
			height: this.height,
			combo: this.maxCombo,
			mode: this.mode,
		};
		try { localStorage.setItem('neon-stack-last-session', JSON.stringify(rec)); } catch { /* */ }
		this.lastSession = rec;
	}

	// == Trail Effect =====================================================

	private spawnTrail() {
		if (!this.currentBlock || this.state !== 'playing') return;
		if (this.trailParticles.length >= 60) return; // Performance cap
		const pos = this.currentBlock.mesh.position;
		const col = getBlockColor(this.blocks.length);
		const mat = new MeshBasicMaterial({ color: col, transparent: true, opacity: 0.4, blending: AdditiveBlending });
		const mesh = new Mesh(new SphereGeometry(0.06, 4, 4), mat);
		mesh.position.set(
			pos.x + (Math.random() - 0.5) * 0.3,
			pos.y + (Math.random() - 0.5) * 0.1,
			pos.z + (Math.random() - 0.5) * 0.3,
		);
		this.trailGroup.add(mesh);
		this.trailParticles.push({ mesh, life: 0.6 });
	}

	private gameOver() {
		this.audio.stopDrone();
		this.audio.playGameOver();
		this.triggerHaptic(0.8, 200); // Strong haptic for game over
		this.destroyGhost();
		this.destroyShieldVisual();
		this.stats.gamesPlayed++;
		this.stats.totalScore += this.score;
		if (this.score > this.stats.bestScore) this.stats.bestScore = this.score;
		if (this.height > this.stats.bestHeight) this.stats.bestHeight = this.height;
		if (this.maxCombo > this.stats.bestCombo) this.stats.bestCombo = this.maxCombo;
		this.saveStats();
		this.checkAchievements();
		this.saveDailyResult();

		// Save to leaderboard
		this.isNewBest = this.saveLeaderboardEntry();

		// Confetti if new best
		if (this.isNewBest) {
			const lastBlock = this.blocks[this.blocks.length - 1];
			if (lastBlock) this.spawnConfetti(lastBlock.mesh.position, 100);
		}

		// Save session for comparison
		this.saveSession();

		this.updateGameOverPanel();
		this.setState('game_over');
	}

	// == Speed Lines ======================================================

	private spawnSpeedLine() {
		if (this.speedLines.length >= 30) return;
		if (Math.random() > 0.3) return;
		const cam = this.w.camera;
		const mat = new MeshBasicMaterial({
			color: 0xaabbff, transparent: true, opacity: 0.25, blending: AdditiveBlending, depthWrite: false,
		});
		const len = 0.5 + Math.random() * 1.5;
		const mesh = new Mesh(new BoxGeometry(0.01, len, 0.01), mat);
		// Spawn around the camera in random positions
		const angle = Math.random() * Math.PI * 2;
		const dist = 2 + Math.random() * 4;
		mesh.position.set(
			cam.position.x + Math.cos(angle) * dist,
			cam.position.y + (Math.random() - 0.5) * 6,
			cam.position.z + Math.sin(angle) * dist,
		);
		this.speedLineGroup.add(mesh);
		this.speedLines.push({
			mesh, life: 0.4 + Math.random() * 0.3,
			velocity: new Vector3(0, -8 - Math.random() * 6, 0),
		});
	}

	private updateSpeedLines(delta: number) {
		for (let i = this.speedLines.length - 1; i >= 0; i--) {
			const sl = this.speedLines[i];
			sl.life -= delta;
			sl.mesh.position.add(sl.velocity.clone().multiplyScalar(delta));
			(sl.mesh.material as MeshBasicMaterial).opacity = Math.max(0, sl.life / 0.4) * 0.25;
			if (sl.life <= 0) {
				this.speedLineGroup.remove(sl.mesh);
				sl.mesh.geometry.dispose();
				(sl.mesh.material as MeshBasicMaterial).dispose();
				this.speedLines.splice(i, 1);
			}
		}
	}

	// == Near-miss HUD ====================================================

	private updateNearMissHUD(clear = false) {
		const d = this.getDoc(this.hudEntity);
		if (!d) return;
		if (clear) {
			(d.getElementById('near-miss') as UIKit.Text | undefined)?.setProperties({ text: '' });
		} else {
			(d.getElementById('near-miss') as UIKit.Text | undefined)?.setProperties({ text: this.nearMissFlash.text });
		}
	}

	// == Wind HUD =========================================================

	private updateWindHUD() {
		const d = this.getDoc(this.hudEntity);
		if (!d) return;
		const dir = this.windDirection;
		const arrow = dir > 0 && dir < Math.PI ? '>>' : '<<';
		const strength = this.windStrength > 0.6 ? 'STRONG' : 'LIGHT';
		(d.getElementById('wind-status') as UIKit.Text | undefined)?.setProperties({
			text: `WIND ${arrow} ${strength}`,
		});
	}

	// == Weather Particle System ==============================================

	private spawnWeatherParticle() {
		const cam = this.w.camera;
		let color: number, size: number, speed: number, spread: number;
		switch (this.colorTheme) {
			case 'fire':
				color = [0xff4400, 0xff6600, 0xff8800, 0xffaa00][Math.floor(Math.random() * 4)];
				size = 0.03 + Math.random() * 0.04;
				speed = 0.5 + Math.random() * 1.5;
				spread = 15;
				break;
			case 'ice':
				color = [0xccddff, 0xaabbff, 0xeeffff, 0x88aaff][Math.floor(Math.random() * 4)];
				size = 0.04 + Math.random() * 0.06;
				speed = 0.8 + Math.random() * 1.0;
				spread = 20;
				break;
			case 'vapor':
				color = [0xff88cc, 0xaa66ff, 0x88ffdd, 0xff66aa][Math.floor(Math.random() * 4)];
				size = 0.05 + Math.random() * 0.05;
				speed = 0.3 + Math.random() * 0.8;
				spread = 18;
				break;
			default: // neon
				color = [0x00ffff, 0x00ff88, 0x44aaff, 0xaa44ff][Math.floor(Math.random() * 4)];
				size = 0.02 + Math.random() * 0.03;
				speed = 1.0 + Math.random() * 2.0;
				spread = 16;
				break;
		}
		const mat = new MeshBasicMaterial({
			color, transparent: true, opacity: 0.25 + Math.random() * 0.15,
			blending: AdditiveBlending, depthWrite: false,
		});
		const geo = this.colorTheme === 'ice'
			? new BoxGeometry(size, size * 0.3, size)
			: new SphereGeometry(size, 4, 4);
		const mesh = new Mesh(geo, mat);
		mesh.position.set(
			cam.position.x + (Math.random() - 0.5) * spread,
			cam.position.y + 8 + Math.random() * 5,
			cam.position.z + (Math.random() - 0.5) * spread,
		);
		this.weatherGroup.add(mesh);
		const vx = (Math.random() - 0.5) * 0.8;
		const vy = this.colorTheme === 'fire' ? speed : -speed;
		const vz = (Math.random() - 0.5) * 0.8;
		this.weatherParticles.push({
			mesh, life: 4 + Math.random() * 3,
			velocity: new Vector3(vx, vy, vz),
		});
	}

	private updateWeatherParticles(delta: number) {
		// Spawn
		this.weatherSpawnTimer -= delta;
		if (this.weatherSpawnTimer <= 0 && this.weatherParticles.length < 80) {
			this.spawnWeatherParticle();
			this.weatherSpawnTimer = 0.08 + Math.random() * 0.12;
		}
		// Update
		for (let i = this.weatherParticles.length - 1; i >= 0; i--) {
			const wp = this.weatherParticles[i];
			wp.life -= delta;
			wp.mesh.position.add(wp.velocity.clone().multiplyScalar(delta));
			// Gentle sway
			wp.mesh.position.x += Math.sin(wp.life * 2 + i) * delta * 0.3;
			if (this.colorTheme === 'ice') wp.mesh.rotation.y += delta * 2;
			if (this.colorTheme === 'fire') {
				wp.mesh.scale.multiplyScalar(1 - delta * 0.3);
				(wp.mesh.material as MeshBasicMaterial).opacity = Math.max(0, wp.life / 4) * 0.3;
			} else {
				(wp.mesh.material as MeshBasicMaterial).opacity = Math.max(0, Math.min(1, wp.life / 2)) * 0.3;
			}
			if (wp.life <= 0 || wp.mesh.position.y < -5) {
				this.weatherGroup.remove(wp.mesh);
				wp.mesh.geometry.dispose();
				(wp.mesh.material as MeshBasicMaterial).dispose();
				this.weatherParticles.splice(i, 1);
			}
		}
	}

	// == Fever Mode =======================================================

	private updateFeverMode(delta: number) {
		if (!this.feverActive) {
			if (this.feverIntensity > 0) {
				this.feverIntensity = Math.max(0, this.feverIntensity - delta * 2);
			}
			return;
		}
		this.feverTime += delta;
		// Pulse intensity
		this.feverIntensity = 0.6 + Math.sin(this.feverTime * 6) * 0.4;
		// Boost ambient light
		if (this.ambientLight) {
			this.ambientLight.intensity = 0.8 + this.feverIntensity * 0.8;
		}
		// Pulse tower lights
		for (const tl of this.towerLights) {
			tl.intensity = 1.5 + this.feverIntensity * 3;
		}
		// Extra trail particles during fever
		if (this.currentBlock && Math.random() < 0.7) {
			this.spawnTrail();
		}
	}

	// == Freeze Power-up ==================================================

	private updateFreeze(delta: number) {
		if (!this.freezeActive || this.freezeTimer <= 0) return;
		this.freezeTimer -= delta;
		if (this.freezeTimer <= 0) {
			this.freezeActive = false;
			this.freezeTimer = 0;
		}
	}

	// == Endless Wave System ==============================================

	private checkEndlessWave() {
		if (this.mode !== 'endless') return;
		const nextWave = Math.floor((this.height - 1) / this.waveBlocksThreshold) + 1;
		if (nextWave > this.endlessWave.wave) {
			this.endlessWave.wave = nextWave;
			this.endlessWave.speedMult = 1 + (nextWave - 1) * 0.15;
			this.endlessWave.windMult = 1 + (nextWave - 1) * 0.25;
			this.endlessWave.scoreBonus = (nextWave - 1) * 5;
			// Wave bonus score
			this.score += nextWave * 50;
			// Show wave announcement
			this.showComboAnnounce(0); // reuse announcer
			const d = this.getDoc(this.comboAnnounceEntity);
			if (d) {
				(d.getElementById('combo-text') as UIKit.Text | undefined)?.setProperties({ text: `WAVE ${nextWave}` });
				const waveSub = nextWave >= 5 ? 'EXTREME' : nextWave >= 3 ? 'INTENSE' : 'HARDER';
				(d.getElementById('combo-sub') as UIKit.Text | undefined)?.setProperties({ text: waveSub });
			}
			this.comboAnnounceTimer = 2.0;
			this.audio.playLevelUp();
			// Confetti for wave completion
			const lastBlock = this.blocks[this.blocks.length - 1];
			if (lastBlock) this.spawnConfetti(lastBlock.mesh.position, 40);
			this.unlock('endless_wave_3');
			if (nextWave >= 5) this.unlock('endless_wave_5');
		}
	}

	// == Block glow scaling ===============================================

	private updateBlockGlows() {
		// Make top blocks glow brighter, bottom blocks dimmer
		const topIdx = this.blocks.length - 1;
		for (let i = 0; i < this.blocks.length; i++) {
			const dist = topIdx - i;
			const mat = this.blocks[i].mesh.material as MeshStandardMaterial;
			if (dist > 15) {
				mat.emissiveIntensity = 0.1;
			} else {
				mat.emissiveIntensity = 0.3 - dist * 0.013;
			}
		}
	}

	// == Update camera ====================================================

	update(delta: number, _time: number) {
		this.placeCooldown = Math.max(0, this.placeCooldown - delta);
		this.tryWirePanelHandlers();

		// Achievement popup timer
		if (this.achievementPopupTimer > 0) {
			this.achievementPopupTimer -= delta;
			if (this.achievementPopupTimer <= 0) {
				if (this.achievementPopupEntity?.object3D) this.achievementPopupEntity.object3D.visible = false;
				// Check for queued achievements
				if (this.achievementQueue.length > 0) {
					this.showAchievementPopup(this.achievementQueue.shift()!);
				}
			}
		}

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
			this.updatePowerUps(delta);
			this.updateFeverMode(delta);
			this.updateFreeze(delta);
			// Score multiplier timer
			if (this.multiplierTimer > 0) {
				this.multiplierTimer -= delta;
			}
			// Wind effect: increases with height, changes direction over time
			if (this.height > 10) {
				this.windTime += delta;
				this.windDirection = Math.sin(this.windTime * 0.4) * Math.PI * 2;
				const windMult = this.mode === 'endless' ? this.endlessWave.windMult : 1;
				this.windStrength = Math.min(1.2, (this.height - 10) * 0.03) * (0.5 + Math.sin(this.windTime * 0.7) * 0.5) * windMult;
			}
			if (this.currentBlock) {
				const effectiveSpeed = this.freezeActive ? 0 : (this.slideSpeed * (this.mode === 'endless' ? this.endlessWave.speedMult : 1));
				const p = this.currentBlock.mesh.position;
				if (this.slideAxis === 'x') {
					p.x += effectiveSpeed * this.slideDir * delta;
					// Apply wind drift on the cross-axis
					if (this.windStrength > 0 && !this.freezeActive) {
						p.z += Math.sin(this.windDirection) * this.windStrength * delta * 0.3;
					}
					if (p.x > SLIDE_RANGE) { p.x = SLIDE_RANGE; this.slideDir = -1; }
					if (p.x < -SLIDE_RANGE) { p.x = -SLIDE_RANGE; this.slideDir = 1; }
				} else {
					p.z += effectiveSpeed * this.slideDir * delta;
					// Apply wind drift on the cross-axis
					if (this.windStrength > 0 && !this.freezeActive) {
						p.x += Math.cos(this.windDirection) * this.windStrength * delta * 0.3;
					}
					if (p.z > SLIDE_RANGE) { p.z = SLIDE_RANGE; this.slideDir = -1; }
					if (p.z < -SLIDE_RANGE) { p.z = -SLIDE_RANGE; this.slideDir = 1; }
				}
				// Freeze visual: blue tint on block
				if (this.freezeActive) {
					(this.currentBlock.mesh.material as MeshStandardMaterial).emissive.setHex(0x88ccff);
					(this.currentBlock.mesh.material as MeshStandardMaterial).emissiveIntensity = 0.6 + Math.sin(performance.now() * 0.01) * 0.2;
				}
				// Trail particles
				if (Math.random() < 0.4) this.spawnTrail();
				// Update ghost
				this.updateGhost();
				// Update shield visual
				if (this.shieldActive) this.updateShieldVisual();
			}
			if (this.mode === 'speed') {
				this.speedTimeLeft -= delta;
				this.updateModeInfo();
				if (this.speedTimeLeft <= 0) this.gameOver();
			}
		}

		// Menu camera orbit
		if (this.state === 'menu' || this.state === 'mode_select' || this.state === 'settings' ||
			this.state === 'achievements' || this.state === 'tutorial' || this.state === 'stats' ||
			this.state === 'leaderboard' || this.state === 'daily_challenge') {
			this.menuOrbitAngle += delta * 0.15;
			const radius = 10;
			const x = Math.sin(this.menuOrbitAngle) * radius;
			const z = Math.cos(this.menuOrbitAngle) * radius;
			this.w.camera.position.set(x, 5, z);
			this.w.camera.lookAt(0, 3, 0);
		}

		// Falling pieces physics
		for (let i = this.fallingPieces.length - 1; i >= 0; i--) {
			const f = this.fallingPieces[i];
			f.velocity.y -= 9.8 * delta;
			f.mesh.position.add(f.velocity.clone().multiplyScalar(delta));
			f.mesh.rotation.x += delta * 2;
			f.mesh.rotation.z += delta * 1.5;
			f.life -= delta;
			(f.mesh.material as MeshStandardMaterial).opacity = Math.max(0, f.life / 2);
			if (f.life <= 0 || f.mesh.position.y < -10) {
				this.towerGroup.remove(f.mesh);
				f.mesh.geometry.dispose();
				(f.mesh.material as MeshStandardMaterial).dispose();
				this.fallingPieces.splice(i, 1);
			}
		}

		// Particles
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

		// Trail particles
		for (let i = this.trailParticles.length - 1; i >= 0; i--) {
			const tp = this.trailParticles[i];
			tp.life -= delta;
			(tp.mesh.material as MeshBasicMaterial).opacity = Math.max(0, tp.life / 0.6) * 0.3;
			tp.mesh.scale.setScalar(tp.life / 0.6);
			if (tp.life <= 0) {
				this.trailGroup.remove(tp.mesh);
				tp.mesh.geometry.dispose();
				(tp.mesh.material as MeshBasicMaterial).dispose();
				this.trailParticles.splice(i, 1);
			}
		}

		// Ripple rings
		this.updateRipples(delta);

		// Score popups
		this.updateScorePopups(delta);

		// Confetti
		this.updateConfetti(delta);

		// Landing animations (bounce)
		for (let i = this.landingAnims.length - 1; i >= 0; i--) {
			const la = this.landingAnims[i];
			la.time += delta;
			const t = la.time / la.duration;
			if (t >= 1) {
				la.mesh.scale.y = la.origScaleY;
				this.landingAnims.splice(i, 1);
			} else {
				// Squash and stretch bounce
				const bounce = 1 + Math.sin(t * Math.PI) * 0.3 * (1 - t);
				const squash = 1 - Math.sin(t * Math.PI) * 0.15 * (1 - t);
				la.mesh.scale.set(squash, bounce, squash);
			}
		}

		// Camera (game state)
		if (this.state === 'playing' || this.state === 'paused' || this.isCountingDown) {
			this.updateCamera(delta);
		}

		// Game over tower orbit
		if (this.state === 'game_over') {
			if (!this.gameOverOrbitActive) {
				this.gameOverOrbitActive = true;
				this.gameOverOrbitAngle = 0;
			}
			this.gameOverOrbitAngle += delta * 0.25;
			const orbitRadius = 10;
			const towerTopY = Math.max(5, (this.blocks.length - 1) * BLOCK_HEIGHT * 0.5 + 3);
			const cx = Math.sin(this.gameOverOrbitAngle) * orbitRadius;
			const cz = Math.cos(this.gameOverOrbitAngle) * orbitRadius;
			const orbY = towerTopY + Math.sin(this.gameOverOrbitAngle * 0.3) * 2;
			this.w.camera.position.set(cx, orbY, cz);
			this.w.camera.lookAt(0, towerTopY - 2, 0);
			// Keep game over panel following camera
			if (this.gameOverEntity?.object3D) this.gameOverEntity.object3D.position.y = orbY;
		}

		if (this.starField) this.starField.rotation.y += delta * 0.005;

		// Aurora animation
		this.updateAurora(_time);

		// Milestone markers
		this.updateMilestoneMarkers(_time);

		// Tower sway effect (subtle sway increases with height)
		if ((this.state === 'playing' || this.isCountingDown) && this.towerGroup) {
			this.towerSwayTime += delta;
			const swayIntensity = Math.min(0.008, (this.height - 1) * 0.0002);
			this.towerGroup.rotation.x = Math.sin(this.towerSwayTime * 0.8) * swayIntensity;
			this.towerGroup.rotation.z = Math.cos(this.towerSwayTime * 0.6) * swayIntensity * 0.7;
		} else if (this.towerGroup) {
			this.towerGroup.rotation.x *= 0.95;
			this.towerGroup.rotation.z *= 0.95;
		}

		// Screen pulse (ambient flash on perfect)
		if (this.screenPulseIntensity > 0) {
			this.screenPulseIntensity -= delta * 2;
			if (this.screenPulseIntensity < 0) this.screenPulseIntensity = 0;
			if (this.ambientLight) {
				this.ambientLight.intensity = 0.8 + this.screenPulseIntensity * 2;
			}
		} else if (this.ambientLight && this.ambientLight.intensity > 0.8) {
			this.ambientLight.intensity = 0.8;
		}

		// Combo announce timer
		if (this.comboAnnounceTimer > 0) {
			this.comboAnnounceTimer -= delta;
			if (this.comboAnnounceTimer <= 0) {
				if (this.comboAnnounceEntity?.object3D) this.comboAnnounceEntity.object3D.visible = false;
			}
		}

		// Multiplier HUD indicator
		if (this.multiplierTimer > 0 && this.state === 'playing') {
			const d = this.getDoc(this.hudEntity);
			if (d) {
				(d.getElementById('powerup-status') as UIKit.Text | undefined)?.setProperties({
					text: `2X SCORE ${Math.ceil(this.multiplierTimer)}s`
				});
			}
		}

		// Environment progression
		if (this.state === 'playing' || this.isCountingDown) {
			const hFactor = Math.min(1, (this.height - 1) / 60);
			const r = Math.floor(5 + hFactor * 15);
			const g = Math.floor(5 + hFactor * 5);
			const b = Math.floor(16 + hFactor * 20);
			const bgColor = (r << 16) | (g << 8) | b;
			this.w.scene.background = new Color(bgColor);
			(this.w.scene.fog as FogExp2).color.set(bgColor);
		}

		// Combo flash effect
		if (this.comboFlashTime > 0) {
			this.comboFlashTime -= delta;
			const intensity = Math.max(0, this.comboFlashTime / 0.15);
			for (const tl of this.towerLights) {
				tl.intensity = 1.5 + intensity * 3;
			}
		}

		// Camera shake decay
		if (this.shakeTime > 0) {
			this.shakeTime -= delta;
			if (this.shakeTime <= 0) this.shakeIntensity = 0;
		}

		// Power-up notification timer
		if (this.powerupNotifyTimer > 0) {
			this.powerupNotifyTimer -= delta;
			if (this.powerupNotifyTimer <= 0 && !this.powerUps.some(p => p.active)) {
				if (this.powerupEntity?.object3D) this.powerupEntity.object3D.visible = false;
			}
		}

		// Width danger indicator
		if (this.state === 'playing' && this.currentBlock) {
			const widthPct = this.currentBlock.width / BASE_WIDTH;
			if (widthPct < 0.35) {
				// Danger: fast red pulse on sliding block
				const danger = 0.5 + Math.sin(performance.now() * 0.015) * 0.5;
				(this.currentBlock.mesh.material as MeshStandardMaterial).emissive.setHex(0xff2200);
				(this.currentBlock.mesh.material as MeshStandardMaterial).emissiveIntensity = 0.3 + danger * 0.5;
			}
		}

		// Speed lines effect (at higher speeds)
		if (this.state === 'playing' && this.slideSpeed > 4.5 && this.currentBlock) {
			this.spawnSpeedLine();
		}
		this.updateSpeedLines(delta);

		// Weather particles (always during gameplay)
		if (this.state === 'playing' || this.isCountingDown) {
			this.updateWeatherParticles(delta);
		}

		// Wave announcer timer
		if (this.waveAnnouncerTimer > 0) {
			this.waveAnnouncerTimer -= delta;
		}

		// Near-miss flash timer
		if (this.nearMissFlash.timer > 0) {
			this.nearMissFlash.timer -= delta;
			if (this.nearMissFlash.timer <= 0) {
				this.updateNearMissHUD(true); // clear
			}
		}

		// Wind indicator on HUD
		if (this.state === 'playing' && this.windStrength > 0.1) {
			this.updateWindHUD();
		} else if (this.state === 'playing') {
			const hd = this.getDoc(this.hudEntity);
			if (hd) (hd.getElementById('wind-status') as UIKit.Text | undefined)?.setProperties({ text: '' });
		}

		// Pulse the current sliding block
		if (this.currentBlock && this.state === 'playing') {
			const pulse = 0.3 + Math.sin(_time * 8) * 0.15;
			(this.currentBlock.mesh.material as MeshStandardMaterial).emissiveIntensity = pulse;
		}

		this.kb.endFrame();
	}

	private updateCamera(delta: number) {
		this.cameraCurrentY += (this.cameraTargetY - this.cameraCurrentY) * delta * 3;
		let camX = 0;
		let camZ = 8;

		// Apply shake
		if (this.shakeTime > 0) {
			const s = this.shakeIntensity * (this.shakeTime / 0.15);
			camX += (Math.random() - 0.5) * s;
			camZ += (Math.random() - 0.5) * s;
			this.cameraCurrentY += (Math.random() - 0.5) * s;
		}

		this.w.camera.position.set(camX, this.cameraCurrentY, camZ);
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
			if (this.kb.getKeyDown('Space') || this.kb.clicked || trigger || aBtn) this.placeBlock();
			if (this.kb.getKeyDown('Escape') || bBtn) this.setState('paused');
		} else if (this.state === 'paused') {
			if (this.kb.getKeyDown('Escape') || bBtn) this.setState('playing');
		}
	}

	// == Panel Docs =======================================================

	private getDoc(e: Entity | null): UIKitDocument | undefined {
		if (!e) return undefined;
		return e.getValue(PanelDocument, 'document') as UIKitDocument | undefined;
	}

	private updateHUD() {
		const d = this.getDoc(this.hudEntity);
		if (!d) return;
		(d.getElementById('score') as UIKit.Text | undefined)?.setProperties({ text: `${this.score}` });
		(d.getElementById('combo') as UIKit.Text | undefined)?.setProperties({ text: this.combo > 0 ? `x${this.combo}` : '' });
		(d.getElementById('combo-label') as UIKit.Text | undefined)?.setProperties({ text: this.combo > 0 ? 'COMBO' : '' });
		(d.getElementById('height') as UIKit.Text | undefined)?.setProperties({ text: `${this.height}` });

		// Width danger
		const lastBlock = this.blocks[this.blocks.length - 1];
		if (lastBlock) {
			const widthPct = Math.min(lastBlock.width / BASE_WIDTH, lastBlock.depth / BASE_DEPTH);
			if (widthPct < 0.35) {
				(d.getElementById('width-warn') as UIKit.Text | undefined)?.setProperties({ text: 'DANGER! NARROW BLOCK' });
			} else if (widthPct < 0.55) {
				(d.getElementById('width-warn') as UIKit.Text | undefined)?.setProperties({ text: 'Getting narrow...' });
			} else {
				(d.getElementById('width-warn') as UIKit.Text | undefined)?.setProperties({ text: '' });
			}
		}

		// Power-up status
		const slowmo = this.powerUps.find(p => p.type === 'slowmo' && p.active);
		if (slowmo) {
			(d.getElementById('powerup-status') as UIKit.Text | undefined)?.setProperties({ text: `SLOW-MO ${Math.ceil(slowmo.timer)}s` });
		} else if (this.multiplierTimer > 0) {
			(d.getElementById('powerup-status') as UIKit.Text | undefined)?.setProperties({ text: `2X SCORE ${Math.ceil(this.multiplierTimer)}s` });
		} else {
			const comboToNext = this.combo < 3 ? `${3 - this.combo} to Slow-Mo` : this.combo < 5 ? `${5 - this.combo} to Shield` : this.combo < 7 ? `${7 - this.combo} to Width+` : this.combo < 10 ? `${10 - this.combo} to 2X` : '';
			(d.getElementById('powerup-status') as UIKit.Text | undefined)?.setProperties({ text: comboToNext });
		}

		// Shield status
		(d.getElementById('shield-status') as UIKit.Text | undefined)?.setProperties({ text: this.shieldActive ? 'SHIELD ACTIVE' : '' });
		// Fever indicator
		(d.getElementById('fever-status') as UIKit.Text | undefined)?.setProperties({
			text: this.feverActive ? 'FEVER!' : '',
		});
		// Freeze indicator
		if (this.freezeActive) {
			(d.getElementById('freeze-status') as UIKit.Text | undefined)?.setProperties({
				text: `FREEZE ${Math.ceil(this.freezeTimer)}s`,
			});
		} else {
			(d.getElementById('freeze-status') as UIKit.Text | undefined)?.setProperties({ text: '' });
		}
		// Endless wave
		if (this.mode === 'endless' && this.endlessWave.wave > 1) {
			(d.getElementById('mode-info-label') as UIKit.Text | undefined)?.setProperties({ text: 'WAVE' });
			(d.getElementById('mode-info') as UIKit.Text | undefined)?.setProperties({ text: `${this.endlessWave.wave}` });
		}
	}

	private updateModeInfo() {
		const d = this.getDoc(this.hudEntity);
		if (!d) return;
		if (this.mode === 'speed') {
			const t = Math.ceil(this.speedTimeLeft);
			const color = t <= 10 ? '#ff4444' : '#ffaa00';
			(d.getElementById('mode-info-label') as UIKit.Text | undefined)?.setProperties({ text: 'TIME' });
			(d.getElementById('mode-info') as UIKit.Text | undefined)?.setProperties({ text: `${t}s`, color });
		} else if (this.mode === 'challenge') {
			(d.getElementById('mode-info-label') as UIKit.Text | undefined)?.setProperties({ text: 'TARGET' });
			(d.getElementById('mode-info') as UIKit.Text | undefined)?.setProperties({ text: `${this.height}/${this.challengeTarget}` });
		} else {
			(d.getElementById('mode-info-label') as UIKit.Text | undefined)?.setProperties({ text: '' });
			(d.getElementById('mode-info') as UIKit.Text | undefined)?.setProperties({ text: '' });
		}
	}

	private updateGameOverPanel() {
		const d = this.getDoc(this.gameOverEntity);
		if (!d) return;
		(d.getElementById('final-score') as UIKit.Text | undefined)?.setProperties({ text: `${this.score}` });
		(d.getElementById('final-height') as UIKit.Text | undefined)?.setProperties({ text: `${this.height}` });
		(d.getElementById('final-combo') as UIKit.Text | undefined)?.setProperties({ text: `${this.maxCombo}` });
		(d.getElementById('best-score') as UIKit.Text | undefined)?.setProperties({ text: `${this.stats.bestScore}` });
		(d.getElementById('new-best-text') as UIKit.Text | undefined)?.setProperties({ text: this.isNewBest ? 'NEW BEST SCORE!' : '' });
		(d.getElementById('final-perfects') as UIKit.Text | undefined)?.setProperties({ text: `${this.sessionPerfects}` });
		(d.getElementById('final-nearmiss') as UIKit.Text | undefined)?.setProperties({ text: `${this.sessionNearMisses}` });
		(d.getElementById('final-powerups') as UIKit.Text | undefined)?.setProperties({ text: `${this.powerUpsUsed}` });
		// Session comparison
		if (this.lastSession && this.lastSession.mode === this.mode) {
			const scoreDiff = this.score - this.lastSession.score;
			const heightDiff = this.height - this.lastSession.height;
			const prefix = (n: number) => n > 0 ? `+${n}` : `${n}`;
			(d.getElementById('session-compare') as UIKit.Text | undefined)?.setProperties({
				text: `vs last: ${prefix(scoreDiff)} pts, ${prefix(heightDiff)} blocks`,
			});
		} else {
			(d.getElementById('session-compare') as UIKit.Text | undefined)?.setProperties({ text: '' });
		}
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
		const themeNames: Record<ColorTheme, string> = { neon: 'NEON', fire: 'FIRE', ice: 'ICE', vapor: 'VAPOR' };
		(d.getElementById('theme-val') as UIKit.Text | undefined)?.setProperties({ text: themeNames[this.colorTheme] });
	}

	private updateAchievementsPanel() {
		const d = this.getDoc(this.achievementsEntity);
		if (!d) return;
		const u = this.achievements.filter((a) => a.unlocked).length;
		(d.getElementById('ach-total') as UIKit.Text | undefined)?.setProperties({ text: `${u} / ${this.achievements.length}` });
		for (let i = 0; i < 16 && i < this.achievements.length; i++) {
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

	private showAchievementPopup(name: string) {
		const d = this.getDoc(this.achievementPopupEntity);
		if (!d) return;
		(d.getElementById('popup-name') as UIKit.Text | undefined)?.setProperties({ text: name });
		if (this.achievementPopupEntity?.object3D) {
			this.achievementPopupEntity.object3D.visible = true;
			this.achievementPopupEntity.object3D.position.set(0, Math.max(5, this.cameraCurrentY) + 0.5, -2);
		}
		this.achievementPopupTimer = 2.5;
	}

	private updateLeaderboardPanel() {
		const d = this.getDoc(this.leaderboardEntity);
		if (!d) return;
		const modeNames: Record<GameMode, string> = {
			classic: 'Classic', zen: 'Zen', speed: 'Speed',
			precision: 'Precision', challenge: 'Challenge', endless: 'Endless',
		};
		(d.getElementById('lb-mode') as UIKit.Text | undefined)?.setProperties({ text: modeNames[this.lbViewMode] });
		const entries = this.leaderboards[this.lbViewMode];
		for (let i = 0; i < 5; i++) {
			const entry = entries[i];
			if (entry) {
				(d.getElementById(`lb-score-${i}`) as UIKit.Text | undefined)?.setProperties({ text: `${entry.score}` });
				(d.getElementById(`lb-height-${i}`) as UIKit.Text | undefined)?.setProperties({ text: `H:${entry.height} C:${entry.combo}` });
			} else {
				(d.getElementById(`lb-score-${i}`) as UIKit.Text | undefined)?.setProperties({ text: '---' });
				(d.getElementById(`lb-height-${i}`) as UIKit.Text | undefined)?.setProperties({ text: '---' });
			}
		}
	}

	// == Panel Wiring =====================================================

	private wired = new Set<string>();
	private tryWirePanelHandlers() {
		this.wire('menu', this.menuEntity, (d) => {
			this.btn(d, 'btn-play', () => { this.audio.playMenuSelect(); this.setState('mode_select'); });
			this.btn(d, 'btn-daily', () => { this.audio.playMenuSelect(); this.dailyChallenge = this.generateDailyChallenge(); this.updateDailyPanel(); this.setState('daily_challenge'); });
			this.btn(d, 'btn-settings', () => { this.audio.playMenuSelect(); this.updateSettingsPanel(); this.setState('settings'); });
			this.btn(d, 'btn-achievements', () => { this.audio.playMenuSelect(); this.updateAchievementsPanel(); this.setState('achievements'); });
			this.btn(d, 'btn-tutorial', () => { this.audio.playMenuSelect(); this.setState('tutorial'); });
			this.btn(d, 'btn-stats', () => { this.audio.playMenuSelect(); this.updateStatsPanel(); this.setState('stats'); });
			this.btn(d, 'btn-leaderboard', () => { this.audio.playMenuSelect(); this.lbViewMode = 'classic'; this.updateLeaderboardPanel(); this.setState('leaderboard'); });
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
			const themes: ColorTheme[] = ['neon', 'fire', 'ice', 'vapor'];
			this.btn(d, 'btn-theme-next', () => {
				const idx = themes.indexOf(this.colorTheme);
				this.setTheme(themes[(idx + 1) % themes.length]);
				this.updateSettingsPanel();
				this.audio.playMenuSelect();
			});
			this.btn(d, 'btn-theme-prev', () => {
				const idx = themes.indexOf(this.colorTheme);
				this.setTheme(themes[(idx - 1 + themes.length) % themes.length]);
				this.updateSettingsPanel();
				this.audio.playMenuSelect();
			});
			this.btn(d, 'btn-settings-back', () => { this.audio.playMenuSelect(); this.setState('menu'); });
		});
		this.wire('ach', this.achievementsEntity, (d) => { this.btn(d, 'btn-ach-back', () => { this.audio.playMenuSelect(); this.setState('menu'); }); });
		this.wire('tut', this.tutorialEntity, (d) => { this.btn(d, 'btn-tutorial-back', () => { this.audio.playMenuSelect(); this.setState('menu'); }); });
		this.wire('stats', this.statsEntity, (d) => { this.btn(d, 'btn-stats-back', () => { this.audio.playMenuSelect(); this.setState('menu'); }); });
		this.wire('lb', this.leaderboardEntity, (d) => {
			this.btn(d, 'btn-lb-back', () => { this.audio.playMenuSelect(); this.setState('menu'); });
			this.btn(d, 'btn-lb-classic', () => { this.lbViewMode = 'classic'; this.updateLeaderboardPanel(); this.audio.playMenuSelect(); });
			this.btn(d, 'btn-lb-zen', () => { this.lbViewMode = 'zen'; this.updateLeaderboardPanel(); this.audio.playMenuSelect(); });
			this.btn(d, 'btn-lb-speed', () => { this.lbViewMode = 'speed'; this.updateLeaderboardPanel(); this.audio.playMenuSelect(); });
			this.btn(d, 'btn-lb-precision', () => { this.lbViewMode = 'precision'; this.updateLeaderboardPanel(); this.audio.playMenuSelect(); });
			this.btn(d, 'btn-lb-challenge', () => { this.lbViewMode = 'challenge'; this.updateLeaderboardPanel(); this.audio.playMenuSelect(); });
			this.btn(d, 'btn-lb-endless', () => { this.lbViewMode = 'endless'; this.updateLeaderboardPanel(); this.audio.playMenuSelect(); });
		});
		this.wire('daily', this.dailyEntity, (d) => {
			this.btn(d, 'btn-daily-play', () => { this.audio.playMenuSelect(); this.isDailyRun = true; this.startGame('classic'); });
			this.btn(d, 'btn-daily-back', () => { this.audio.playMenuSelect(); this.setState('menu'); });
		});
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

	// == Achievements =====================================================

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
			{ id: 'slowmo_earn', name: 'Time Bender', description: 'Earn a Slow-Mo power-up', unlocked: false },
			{ id: 'widthboost_earn', name: 'Size Matters', description: 'Earn a Width Boost power-up', unlocked: false },
			{ id: 'height_40', name: 'Stratosphere', description: 'Stack 40 blocks', unlocked: false },
			{ id: 'height_60', name: 'Exosphere', description: 'Stack 60 blocks', unlocked: false },
			{ id: 'score_3000', name: 'Elite', description: 'Score 3000 points', unlocked: false },
			{ id: 'total_score_25000', name: 'Fortune', description: '25,000 total points', unlocked: false },
			{ id: 'total_score_50000', name: 'Treasure', description: '50,000 total points', unlocked: false },
			{ id: 'games_100', name: 'Centurion Player', description: 'Play 100 games', unlocked: false },
			{ id: 'zen_50', name: 'Inner Peace', description: 'Stack 50 in Zen mode', unlocked: false },
			{ id: 'speed_30', name: 'Lightning', description: 'Stack 30 in Speed mode', unlocked: false },
			{ id: 'shield_earn', name: 'Force Field', description: 'Earn a Shield power-up', unlocked: false },
			{ id: 'shield_use', name: 'Saved!', description: 'Shield absorbs a miss', unlocked: false },
			{ id: 'multiplier_earn', name: 'Double Down', description: 'Earn a Score Multiplier', unlocked: false },
			{ id: 'score_10000', name: 'Legendary', description: 'Score 10,000 in one game', unlocked: false },
			{ id: 'height_80', name: 'Ionosphere', description: 'Stack 80 blocks', unlocked: false },
			{ id: 'total_score_100000', name: 'Millionaire', description: '100,000 total points', unlocked: false },
			{ id: 'all_modes_played', name: 'Versatile', description: 'Play all 6 game modes', unlocked: false },
			{ id: 'daily_win', name: 'Daily Victor', description: 'Complete a daily challenge', unlocked: false },
			{ id: 'combo_20_game', name: 'Unstoppable', description: '20 combo in a single game', unlocked: false },
			// Round 5 achievements
			{ id: 'height_25_milestone', name: 'Quarter Century', description: 'Reach height 25', unlocked: false },
			{ id: 'height_50_milestone', name: 'Half Century Tower', description: 'Reach height 50', unlocked: false },
			{ id: 'score_500_one', name: 'Five Hundred Club', description: 'Score 500 in one game', unlocked: false },
			{ id: 'speed_25', name: 'Quick Stacker', description: 'Stack 25 in Speed mode', unlocked: false },
			{ id: 'endless_30', name: 'Endurance', description: 'Stack 30 in Endless mode', unlocked: false },
			{ id: 'combo_30_game', name: 'Legendary Streak', description: '30 combo in a single game', unlocked: false },
			{ id: 'total_blocks_2000', name: 'Construction Foreman', description: 'Place 2000 total blocks', unlocked: false },
			{ id: 'total_perfects_500', name: 'Ascended', description: '500 total perfect placements', unlocked: false },
			{ id: 'games_200', name: 'Devoted', description: 'Play 200 games', unlocked: false },
			{ id: 'daily_3', name: 'Streak Runner', description: 'Complete 3 daily challenges', unlocked: false },
			{ id: 'precision_15', name: 'Surgical', description: 'All perfects with 15+ blocks in Precision', unlocked: false },
			// Round 6 achievements
			{ id: 'magnet_earn', name: 'Magnetic', description: 'Earn a Magnet power-up', unlocked: false },
			{ id: 'wind_survivor', name: 'Wind Walker', description: 'Stack 30+ blocks with wind active', unlocked: false },
			{ id: 'near_miss_10', name: 'Close Calls', description: '10 near-misses in one game', unlocked: false },
			{ id: 'score_15000', name: 'Transcendent Score', description: 'Score 15,000 in one game', unlocked: false },
			{ id: 'height_120', name: 'Mesosphere', description: 'Stack 120 blocks', unlocked: false },
			{ id: 'combo_40_game', name: 'Inhuman', description: '40 combo in a single game', unlocked: false },
			{ id: 'all_themes', name: 'Fashionista', description: 'Play a game in each theme', unlocked: false },
			{ id: 'speed_40', name: 'Blitz', description: 'Stack 40 in Speed mode', unlocked: false },
			{ id: 'daily_7', name: 'Weekly Warrior', description: 'Complete 7 daily challenges', unlocked: false },
			{ id: 'total_blocks_5000', name: 'Grand Architect', description: 'Place 5000 total blocks', unlocked: false },
			// Round 7 achievements
			{ id: 'fever_mode', name: 'Fever Pitch', description: 'Trigger Fever Mode (8x combo)', unlocked: false },
			{ id: 'freeze_earn', name: 'Ice Age', description: 'Earn a Freeze power-up', unlocked: false },
			{ id: 'endless_wave_3', name: 'Wave Rider', description: 'Reach wave 3 in Endless', unlocked: false },
			{ id: 'endless_wave_5', name: 'Tsunami', description: 'Reach wave 5 in Endless', unlocked: false },
			{ id: 'combo_50_game', name: 'Machine', description: '50 combo in a single game', unlocked: false },
			{ id: 'height_150', name: 'Thermosphere', description: 'Stack 150 blocks', unlocked: false },
			{ id: 'score_25000', name: 'Olympian', description: 'Score 25,000 in one game', unlocked: false },
			{ id: 'perfect_pct_75', name: 'Diamond Hands', description: '75%+ perfect rate (30+ blocks)', unlocked: false },
			{ id: 'powerups_10', name: 'Power Player', description: 'Earn 10 power-ups in one game', unlocked: false },
			{ id: 'total_perfects_1000', name: 'Eternal Precision', description: '1000 total perfect placements', unlocked: false },
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
		if (a && !a.unlocked) {
			a.unlocked = true;
			this.audio.playAchievement();
			this.saveAchievements();
			// Queue achievement popup
			if (this.achievementPopupTimer > 0) {
				this.achievementQueue.push(a.name);
			} else {
				this.showAchievementPopup(a.name);
			}
		}
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
		if (this.slowMoAwarded) this.unlock('slowmo_earn');
		if (this.widthBoostAwarded) this.unlock('widthboost_earn');
		if (this.height >= 40) this.unlock('height_40');
		if (this.height >= 60) this.unlock('height_60');
		if (this.score >= 3000) this.unlock('score_3000');
		if (this.stats.totalScore >= 25000) this.unlock('total_score_25000');
		if (this.stats.totalScore >= 50000) this.unlock('total_score_50000');
		if (this.stats.gamesPlayed >= 100) this.unlock('games_100');
		if (this.mode === 'zen' && this.height >= 50) this.unlock('zen_50');
		if (this.mode === 'speed' && this.height >= 30) this.unlock('speed_30');
		if (this.score >= 10000) this.unlock('score_10000');
		if (this.height >= 80) this.unlock('height_80');
		if (this.stats.totalScore >= 100000) this.unlock('total_score_100000');
		if (this.maxCombo >= 20) this.unlock('combo_20_game');
		// Round 5 achievements
		if (this.height >= 25) this.unlock('height_25_milestone');
		if (this.height >= 50) this.unlock('height_50_milestone');
		if (this.score >= 500) this.unlock('score_500_one');
		if (this.mode === 'speed' && this.height >= 25) this.unlock('speed_25');
		if (this.mode === 'endless' && this.height >= 30) this.unlock('endless_30');
		if (this.maxCombo >= 30) this.unlock('combo_30_game');
		if (this.stats.totalBlocks >= 2000) this.unlock('total_blocks_2000');
		if (this.stats.totalPerfects >= 500) this.unlock('total_perfects_500');
		if (this.stats.gamesPlayed >= 200) this.unlock('games_200');
		if (this.mode === 'precision' && this.height >= 15 && this.combo === this.height - 1) this.unlock('precision_15');
		// Round 6 achievements
		if (this.height >= 30 && this.windStrength > 0) this.unlock('wind_survivor');
		if (this.sessionNearMisses >= 10) this.unlock('near_miss_10');
		if (this.score >= 15000) this.unlock('score_15000');
		if (this.height >= 120) this.unlock('height_120');
		if (this.maxCombo >= 40) this.unlock('combo_40_game');
		if (this.themesPlayed.size >= 4) this.unlock('all_themes');
		if (this.mode === 'speed' && this.height >= 40) this.unlock('speed_40');
		if (this.stats.totalBlocks >= 5000) this.unlock('total_blocks_5000');
		// Check daily streak (count stored daily keys)
		try {
			let dailyCount = 0;
			for (let k = 0; k < localStorage.length; k++) {
				const key = localStorage.key(k);
				if (key && key.startsWith('neon-stack-daily-')) dailyCount++;
			}
			if (dailyCount >= 3) this.unlock('daily_3');
			if (dailyCount >= 7) this.unlock('daily_7');
		} catch { /* */ }
		// Check all modes played
		const modesPlayed = ['mode_classic', 'mode_zen', 'mode_speed', 'mode_precision', 'mode_challenge', 'mode_endless'];
		if (modesPlayed.every(m => this.achievements.find(a => a.id === m)?.unlocked)) this.unlock('all_modes_played');
		// Round 7 achievements
		if (this.maxCombo >= 50) this.unlock('combo_50_game');
		if (this.height >= 150) this.unlock('height_150');
		if (this.score >= 25000) this.unlock('score_25000');
		if (this.height >= 30 && this.stats.totalBlocks > 0) {
			const pct = this.sessionPerfects / (this.height - 1);
			if (pct >= 0.75) this.unlock('perfect_pct_75');
		}
		if (this.powerUpsUsed >= 10) this.unlock('powerups_10');
		if (this.stats.totalPerfects >= 1000) this.unlock('total_perfects_1000');
	}

	// == Leaderboards =====================================================

	private loadLeaderboards() {
		try {
			const s = localStorage.getItem('neon-stack-leaderboards');
			if (s) this.leaderboards = JSON.parse(s);
		} catch { /* ignore */ }
	}

	private saveLeaderboards() {
		try { localStorage.setItem('neon-stack-leaderboards', JSON.stringify(this.leaderboards)); } catch { /* */ }
	}

	/** Save entry and return true if it's a new #1 */
	private saveLeaderboardEntry(): boolean {
		const entry: LeaderboardEntry = {
			score: this.score,
			height: this.height,
			combo: this.maxCombo,
			date: new Date().toISOString().slice(0, 10),
		};
		const lb = this.leaderboards[this.mode];
		lb.push(entry);
		lb.sort((a, b) => b.score - a.score);
		if (lb.length > 5) lb.length = 5;
		this.saveLeaderboards();
		return lb[0] === entry;
	}

	// == Persistence ======================================================

	private loadStats() { try { const s = localStorage.getItem('neon-stack-stats'); if (s) this.stats = JSON.parse(s); } catch { /* */ } }
	private saveStats() { try { localStorage.setItem('neon-stack-stats', JSON.stringify(this.stats)); } catch { /* */ } }
}
