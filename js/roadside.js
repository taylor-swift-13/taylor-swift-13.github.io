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
  const pointer = {x:0, y:0, targetX:0, targetY:0};

  const fragment = `
    precision highp float;
    uniform vec2 resolution;
    uniform float time;
    uniform vec2 pointer;
    varying vec2 uv;
    void main() {
      vec2 p = (uv-.5)*vec2(min(resolution.x/resolution.y,2.),1.);
      float t = time*.12;
      vec2 lightOffset = p-vec2(-.35+sin(t)*.14,.12+cos(t*.8)*.08)-pointer*.35;
      vec2 shadeOffset = p-vec2(.38+cos(t*.7)*.12,-.17+sin(t*.9)*.10)+pointer*.18;
      float light = exp(-dot(lightOffset,lightOffset)*3.);
      float shadow = exp(-dot(shadeOffset,shadeOffset)*3.5);
      vec2 depthOffset = (uv-.5-pointer*vec2(.08,.06))*vec2(1.1,1.5);
      float depth = exp(-dot(depthOffset,depthOffset)*5.);
      float brightness = .93+.13*depth+.08*light-.045*shadow;
      vec3 color = vec3(200.,16.,46.)/255.*brightness;
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
      const mouse = gl.getUniformLocation(program, 'pointer');
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
        gl.uniform2f(mouse, pointer.x, pointer.y);
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
        const ease = reducedMotion.matches ? 1 : .18;
        pointer.x += (pointer.targetX-pointer.x)*ease;
        pointer.y += (pointer.targetY-pointer.y)*ease;
        if (opened) {
          view.style.setProperty('--roadside-shift-x', `${pointer.x*9}px`);
          view.style.setProperty('--roadside-shift-y', `${-pointer.y*6}px`);
          view.style.setProperty('--roadside-rotate-x', `${pointer.y*2}deg`);
          view.style.setProperty('--roadside-rotate-y', `${pointer.x*3}deg`);
        }
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
  for (const surface of [entry, view]) {
    surface.addEventListener('pointermove', event => {
      const rect = surface.getBoundingClientRect();
      pointer.targetX = Math.max(-1,Math.min(1,(event.clientX-rect.left)/rect.width*2-1));
      pointer.targetY = Math.max(-1,Math.min(1,1-(event.clientY-rect.top)/rect.height*2));
      stillFrame = false;
    });
    surface.addEventListener('pointerleave', () => {
      pointer.targetX=0;
      pointer.targetY=0;
      stillFrame=false;
    });
  }

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
