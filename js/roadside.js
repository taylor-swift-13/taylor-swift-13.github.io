(() => {
  'use strict';
  const entry = document.querySelector('.roadside-entry');
  const view = document.getElementById('roadside-view');
  if (!entry || !view) return;
  const closeButton = view.querySelector('.roadside-close');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let opened = false;
  let nativeFullscreen = false;
  let previousOverflow = '';
  let previousFocus;
  const inertState = new Map();

  const fragment = `
    precision highp float;
    uniform vec2 resolution;
    uniform float time;
    varying vec2 uv;
    float sea(vec2 p) {
      float t = time * .65;
      return sin(dot(p, vec2(.7,.65)) - t) * .28
        + sin(dot(p, vec2(-1.1,.8)) + t * .85) * .16
        + sin(dot(p, vec2(2.5,1.4)) - t * 1.3) * .06
        + sin(dot(p, vec2(-3.5,4.7)) + t * 1.6) * .025;
    }
    void main() {
      vec2 screen = uv * 2. - 1.;
      vec3 ray = normalize(vec3(screen.x * resolution.x / resolution.y * .65, screen.y * .7 - .6, -1.5));
      vec3 sky = mix(vec3(.58,.024,.072), vec3(.19,.003,.025), smoothstep(.6,1.,uv.y));
      vec3 color = sky;
      if (ray.y < -.012) {
        vec3 origin = vec3(0.,3.4,5.);
        float distance = min(100.,-origin.y / ray.y);
        for (int i=0; i<4; i++) {
          vec3 point = origin + ray * distance;
          distance = clamp((sea(point.xz)-origin.y) / ray.y,0.,100.);
        }
        vec3 point = origin + ray * distance;
        float h = sea(point.xz);
        float dx = (sea(point.xz+vec2(.035,0.))-h)/.035;
        float dz = (sea(point.xz+vec2(0.,.035))-h)/.035;
        vec3 normal = normalize(vec3(-dx,1.,-dz));
        vec3 light = normalize(vec3(-.4,.65,-.6));
        float diffuse = max(dot(normal,light),0.);
        float reflection = pow(1.-max(dot(normal,-ray),0.),3.);
        float shine = pow(max(dot(reflect(ray,normal),light),0.),42.);
        color = mix(vec3(.17,.002,.023),vec3(.72,.018,.065),diffuse*.8);
        color += vec3(.42,.035,.065)*reflection;
        color += vec3(1.,.3,.32)*shine*.72;
        color += vec3(.35,.09,.1)*smoothstep(.30,.48,h)*.15;
        color = mix(color,sky,1.-exp(-distance*.025));
      }
      float grain = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898,78.233))) * 43758.5453);
      color += (grain - .5) * .014;
      gl_FragColor = vec4(color, 1.);
    }
  `;
  const vertex = 'attribute vec2 position; varying vec2 uv; void main(){uv=position*.5+.5;gl_Position=vec4(position,0.,1.);}';

  function createSurface(canvas) {
    const gl = canvas.getContext('webgl', {alpha:false, antialias:false, powerPreference:'low-power'});
    if (!gl) return null;
    function shader(type, source) {
      const result = gl.createShader(type);
      gl.shaderSource(result, source);
      gl.compileShader(result);
      if (!gl.getShaderParameter(result, gl.COMPILE_STATUS)) {
        gl.deleteShader(result);
        throw new Error('Roadside shader could not compile');
      }
      return result;
    }
    try {
      const program = gl.createProgram();
      const vs = shader(gl.VERTEX_SHADER, vertex);
      const fs = shader(gl.FRAGMENT_SHADER, fragment);
      gl.attachShader(program, vs);
      gl.attachShader(program, fs);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Roadside shader could not link');
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      const vertices = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, vertices);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
      gl.useProgram(program);
      const position = gl.getAttribLocation(program, 'position');
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      const resolution = gl.getUniformLocation(program, 'resolution');
      const time = gl.getUniformLocation(program, 'time');
      let lost = false;
      canvas.addEventListener('webglcontextlost', event => {event.preventDefault(); lost = true;});
      return seconds => {
        if (lost) return;
        const rect = canvas.getBoundingClientRect();
        const ratio = Math.min(window.devicePixelRatio || 1, 1.25, 1400 / Math.max(rect.width, 1));
        const width = Math.max(1, Math.round(rect.width * ratio));
        const height = Math.max(1, Math.round(rect.height * ratio));
        if (canvas.width !== width || canvas.height !== height) {canvas.width=width; canvas.height=height;}
        gl.viewport(0, 0, width, height);
        gl.uniform2f(resolution, width, height);
        gl.uniform1f(time, reducedMotion.matches ? 0 : seconds);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
      };
    } catch {
      // The CSS background remains available when GPU rendering is unavailable.
      return null;
    }
  }

  const previewSurface = createSurface(entry.querySelector('canvas'));
  const fullSurface = createSurface(view.querySelector('canvas'));
  let previewVisible = true;
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([item]) => {previewVisible = item.isIntersecting;}).observe(entry);
  }
  let lastFrame = 0;
  let stillFrame = false;
  function frame(now) {
    if (!document.hidden && (opened || previewVisible) && now-lastFrame >= (opened ? 33 : 50)) {
      if (!reducedMotion.matches || !stillFrame) {
        (opened ? fullSurface : previewSurface)?.(now / 1000);
        stillFrame = true;
      }
      lastFrame = now;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  window.addEventListener('resize', () => {stillFrame=false;});
  reducedMotion.addEventListener('change', () => {stillFrame=false;});

  function finishClose() {
    if (!opened) return;
    opened = false;
    view.hidden = true;
    view.classList.remove('is-revealed');
    entry.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = previousOverflow;
    for (const [element, value] of inertState) element.inert = value;
    inertState.clear();
    nativeFullscreen = false;
    stillFrame = false;
    (previousFocus || entry).focus({preventScroll:true});
  }
  function close() {
    if (document.fullscreenElement === view) document.exitFullscreen().catch(() => {});
    finishClose();
  }
  entry.addEventListener('click', () => {
    if (opened) return;
    opened = true;
    previousFocus = document.activeElement;
    previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    for (const element of document.querySelectorAll('body > header, body > main, body > footer')) {
      inertState.set(element, element.inert);
      element.inert = true;
    }
    view.hidden = false;
    entry.setAttribute('aria-expanded', 'true');
    stillFrame = false;
    if (view.requestFullscreen) view.requestFullscreen().then(() => {
      if (opened) nativeFullscreen=true;
      else if (document.fullscreenElement === view) document.exitFullscreen().catch(() => {});
    }).catch(() => {});
    closeButton.focus({preventScroll:true});
    requestAnimationFrame(() => requestAnimationFrame(() => {if (opened) view.classList.add('is-revealed');}));
  });
  closeButton.addEventListener('click', close);
  document.addEventListener('fullscreenchange', () => {
    if (nativeFullscreen && document.fullscreenElement !== view) {
      nativeFullscreen = false;
      // Embedded browsers can revoke native fullscreen; keep the viewport overlay open.
      if (opened) closeButton.focus({preventScroll:true});
    }
  });
  document.addEventListener('keyup', event => {
    if (opened && event.key === 'Escape') close();
  });
  view.addEventListener('keydown', event => {
    if (event.key === 'Escape') {event.preventDefault(); close();}
    if (event.key === 'Tab') {event.preventDefault(); closeButton.focus();}
  });
})();
