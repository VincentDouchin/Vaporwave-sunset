import './style.css'
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer"
import { UnrealBloomPass } from "./src/TransparentBackgroundFixedUnrealBloomPass.ts"

import { GlitchPass } from 'three/examples/jsm/postprocessing/GlitchPass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass";

import cnoise from './src/cnoise.glsl.js'
const sizes = {
	width: window.innerWidth,
	height: window.innerHeight
}
//!CAMERAS
const scene = new THREE.Scene();
const camera0 = new THREE.PerspectiveCamera(75, sizes.width / sizes.height, 0.01, 2);
const camera1 = new THREE.PerspectiveCamera(75, sizes.width / sizes.height, 0.01, 20);

camera0.position.set(0, 0.06, 1.1)
camera1.position.set(0, 0.06, 1.1)

camera0.layers.set(0)
camera1.layers.set(1)

//!CANVAS
const canvas = document.createElement('canvas')
document.body.appendChild(canvas)

//!RENDERER
const renderer = new THREE.WebGLRenderer({
	canvas: canvas,
});
renderer.setClearColor(0x000000, 0)

renderer.setSize(sizes.width, sizes.height)

//!RESIZE
window.addEventListener('resize', () => {
	sizes.width = sizes.width
	sizes.height = sizes.height
	camera0.aspect = sizes.width / sizes.height
	camera0.updateProjectionMatrix()
	camera1.aspect = sizes.width / sizes.height
	camera1.updateProjectionMatrix()

	renderer.setSize(sizes.width, sizes.height)
	renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
})



//!OBJECTS

const sunRadius = 2
const sun = new THREE.Mesh(
	new THREE.CircleGeometry(sunRadius, 128),
	new THREE.ShaderMaterial({
		uniforms: {
			time: { value: 0 },
			radius: { value: sunRadius },
			color1: { value: new THREE.Vector3(246 / 255, 185 / 255, 51 / 255) },
			color2: { value: new THREE.Vector3(233 / 255, 66 / 255, 94 / 255) }
		},
		vertexShader: /* glsl */`
		varying vec3 vPosition;
		varying vec2 vUv;

		void main()	{
			gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
			vUv = uv;
			vPosition = position;
		}`,
		fragmentShader: /* glsl */`
		varying vec3 vPosition;
		uniform float radius;
		uniform float time;
		uniform vec3 color1;
		uniform vec3 color2;
		varying vec2 vUv;
		void main() {
			float vTime = fract(time)*4.;
			float distanceFromTop = radius - vPosition.y;
			float redAmount = min(1.0, distanceFromTop / radius * 0.8);
			vec4 color = vec4(mix(color1,color2,redAmount), 1.0);
			bool isStripe = mod(vPosition.y*20. + vTime, radius* distanceFromTop) <  radius ||  distanceFromTop < radius*0.8;
			gl_FragColor = isStripe? color : vec4(0.0);
		}
		`
	})
)
sun.position.z = -4
sun.position.y = 0.5
sun.layers.set(1)
scene.add(sun);

const plane = new THREE.Mesh(
	new THREE.PlaneGeometry(1, 2, 24, 24),
	new THREE.ShaderMaterial({
		uniforms: {
			pos: { value: 0.0 },
			time: { value: 0 },
			cells: { value: 24 },
			mountainRange: { value: 7 },
			colorRoad: { value: new THREE.Vector4(113 / 255, 28 / 255, 146 / 255, 1) },
			colorMountain: { value: new THREE.Vector4(234 / 255, 0 / 255, 217 / 255, 1) },
			// colorRoad:{value:new THREE.Vector4(19/255,62/255,124/255,1)},
			// colorMountain:{value:new THREE.Vector4(10/255,189/255,198/255,1)}
			
		},
	
		vertexShader: /* glsl */`
		${cnoise}
		varying vec4 vPosition;
		varying vec3 vNormal;
		varying vec2 vUv;
		uniform float cells;
		uniform float mountainRange;
		uniform vec4 colorRoad;
		uniform vec4 colorMountain;
		varying vec4 vColor;
		// #include <begin_vertex>
        // #include <project_vertex>
        // #include <fog_vertex>

		void main() 
		{
			vNormal = normal;
			vUv = uv;
			float noisedPosition = pow(abs(cnoise(position * 23.)*0.7),2.);
			bool road = uv.x > mountainRange/cells && uv.x < (cells-mountainRange)/cells;
			float mountain = road ?  0.:noisedPosition  ;
			vPosition =  projectionMatrix * modelViewMatrix * vec4( position.x,position.y, mountain , 1.0 );
			vColor = road?colorRoad : colorMountain;
			
			gl_Position = vPosition ;

		}`,
		fragmentShader: /* glsl */`
		varying vec2 vUv;
		varying vec4 vPosition;
		varying vec4 vColor;
		uniform float cells;
		uniform float time;
		uniform float pos;
		// #include <fog_pars_fragment>
		float grid(vec2 st, float res)
		{
		  vec2 grid = fract(st*res)*2.;
		  return (smoothstep(res,res,grid.x) * smoothstep(res,res,grid.y));
		}

		void main()
		{
			float scale = cells * cells;
			float resolution = 1./cells;
		  	vec2 grid_uv = vUv.xy * scale +1.; // scale
			//   grid_uv.y += time*cells;
			  
		  	float isGrid = 1.-grid(grid_uv, resolution) ; // resolution
		  	gl_FragColor = vec4(vec4(isGrid*vColor).xyz,1.);
			// #include <fog_fragment>
		}`,

	})
);
plane.rotation.x = -Math.PI * 0.5;

plane.layers.set(0)
scene.add(plane);
const plane2 = plane.clone()
scene.add(plane2)

//!PASSES
const renderPass0 = new RenderPass(scene, camera0)
const renderPass1 = new RenderPass(scene, camera1)
const bloomPassPlane = new UnrealBloomPass(new THREE.Vector2(sizes.width, sizes.height), 3, 1, 0);
const bloomPassSun = new UnrealBloomPass(new THREE.Vector2(sizes.width, sizes.height), 1, 2, 0);
const glitchPass = new GlitchPass()

//!COMPOSERS
const planeComposer = new EffectComposer(renderer)
planeComposer.addPass(renderPass0)
planeComposer.addPass(bloomPassPlane)
planeComposer.renderToScreen = false

const sunComposer = new EffectComposer(renderer)

sunComposer.addPass(renderPass1)
sunComposer.addPass(bloomPassSun)

sunComposer.addPass(glitchPass)
sunComposer.renderToScreen = false

//!MERGING SHADERS
const finalPass = new ShaderPass(
	new THREE.ShaderMaterial({
		uniforms: {
			bloomTexture: { value: planeComposer.renderTarget2.texture },
			glitchTexture: { value: sunComposer.renderTarget2.texture }
		},
		vertexShader: /*glsl*/`
			varying vec2 vUv;
		void main() {
			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
		}
		`,
		fragmentShader: /*glsl*/`
			uniform sampler2D glitchTexture;
			uniform sampler2D bloomTexture;
			varying vec2 vUv;
			void main()
			{
				vec4 bloom = texture2D(bloomTexture, vUv);
				vec4 glitch = texture2D(glitchTexture, vUv);
				vec4 res = (bloom.w < 1. && glitch.w > 0.0) ? glitch : bloom;
				gl_FragColor = res.w != 1.0 ? mix(vec4(0.3,0.,0.3,1.),vec4(0.0,0.,0.3,1.),vUv.y*0.8) + res : res;
			}`,
		defines: {}
	})
);
finalPass.needsSwap = true;

const finalComposer = new EffectComposer(renderer);
finalComposer.addPass(finalPass);

//!ANIMATE
const clock = new THREE.Clock()
const animate = function () {

	sun.material.uniforms.time.value = clock.getElapsedTime()
	requestAnimationFrame(animate);
	plane.position.z = ((clock.getElapsedTime() * 0.15) % 2)

	plane2.position.z = ((clock.getElapsedTime() * 0.15) % 2) - 2


	sunComposer.render();
	planeComposer.render();
	finalComposer.render()

};

animate();