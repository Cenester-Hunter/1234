'use strict';
// Постобработка на WebGL (шейдер): свечение (bloom), лучи света (god rays), хроматическая аберрация,
// цветокоррекция, виньетка, плёночное зерно, волна жара при режиме Дыхания.
// Игра рисует кадр в обычный 2D-холст, затем Post.present() прогоняет его через шейдер на экран.
// Если WebGL недоступен или упал, кадр просто копируется как есть (игра работает без шейдеров).

const Post = {
  gl: null, view: null, src: null, ok: false, q: 2, prog: null, tex: null, U: {}, ctx2d: null,
  // параметры, которые игра меняет по ходу боя
  P: { aber: 0.0015, rage: 0, flash: 0, tint: [0, 0, 0], tintA: 0, light: [0.5, 0.1], warp: [0.5, 0.5, 0], dark: 0 },

  VS: 'attribute vec2 p;varying vec2 v;void main(){v=p*0.5+0.5;gl_Position=vec4(p,0.0,1.0);}',
  FS: [
    'precision mediump float;',
    'varying vec2 v;uniform sampler2D T;uniform vec2 px;uniform float t,q,aber,rage,flash,tintA,dark;',
    'uniform vec3 tint;uniform vec2 light;uniform vec3 warp;',
    'float h(vec2 p){return fract(sin(dot(p,vec2(12.9898,78.233))+t)*43758.5453);}',
    'vec3 S(vec2 u){return texture2D(T,u).rgb;}',
    'void main(){',
    ' vec2 uv=v;',
    ' vec2 d=uv-warp.xy;float r=length(d*vec2(1.78,1.0));',
    ' uv+=normalize(d+vec2(1e-4))*warp.z*sin(r*38.0-t*13.0)*exp(-r*4.5)*0.012;',
    ' vec2 c=uv-0.5;float ab=aber*(0.5+dot(c,c)*4.0)+rage*0.0016;',
    ' vec3 col=vec3(S(uv+c*ab).r,S(uv).g,S(uv-c*ab).b);',
    ' if(q>0.5){',
    '  vec3 b=vec3(0.0);',
    '  for(int i=0;i<8;i++){float a=float(i)*0.7854;vec2 o=vec2(cos(a),sin(a));',
    '   b+=max(S(uv+o*px*7.0)-0.5,0.0)*1.0+max(S(uv+o*px*19.0)-0.5,0.0)*0.8;}',
    '  col+=b*(0.085+rage*0.05);',
    ' }',
    ' if(q>1.5){',
    '  vec2 dl=(light-uv)/18.0;vec2 su=uv;vec3 g=vec3(0.0);float dec=1.0;',
    '  for(int i=0;i<18;i++){su+=dl;vec3 s=S(su);float l=dot(s,vec3(0.33));g+=max(s-0.55,0.0)*dec*step(0.02,l);dec*=0.93;}',
    '  col+=g*0.04*vec3(0.8,1.0,0.95);',
    ' }',
    ' float lum=dot(col,vec3(0.299,0.587,0.114));',
    ' col=mix(vec3(lum),col,1.08+rage*0.25);',
    ' col=(col-0.5)*(1.1+rage*0.08)+0.5;',
    ' col=mix(col,col*(tint*1.7),tintA);',
    ' col+=vec3(0.5,0.08,0.02)*rage*0.12*(1.0-length(c)*1.2);',
    ' col+=flash;',
    ' float vg=smoothstep(0.95,0.25,length(c*vec2(1.25,1.0)));',
    ' col*=mix(0.45,1.0,vg)*(1.0-dark);',
    ' col+=(h(uv*vec2(1280.0,720.0))-0.5)*0.045;',
    ' gl_FragColor=vec4(col,1.0);}',
  ].join('\n'),

  // Пробуем WebGL на новом холсте; если удалось (и тестовая загрузка текстуры прошла), он заменяет видимый холст.
  init(el, src) {
    this.src = src; this.view = el;
    if (!/[?&]nogl=1/.test(location.search)) {
      try {
        const g = document.createElement('canvas'); g.width = el.width; g.height = el.height;
        const gl = g.getContext('webgl', { antialias: false, alpha: false, preserveDrawingBuffer: false, powerPreference: 'high-performance' });
        this.gl = gl;
        if (gl && this.build()) {
          gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);   // проверка: холст не «чужой»
          if (gl.getError() === 0) {
            g.id = el.id; g.style.cssText = el.style.cssText;
            el.parentNode.replaceChild(g, el);
            this.view = g; this.ok = true;
            // контекст отобрали (поворот экрана, фон): ждём возврата и пересобираем шейдер; не вернулся за 2.5 с — обычный 2D-холст
            g.addEventListener('webglcontextlost', e => {
              e.preventDefault(); this.ok = false; this.restored = false; clearTimeout(this.lt);
              this.lt = setTimeout(() => { if (!this.restored) this.lost(); }, 2500);
            });
            g.addEventListener('webglcontextrestored', () => {
              clearTimeout(this.lt);
              try { if (this.gl.isContextLost() || !this.build()) throw 0; this.restored = true; this.ok = true; } catch (er) { this.lost(); }
            });
            return this.view;
          }
        }
      } catch (e) { /* падаем на 2D */ }
    }
    this.gl = null;
    this.fallback();
    return this.view;
  },

  // видеокарта отобрала контекст: ставим обычный 2D-холст вместо WebGL
  lost() {
    const old = this.view, el = document.createElement('canvas');
    el.id = old.id; el.width = old.width; el.height = old.height; el.style.cssText = old.style.cssText;
    old.parentNode.replaceChild(el, old);
    this.view = el; this.ok = false; this.gl = null; this.fallback();
    if (this.onView) this.onView(el);
  },

  fallback() {
    this.ok = false; this.gl = null;
    try { this.ctx2d = this.view.getContext('2d'); } catch (e) { this.ctx2d = null; }
  },

  build() {
    const gl = this.gl;
    const sh = (type, s) => { const o = gl.createShader(type); gl.shaderSource(o, s); gl.compileShader(o); if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
    try {
      const pr = this.prog = gl.createProgram();
      gl.attachShader(pr, sh(gl.VERTEX_SHADER, this.VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, this.FS));
      gl.linkProgram(pr);
      if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(pr));
      gl.useProgram(pr);
      const buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
      this.tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, this.tex);
      gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
      for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, k, v);
      for (const n of ['T', 'px', 't', 'q', 'aber', 'rage', 'flash', 'tintA', 'dark', 'tint', 'light', 'warp']) this.U[n] = gl.getUniformLocation(pr, n);
      return true;
    } catch (e) { if (window.console) console.warn('shader', e); return false; }
  },

  present(t) {
    const src = this.src, view = this.view;
    if (!this.ok) {
      if (this.ctx2d) { this.ctx2d.setTransform(1, 0, 0, 1, 0, 0); this.ctx2d.drawImage(src, 0, 0, view.width, view.height); }
      return;
    }
    const gl = this.gl, U = this.U, P = this.P;
    if (gl.isContextLost()) return;
    gl.viewport(0, 0, view.width, view.height);
    gl.bindTexture(gl.TEXTURE_2D, this.tex);
    try { gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src); }
    catch (e) { this.lost(); return; }
    gl.uniform1i(U.T, 0); gl.uniform2f(U.px, 1 / view.width, 1 / view.height);
    gl.uniform1f(U.t, t % 100); gl.uniform1f(U.q, this.q);
    gl.uniform1f(U.aber, P.aber); gl.uniform1f(U.rage, P.rage); gl.uniform1f(U.flash, P.flash);
    gl.uniform1f(U.tintA, P.tintA); gl.uniform1f(U.dark, P.dark);
    gl.uniform3f(U.tint, P.tint[0], P.tint[1], P.tint[2]);
    gl.uniform2f(U.light, P.light[0], P.light[1]);
    gl.uniform3f(U.warp, P.warp[0], P.warp[1], P.warp[2]);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  },
};
