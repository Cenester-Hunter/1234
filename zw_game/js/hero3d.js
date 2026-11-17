'use strict';
// 3D-герой: твоя модель model-c37d4b.glb на ЕДИНОМ СКЕЛЕТЕ (ZW_UNIFIED_SKELETON) без изменения формы.
// Модель не перерисовывается и не «улучшается»: меш и текстуры (цвет, металл/шероховатость, нормали) — те же, что в GLB.
// Поза считается так, чтобы каждая кость меша смотрела туда же, куда кость Mixamo-анимации (форма и пропорции не страдают:
// длины костей — от модели, а не от анимации; кручение берётся из анимации).
//
// Конвейер: Hero3D.pose() -> 22 матрицы костей -> WebGL (скиннинг на GPU, PBR) -> холст -> drawImage в игру.

const H3_NB = 22;
const H3 = {
  // клип -> скорость проигрывания (Mixamo-клипы медленные для файтинга)
  SPEED: { attack_slash: 2.4, attack_sword2: 1.8, attack_greatsword: 2.0, cast_magic: 1.8, smoking: 2.0, attack_punch: 2.4, attack_elbow: 2.2, attack_kick: 2.2, attack_sword: 2.0, attack_spin: 1.8, attack_turnkick: 2.0, run: 1.5, hit_uppercut: 1.5, die: 1.6, jump: 1.0 },
  K: 1.12,           // игровых пикселей на см
};

const Hero3D = {
  ok: false, err: '', T: 0,

  init(rs) {
    if (this.ok || this.err) return this.ok;
    if (!window.HERO_DATA) return false;
    try {
      const D = window.HERO_DATA;
      // качество по памяти: после падения вкладки (флаг «идёт сессия» не сбросился) снижаем текстуры, после второго — отключаем 3D
      const LG = k => { try { return localStorage.getItem(k); } catch (e) { return null; } }, LS = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { } };
      let tier = +(LG('zw_h3tier') || 0); const q = /[?&]h3=(\w+)/.exec(location.search);
      if (q) { tier = q[1] === 'hi' ? -1 : +q[1] || 0; LS('zw_h3tier', Math.max(0, tier)); LS('zw_h3run', '0'); }
      else if (LG('zw_h3run') === '1') { tier = Math.min(3, tier + 1); LS('zw_h3tier', tier); }
      LS('zw_h3run', '1'); setTimeout(() => LS('zw_h3run', '0'), 25000); addEventListener('pagehide', () => LS('zw_h3run', '0'));
      if (tier >= 3) throw new Error('3D отключён: вкладка падала по памяти (открой с ?h3=0 чтобы включить)');
      this.tier = tier; this.texMax = tier < 0 ? 2048 : tier === 0 ? 1024 : 512; this.aa = tier <= 0;
      this.D = D; this.rig = D.rig; this.rs = rs || 1;
      const b64 = s => { const bin = atob(s), u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); return u; };
      const bin = b64(D.bin), m = D.meta, n = m.n;
      const cut = (o, len) => bin.slice(o, o + len);
      this.mesh = {
        n, tri: m.tri, pos: cut(m.pos, n * 12), nor: cut(m.nor, n * 3), tan: cut(m.tan, n * 4), uv: cut(m.uv, n * 4),
        jnt: cut(m.jnt, n * 4), wgt: cut(m.wgt, n * 4), ind: cut(m.ind, m.tri * 6),
      };
      const qb = b64(D.qbin); this.q16 = new Int16Array(qb.buffer.slice(qb.byteOffset, qb.byteOffset + qb.length));
      this.clips = D.clips;
      // матрицы покоя
      const r = this.rig; this.NBALL = r.names.length; this.par = r.par;
      this.RRt = r.RR.map(a => [a[0], a[3], a[6], a[1], a[4], a[7], a[2], a[5], a[8]]);   // RR^-1
      this.St = r.S.map(a => [a[0], a[3], a[6], a[1], a[4], a[7], a[2], a[5], a[8]]);     // S^-1
      this.RS = this.RRt.map((x, i) => this.mm(x, this.St[i]));   // RR^-1 * S^-1 (константа на кость)
      this.J = r.J; this.sroot = r.sroot; this.h0 = r.h0;
      this.names = r.names; this.idx = {}; r.names.forEach((nm, i) => this.idx[nm] = i);
      this.u = new Float32Array(this.NBALL * 12); this.PW = []; for (let i = 0; i < this.NBALL; i++) this.PW.push([0, 0, 0]);
      this.Rw = []; for (let i = 0; i < H3_NB; i++) this.Rw.push(new Array(9));
      this.Mm = []; for (let i = 0; i < H3_NB; i++) this.Mm.push(new Array(9));
      this.ql = new Float32Array(H3_NB * 4);
      this.initPalm();
      this.initGL();
      D.bin = null; D.qbin = null;   // освобождаем строки base64 (экономия памяти)
      this.ok = true;
    } catch (e) { this.err = String(e && e.message || e); console.error('Hero3D', e); }
    return this.ok;
  },

  mm(a, b) {   // 3x3 row-major
    const o = new Array(9);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) o[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j];
    return o;
  },
  q2m(q, o) {
    const x = q[0], y = q[1], z = q[2], w = q[3], n = 1 / Math.hypot(x, y, z, w), X = x * n, Y = y * n, Z = z * n, W = w * n;
    o[0] = 1 - 2 * (Y * Y + Z * Z); o[1] = 2 * (X * Y - Z * W); o[2] = 2 * (X * Z + Y * W);
    o[3] = 2 * (X * Y + Z * W); o[4] = 1 - 2 * (X * X + Z * Z); o[5] = 2 * (Y * Z - X * W);
    o[6] = 2 * (X * Z - Y * W); o[7] = 2 * (Y * Z + X * W); o[8] = 1 - 2 * (X * X + Y * Y);
    return o;
  },

  // локальные кватернионы клипа в дробном кадре f (с зацикливанием/ограничением) -> this.ql
  sample(clip, f, loop) {
    const c = this.clips[clip], F = c.frames;
    if (loop) { f = ((f % F) + F) % F; } else f = Math.max(0, Math.min(F - 1, f));
    let f0 = Math.floor(f), t = f - f0, f1 = f0 + 1; if (f1 >= F) f1 = loop ? 0 : F - 1;
    const a = c.off / 2 + f0 * H3_NB * 4, b = c.off / 2 + f1 * H3_NB * 4, Q = this.q16, o = this.ql;
    for (let i = 0; i < H3_NB; i++) {
      const A = a + i * 4, B = b + i * 4;
      let d = Q[A] * Q[B] + Q[A + 1] * Q[B + 1] + Q[A + 2] * Q[B + 2] + Q[A + 3] * Q[B + 3]; const s = d < 0 ? -1 : 1;
      for (let k = 0; k < 4; k++) o[i * 4 + k] = (Q[A + k] * (1 - t) + Q[B + k] * s * t) / 32767;
    }
    const ra = c.root[f0], rb = c.root[f1];
    return [ra[0] + (rb[0] - ra[0]) * t, ra[1] + (rb[1] - ra[1]) * t, ra[2] + (rb[2] - ra[2]) * t];
  },

  // смесь двух поз (кроссфейд): ql_a, ql_b -> ql
  blendQ(qa, qb, u, out) {
    for (let i = 0; i < H3_NB; i++) {
      let d = 0; for (let k = 0; k < 4; k++) d += qa[i * 4 + k] * qb[i * 4 + k]; const s = d < 0 ? -1 : 1;
      let n = 0; for (let k = 0; k < 4; k++) { const v = qa[i * 4 + k] * (1 - u) + qb[i * 4 + k] * s * u; out[i * 4 + k] = v; n += v * v; }
      n = 1 / Math.sqrt(n); for (let k = 0; k < 4; k++) out[i * 4 + k] *= n;
    }
  },

  // добавочный поворот кости (рад) вокруг локальной оси: дыхание, наклон блока и т. п.
  addRot(ql, bone, ax, ang) {
    const i = this.idx[bone] * 4, h = ang / 2, s = Math.sin(h), c = Math.cos(h);
    const x = ql[i], y = ql[i + 1], z = ql[i + 2], w = ql[i + 3];
    const bx = ax === 0 ? s : 0, by = ax === 1 ? s : 0, bz = ax === 2 ? s : 0;
    ql[i] = w * bx + x * c + y * bz - z * by; ql[i + 1] = w * by - x * bz + y * c + z * bx;
    ql[i + 2] = w * bz + x * by - y * bx + z * c; ql[i + 3] = w * c - x * bx - y * by - z * bz;
  },

  // ql + root -> this.u (uniform-строки) и this.PW (положения всех костей, см)
  pose(ql, root, yoff, rootXZ) {
    const par = this.par, Rw = this.Rw, M = this.Mm, J = this.J, PW = this.PW, tmp = new Array(9);
    for (let i = 0; i < H3_NB; i++) {
      const Rl = this.q2m([ql[i * 4], ql[i * 4 + 1], ql[i * 4 + 2], ql[i * 4 + 3]], tmp);
      Rw[i] = par[i] < 0 ? Rl.slice() : this.mm(Rw[par[i]], Rl);
      M[i] = this.mm(Rw[i], this.RS[i]);
    }
    PW[0][0] = J[0][0] + this.sroot * (rootXZ ? rootXZ[0] : root[0]); PW[0][1] = J[0][1] + this.sroot * (root[1] - this.h0) + yoff; PW[0][2] = J[0][2] + this.sroot * (rootXZ ? rootXZ[1] : root[2]);
    for (let i = 1; i < this.NBALL; i++) {
      const p = par[i], m = M[p], d0 = J[i][0] - J[p][0], d1 = J[i][1] - J[p][1], d2 = J[i][2] - J[p][2];
      PW[i][0] = PW[p][0] + m[0] * d0 + m[1] * d1 + m[2] * d2;
      PW[i][1] = PW[p][1] + m[3] * d0 + m[4] * d1 + m[5] * d2;
      PW[i][2] = PW[p][2] + m[6] * d0 + m[7] * d1 + m[8] * d2;
    }
    const u = this.u;
    for (let i = 0; i < H3_NB; i++) {
      const m = M[i], j = J[i], p = PW[i];
      const tx = p[0] - (m[0] * j[0] + m[1] * j[1] + m[2] * j[2]), ty = p[1] - (m[3] * j[0] + m[4] * j[1] + m[5] * j[2]), tz = p[2] - (m[6] * j[0] + m[7] * j[1] + m[8] * j[2]);
      u[i * 12] = m[0]; u[i * 12 + 1] = m[1]; u[i * 12 + 2] = m[2]; u[i * 12 + 3] = tx;
      u[i * 12 + 4] = m[3]; u[i * 12 + 5] = m[4]; u[i * 12 + 6] = m[5]; u[i * 12 + 7] = ty;
      u[i * 12 + 8] = m[6]; u[i * 12 + 9] = m[7]; u[i * 12 + 10] = m[8]; u[i * 12 + 11] = tz;
    }
  },

  // ладонь: вершины сетки, привязанные в основном к правой кисти. Их кожа (после скиннинга) — точка хвата меча
  initPalm() {
    const M = this.mesh, I = this.idx, pos = new Float32Array(M.pos.buffer, M.pos.byteOffset, M.n * 3);
    this.palmPos = pos; this.palmS = {};
    for (const side of ['Right', 'Left']) {
      const hj = I[side + 'Hand'], pick = [];
      for (let v = 0; v < M.n; v++) { let w = 0; for (let k = 0; k < 4; k++) if (M.jnt[v * 4 + k] === hj) w += M.wgt[v * 4 + k]; if (w >= 128) pick.push(v); }
      const st = Math.max(1, Math.floor(pick.length / 100)), list = [];
      for (let i = 0; i < pick.length; i += st) list.push(pick[i]);
      let cx = 0, cy = 0, cz = 0; for (const v of list) { cx += pos[v * 3]; cy += pos[v * 3 + 1]; cz += pos[v * 3 + 2]; }
      const n = Math.max(1, list.length); cx /= n; cy /= n; cz /= n; let r2 = 0;
      for (const v of list) r2 += (pos[v * 3] - cx) ** 2 + (pos[v * 3 + 1] - cy) ** 2 + (pos[v * 3 + 2] - cz) ** 2;
      this.palmS[side] = { list, r: Math.max(3, Math.sqrt(r2 / n) * 0.85) };
    }
    this.palm = this.palmS.Right.list; this.palmR = this.palmS.Right.r;
  },
  // центр ладони в мире (см) для позы, которая сейчас лежит в this.u
  palmWorld(side) {
    const M = this.mesh, u = this.u, P = this.palmPos, list = this.palmS[side || 'Right'].list; let X = 0, Y = 0, Z = 0, c = 0;
    for (const v of list) {
      const x = P[v * 3], y = P[v * 3 + 1], z = P[v * 3 + 2];
      for (let k = 0; k < 4; k++) {
        const w = M.wgt[v * 4 + k] / 255; if (!w) continue; const o = M.jnt[v * 4 + k] * 12;
        X += w * (u[o] * x + u[o + 1] * y + u[o + 2] * z + u[o + 3]); Y += w * (u[o + 4] * x + u[o + 5] * y + u[o + 6] * z + u[o + 7]); Z += w * (u[o + 8] * x + u[o + 9] * y + u[o + 10] * z + u[o + 11]);
      }
      c++;
    }
    return c ? [X / c, Y / c, Z / c] : null;
  },

  // высота самой низкой точки тела над землёй при текущей позе (для привязки стоп к полу), см
  lowest() {
    const P = this.PW, I = this.idx; let lo = 1e9;
    const t = (n, r) => { const y = P[I[n]][1] - r; if (y < lo) lo = y; };
    t('LeftFoot', 11); t('RightFoot', 11); t('LeftToeEnd', 1.7); t('RightToeEnd', 1.7); t('LeftToeBase', 3); t('RightToeBase', 3);
    t('LeftLeg', 9); t('RightLeg', 9); t('Hips', 14); t('Head', 12); t('HeadTop', 2); t('LeftHandEnd', 4); t('RightHandEnd', 4); t('LeftForeArm', 8); t('RightForeArm', 8); t('Spine2', 14);
    return lo;
  },

  // ---------- WebGL ----------
  initGL(again) {
    const W = Render.BW * this.rs, H = Render.BH * this.rs;
    const cv = this.cv = again ? this.cv : document.createElement('canvas'); if (!again) { cv.width = Math.round(W); cv.height = Math.round(H); }
    const gl = this.gl = again ? this.gl : cv.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: this.aa, preserveDrawingBuffer: false });
    if (!gl) throw new Error('нет WebGL');
    // контекст могут отобрать (поворот экрана, нехватка видеопамяти): ждём возврата и пересобираем шейдеры/буферы/текстуры
    if (!again) cv.addEventListener('webglcontextlost', e => { e.preventDefault(); this.glLost = true; });
    if (!again) cv.addEventListener('webglcontextrestored', () => { try { this.glLost = false; this.initGL(true); } catch (er) { this.err = String(er && er.message || er); } });
    const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
    const VS = `precision highp float;
attribute vec3 aP; attribute vec3 aN; attribute vec4 aT; attribute vec2 aUV; attribute vec4 aJ; attribute vec4 aW;
uniform vec4 uB[${H3_NB * 3}]; uniform mat3 uR; uniform vec4 uProj;
varying vec2 vUV; varying vec3 vN; varying vec3 vT; varying float vS; varying vec3 vP;
void main(){
  vec4 p4=vec4(aP,1.0); vec3 p=vec3(0.0); vec3 n=vec3(0.0); vec3 t=vec3(0.0);
  for(int i=0;i<4;i++){
    int j=int(aJ[i]+0.5)*3; float w=aW[i];
    vec4 r0=uB[j], r1=uB[j+1], r2=uB[j+2];
    p+=w*vec3(dot(r0,p4),dot(r1,p4),dot(r2,p4));
    n+=w*vec3(dot(r0.xyz,aN),dot(r1.xyz,aN),dot(r2.xyz,aN));
    t+=w*vec3(dot(r0.xyz,aT.xyz),dot(r1.xyz,aT.xyz),dot(r2.xyz,aT.xyz));
  }
  vec3 q=uR*p; vN=uR*n; vT=uR*t; vS=aT.w; vUV=aUV; vP=q;
  gl_Position=vec4(q.x*uProj.x+uProj.z, q.y*uProj.y+uProj.w, -q.z*0.004, 1.0);
}`;
    const FS = `precision highp float;
varying vec2 vUV; varying vec3 vN; varying vec3 vT; varying float vS; varying vec3 vP;
uniform sampler2D uC; uniform sampler2D uO; uniform sampler2D uNm;
uniform vec3 uRim; uniform vec3 uEye; uniform float uTime; uniform float uFlash; uniform vec3 uTint; uniform float uGlow; uniform float uHurt;
vec3 env(vec3 r, float rough){
  float up=smoothstep(-0.4,0.9,r.y);
  vec3 c=mix(vec3(0.015,0.02,0.03),vec3(0.20,0.27,0.34),up);
  c+=vec3(0.7,0.85,1.0)*pow(max(dot(r,normalize(vec3(-0.4,0.7,0.6))),0.0),mix(60.0,6.0,rough))*1.6;
  c+=mix(vec3(0.8),uRim,0.4)*pow(max(dot(r,normalize(vec3(0.5,0.3,-0.8))),0.0),mix(30.0,4.0,rough))*0.9;
  c+=vec3(0.55,0.45,0.35)*pow(max(dot(r,normalize(vec3(0.8,-0.1,0.5))),0.0),mix(24.0,4.0,rough))*0.35;
  return c;
}
void main(){
  vec3 alb=pow(texture2D(uC,vUV).rgb,vec3(2.2));
  vec3 orm=texture2D(uO,vUV).rgb; float ao=orm.r, rough=clamp(orm.g,0.08,1.0), met=orm.b;
  vec3 nm=texture2D(uNm,vUV).rgb*2.0-1.0;
  vec3 N0=normalize(vN); vec3 T=normalize(vT-N0*dot(N0,vT)); vec3 B=cross(N0,T)*vS;
  vec3 N=normalize(T*nm.x+B*nm.y+N0*nm.z);
  vec3 V=vec3(0.0,0.0,1.0);
  float nv=max(dot(N,V),0.0);
  vec3 L1=normalize(vec3(-0.45,0.65,0.62)); vec3 L2=normalize(vec3(0.75,0.15,0.45)); vec3 L3=normalize(vec3(0.45,0.35,-0.8));
  float d1=max(dot(N,L1),0.0), d2=max(dot(N,L2),0.0), d3=max(dot(N,L3),0.0);
  vec3 F0=mix(vec3(0.04),alb,met);
  vec3 dif=alb*(1.0-met);
  vec3 amb=mix(vec3(0.05,0.06,0.08),vec3(0.16,0.2,0.26),N.y*0.5+0.5);
  vec3 col=dif*(amb*ao*2.3+vec3(1.0,0.97,0.92)*d1*1.9+vec3(0.35,0.45,0.6)*d2*0.7+mix(vec3(0.8),uRim,0.35)*d3*0.5);
  vec3 R=reflect(-V,N);
  vec3 Fr=F0+(max(vec3(1.0-rough),F0)-F0)*pow(1.0-nv,5.0);
  col+=env(R,rough)*Fr*mix(1.0,0.55,rough)*(0.35+0.65*ao)*1.15;
  // кромка по силуэту
  col+=uRim*pow(1.0-nv,4.0)*0.4*(0.4+0.6*smoothstep(-0.3,0.6,N.y));
  // свечение: зелёные элементы брони и красные глаза (из самой текстуры)
  float gr=clamp(alb.g-max(alb.r,alb.b)*1.15,0.0,1.0)*uGlow;
  col+=alb*gr*(3.2+0.5*sin(uTime*2.4+vUV.x*40.0));
  float rd=clamp(alb.r-max(alb.g,alb.b)*1.6,0.0,1.0);
  col=mix(col,uEye*1.8,clamp(rd*5.0,0.0,1.0));
  col=col/(1.0+col*0.55);  // мягкая тональная кривая
  col=pow(col,vec3(1.0/2.2));
  col=mix(col,vec3(1.0),uFlash);
  col=mix(col,uTint,uHurt);
  gl_FragColor=vec4(col,1.0);
}`;
    const pr = this.pr = gl.createProgram();
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
    gl.useProgram(pr);
    const M = this.mesh, buf = (data, tgt) => { const b = gl.createBuffer(); gl.bindBuffer(tgt || gl.ARRAY_BUFFER, b); gl.bufferData(tgt || gl.ARRAY_BUFFER, data, gl.STATIC_DRAW); return b; };
    const at = (nm, b, size, type, norm) => { const l = gl.getAttribLocation(pr, nm); gl.bindBuffer(gl.ARRAY_BUFFER, b); gl.enableVertexAttribArray(l); gl.vertexAttribPointer(l, size, type, norm, 0, 0); };
    const f32 = new Float32Array(M.pos.buffer), u16 = new Uint16Array(M.uv.buffer), ix = new Uint16Array(M.ind.buffer);
    at('aP', buf(f32), 3, gl.FLOAT, false); at('aN', buf(new Int8Array(M.nor.buffer)), 3, gl.BYTE, true);
    at('aT', buf(new Int8Array(M.tan.buffer)), 4, gl.BYTE, true); at('aUV', buf(u16), 2, gl.UNSIGNED_SHORT, true);
    at('aJ', buf(M.jnt), 4, gl.UNSIGNED_BYTE, false); at('aW', buf(M.wgt), 4, gl.UNSIGNED_BYTE, true);
    buf(ix, gl.ELEMENT_ARRAY_BUFFER); this.nIdx = M.tri * 3;
    this.L = {}; for (const k of ['uB', 'uR', 'uProj', 'uRim', 'uEye', 'uTime', 'uFlash', 'uTint', 'uGlow', 'uHurt', 'uC', 'uO', 'uNm']) this.L[k] = gl.getUniformLocation(pr, k);
    this.texReady = 0;
    this.texCv = this.texCv || {};
    const mkTex = (src, unit, name) => {
      const t = gl.createTexture();
      const up = im => {
        gl.activeTexture(gl.TEXTURE0 + unit); gl.bindTexture(gl.TEXTURE_2D, t);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, im);
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        const ext = gl.getExtension('EXT_texture_filter_anisotropic'); if (ext) gl.texParameterf(gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, 4);
        this.texReady++;
      };
      if (this.texCv[unit]) { up(this.texCv[unit]); return; }
      const im = new Image();
      im.onload = () => {
        let srcImg = im;
        const mx = Math.min(this.texMax || 1024, im.width);
        if (im.width > mx) { const c2 = document.createElement('canvas'); c2.width = c2.height = mx; c2.getContext('2d').drawImage(im, 0, 0, mx, mx); srcImg = c2; }
        if (srcImg !== im) this.texCv[unit] = srcImg;
        else { const c2 = document.createElement('canvas'); c2.width = im.width; c2.height = im.height; c2.getContext('2d').drawImage(im, 0, 0); this.texCv[unit] = c2; }
        up(this.texCv[unit]);
      };
      im.src = src;
    };
    mkTex(this.D.tex.color, 0); mkTex(this.D.tex.orm, 1); mkTex(this.D.tex.normal, 2);
    gl.uniform1i(this.L.uC, 0); gl.uniform1i(this.L.uO, 1); gl.uniform1i(this.L.uNm, 2);
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.enable(gl.CULL_FACE); gl.cullFace(gl.BACK);
  },

  hex(c) { const n = parseInt(String(c || '#58ff7a').replace('#', ''), 16); return [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; },

  // рисует героя в свой холст; (px,py) — где стоит точка «земля под таз» внутри буфера; возвращает холст
  render(yaw, rim, eye, flash, tint, hurt, time, glow) {
    const gl = this.gl, L = this.L, cv = this.cv;
    if (this.glLost || gl.isContextLost() || this.texReady < 3) return null;
    gl.viewport(0, 0, cv.width, cv.height); gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
    const s = Math.sin(yaw), c = Math.cos(yaw), k = H3.K * this.rs;
    gl.uniform4fv(L.uB, this.u.subarray(0, H3_NB * 12));
    gl.uniformMatrix3fv(L.uR, false, [c, 0, -s, 0, 1, 0, s, 0, c]);          // R*p: x'=c*x+s*z, z'=-s*x+c*z (столбцы)
    const ox = Render.OX * this.rs, oy = Render.OY * this.rs;
    gl.uniform4f(L.uProj, 2 * k / cv.width, 2 * k / cv.height, 2 * ox / cv.width - 1, 1 - 2 * oy / cv.height);
    const rc = this.hex(rim), ec = this.hex(eye);
    gl.uniform3f(L.uRim, rc[0], rc[1], rc[2]); gl.uniform3f(L.uEye, ec[0], ec[1], ec[2]);
    gl.uniform1f(L.uTime, time); gl.uniform1f(L.uFlash, flash); gl.uniform3f(L.uTint, tint[0], tint[1], tint[2]); gl.uniform1f(L.uHurt, hurt); gl.uniform1f(L.uGlow, glow);
    gl.drawElements(gl.TRIANGLES, this.nIdx, gl.UNSIGNED_SHORT, 0);
    return cv;
  },
};

// ---------- аниматор героя: состояния бойца -> клипы единого скелета ----------
class HeroAnimator {
  constructor() {
    this.cur = new Float32Array(H3_NB * 4); this.prevQ = new Float32Array(H3_NB * 4); this.tmpQ = new Float32Array(H3_NB * 4);
    this.root = [0, 104, 0]; this.fade = 1; this.lastKey = ''; this.yoff = 0; this.pw = null; this.drift = {}; this.t = 0; this.yaw = 0;
  }

  // удаляем боковой/продольный снос корня внутри клипа (движением управляет игра)
  rootFix(clip, r, f, loop) {
    const c = Hero3D.clips[clip], F = c.frames, r0 = c.root[0], rN = c.root[F - 1];
    const u = F > 1 ? Math.max(0, Math.min(1, f / (F - 1))) : 0;
    if (clip === 'attack_sword2') return [0, 0];
    let x = r[0] - r0[0], z = r[2] - r0[2];
    if (clip !== 'die') { x -= (rN[0] - r0[0]) * u; z -= (rN[2] - r0[2]) * u; }
    return [x, z];
  }

  // выбор источника позы. src: {clip, f, loop, mods:[[bone,axis,ang]]}
  setSrc(src, fadeTime) {
    const key = src.key || src.clip;
    if (key !== this.lastKey) { this.prevQ.set(this.cur); this.fade = 0; this.fadeT = fadeTime || 0.1; this.lastKey = key; }
    this.src = src;
  }

  update(dt) {
    const H = Hero3D, s = this.src; if (!s) return;
    let root = H.sample(s.clip, s.f, s.loop);
    const rxz = this.rootFix(s.clip, root, s.f, s.loop);
    this.tmpQ.set(H.ql);
    this.fade = Math.min(1, this.fade + dt / Math.max(this.fadeT, 0.001));
    if (this.fade < 1) { const u = this.fade * this.fade * (3 - 2 * this.fade); H.blendQ(this.prevQ, this.tmpQ, u, this.cur); } else this.cur.set(this.tmpQ);
    if (s.mods) for (const m of s.mods) H.addRot(this.cur, m[0], m[1], m[2]);
    H.pose(this.cur, root, 0, rxz);
    // стопы к полу (кроме вертикали, которую ведёт физика игры)
    const lo = H.lowest(); this.yoff = s.air && this.yoffHold !== undefined ? this.yoffHold : -lo; if (!s.air) this.yoffHold = this.yoff; H.pose(this.cur, root, this.yoff, rxz);
    // положения костей для игры (копия)
    this.pw = H.PW.map(p => p.slice()); this.rootv = root; this.rxz = rxz;
  }

  // пересчитать матрицы костей по сохранённой позе (общий WebGL-холст мог использоваться другим бойцом)
  apply() { if (this.pw) Hero3D.pose(this.cur, this.rootv, this.yoff, this.rxz); }
}
