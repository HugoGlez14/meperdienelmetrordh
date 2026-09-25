import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import React, {act} from 'react';
import {JSDOM} from 'jsdom';
import {createServer} from 'vite';

const network = {
  routes: [{route_id: 'r1', route_short_name: '1', route_long_name: 'Ruta de prueba', route_color: 'BE1830', shapeIds: ['s1']}],
  stops: [
    {stop_id: 'a', stop_name: 'Origen de prueba', stop_lat: '19.40', stop_lon: '-99.16'},
    {stop_id: 'b', stop_name: 'Destino de prueba', stop_lat: '19.42', stop_lon: '-99.15'},
  ],
  shapes: {s1: [[19.40, -99.16], [19.42, -99.15]]},
};

// jsdom cannot paint pseudo-elements. Inspect the parsed CSS and match their
// host selectors against the actual mounted DOM, including relational :has().
function viewportPseudoOverlays(sheet, body) {
  const overlays = [];
  function inspect(rules) {
    for (const rule of rules) {
      if (rule.cssRules) inspect(rule.cssRules);
      if (!rule.selectorText || rule.style.position !== 'fixed') continue;
      const zero = value => /^(?:0(?:px)?|0(?:px)?\s+0(?:px)?)$/.test(value.trim());
      const coversViewport = zero(rule.style.getPropertyValue('inset')) ||
        ['top', 'right', 'bottom', 'left'].every(side => zero(rule.style.getPropertyValue(side)));
      if (!coversViewport) continue;
      const content = rule.style.getPropertyValue('content');
      if (!content || content === 'none' || content === 'normal') continue;
      for (const selector of rule.selectorText.split(/,(?![^()]*\))/)) {
        if (!/::?(?:before|after)\s*$/.test(selector)) continue;
        const host = selector.replace(/::?(?:before|after)\s*$/, '').trim();
        if (body.matches(host)) overlays.push(selector);
      }
    }
  }
  inspect(sheet.cssRules);
  return overlays;
}

test('Metrobús remains usable while live positions are pending and its route form is incomplete', async () => {
  const dom = new JSDOM('<!doctype html><html><head></head><body><div id="root"></div></body></html>', {
    url: 'http://127.0.0.1:5173/metrobus',
    pretendToBeVisual: true,
  });
  const originals = new Map();
  const expose = (key, value) => {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, {configurable: true, writable: true, value});
  };
  let server, root, liveSignal;
  let livePending = false;
  const requests = [];
  try {
    for (const key of ['window', 'document', 'navigator', 'HTMLElement', 'Node', 'Event']) expose(key, dom.window[key]);
    expose('IS_REACT_ACT_ENVIRONMENT', true);
    expose('fetch', (url, {signal} = {}) => {
      requests.push(url);
      if (url === '/api/metrobus/network') return Promise.resolve({ok: true, json: async () => network});
      if (url === '/api/metrobus/live') {
        liveSignal = signal;
        livePending = true;
        return new Promise((resolve, reject) => {
          signal.addEventListener('abort', () => {
            livePending = false;
            reject(new DOMException('Aborted', 'AbortError'));
          }, {once: true});
        });
      }
      throw new Error('Unexpected request: ' + url);
    });
    const style = dom.window.document.createElement('style');
    style.textContent = await readFile(new URL('../src/style.css', import.meta.url), 'utf8');
    dom.window.document.head.append(style);
    assert.ok(style.sheet, 'application CSS must be parsed for the overlay regression check');
    server = await createServer({
      root: fileURLToPath(new URL('../', import.meta.url)),
      configFile: false,
      server: {middlewareMode: true},
      appType: 'custom',
      optimizeDeps: {noDiscovery: true},
    });
    const {default: MetrobusLive} = await server.ssrLoadModule('/src/MetrobusLive.jsx');
    const {createRoot} = await import('react-dom/client');
    root = createRoot(dom.window.document.getElementById('root'));
    await act(async () => {
      root.render(React.createElement(MetrobusLive, {mobile: false}));
    });

    assert.ok(requests.includes('/api/metrobus/network'));
    assert.ok(requests.includes('/api/metrobus/live'));
    assert.equal(livePending, true, 'this scenario must not wait for live positions to finish');
    const document = dom.window.document;
    assert.ok(document.querySelector('.mb-map svg polyline'), 'static routes render while live positions are pending');
    const [origin, destination] = document.querySelectorAll('form input[role="combobox"]');
    assert.ok(origin && destination, 'both stop selectors must render');
    assert.equal(origin.disabled, false);
    assert.equal(destination.disabled, false);
    const calculate = document.querySelector('form .search-button');
    assert.equal(calculate.disabled, true, 'an incomplete journey must remain invalid');
    assert.notEqual(calculate.getAttribute('aria-busy'), 'true', 'invalid is not loading');
    assert.equal(document.querySelector('.page-loader'), null);
    assert.deepEqual(viewportPseudoOverlays(style.sheet, document.body), [], 'a disabled calculate button must not create a blocking CSS overlay');

    // Prove this check catches the original bug, rather than merely searching
    // for one particular selector string in the application's stylesheet.
    const control = document.createElement('style');
    control.textContent = 'body:has(.search-button:disabled)::before {content:"";position:fixed;inset:0;z-index:90}';
    document.head.append(control);
    assert.equal(viewportPseudoOverlays(control.sheet, document.body).length, 1);
    control.remove();

    await act(async () => {
      origin.focus();
    });
    await act(async () => {
      const option = [...document.querySelectorAll('[role="option"]')].find(element => element.textContent.includes('Indios Verdes'));
      option.click();
    });
    assert.equal(calculate.disabled, true, 'a destination is still required');
    await act(async () => {
      destination.focus();
    });
    await act(async () => {
      const option = [...document.querySelectorAll('[role="option"]')].find(element => element.textContent.includes('El Caminero'));
      option.click();
    });
    assert.equal(origin.value, 'Indios Verdes');
    assert.equal(destination.value, 'El Caminero');
    assert.equal(calculate.disabled, false, 'the user can prepare a journey while live positions remain pending');
    assert.equal(livePending, true);
    assert.deepEqual(viewportPseudoOverlays(style.sheet, document.body), []);
  } finally {
    if (root) await act(async () => root.unmount());
    if (liveSignal) assert.equal(liveSignal.aborted, true, 'unmount must cancel the pending live request');
    if (server) await server.close();
    dom.window.close();
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
});

test('Metrobús falls back to the bundled planner when the local API is unavailable', async () => {
  const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
    url: 'http://127.0.0.1:5173/metrobus',
    pretendToBeVisual: true,
  });
  const originals = new Map();
  const expose = (key, value) => {
    originals.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, {configurable: true, writable: true, value});
  };
  let server, root;
  try {
    for (const key of ['window', 'document', 'navigator', 'HTMLElement', 'Node', 'Event']) expose(key, dom.window[key]);
    expose('IS_REACT_ACT_ENVIRONMENT', true);
    expose('fetch', async () => ({ok: false, status: 503, json: async () => ({})}));
    server = await createServer({
      root: fileURLToPath(new URL('../', import.meta.url)),
      configFile: false,
      server: {middlewareMode: true},
      appType: 'custom',
      optimizeDeps: {noDiscovery: true},
    });
    const {default: MetrobusLive} = await server.ssrLoadModule('/src/MetrobusLive.jsx');
    const {createRoot} = await import('react-dom/client');
    root = createRoot(dom.window.document.getElementById('root'));
    await act(async () => {
      root.render(React.createElement(MetrobusLive, {mobile: false}));
      await new Promise(resolve => setTimeout(resolve, 0));
    });

    const document = dom.window.document;
    assert.match(document.body.textContent, /Planificador local activo/);
    assert.doesNotMatch(document.body.textContent, /El servicio local de Metrobús no está disponible/);
    assert.ok(document.querySelector('input[aria-label="Estoy en"]'));
    assert.ok(document.querySelector('input[aria-label="Quiero ir a"]'));
    assert.ok(document.querySelector('.mb-map svg'), 'the bundled schematic map must be visible');
  } finally {
    if (root) await act(async () => root.unmount());
    if (server) await server.close();
    dom.window.close();
    for (const [key, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  }
});
