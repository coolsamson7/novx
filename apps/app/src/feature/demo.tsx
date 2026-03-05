/* eslint-disable @typescript-eslint/no-empty-function */
import { useEffect, useRef, useState } from "react";
import { Hands, Results } from "@mediapipe/hands";
import { Camera } from "@mediapipe/camera_utils";

// ═══════════════════════════════════════════════════════════════════════════════
// MATH UTILS
// ═══════════════════════════════════════════════════════════════════════════════

interface Vec2 { x: number; y: number; }

const V = {
  add:    (a: Vec2, b: Vec2): Vec2  => ({ x: a.x+b.x, y: a.y+b.y }),
  sub:    (a: Vec2, b: Vec2): Vec2  => ({ x: a.x-b.x, y: a.y-b.y }),
  scale:  (a: Vec2, s: number): Vec2 => ({ x: a.x*s, y: a.y*s }),
  len:    (a: Vec2): number          => Math.hypot(a.x, a.y),
  norm:   (a: Vec2): Vec2            => { const l=Math.hypot(a.x,a.y)||1; return {x:a.x/l,y:a.y/l}; },
  dot:    (a: Vec2, b: Vec2): number => a.x*b.x + a.y*b.y,
  lerp:   (a: Vec2, b: Vec2, t: number): Vec2 => ({ x:a.x+(b.x-a.x)*t, y:a.y+(b.y-a.y)*t }),
  clone:  (a: Vec2): Vec2           => ({ x: a.x, y: a.y }),
  zero:   (): Vec2                  => ({ x:0, y:0 }),
};

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)); }

/** Point-to-segment distance; also returns the closest point on the segment */
function ptSegClosest(p: Vec2, a: Vec2, b: Vec2): { dist: number; pt: Vec2 } {
  const ab = V.sub(b, a);
  const ap = V.sub(p, a);
  const len2 = V.dot(ab, ab);
  const t = len2 ? clamp(V.dot(ap, ab) / len2, 0, 1) : 0;
  const pt = V.add(a, V.scale(ab, t));
  return { dist: V.len(V.sub(p, pt)), pt };
}

// ═══════════════════════════════════════════════════════════════════════════════
// WEBCAM COVER-FIT
// ═══════════════════════════════════════════════════════════════════════════════

const VIDEO_W = 640, VIDEO_H = 480, VIDEO_ASP = VIDEO_W / VIDEO_H;

interface CoverParams { dW: number; dH: number; ox: number; oy: number; }

function coverParams(CW: number, CH: number): CoverParams {
  const cAsp = CW / CH;
  const dW = cAsp > VIDEO_ASP ? CW : CH * VIDEO_ASP;
  const dH = cAsp > VIDEO_ASP ? CW / VIDEO_ASP : CH;
  return { dW, dH, ox: (CW-dW)/2, oy: (CH-dH)/2 };
}

function drawVideoCover(
  ctx: CanvasRenderingContext2D,
  vid: HTMLVideoElement,
  CW: number, CH: number,
) {
  const { dW, dH, ox, oy } = coverParams(CW, CH);
  ctx.save(); ctx.translate(CW, 0); ctx.scale(-1, 1);
  ctx.drawImage(vid, CW - ox - dW, oy, dW, dH);
  ctx.restore();
}

function lmToCanvas(
  lm: { x: number; y: number },
  CW: number, CH: number,
): Vec2 {
  const { dW, dH, ox, oy } = coverParams(CW, CH);
  return { x: CW - (lm.x * dW + ox), y: lm.y * dH + oy };
}

// ═══════════════════════════════════════════════════════════════════════════════
// HAND TRACKER
// ═══════════════════════════════════════════════════════════════════════════════

const HAND_BONES: [number, number][] = [
  [0,1],[1,5],[5,9],[9,13],[13,17],[0,17],
  [1,2],[2,3],[3,4],
  [5,6],[6,7],[7,8],
  [9,10],[10,11],[11,12],
  [13,14],[14,15],[15,16],
  [17,18],[18,19],[19,20],
];

// Capsule radius per bone (palm = thicker)
function boneRadius(a: number, b: number) {
  return (a < 2 || b < 2 || (a === 5 && b === 9)) ? 22 : 16;
}

interface JointState {
  pos:  Vec2;
  vel:  Vec2;   // pixels/frame, smoothed
}

class HandTracker {
  pts:    Vec2[] | null = null;  // screen-space joint positions
  joints: JointState[] = Array.from({ length: 21 }, () => ({ pos: V.zero(), vel: V.zero() }));
  private prev: Vec2[] | null = null;

  update(raw: { x:number; y:number }[] | null, CW: number, CH: number) {
    if (!raw) {
      this.pts = null;
      this.prev = null;
      this.joints.forEach(j => { j.vel = V.zero(); });
      return;
    }
    this.pts = raw.map(lm => lmToCanvas(lm, CW, CH));

    this.pts.forEach((p, i) => {
      const j = this.joints[i];
      if (this.prev) {
        const raw_vel = V.sub(p, this.prev[i]);
        // Exponential smoothing: blend 40% new, 60% old
        j.vel = V.lerp(j.vel, raw_vel, 0.4);
      }
      j.pos = V.clone(p);
    });
    this.prev = this.pts.map(V.clone);
  }

  /**
   * Tests whether a circle (ball) overlaps any hand bone capsule.
   * Returns the closest joint index and its velocity, or null on miss.
   */
  testBall(ballPos: Vec2, ballR: number): { jointIdx: number; jointVel: Vec2 } | null {
    if (!this.pts) return null;
    let bestDist = Infinity;
    let bestJoint = -1;

    for (const [a, b] of HAND_BONES) {
      const capsR = boneRadius(a, b);
      const { dist, pt } = ptSegClosest(ballPos, this.pts[a], this.pts[b]);
      if (dist < ballR + capsR) {
        // Which endpoint is closer to the actual contact point?
        const da = V.len(V.sub(pt, this.pts[a]));
        const db = V.len(V.sub(pt, this.pts[b]));
        const closer = da < db ? a : b;
        if (dist < bestDist) { bestDist = dist; bestJoint = closer; }
      }
    }

    if (bestJoint < 0) return null;
    return { jointIdx: bestJoint, jointVel: V.clone(this.joints[bestJoint].vel) };
  }

  draw(ctx: CanvasRenderingContext2D) {
    if (!this.pts) return;
    const pts = this.pts;

    // Glow pass
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.lineCap = "round";
    for (const [a, b] of HAND_BONES) {
      ctx.strokeStyle = "rgba(40,160,255,0.09)";
      ctx.lineWidth = 32;
      ctx.beginPath();
      ctx.moveTo(pts[a].x, pts[a].y);
      ctx.lineTo(pts[b].x, pts[b].y);
      ctx.stroke();
    }
    ctx.globalCompositeOperation = "source-over";
    ctx.restore();

    // Bones — colour by speed of that bone's endpoints
    ctx.save();
    ctx.lineCap = "round";
    for (const [a, b] of HAND_BONES) {
      const spd = Math.max(V.len(this.joints[a].vel), V.len(this.joints[b].vel));
      const power = clamp(spd / 18, 0, 1);
      const hue = 200 - power * 160; // cyan → orange
      ctx.strokeStyle = `hsla(${hue},100%,${60 + power * 20}%,${0.78 + power * 0.15})`;
      ctx.lineWidth = (a < 2 || b < 2) ? 7 + power * 4 : 4.5 + power * 2;
      ctx.beginPath();
      ctx.moveTo(pts[a].x, pts[a].y);
      ctx.lineTo(pts[b].x, pts[b].y);
      ctx.stroke();
    }
    // Joints — bigger + brighter for fast-moving ones
    for (let i = 0; i < pts.length; i++) {
      const spd = V.len(this.joints[i].vel);
      const power = clamp(spd / 18, 0, 1);
      const hue = 200 - power * 160;
      ctx.beginPath();
      ctx.arc(pts[i].x, pts[i].y, i === 0 ? 7 + power*3 : 3.5 + power*3, 0, Math.PI * 2);
      ctx.fillStyle = `hsla(${hue},100%,90%,0.95)`;
      ctx.fill();
    }
    ctx.restore();
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// BASE GAME OBJECT
// ═══════════════════════════════════════════════════════════════════════════════

abstract class GameObject {
  alive = true;

  abstract update(dt: number): void;
  abstract draw(ctx: CanvasRenderingContext2D, t: number): void;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHYSICS OBJECT (extends GameObject)
// ═══════════════════════════════════════════════════════════════════════════════

abstract class PhysicsObject extends GameObject {
  pos: Vec2;
  vel: Vec2;

  constructor(pos: Vec2, vel: Vec2) {
    super();
    this.pos = V.clone(pos);
    this.vel = V.clone(vel);
  }

  applyGravity(g: number) { this.vel.y += g; }

  move() {
    this.pos.x += this.vel.x;
    this.pos.y += this.vel.y;
  }

  capSpeed(max: number) {
    const s = V.len(this.vel);
    if (s > max) this.vel = V.scale(this.vel, max / s);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PARTICLE (extends PhysicsObject)
// ═══════════════════════════════════════════════════════════════════════════════

class Particle extends PhysicsObject {
  life    = 1.0;
  decay:  number;
  size:   number;
  color:  string;

  constructor(pos: Vec2, vel: Vec2, color: string, size: number, decay = 0.036) {
    super(pos, vel);
    this.color = color;
    this.size  = size;
    this.decay = decay;
  }

  update(dt: number) {
    this.applyGravity(0.32);
    this.move();
    this.life -= this.decay;
    if (this.life <= 0) this.alive = false;
  }

  draw(ctx: CanvasRenderingContext2D, _t: number) {
    ctx.beginPath();
    ctx.arc(this.pos.x, this.pos.y, Math.max(0, this.size * this.life), 0, Math.PI * 2);
    ctx.fillStyle = this.color + Math.floor(this.life * 255).toString(16).padStart(2, "0");
    ctx.fill();
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPLOSION RING (extends PhysicsObject — zero vel, just expands)
// ═══════════════════════════════════════════════════════════════════════════════

class ExplosionRing extends PhysicsObject {
  r:     number;
  maxR:  number;
  life   = 1.0;
  color: string;

  constructor(pos: Vec2, startR: number, maxR: number, color: string) {
    super(pos, V.zero());
    this.r = startR; this.maxR = maxR; this.color = color;
  }

  update(_dt: number) {
    this.r += (this.maxR - this.r) * 0.14;
    this.life -= 0.044;
    if (this.life <= 0) this.alive = false;
  }

  draw(ctx: CanvasRenderingContext2D, _t: number) {
    ctx.beginPath();
    ctx.arc(this.pos.x, this.pos.y, this.r, 0, Math.PI * 2);
    ctx.strokeStyle = this.color + Math.floor(this.life * 200).toString(16).padStart(2, "0");
    ctx.lineWidth   = 4 * this.life;
    ctx.stroke();
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FLOAT TEXT (extends GameObject)
// ═══════════════════════════════════════════════════════════════════════════════

class FloatText extends GameObject {
  pos:   Vec2;
  text:  string;
  color: string;
  size:  number;
  life  = 1.0;

  constructor(pos: Vec2, text: string, color: string, size = 22) {
    super();
    this.pos = V.clone(pos);
    this.text = text; this.color = color; this.size = size;
  }

  update(_dt: number) {
    this.pos.y -= 1.4;
    this.life  -= 0.02;
    if (this.life <= 0) this.alive = false;
  }

  draw(ctx: CanvasRenderingContext2D, _t: number) {
    ctx.save();
    ctx.globalAlpha = this.life;
    ctx.font = `bold ${this.size}px 'Arial Black',Arial`;
    ctx.textAlign = "center";
    ctx.strokeStyle = "rgba(0,0,0,0.85)";
    ctx.lineWidth   = 4.5;
    ctx.strokeText(this.text, this.pos.x, this.pos.y);
    ctx.fillStyle = this.color;
    ctx.fillText(this.text, this.pos.x, this.pos.y);
    ctx.restore();
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// BALL (extends PhysicsObject)
// ═══════════════════════════════════════════════════════════════════════════════

type BallKind = "normal" | "golden" | "danger";

let _ballId = 0;

class Ball extends PhysicsObject {
  id:          number;
  kind:        BallKind;
  r:           number;
  angle        = 0;
  spin:        number;
  hitCooldown  = 0;   // frames before can be hit again
  glowFrames   = 0;   // frames since last deflection (for hit glow)
  dangerFrames = 0;   // frames spent in danger zone

  constructor(pos: Vec2, vel: Vec2, kind: BallKind, r = 26) {
    super(pos, vel);
    this.id   = ++_ballId;
    this.kind = kind;
    this.r    = r;
    this.spin = (Math.random() - 0.5) * 0.07;
  }

  /** Satisfies the abstract base; Game calls tick() directly with all context. */
  update(_dt: number) { /* no-op: use tick() */ }

  tick(gravity: number, maxSpeed: number, CW: number, CH: number, dzY: number) {
    this.hitCooldown  = Math.max(0, this.hitCooldown - 1);
    this.glowFrames   = Math.max(0, this.glowFrames  - 1);

    this.applyGravity(gravity);
    this.capSpeed(maxSpeed);
    this.move();
    this.angle += this.spin;

    // Wall bounce
    if (this.pos.x - this.r < 0)    { this.pos.x = this.r;    this.vel.x =  Math.abs(this.vel.x); }
    if (this.pos.x + this.r > CW)   { this.pos.x = CW - this.r; this.vel.x = -Math.abs(this.vel.x); }
    if (this.pos.y - this.r < 0)    { this.pos.y = this.r;    this.vel.y =  Math.abs(this.vel.y) * 0.8; }

    // Danger zone tracking
    this.dangerFrames = (this.pos.y + this.r > dzY) ? this.dangerFrames + 1 : 0;
  }

  /**
   * Apply a deflection impulse driven entirely by the hitting joint's velocity.
   * The faster and more directional the joint moves, the harder and more
   * precisely the ball flies. Slow/static touch = gentle upward pop.
   */
  deflect(jointVel: Vec2, _CW: number, _CH: number) {
    const speed = V.len(jointVel);

    if (speed > 1.5) {
      // Full momentum transfer: scale so fast swipes = powerful shots
      const scale = clamp(speed * 0.9, 3, 22) / speed;
      this.vel.x  = jointVel.x * scale + (Math.random() - 0.5) * 0.8;
      this.vel.y  = jointVel.y * scale;
    } else {
      // Nearly-stationary hand: small upward pop
      this.vel.x  = this.vel.x * 0.35 + (Math.random() - 0.5) * 2;
      this.vel.y  = -4 - Math.random() * 3;
    }

    // Guarantee at least a small upward component so ball never sticks
    if (this.vel.y > -1.5) this.vel.y = -1.5 - Math.random() * 2;

    this.hitCooldown = 20;
    this.glowFrames  = 50;
  }

  get isPowerShottable(): boolean { return true; }

  draw(ctx: CanvasRenderingContext2D, t: number) {
    if      (this.kind === "golden") drawGoldenBall(ctx, this.pos, this.r, t);
    else if (this.kind === "danger") drawDangerBall(ctx, this.pos, this.r, t);
    else                             drawNormalBall(ctx, this.pos, this.r, this.angle, this.glowFrames / 45);
  }
}

// ─── Ball visual helpers ──────────────────────────────────────────────────────

function pentagon(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = (i * Math.PI * 2) / 5 - Math.PI / 2;
    i ? ctx.lineTo(cx + Math.cos(a)*r, cy + Math.sin(a)*r)
      : ctx.moveTo(cx + Math.cos(a)*r, cy + Math.sin(a)*r);
  }
  ctx.closePath(); ctx.fill();
}

function drawNormalBall(ctx: CanvasRenderingContext2D, pos: Vec2, r: number, angle: number, glow: number) {
  if (glow > 0) {
    const g2 = ctx.createRadialGradient(pos.x, pos.y, r*.4, pos.x, pos.y, r*2.6);
    g2.addColorStop(0, `rgba(100,200,255,${glow * 0.55})`);
    g2.addColorStop(1, "rgba(100,200,255,0)");
    ctx.fillStyle = g2; ctx.beginPath(); ctx.arc(pos.x, pos.y, r*2.6, 0, Math.PI*2); ctx.fill();
  }
  ctx.save(); ctx.translate(pos.x, pos.y); ctx.rotate(angle);
  ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI*2); ctx.clip();
  const g = ctx.createRadialGradient(-r*.3,-r*.3,r*.04,0,0,r);
  g.addColorStop(0,"#fff"); g.addColorStop(.6,"#ddd"); g.addColorStop(1,"#888");
  ctx.fillStyle = g; ctx.fillRect(-r,-r,r*2,r*2);
  ctx.fillStyle = "#111"; pentagon(ctx,0,0,r*.37);
  for (let i = 0; i < 5; i++) {
    const a = (i*Math.PI*2)/5 - Math.PI/2;
    pentagon(ctx, Math.cos(a)*r*.71, Math.sin(a)*r*.71, r*.32);
  }
  const hl = ctx.createRadialGradient(-r*.3,-r*.3,0,-r*.3,-r*.3,r*.5);
  hl.addColorStop(0,"rgba(255,255,255,.65)"); hl.addColorStop(1,"rgba(255,255,255,0)");
  ctx.fillStyle = hl; ctx.fillRect(-r,-r,r*2,r*2);
  ctx.restore();
}

function drawGoldenBall(ctx: CanvasRenderingContext2D, pos: Vec2, r: number, t: number) {
  const pulse = .65 + .35*Math.sin(t*.09);
  const glow = ctx.createRadialGradient(pos.x,pos.y,r*.5,pos.x,pos.y,r*2.5);
  glow.addColorStop(0,`rgba(255,220,0,${.55*pulse})`); glow.addColorStop(1,"rgba(255,200,0,0)");
  ctx.fillStyle=glow; ctx.beginPath(); ctx.arc(pos.x,pos.y,r*2.5,0,Math.PI*2); ctx.fill();
  ctx.save(); ctx.translate(pos.x, pos.y);
  ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2); ctx.clip();
  const g=ctx.createRadialGradient(-r*.3,-r*.3,r*.04,0,0,r);
  g.addColorStop(0,"#fff8a0"); g.addColorStop(.4,"#ffd700"); g.addColorStop(.85,"#b8860b"); g.addColorStop(1,"#7a5900");
  ctx.fillStyle=g; ctx.fillRect(-r,-r,r*2,r*2);
  ctx.strokeStyle="rgba(255,255,160,.38)"; ctx.lineWidth=1.5;
  for (let i=0;i<6;i++){
    const a=(i*Math.PI)/3+t*.014;
    ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(Math.cos(a)*r,Math.sin(a)*r); ctx.stroke();
  }
  const hl=ctx.createRadialGradient(-r*.28,-r*.32,0,-r*.28,-r*.32,r*.42);
  hl.addColorStop(0,"rgba(255,255,255,.78)"); hl.addColorStop(1,"rgba(255,255,255,0)");
  ctx.fillStyle=hl; ctx.fillRect(-r,-r,r*2,r*2);
  ctx.restore();
  ctx.save(); ctx.translate(pos.x, pos.y);
  ctx.font=`bold ${r*.6}px 'Arial Black',Arial`; ctx.textAlign="center"; ctx.textBaseline="middle";
  ctx.strokeStyle="#7a5900"; ctx.lineWidth=3; ctx.strokeText("+50",0,1);
  ctx.fillStyle="#fff"; ctx.fillText("+50",0,1);
  ctx.restore();
}

function drawDangerBall(ctx: CanvasRenderingContext2D, pos: Vec2, r: number, t: number) {
  const pulse = .5+.5*Math.sin(t*.18);
  const glow=ctx.createRadialGradient(pos.x,pos.y,r*.3,pos.x,pos.y,r*2.6);
  glow.addColorStop(0,`rgba(255,0,40,${.6*pulse})`); glow.addColorStop(1,"rgba(255,0,40,0)");
  ctx.fillStyle=glow; ctx.beginPath(); ctx.arc(pos.x,pos.y,r*2.6,0,Math.PI*2); ctx.fill();
  ctx.save(); ctx.translate(pos.x,pos.y); ctx.rotate(t*.03);
  ctx.fillStyle=`rgba(255,${40+Math.floor(pulse*60)},0,.9)`;
  for (let i=0;i<8;i++){
    const a=(i*Math.PI*2)/8;
    ctx.beginPath(); ctx.moveTo(Math.cos(a)*r,Math.sin(a)*r);
    ctx.lineTo(Math.cos(a+.2)*(r*.6),Math.sin(a+.2)*(r*.6));
    ctx.lineTo(Math.cos(a+.4)*r,Math.sin(a+.4)*r);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
  ctx.save(); ctx.translate(pos.x,pos.y);
  ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2); ctx.clip();
  const g=ctx.createRadialGradient(-r*.25,-r*.25,r*.04,0,0,r);
  g.addColorStop(0,"#ff4444"); g.addColorStop(.5,"#cc0000"); g.addColorStop(1,"#440000");
  ctx.fillStyle=g; ctx.fillRect(-r,-r,r*2,r*2);
  ctx.strokeStyle=`rgba(255,200,0,${.4+pulse*.3})`; ctx.lineWidth=3;
  for (let i=-3;i<=3;i++){
    ctx.beginPath(); ctx.moveTo(i*r*.6-r,r); ctx.lineTo(i*r*.6+r,-r); ctx.stroke();
  }
  const hl=ctx.createRadialGradient(-r*.28,-r*.32,0,-r*.28,-r*.32,r*.38);
  hl.addColorStop(0,"rgba(255,180,180,.4)"); hl.addColorStop(1,"rgba(255,255,255,0)");
  ctx.fillStyle=hl; ctx.fillRect(-r,-r,r*2,r*2);
  ctx.restore();
  ctx.font=`${r*.85}px serif`; ctx.textAlign="center"; ctx.textBaseline="middle";
  ctx.fillText("💀",pos.x,pos.y+2);
}

// ═══════════════════════════════════════════════════════════════════════════════
// BASKET  (moves horizontally near the top, catches balls)
// ═══════════════════════════════════════════════════════════════════════════════

class Basket {
  x:      number;   // centre x
  y:      number;   // centre y (top area)
  width   = 90;     // opening width
  height  = 50;     // visual depth
  speed:  number;
  dir     = 1;
  // Flash state when a ball is scored
  flashFrames  = 0;
  shakeX       = 0;
  shakeY       = 0;

  constructor(CW: number, CH: number) {
    this.x     = CW / 2;
    this.y     = CH * 0.10 + this.height / 2;
    this.speed = 1.8;
  }

  update(dt: number, CW: number, CH: number, elapsed: number) {
    // Speed ramps up with difficulty
    this.speed = 1.8 + elapsed * 0.04;
    this.y     = CH * 0.10 + this.height / 2; // track resize

    const margin = this.width / 2 + 10;
    this.x += this.dir * this.speed * (dt / 16);
    if (this.x > CW - margin) { this.x = CW - margin; this.dir = -1; }
    if (this.x < margin)      { this.x = margin;       this.dir =  1; }

    this.flashFrames = Math.max(0, this.flashFrames - 1);
    if (this.flashFrames > 0) {
      this.shakeX = (Math.random() - 0.5) * 6 * (this.flashFrames / 30);
      this.shakeY = (Math.random() - 0.5) * 4 * (this.flashFrames / 30);
    } else {
      this.shakeX = 0; this.shakeY = 0;
    }
  }

  /** Returns true when ball centre crosses into the basket opening from below */
  catches(ball: Ball): boolean {
    const bx = ball.pos.x, by = ball.pos.y;
    const rim = this.rimY;
    // Ball must be moving upward and crossing the rim line
    if (ball.vel.y >= 0) return false;
    const halfW = this.width / 2 - ball.r * 0.3;
    return Math.abs(bx - this.cx) < halfW && Math.abs(by - rim) < ball.r + 6;
  }

  /** Trigger the score flash */
  score() {
    this.flashFrames = 40;
  }

  get cx()   { return this.x + this.shakeX; }
  get rimY() { return this.y + this.shakeY - this.height / 2; }

  draw(ctx: CanvasRenderingContext2D, t: number) {
    const cx   = this.cx;
    const rimY = this.rimY;
    const w    = this.width;
    const h    = this.height;
    const flash = this.flashFrames / 40;

    // Glow halo when flashing
    if (flash > 0) {
      const pulse = flash * (0.7 + 0.3 * Math.sin(t * 0.4));
      const g = ctx.createRadialGradient(cx, rimY + h/2, 10, cx, rimY + h/2, w);
      g.addColorStop(0, `rgba(255,220,0,${pulse * 0.7})`);
      g.addColorStop(1, "rgba(255,220,0,0)");
      ctx.fillStyle = g;
      ctx.fillRect(cx - w, rimY - 10, w * 2, h + 20);
    }

    // Back net (drawn first so rim appears in front)
    ctx.save();
    ctx.beginPath();
    // Trapezoid net: wide at top, slightly narrower at bottom
    ctx.moveTo(cx - w/2, rimY);
    ctx.lineTo(cx + w/2, rimY);
    ctx.lineTo(cx + w/2 - 8, rimY + h);
    ctx.lineTo(cx - w/2 + 8, rimY + h);
    ctx.closePath();
    ctx.strokeStyle = flash > 0
      ? `rgba(255,220,80,${0.55 + flash * 0.4})`
      : "rgba(180,140,60,0.55)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Net grid lines
    for (let i = 1; i < 4; i++) {
      const py = rimY + (h / 4) * i;
      const shrink = (i / 4) * 8;
      ctx.beginPath();
      ctx.moveTo(cx - w/2 + shrink, py);
      ctx.lineTo(cx + w/2 - shrink, py);
      ctx.stroke();
    }
    for (let i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(cx + (w/5)*i, rimY);
      ctx.lineTo(cx + (w/5)*i - 4, rimY + h);
      ctx.stroke();
    }
    ctx.restore();

    // Left rim post
    ctx.save();
    ctx.lineWidth   = 6;
    ctx.lineCap     = "round";
    const rimColor  = flash > 0
      ? `hsl(${45 + flash*20},100%,${55 + flash*20}%)`
      : "#c8a820";
    ctx.strokeStyle = rimColor;
    ctx.shadowColor = flash > 0 ? "#ffe066" : "transparent";
    ctx.shadowBlur  = flash > 0 ? 16 * flash : 0;

    // Left rim
    ctx.beginPath();
    ctx.moveTo(cx - w/2 - 4, rimY - 2);
    ctx.lineTo(cx - w/2 + 12, rimY - 2);
    ctx.stroke();
    // Right rim
    ctx.beginPath();
    ctx.moveTo(cx + w/2 + 4, rimY - 2);
    ctx.lineTo(cx + w/2 - 12, rimY - 2);
    ctx.stroke();

    // Rim arc (the actual hoop)
    ctx.beginPath();
    ctx.ellipse(cx, rimY, w/2, 7, 0, 0, Math.PI * 2);
    ctx.strokeStyle = rimColor;
    ctx.lineWidth   = 5;
    ctx.stroke();

    ctx.restore();

    // Backboard above rim
    ctx.save();
    ctx.fillStyle = flash > 0
      ? `rgba(255,240,160,${0.18 + flash*0.2})`
      : "rgba(255,255,255,0.08)";
    ctx.strokeStyle = flash > 0 ? `rgba(255,220,60,${0.6+flash*0.3})` : "rgba(255,255,255,0.2)";
    ctx.lineWidth   = 2;
    ctx.beginPath();
    ctx.roundRect(cx - w/2 - 16, rimY - 44, w + 32, 42, 4);
    ctx.fill();
    ctx.stroke();
    ctx.restore();

    // Arrow hint (pulses to attract player attention)
    if (flash === 0) {
      const alpha = 0.35 + 0.2 * Math.sin(t * 0.07);
      ctx.save();
      ctx.fillStyle = `rgba(255,220,60,${alpha})`;
      ctx.font = "bold 16px Arial";
      ctx.textAlign = "center";
      ctx.fillText("▼ AIM HERE ▼", cx, rimY - 50);
      ctx.restore();
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PARTICLE SYSTEM
// ═══════════════════════════════════════════════════════════════════════════════

class ParticleSystem {
  private particles:  Particle[]      = [];
  private rings:      ExplosionRing[] = [];
  private floatTexts: FloatText[]     = [];

  emit(pos: Vec2, color: string, count = 12, speedMult = 1) {
    for (let i = 0; i < count; i++) {
      const a = (Math.PI*2*i)/count + Math.random()*.5;
      const s = (2 + Math.random()*5) * speedMult;
      this.particles.push(new Particle(
        V.clone(pos),
        { x: Math.cos(a)*s, y: Math.sin(a)*s - 2 },
        color, 3 + Math.random()*5,
      ));
    }
  }

  explode(pos: Vec2, colors: string[]) {
    colors.forEach((c, i) => {
      this.rings.push(new ExplosionRing(V.clone(pos), 13, 26*(2.5+i*1.2), c));
    });
    for (let i = 0; i < 30; i++) {
      const a = Math.random()*Math.PI*2, s = 3+Math.random()*10;
      this.particles.push(new Particle(
        V.clone(pos),
        { x: Math.cos(a)*s, y: Math.sin(a)*s - 4 },
        colors[Math.floor(Math.random()*colors.length)],
        4 + Math.random()*7,
      ));
    }
  }

  /** Big celebratory firework burst — used when basket scores */
  firework(pos: Vec2, colors: string[]) {
    // Multiple rings
    colors.forEach((c, i) => {
      this.rings.push(new ExplosionRing(V.clone(pos), 8, 22 * (2 + i * 1.3), c));
    });
    // Streaking star particles
    for (let i = 0; i < 50; i++) {
      const a  = (Math.PI * 2 * i) / 50 + Math.random() * 0.15;
      const s  = 4 + Math.random() * 14;
      const c  = colors[Math.floor(Math.random() * colors.length)];
      this.particles.push(new Particle(
        V.clone(pos),
        { x: Math.cos(a) * s, y: Math.sin(a) * s - 3 },
        c, 5 + Math.random() * 7, 0.022,
      ));
    }
  }

  floatText(pos: Vec2, text: string, color: string, size = 22) {
    this.floatTexts.push(new FloatText(V.clone(pos), text, color, size));
  }

  update(dt: number) {
    this.particles  = this.particles .filter(p => { p.update(dt); return p.alive; });
    this.rings      = this.rings     .filter(r => { r.update(dt); return r.alive; });
    this.floatTexts = this.floatTexts.filter(f => { f.update(dt); return f.alive; });
  }

  draw(ctx: CanvasRenderingContext2D, t: number) {
    this.rings     .forEach(r => r.draw(ctx, t));
    this.particles .forEach(p => p.draw(ctx, t));
    this.floatTexts.forEach(f => f.draw(ctx, t));
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GAME CONTROLLER
// ═══════════════════════════════════════════════════════════════════════════════

type GamePhase = "idle" | "playing" | "gameover";

const MAX_LIVES     = 3;
const DANGER_ZONE   = 0.22; // bottom fraction of canvas
const BALL_R        = 26;

class Game {
  phase:       GamePhase  = "idle";
  score        = 0;
  lives        = MAX_LIVES;
  combo        = 0;
  comboTimer   = 0;        // ms remaining on combo window
  deflections  = 0;
  elapsed      = 0;        // seconds since start
  balls:       Ball[]     = [];
  basket:      Basket | null = null;
  fx:          ParticleSystem;
  spawnTimer   = 0;        // seconds until next auto-spawn

  // Callbacks to push to React state
  onScore:    (s: number) => void = () => {};
  onLives:    (l: number) => void = () => {};
  onGameOver: (s: number, d: number) => void = () => {};
  onNewBall:  (n: number) => void = () => {};

  constructor() { this.fx = new ParticleSystem(); }

  // ── Difficulty ────────────────────────────────────────────────────────────
  get gravity()     { return 0.25 + this.elapsed * 0.005; }
  get maxBallSpeed(){ return 8   + this.elapsed * 0.12; }
  get spawnEvery()  { return Math.max(14 - this.elapsed * 0.12, 5); }
  get maxBalls()    { return Math.min(2 + Math.floor(this.elapsed / 14), 7); }

  // ── Setup ─────────────────────────────────────────────────────────────────
  start() {
    this.phase      = "playing";
    this.score      = 0;
    this.lives      = MAX_LIVES;
    this.combo      = 0;
    this.comboTimer = 0;
    this.deflections= 0;
    this.elapsed    = 0;
    this.spawnTimer = this.spawnEvery;
    this.balls      = [];
    this.fx         = new ParticleSystem();
    this.basket     = new Basket(800, 600); // real size set on first update
    this.onScore(0); this.onLives(MAX_LIVES);
    this.spawnBall("normal");
    this.spawnBall("normal");
  }

  private spawnBall(kind?: BallKind, CW = 800, CH = 600): Ball {
    const k: BallKind = kind ?? (
      Math.random() < .12 ? "danger" : Math.random() < .18 ? "golden" : "normal"
    );
    const speed = this.maxBallSpeed * (.6 + Math.random() * .4);
    const angle = Math.random() * Math.PI * 2;
    const b = new Ball(
      { x: BALL_R + 20 + Math.random() * (CW - BALL_R*2 - 40), y: BALL_R + 10 + Math.random() * CH * .28 },
      { x: Math.cos(angle)*speed, y: Math.sin(angle)*speed },
      k, BALL_R,
    );
    this.balls.push(b);
    this.onNewBall(this.balls.length);
    return b;
  }

  // ── Per-frame update ──────────────────────────────────────────────────────
  update(dt: number, hand: HandTracker, CW: number, CH: number) {
    if (this.phase !== "playing") return;

    this.elapsed    += dt / 1000;
    this.comboTimer -= dt;
    if (this.comboTimer <= 0) this.combo = 0;

    // Update basket
    if (!this.basket) this.basket = new Basket(CW, CH);
    this.basket.update(dt, CW, CH, this.elapsed);

    // Auto-spawn
    this.spawnTimer -= dt / 1000;
    if (this.spawnTimer <= 0 && this.balls.length < this.maxBalls) {
      this.spawnBall(undefined, CW, CH);
      this.spawnTimer = this.spawnEvery;
      this.fx.floatText({ x: CW/2, y: CH*.38 }, "NEW BALL!", "#ff6600", 28);
    }

    const dzY = CH * (1 - DANGER_ZONE);
    const dead: Ball[] = [];

    this.balls.forEach(b => {
      b.tick(this.gravity, this.maxBallSpeed, CW, CH, dzY);

      // Basket catch (ball enters hoop from below while moving upward)
      if (this.basket && this.basket.catches(b)) {
        this.onBasketScore(b, CW, CH);
        dead.push(b);
        return;
      }

      // Ground death
      if (b.pos.y - b.r > CH + 10) { dead.push(b); return; }

      // Hand collision (only when cooldown expired)
      if (b.hitCooldown === 0) {
        const hit = hand.testBall(b.pos, b.r);
        if (hit) {
          this.onDeflect(b, hit.jointIdx, hit.jointVel, CW);
        }
      }
    });

    dead.forEach(b => this.onBallDied(b, CW, CH));
    this.balls = this.balls.filter(b => !dead.includes(b));

    this.fx.update(dt);
  }

  private onBasketScore(b: Ball, CW: number, CH: number) {
    this.combo++;
    this.comboTimer = 2500;

    const base  = b.kind === "golden" ? 200 : b.kind === "danger" ? 150 : 100;
    const total = base * Math.max(1, this.combo);
    this.score += total;
    this.onScore(this.score);

    const bpos = V.clone(b.pos);
    const bx   = this.basket!.cx;
    const rimY = this.basket!.rimY;

    this.basket!.score();

    // Big firework at basket position
    const cols = b.kind === "golden"
      ? ["#ffd700","#fff8a0","#ffaa00","#fff"]
      : b.kind === "danger"
      ? ["#ff0040","#ff8800","#ffff00","#fff"]
      : ["#00e5ff","#76ff03","#ffd700","#fff"];

    this.fx.firework({ x: bx, y: rimY }, cols);
    // Second burst slightly higher for drama
    setTimeout(() => {
      if (this.phase === "playing")
        this.fx.firework({ x: bx + (Math.random()-0.5)*60, y: rimY - 40 }, cols);
    }, 120);

    const label = this.combo > 1
      ? `🏀 BASKET! ×${this.combo}  +${total}`
      : `🏀 BASKET!  +${total}`;
    this.fx.floatText({ x: bx, y: rimY - 20 }, label, "#ffd700", 32);

    // Respawn a new ball after a short delay
    setTimeout(() => {
      if (this.phase === "playing") this.spawnBall(undefined, CW, CH);
    }, 1000);
  }

  private onDeflect(b: Ball, jointIdx: number, jointVel: Vec2, CW: number) {
    const speed     = V.len(jointVel);
    const isPower   = speed > 10;
    const jointName = this.jointName(jointIdx);

    b.deflect(jointVel, CW, 0);
    this.deflections++;
    this.combo++;
    this.comboTimer = 1800;

    let pts = b.kind === "golden" ? 50 : b.kind === "danger" ? 30 : 10;
    pts *= Math.max(1, this.combo);
    this.score += pts;
    this.onScore(this.score);

    // Power bar display: show speed as filled blocks
    const bars     = Math.min(Math.round(speed / 3), 5);
    const barStr   = "█".repeat(bars) + "░".repeat(5 - bars);
    const color    = b.kind === "golden" ? "#ffd700" : b.kind === "danger" ? "#ff4444" : "#60c8ff";
    const prefix   = isPower ? `💨 ${jointName}` : jointName;
    const label    = this.combo > 1
      ? `${prefix} [${barStr}] ×${this.combo} +${pts}`
      : `${prefix} [${barStr}] +${pts}`;

    this.fx.floatText(V.add(b.pos, {x:0, y:-44}), label, this.combo > 3 ? "#ffd700" : color, isPower ? 22 : 19);

    const c = b.kind === "golden" ? "#ffd700" : b.kind === "danger" ? "#ff0040" : "#60c8ff";
    this.fx.emit(b.pos, c, isPower ? 18 : 10, isPower ? 2.0 : 1);
  }

  private onBallDied(b: Ball, CW: number, CH: number) {
    this.lives = Math.max(0, this.lives - 1);
    this.combo = 0;
    this.onLives(this.lives);

    const cols = b.kind === "danger"
      ? ["#ff0040","#ff4400","#ff8800","#ffff00"]
      : ["#ff8c00","#ff4400","#ffcc00","#ff6600"];
    this.fx.explode({ x: b.pos.x, y: CH - 20 }, cols);
    this.fx.floatText(
      { x: b.pos.x, y: CH - 60 },
      b.kind === "danger" ? "💀 −1 LIFE!" : "😱 −1 LIFE",
      "#ff2244", 28,
    );

    if (this.lives <= 0) {
      this.phase = "gameover";
      this.onGameOver(this.score, this.deflections);
    } else {
      setTimeout(() => {
        if (this.phase === "playing") this.spawnBall(b.kind === "golden" ? "normal" : b.kind, CW, CH);
      }, 1200);
    }
  }

  /** Human-readable name for a joint index */
  private jointName(idx: number): string {
    if (idx === 0)                    return "Palm";
    if (idx >= 1  && idx <= 4)        return ["","Thumb","Thumb","Thumb tip","Thumb tip"][idx];
    if (idx >= 5  && idx <= 8)        return idx === 8 ? "Index tip" : "Index";
    if (idx >= 9  && idx <= 12)       return idx === 12 ? "Middle tip" : "Middle";
    if (idx >= 13 && idx <= 16)       return idx === 16 ? "Ring tip" : "Ring";
    return idx === 20 ? "Pinky tip" : "Pinky";
  }

  // ── Danger zone check ─────────────────────────────────────────────────────
  anyInDangerZone(CH: number): boolean {
    return this.balls.some(b => b.pos.y + b.r > CH * (1 - DANGER_ZONE));
  }

  // ── Draw ──────────────────────────────────────────────────────────────────
  draw(ctx: CanvasRenderingContext2D, t: number, CW: number, CH: number) {
    const dzY = CH * (1 - DANGER_ZONE);

    // Danger zone overlay
    if (this.anyInDangerZone(CH)) {
      const pulse = .3 + .25*Math.sin(t*.15);
      const dg = ctx.createLinearGradient(0, dzY, 0, CH);
      dg.addColorStop(0, "rgba(255,0,0,0)");
      dg.addColorStop(.4, `rgba(255,0,0,${pulse})`);
      dg.addColorStop(1, `rgba(255,60,0,${pulse+.1})`);
      ctx.fillStyle = dg; ctx.fillRect(0, dzY, CW, CH-dzY);
    }

    // Danger zone dashed line
    ctx.strokeStyle = "rgba(255,0,0,0.28)"; ctx.lineWidth = 1;
    ctx.setLineDash([6,4]);
    ctx.beginPath(); ctx.moveTo(0, dzY); ctx.lineTo(CW, dzY); ctx.stroke();
    ctx.setLineDash([]);

    // Basket (draw before balls so balls appear in front of net)
    this.basket?.draw(ctx, t);

    // Balls
    this.balls.forEach(b => {
      // Red warning ring for balls close to the ground
      if (b.dangerFrames > 0 && b.dangerFrames % 6 < 3) {
        ctx.beginPath();
        ctx.arc(b.pos.x, b.pos.y, b.r + 5 + b.dangerFrames * .04, 0, Math.PI*2);
        ctx.strokeStyle = `rgba(255,0,0,${clamp(.3 + b.dangerFrames*.004, 0, 0.9)})`;
        ctx.lineWidth = 3; ctx.stroke();
      }
      b.draw(ctx, t);
    });

    // Particles / rings / float texts
    this.fx.draw(ctx, t);

    // HUD
    if (this.phase === "playing") this.drawHUD(ctx, t, CW, CH, dzY);
    if (this.phase !== "playing") {
      ctx.fillStyle = "rgba(0,0,0,0.45)"; ctx.fillRect(0, 0, CW, CH);
    }
  }

  private drawHUD(ctx: CanvasRenderingContext2D, t: number, CW: number, CH: number, dzY: number) {
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    ctx.fillRect(0, 0, CW, 52);

    // Lives
    ctx.font = "26px serif";
    for (let i = 0; i < MAX_LIVES; i++) {
      ctx.globalAlpha = i < this.lives ? 1 : 0.22;
      ctx.fillText("❤️", 16 + i*34, 36);
    }
    ctx.globalAlpha = 1;

    // Score (centre)
    ctx.fillStyle = "#fff"; ctx.font = "bold 22px 'Arial Black',Arial"; ctx.textAlign = "center";
    ctx.fillText(`🏀 ${this.score}`, CW/2, 34);

    // Difficulty + deflections (right)
    const pct = Math.min(this.elapsed / 60, 1);
    ctx.fillStyle = `rgba(255,${Math.floor(200 - pct*160)},0,0.85)`;
    ctx.font = "bold 11px Arial"; ctx.textAlign = "right";
    ctx.fillText(`${this.balls.length} BALLS  ⚡${Math.round(pct*100)}%`, CW-14, 22);
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.fillText(`${this.deflections} hits`, CW-14, 38);

    // Combo
    if (this.combo > 1) {
      ctx.textAlign = "center"; ctx.fillStyle = "#ffd700";
      ctx.font = `bold ${Math.min(18 + this.combo*1.8, 32)}px 'Arial Black',Arial`;
      ctx.shadowColor = "#ffd700"; ctx.shadowBlur = 16;
      ctx.fillText(`🔥 COMBO ×${this.combo}`, CW/2 + 70, 34);
      ctx.shadowBlur = 0;
    }

    // Danger warning text
    if (this.anyInDangerZone(CH) && t % 20 < 10) {
      ctx.fillStyle = `rgba(255,30,30,${.7+.3*Math.sin(t*.3)})`;
      ctx.font = "bold 18px 'Arial Black',Arial"; ctx.textAlign = "left";
      ctx.fillText("⚠ DANGER ZONE", 14, CH-8);
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// REACT COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export const DemoView = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef     = useRef<HTMLVideoElement>(null);
  const canvasRef    = useRef<HTMLCanvasElement>(null);

  const [phase, setPhase]           = useState<GamePhase>("idle");
  const [lives, setLives]           = useState(MAX_LIVES);
  const [score, setScore]           = useState(0);
  const [finalScore, setFinalScore] = useState(0);
  const [finalDefl, setFinalDefl]   = useState(0);

  const gameRef = useRef<Game | null>(null);
  const startRef= useRef<(() => void) | null>(null);

  useEffect(() => {
    const container = containerRef.current!;
    const canvas    = canvasRef.current!;
    const ctx       = canvas.getContext("2d")!;

    let CW = container.clientWidth  || 900;
    let CH = container.clientHeight || 600;
    canvas.width = CW; canvas.height = CH;

    // ── Game instance ─────────────────────────────────────────────────────
    const game = new Game();
    gameRef.current = game;

    game.onScore    = s => setScore(s);
    game.onLives    = l => setLives(l);
    game.onGameOver = (s, d) => { setFinalScore(s); setFinalDefl(d); setPhase("gameover"); };
    game.onNewBall  = () => {};

    startRef.current = () => {
      game.start();
      setPhase("playing"); setScore(0); setLives(MAX_LIVES);
    };

    // ── Hand tracker ──────────────────────────────────────────────────────
    const hand = new HandTracker();

    const hands = new Hands({
      locateFile: f => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${f}`,
    });
    hands.setOptions({ maxNumHands:1, modelComplexity:1,
      minDetectionConfidence:.7, minTrackingConfidence:.7 });
    hands.onResults((r: Results) => {
      hand.update(r.multiHandLandmarks?.[0] ?? null, CW, CH);
    });

    if (videoRef.current) {
      const cam = new Camera(videoRef.current, {
        onFrame: async () => { if(videoRef.current) await hands.send({image:videoRef.current}); },
        width: VIDEO_W, height: VIDEO_H,
      });
      cam.start();
    }

    // ── Resize ────────────────────────────────────────────────────────────
    const ro = new ResizeObserver(() => {
      CW = container.clientWidth; CH = container.clientHeight;
      canvas.width = CW; canvas.height = CH;
    });
    ro.observe(container);

    // ── Loop ──────────────────────────────────────────────────────────────
    let animId: number, lastTs = 0, frame = 0;

    function loop(ts: number) {
      animId = requestAnimationFrame(loop);
      const dt = lastTs ? Math.min(ts - lastTs, 50) : 16;
      lastTs = ts; frame++;

      ctx.clearRect(0, 0, CW, CH);
      if (videoRef.current) drawVideoCover(ctx, videoRef.current, CW, CH);

      game.update(dt, hand, CW, CH);
      game.draw(ctx, frame, CW, CH);
      hand.draw(ctx);
    }

    animId = requestAnimationFrame(loop);
    return () => { cancelAnimationFrame(animId); ro.disconnect(); };
  }, []);

  const btn = (grad: string, shadow: string): React.CSSProperties => ({
    padding:"13px 44px", fontSize:"1.1rem", fontWeight:900,
    fontFamily:"'Arial Black',Arial,sans-serif", border:"none",
    borderRadius:"50px", cursor:"pointer", letterSpacing:".06em",
    background:grad, color:"#000", boxShadow:shadow,
  });

  const overlay: React.CSSProperties = {
    position:"absolute", inset:0,
    display:"flex", flexDirection:"column",
    alignItems:"center", justifyContent:"center", gap:14,
  };

  return (
    <div style={{
      display:"flex", flexDirection:"column", height:"100vh",
      background:"#060610", overflow:"hidden",
      fontFamily:"'Arial Black',Arial,sans-serif", color:"#fff",
    }}>
      <div style={{
        display:"flex", alignItems:"center", justifyContent:"space-between",
        padding:"5px 14px", flexShrink:0, background:"rgba(0,0,0,.5)",
        borderBottom:"1px solid rgba(255,255,255,.08)",
      }}>
        <h1 style={{
          margin:0, fontSize:"1.1rem",
          background:"linear-gradient(90deg,#ff6600,#ffd700,#ff0040)",
          WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent",
        }}>🏐 KEEPER — AR Juggle Survival</h1>
        <div style={{fontSize:".68rem",opacity:.65,display:"flex",gap:12,flexWrap:"wrap",justifyContent:"flex-end"}}>
          <span>🏀 Aim for the basket!</span>
          <span style={{color:"#ffd700"}}>⭐ Golden basket = 200pts</span>
          <span style={{color:"#ff4444"}}>💀 Danger = 150pts</span>
          <span style={{color:"#60c8ff"}}>💨 Flick speed = shot power</span>
        </div>
      </div>

      <div ref={containerRef} style={{flex:1,position:"relative",overflow:"hidden"}}>
        <video ref={videoRef} style={{display:"none"}} autoPlay playsInline />
        <canvas ref={canvasRef} style={{position:"absolute",inset:0}} />

        {phase==="idle" && (
          <div style={overlay}>
            <div style={{fontSize:"3.5rem",filter:"drop-shadow(0 0 20px rgba(255,150,0,.8))"}}>🏐</div>
            <div style={{fontSize:"1.8rem",fontWeight:900,letterSpacing:".04em"}}>KEEPER</div>
            <div style={{
              fontSize:".82rem", opacity:.85, textAlign:"center",
              maxWidth:360, lineHeight:1.8,
              background:"rgba(0,0,0,.55)", padding:"14px 20px", borderRadius:12,
              border:"1px solid rgba(255,255,255,.1)",
            }}>
              Balls bounce — <b style={{color:"#ff4444"}}>don't let them hit the floor!</b><br/>
              <b style={{color:"#ffd700"}}>🏀 Aim for the moving basket</b> at the top for big points!<br/>
              <b style={{color:"#60c8ff"}}>Flick fast</b> = directional power shot.<br/>
              <b style={{color:"#aaa"}}>Slow touch</b> = gentle upward pop.<br/>
              <b style={{color:"#ffd700"}}>⭐ Golden basket = 200pts</b> ·{" "}
              <b style={{color:"#ff4444"}}>💀 Danger basket = 150pts</b><br/>
              More balls spawn over time. <b>3 lives.</b>
            </div>
            <button onClick={()=>startRef.current?.()} style={btn(
              "linear-gradient(135deg,#ff6600,#ffd700)",
              "0 4px 24px rgba(255,150,0,.55)",
            )}>START GAME</button>
          </div>
        )}

        {phase==="gameover" && (
          <div style={overlay}>
            <div style={{fontSize:"2.8rem"}}>💀</div>
            <div style={{fontSize:"1.9rem",fontWeight:900}}>GAME OVER</div>
            <div style={{
              fontSize:"4rem", fontWeight:900, color:"#ffd700",
              textShadow:"0 0 30px rgba(255,215,0,.85)", lineHeight:1,
            }}>{finalScore}</div>
            <div style={{fontSize:".82rem",opacity:.65}}>🏐 {finalDefl} deflections</div>
            <button onClick={()=>startRef.current?.()} style={btn(
              "linear-gradient(135deg,#ff6600,#ff0040)",
              "0 4px 24px rgba(255,80,0,.5)",
            )}>TRY AGAIN</button>
          </div>
        )}

        {phase==="playing" && (
          <div style={{
            position:"absolute", top:58, left:14,
            display:"flex", gap:4, fontSize:"1.1rem",
            background:"rgba(0,0,0,.4)", padding:"4px 8px", borderRadius:8,
          }}>
            {Array.from({length:MAX_LIVES}).map((_,i)=>(
              <span key={i} style={{opacity:i<lives?1:.2,transition:"opacity .3s"}}>❤️</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};