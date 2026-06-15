import { World } from '@iwsdk/core';
import { GameSystem } from './game';

async function main() {
	const container = document.getElementById('app') as HTMLDivElement;

	const world = await World.create(container, {
		xr: { offer: 'once' },
		browserControls: true,
		render: {
			fov: 70,
			near: 0.01,
			far: 500,
			defaultLighting: true,
		},
		features: {
			grabbing: false,
			locomotion: false,
			physics: false,
			spatialUI: true,
		},
	});

	// Set initial camera position
	world.camera.position.set(0, 5, 8);
	world.camera.lookAt(0, 3, 0);

	world.registerSystem(GameSystem);
	const game = world.getSystem(GameSystem)!;
	game.bootstrap(world);
}

main().catch(console.error);
