import { useEffect, useRef, useState } from 'react';
import Phaser from 'phaser';
import { WORLD, CHARACTERS, movePosition } from '../../shared/world.js';
import spriteBounds from './sprite-bounds.json';

export default function Game({ players, selfId, messages, onMove, onError }) {
  const element = useRef(null);
  const [activated, setActivated] = useState(false);
  const touch = useRef({ dx: 0, dy: 0 });
  const live = useRef({ players, selfId, messages, onMove, onError });
  live.current = { players, selfId, messages, onMove, onError };
  useEffect(() => {
    let game, sceneReady = false, scene;
    class Plaza extends Phaser.Scene {
      constructor() { super('plaza'); this.avatars = new Map(); this.lastSend = 0; this.sequence = 0; this.sending = false; }
      preload() {
        this.load.image('plaza', '/assets/plaza.png');
        for (const name of CHARACTERS) this.load.image(name, `/assets/${name}.png`);
      }
      create() {
        scene = this; sceneReady = true;
        this.add.image(0, 0, 'plaza').setOrigin(0).setDisplaySize(WORLD.width, WORLD.height);
        for (const name of CHARACTERS) {
          const b = spriteBounds[name];
          this.textures.get(name).add('body', 0, b.x, b.y, b.width, b.height);
        }
        const node = this.game.canvas;
        node.tabIndex = 0; node.setAttribute('aria-label', 'Walkable plaza. Use WASD or arrow keys.');
        this.keys = this.input.keyboard.addKeys('W,A,S,D,UP,DOWN,LEFT,RIGHT', false);
        this.input.keyboard.enabled = false;
        this.focus = () => { this.input.keyboard.enabled = true; setActivated(true); };
        this.blur = () => { touch.current = { dx: 0, dy: 0 }; this.input.keyboard.enabled = false; this.input.keyboard.resetKeys(); };
        this.outside = event => {
          if (!element.current?.parentElement?.contains(event.target)) {
            setActivated(false); touch.current = { dx: 0, dy: 0 }; node.blur();
          }
        };
        document.addEventListener('pointerdown', this.outside);
        node.addEventListener('focus', this.focus); node.addEventListener('blur', this.blur);
        node.addEventListener('pointerdown', () => node.focus());
      }
      update(time, delta) {
        const data = live.current;
        const ids = new Set(data.players.map(p => p.id));
        for (const [id, object] of this.avatars) if (!ids.has(id)) { object.group.destroy(true); this.avatars.delete(id); }
        for (const player of data.players) {
          let object = this.avatars.get(player.id);
          if (!object) {
            const sprite = this.add.image(0, 0, player.character, 'body').setOrigin(.5, 1);
            const bounds = spriteBounds[player.character];
            sprite.setDisplaySize(43 * bounds.width / bounds.height, 43);
            const label = this.add.text(0, 7, player.name, { fontFamily: 'Nunito, sans-serif', fontSize: '12px', color: '#382e32', backgroundColor: '#fff8e9', wordWrap: { width: 80, useAdvancedWrap: true }, padding: { x: 5, y: 2 }, align: 'center' }).setOrigin(.5, 0);
            const bubble = this.add.text(0, -57, '', { fontFamily: 'Nunito, sans-serif', fontSize: '14px', color: '#382e32', backgroundColor: '#fffbed', wordWrap: { width: 180 }, padding: { x: 9, y: 7 }, align: 'center' }).setOrigin(.5, 1).setVisible(false);
            const group = this.add.container(player.x, player.y, [sprite, label, bubble]);
            object = { group, sprite, label, bubble, x: player.x, y: player.y, seen: player };
            this.avatars.set(player.id, object);
          }
          const me = player.id === data.selfId;
          let dx = 0, dy = 0;
          if (me && this.input.keyboard.enabled) {
            dx = Number(this.keys.D.isDown || this.keys.RIGHT.isDown) - Number(this.keys.A.isDown || this.keys.LEFT.isDown);
            dy = Number(this.keys.S.isDown || this.keys.DOWN.isDown) - Number(this.keys.W.isDown || this.keys.UP.isDown);
          }
          if (me && (touch.current.dx || touch.current.dy)) { dx = touch.current.dx; dy = touch.current.dy; }
          if (me) {
            if (object.seen !== player) {
              const gap = Math.hypot(object.x - player.x, object.y - player.y);
              const fraction = gap > 90 ? 1 : .35;
              object.x += (player.x - object.x) * fraction; object.y += (player.y - object.y) * fraction;
              object.seen = player;
            }
            movePosition(object, dx, dy, Math.min(delta / 1000, .05));
            if (time - this.lastSend >= 100 && !this.sending) {
              this.lastSend = time; this.sending = true;
              Promise.resolve(data.onMove({ dx, dy, sequence: ++this.sequence })).catch(data.onError).finally(() => { this.sending = false; });
            }
          } else {
            object.x += (player.x - object.x) * Math.min(1, delta / 100);
            object.y += (player.y - object.y) * Math.min(1, delta / 100);
          }
          const moving = me ? Boolean(dx || dy) : player.moving;
          object.group.setPosition(object.x, object.y).setDepth(object.y);
          if (me) { this.game.canvas.dataset.selfX = String(Math.round(object.x)); this.game.canvas.dataset.selfY = String(Math.round(object.y)); }
          object.sprite.y = moving && !window.matchMedia('(prefers-reduced-motion: reduce)').matches ? -Math.abs(Math.sin(time / 90)) * 3 : 0;
          object.sprite.setFlipX(me && dx ? dx < 0 : player.facing === 'left');
          const message = [...data.messages].reverse().find(m => m.playerId === player.id && Date.now() - m.at < 6000);
          object.bubble.setVisible(Boolean(message));
          if (message) object.bubble.setText(message.text);
        }
      }
    }
    game = new Phaser.Game({ type: Phaser.AUTO, parent: element.current, width: WORLD.width, height: WORLD.height, pixelArt: true, backgroundColor: '#b8cf80', scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH }, scene: Plaza, audio: { noAudio: true }, banner: false });
    return () => { if (sceneReady) { document.removeEventListener('pointerdown', scene.outside); game.canvas.removeEventListener('focus', scene.focus); game.canvas.removeEventListener('blur', scene.blur); } game.destroy(true); };
  }, []);
  const start = (event, dx, dy) => { element.current?.querySelector("canvas")?.focus(); event.currentTarget.setPointerCapture(event.pointerId); touch.current = { dx, dy }; };
  const stop = () => { touch.current = { dx: 0, dy: 0 }; };
  return <div className={`game-frame ${activated ? "is-controlled" : "awaiting-control"}`}><div ref={element} className="game-canvas" /><button className="walk-hint" hidden={activated} onClick={() => element.current?.querySelector("canvas")?.focus()}>Click to control<span className="walk-keys" aria-label="WASD or arrow keys">{["W", "A", "S", "D"].map(key => <kbd key={key}>{key}</kbd>)}<span>or arrow keys</span></span></button><div className="touch-pad" aria-label="Walking controls">{[['up',0,-1],['left',-1,0],['down',0,1],['right',1,0]].map(([direction,dx,dy]) => <button key={direction} className={`walk-${direction}`} aria-label={`Walk ${direction}`} onPointerDown={event => start(event, dx, dy)} onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={stop}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 3 4 11h4v6h4v-6h4z" fill="currentColor"/></svg></button>)}</div></div>;
}
