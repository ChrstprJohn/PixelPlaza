import { useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import { WORLD, CHARACTERS, OBSTACLES, SCENERY, facingDirection, movePosition, walkable } from '../../shared/world.js';
import gardenArt from './character-art.json';
import hauntedArt from './haunted-art.json';
import directionalArt from './directional-art.json';
import sceneryArt from './scenery-art.json';
import benchArt from './bench-art.json';
import { LOBBIES } from '../../shared/lobbies.js';
import { characterMotion, movementPose } from './character-motion.js';

export default function Game({ players, selfId, messages, onMove, onError, controlsPaused = false, lobbyId = 'garden', onReady }) {
  const art = lobbyId === 'haunted' ? hauntedArt : gardenArt;
  const theme = lobbyId === 'haunted' ? 'haunted' : 'garden';
  const walkingArt = directionalArt[theme], propsArt = sceneryArt[theme];
  const element = useRef(null);
  const sceneRef = useRef(null);
  const [activated, setActivated] = useState(false);
  const touch = useRef({ dx: 0, dy: 0 });
  const joystickPointer = useRef(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const live = useRef({ players, selfId, messages, onMove, onError, controlsPaused, onReady });
  live.current = { players, selfId, messages, onMove, onError, controlsPaused, onReady };
  useEffect(() => {
    touch.current = { dx: 0, dy: 0 };
    setKnob({ x: 0, y: 0 });
    const scene = sceneRef.current;
    if (!scene) return;
    scene.input.keyboard.resetKeys();
    scene.input.keyboard.enabled = !controlsPaused && document.activeElement === scene.game.canvas;
    if (controlsPaused) scene.sendInput(0, 0);
    joystickPointer.current = null;
  }, [controlsPaused]);
  useEffect(() => {
    let game, sceneReady = false, scene;
    class Plaza extends Phaser.Scene {
      constructor() { super('plaza'); this.avatars = new Map(); this.lastSend = 0; this.sequence = 0; this.sending = false; this.lastInput = { dx: 0, dy: 0 }; }
      sendInput(dx, dy, time = this.time.now) {
        const self = live.current.players.find(player => player.id === live.current.selfId);
        this.sequence = Math.max(this.sequence, self?.inputSequence || 0);
        const changed = dx !== this.lastInput.dx || dy !== this.lastInput.dy;
        if (!changed && (!(dx || dy) || time - this.lastSend < 100 || this.sending)) return;
        this.lastSend = time; this.sending = true; this.lastInput = { dx, dy };
        Promise.resolve(live.current.onMove({ dx, dy, sequence: ++this.sequence })).catch(live.current.onError).finally(() => { this.sending = false; });
      }
      preload() {
        this.load.image('plaza', LOBBIES.find(room => room.id === lobbyId)?.map || LOBBIES[0].map);
        this.load.image('bench', '/assets/bench.webp');
        this.load.image('characters', art.image);
        this.load.image('scenery', propsArt.image);
        for (const name of CHARACTERS) this.load.image(`walk-${name}`, walkingArt[name].image);
      }
      create() {
        scene = this; sceneRef.current = this; sceneReady = true;
        this.add.image(0, 0, 'plaza').setOrigin(0).setDisplaySize(WORLD.width, WORLD.height);
        this.textures.get('bench').add('prop', 0, benchArt.x, benchArt.y, benchArt.width, benchArt.height);
        for (const o of OBSTACLES.slice(2, 6)) {
          const bench = this.add.image(o.x + o.w / 2, o.y + o.h, 'bench', 'prop').setOrigin(.5, 1).setDisplaySize(o.w, o.h).setDepth(o.y + o.h);
          if (lobbyId === 'haunted') bench.setTint(0x8792ae);
        }
        this.resizeCamera = size => this.cameras.main.setSize(size.width, size.height).setZoom(Math.max(size.width / WORLD.width, size.height / WORLD.height)).setBounds(0, 0, WORLD.width, WORLD.height);
        this.resizeCamera(this.scale.gameSize);
        this.scale.on('resize', this.resizeCamera);
        for (const name of CHARACTERS) {
          art.frames[name].forEach((b, index) => this.textures.get('characters').add(`${name}-${index}`, 0, b.x, b.y, b.width, b.height));
          const frame = (index, duration = 0) => ({ key: 'characters', frame: `${name}-${index}`, duration });
          this.anims.create({ key: `${name}-idle`, frames: [frame(0, 1500), frame(1, 250), frame(0, 600), frame(2, 250), frame(0, 1000), frame(3, 20), frame(0, 400)], frameRate: 10, repeat: -1 });
          for (const [direction, frames] of Object.entries(walkingArt[name].frames)) {
            frames.forEach((b, i) => this.textures.get(`walk-${name}`).add(`${direction}-${i}`, 0, b.x, b.y, b.width, b.height));
            this.anims.create({ key: `${name}-walk-${direction}`, frames: frames.map((b, i) => ({ key: `walk-${name}`, frame: `${direction}-${i}` })), frameRate: 18, repeat: -1 });
          }
        }
        this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
        for (const [kind, frames] of Object.entries(propsArt.frames)) frames.forEach((b, i) => this.textures.get('scenery').add(`${kind}-${i}`, 0, b.x, b.y, b.width, b.height));
        this.scenery = SCENERY.map(prop => {
          const frame = propsArt.frames[prop.kind][0];
          const scale = prop.height / propsArt.characterHeights[prop.kind];
          const sprite = this.add.sprite(prop.x, prop.y, 'scenery', `${prop.kind}-0`).setOrigin(frame.anchorX, frame.anchorY).setScale(scale).setDepth(prop.y);
          return { ...prop, sprite };
        });
        this.leaves = Array.from({ length: 24 }, () => ({ pixel: this.add.rectangle(0, 0, 6, 3, theme === 'haunted' ? 0x9d77bf : 0xc3ad58).setVisible(false).setDepth(WORLD.height + 2), born: 0 }));
        this.lastLeaf = 0; this.leafCursor = 0;
        this.dust = Array.from({ length: 96 }, () => ({ pixel: this.add.rectangle(0, 0, 5, 5, 0xfff4d0).setVisible(false), born: 0 }));
        this.dustCursor = 0;
        this.blockedUntil = 0;
        this.blockedText = this.add.text(0, 0, 'Blocked', { fontFamily: 'Nunito, sans-serif', fontSize: '12px', color: '#98372f', backgroundColor: '#fff8e9', padding: { x: 7, y: 3 } }).setOrigin(.5, 0).setDepth(WORLD.height + 1).setVisible(false);
        const node = this.game.canvas;
        node.tabIndex = 0; node.setAttribute('aria-label', 'Walkable plaza. Use WASD or arrow keys.');
        this.keys = this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT', false);
        this.input.keyboard.enabled = false;
        this.focus = () => { this.input.keyboard.enabled = !live.current.controlsPaused; setActivated(true); };
        this.blur = () => { touch.current = { dx: 0, dy: 0 }; joystickPointer.current = null; setKnob({ x: 0, y: 0 }); this.input.keyboard.enabled = false; this.input.keyboard.resetKeys(); this.sendInput(0, 0); };
        this.outside = event => {
          if (!element.current?.closest('.lobby-layout')?.contains(event.target)) {
            setActivated(false); touch.current = { dx: 0, dy: 0 }; node.blur();
          }
        };
        document.addEventListener('pointerdown', this.outside);
        this.windowBlur = () => { setActivated(false); node.blur(); this.blur(); };
        window.addEventListener('blur', this.windowBlur);
        node.addEventListener('focus', this.focus); node.addEventListener('blur', this.blur);
        node.addEventListener('pointerdown', () => node.focus());
        this.input.on('pointermove', pointer => { const point = this.cameras.main.getWorldPoint(pointer.x, pointer.y); const self = live.current.players.find(player => player.id === live.current.selfId); node.style.cursor = walkable(point.x, point.y, lobbyId, self?.character) ? 'default' : 'not-allowed'; });
        live.current.onReady?.();
        node.focus({ preventScroll: true });
      }
      emitDust(object, time) {
        if (time - (object.lastDust || 0) < 65 || this.reducedMotion.matches) return;
        object.lastDust = time;
        for (const side of [-1, 1]) {
          const dust = this.dust[this.dustCursor++ % this.dust.length];
          dust.born = time; dust.x = object.x + side * 5; dust.y = object.y + 1;
          dust.vx = side * (8 + Math.random() * 10); dust.vy = -12 - Math.random() * 9;
          dust.pixel.setPosition(dust.x, dust.y).setFillStyle(side < 0 ? 0x97704c : 0xfff4d0).setDepth(object.y + 2).setScale(1).setAlpha(.9).setVisible(true);
        }
      }
      update(time, delta) {
        const data = live.current;
        if (!this.reducedMotion.matches && time - this.lastLeaf > 850) {
          this.lastLeaf = time;
          const trees = this.scenery.filter(prop => ['tree', 'cherry'].includes(prop.kind));
          const tree = trees[Math.floor(Math.random() * trees.length)], leaf = this.leaves[this.leafCursor++ % this.leaves.length];
          leaf.born = time; leaf.x = tree.x + (Math.random() - .5) * tree.height * .55; leaf.y = tree.y - tree.height * (.5 + Math.random() * .25);
          leaf.pixel.setPosition(leaf.x, leaf.y).setFillStyle(theme === 'haunted' ? 0x9d77bf : tree.kind === 'cherry' ? 0xe991ae : 0xc3ad58).setVisible(true);
        }
        for (const leaf of this.leaves) {
          if (!leaf.pixel.visible) continue;
          const age = (time - leaf.born) / 4800;
          if (age >= 1 || this.reducedMotion.matches) { leaf.pixel.setVisible(false); continue; }
          leaf.pixel.setPosition(leaf.x + Math.sin(age * 7) * 10 + age * 20, leaf.y + age * 115).setRotation(Math.sin(age * 8) * .65).setAlpha(Math.min(age * 8, 1, (1 - age) * 4));
        }
        for (const dust of this.dust) {
          if (!dust.pixel.visible) continue;
          const age = (time - dust.born) / 650;
          if (age >= 1 || this.reducedMotion.matches) { dust.pixel.setVisible(false); continue; }
          dust.pixel.setPosition(dust.x + dust.vx * age * .65, dust.y + dust.vy * age * .65).setAlpha((1 - age) * .9).setScale(1 - age * .45);
        }
        const ids = new Set(data.players.map(p => p.id));
        for (const [id, object] of this.avatars) if (!ids.has(id)) { object.group.destroy(true); this.avatars.delete(id); }
        for (const player of data.players) {
          const motion = characterMotion[theme][player.character];
          let object = this.avatars.get(player.id);
          if (!object) {
            const sprite = this.add.sprite(0, 0, 'characters', `${player.character}-0`).setOrigin(art.frames[player.character][0].anchorX, 1);
            sprite.setScale(48 / art.characterHeights[player.character]);
            const shadow = this.add.ellipse(0, -1, 28, 8, 0x443438, .18);
            const label = this.add.text(0, -54, player.name, { fontFamily: 'Nunito, sans-serif', fontSize: '12px', fontStyle: 'bold', color: '#fff8e9', stroke: '#382e32', strokeThickness: 3, align: 'center' }).setOrigin(.5, 1);
            const bubble = this.add.text(0, -78, '', { fontFamily: 'Nunito, sans-serif', fontSize: '14px', color: '#382e32', backgroundColor: '#fffbed', wordWrap: { width: 180 }, padding: { x: 9, y: 7 }, align: 'center' }).setOrigin(.5, 1).setVisible(false);
            const group = this.add.container(player.x, player.y, [shadow, sprite, label, bubble]);
            object = { character: player.character, group, sprite, shadow, label, bubble, x: player.x, y: player.y, seen: player, direction: walkingArt[player.character].frames[player.facing] ? player.facing : 'south', idleSpeed: .9 + Math.random() * .2, walkPhase: 0, nextIdle: time + 4500 + Math.random() * 6000 };
            this.avatars.set(player.id, object);
            if (player.id === data.selfId) { this.cameras.main.startFollow(group, true, 1, 1); this.cameras.main.centerOn(player.x, player.y); }
          }
          const me = player.id === data.selfId;
          const previousX = object.x, previousY = object.y;
          let dx = 0, dy = 0;
          let moving = false;
          if (me && this.input.keyboard.enabled && !data.controlsPaused) {
            dx = Number(this.keys.D.isDown || this.keys.RIGHT.isDown) - Number(this.keys.A.isDown || this.keys.LEFT.isDown);
            dy = Number(this.keys.S.isDown || this.keys.DOWN.isDown) - Number(this.keys.W.isDown || this.keys.UP.isDown);
          }
          if (me && !data.controlsPaused && (touch.current.dx || touch.current.dy)) { dx = touch.current.dx; dy = touch.current.dy; }
          if (me) {
            if (object.seen !== player) {
              const gap = Math.hypot(object.x - player.x, object.y - player.y);
              // Late movement snapshots must not drag a released character forward.
              const fraction = gap > 90 ? 1 : (dx || dy) && gap > 12 ? .35 : 0;
              object.x += (player.x - object.x) * fraction; object.y += (player.y - object.y) * fraction;
              object.seen = player;
            }
            const beforeX = object.x, beforeY = object.y;
            movePosition(object, dx, dy, Math.min(delta / 1000, .05), lobbyId);
            moving = Math.hypot(object.x - beforeX, object.y - beforeY) > .01;
            if ((dx && Math.abs(object.x - beforeX) < .01) || (dy && Math.abs(object.y - beforeY) < .01)) this.blockedUntil = time + 550;
            this.blockedText.setPosition(object.x, object.y + 31).setVisible(time < this.blockedUntil);
            this.sendInput(dx, dy, time);
          } else {
            moving = Math.hypot(player.x - object.x, player.y - object.y) > .75;
            if (moving) object.direction = facingDirection(player.x - object.x, player.y - object.y);
            object.x += (player.x - object.x) * Math.min(1, delta / 100);
            object.y += (player.y - object.y) * Math.min(1, delta / 100);
          }
          object.group.setPosition(object.x, object.y).setDepth(object.y);
          if (me && (dx || dy)) object.direction = facingDirection(dx, dy);
          if ((moving || motion.action === 'fly') && !this.reducedMotion.matches) {
            // Keep foot contacts tied to actual travel, including direction changes.
            const oldStep = Math.floor(object.walkPhase * 2);
            if (moving && motion.action === 'walk') object.walkPhase += Math.hypot(object.x - previousX, object.y - previousY) / motion.stride;
            const pose = movementPose(motion, object.walkPhase, time);
            object.sprite.anims.stop();
            object.sprite.setTexture(`walk-${player.character}`, `${object.direction}-${pose.frame}`);
            if (motion.action === 'walk' && Math.floor(object.walkPhase * 2) !== oldStep) this.emitDust(object, time);
            if (moving) { object.idleAction = null; object.nextIdle = time + 5000 + Math.random() * 7000; }
          }
          else if (!this.reducedMotion.matches) {
            object.sprite.play(`${player.character}-idle`, true);
            object.sprite.anims.timeScale = moving ? 1 : object.idleSpeed;
          } else {
            object.sprite.anims.stop();
            object.sprite.setTexture(`walk-${player.character}`, `${object.direction}-0`);
          }
          object.sprite.anims.timeScale = moving ? 1 : object.idleSpeed;
          const frameIndex = Number(object.sprite.frame.name.split('-').pop()) || 0;
          const walking = object.sprite.texture.key.startsWith('walk-');
          const crop = walking ? walkingArt[player.character].frames[object.direction][frameIndex] : art.frames[player.character][frameIndex];
          const scale = 48 / (walking ? walkingArt[player.character].bodyHeight : art.characterHeights[player.character]);
          let lift = this.reducedMotion.matches ? 0 : movementPose(motion, object.walkPhase, time).lift, squash = 1, offset = 0;
          if (!moving && !this.reducedMotion.matches) {
            if (!object.idleAction && time >= object.nextIdle) object.idleAction = { start: time, kind: motion.action === 'walk' && Math.random() < .55 ? 'hop' : 'peek' };
            if (object.idleAction) {
              const progress = (time - object.idleAction.start) / (object.idleAction.kind === 'hop' ? 900 : 1600);
              if (progress >= 1) { object.idleAction = null; object.nextIdle = time + 6500 + Math.random() * 8000; }
              else if (object.idleAction.kind === 'hop') {
                if (progress < .18) squash = 1 - Math.sin(progress / .18 * Math.PI) * .08;
                else if (progress < .78) lift = Math.sin((progress - .18) / .6 * Math.PI) * 10;
                else squash = 1 - Math.sin((progress - .78) / .22 * Math.PI) * .05;
              } else offset = Math.sin(progress * Math.PI * 2) * 1.5;
            }
          }
          object.sprite.setOrigin(crop.anchorX, crop.anchorY).setPosition(offset, -lift).setScale(scale / Math.sqrt(squash), scale * squash);
          object.shadow.setScale(1 - lift / 35).setAlpha(.18 - lift / 150);
          object.label.setY(-54 - lift);
          object.bubble.setY(-78 - lift);
          if (me) {
            this.game.canvas.dataset.selfX = String(Math.round(object.x)); this.game.canvas.dataset.selfY = String(Math.round(object.y));
            this.game.canvas.dataset.selfAnimation = moving ? 'walk' : 'idle';
            this.game.canvas.dataset.selfFrame = object.sprite.frame.name;
            this.game.canvas.dataset.dustParticles = String(this.dust.filter(dust => dust.pixel.visible).length);
          }
          object.sprite.setFlipX(false);
          const message = [...data.messages].reverse().find(m => m.playerId === player.id && Date.now() - m.at < 6000);
          object.bubble.setVisible(Boolean(message));
          if (message) object.bubble.setText(message.text);
        }
      }
    }
    game = new Phaser.Game({ type: Phaser.AUTO, parent: element.current, width: element.current.clientWidth || WORLD.width, height: element.current.clientHeight || WORLD.height, pixelArt: true, backgroundColor: '#b8cf80', scale: { mode: Phaser.Scale.RESIZE }, scene: Plaza, audio: { noAudio: true }, banner: false });
    return () => { if (sceneReady) { document.removeEventListener('pointerdown', scene.outside); window.removeEventListener('blur', scene.windowBlur); scene.scale.off('resize', scene.resizeCamera); game.canvas.removeEventListener('focus', scene.focus); game.canvas.removeEventListener('blur', scene.blur); } sceneRef.current = null; game.destroy(true); };
  }, [lobbyId, art, walkingArt, propsArt]);
  const steer = event => {
    if (joystickPointer.current !== event.pointerId) return;
    const box = event.currentTarget.getBoundingClientRect();
    const x = event.clientX - box.left - box.width / 2, y = event.clientY - box.top - box.height / 2;
    const distance = Math.hypot(x, y), limit = 32, fraction = Math.min(1, limit / (distance || 1));
    setKnob({ x: x * fraction, y: y * fraction });
    const angle = Math.round(Math.atan2(y, x) / (Math.PI / 4)) * Math.PI / 4;
    touch.current = distance < 7 ? { dx: 0, dy: 0 } : { dx: Math.round(Math.cos(angle)), dy: Math.round(Math.sin(angle)) };
  };
  const start = event => { if (joystickPointer.current !== null) return; joystickPointer.current = event.pointerId; element.current?.querySelector('canvas')?.focus(); event.currentTarget.setPointerCapture(event.pointerId); steer(event); };
  const stop = () => { joystickPointer.current = null; touch.current = { dx: 0, dy: 0 }; setKnob({ x: 0, y: 0 }); };
  return <div className={`game-frame ${activated || controlsPaused ? "is-controlled" : "awaiting-control"} ${controlsPaused ? 'controls-paused' : ''}`}><div ref={element} className="game-canvas" /><button className="walk-hint" hidden={activated || controlsPaused} onClick={() => element.current?.querySelector("canvas")?.focus()}>Click to control<span className="walk-keys" aria-label="WASD or arrow keys">{["W", "A", "S", "D"].map(key => <kbd key={key}>{key}</kbd>)}<span>or arrow keys</span></span></button><div className="touch-joystick" role="group" aria-label="Drag the joystick to walk" onPointerDown={start} onPointerMove={steer} onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={stop}><span className="joystick-knob" style={{ transform: `translate(${knob.x}px,${knob.y}px)` }}/></div></div>;
}
