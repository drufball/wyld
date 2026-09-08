/**
 * Artifact frames are sandboxed without `allow-same-origin`, so their DOM is inaccessible.
 * Pins communicate exclusively through postMessage and therefore only work in explainers
 * that embed `PIN_BRIDGE_SNIPPET`.
 */
export const PIN_BRIDGE_SOURCE = `(function () {
  var parentWindow = window.parent;
  if (!parentWindow || parentWindow === window) return;
  var on = false;
  var wanted = [];
  var pending = false;
  var held = false;
  var captures = {};

  function send(message) { parentWindow.postMessage(message, '*'); }
  function modifierHeld(event) { return navigator.userAgent.includes('Mac') ? event.metaKey : event.ctrlKey; }
  function reportHeld(next) {
    if (held === next) return;
    held = next;
    send({ type: 'wyld:pin:key', held: held });
  }
  function rectOf(el) { var r = el.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; }
  function labelOf(el) {
    var explicit = el.getAttribute('data-pin-label');
    var text = explicit === null ? (el.textContent || '').replace(/\\s+/g, ' ').trim() : explicit;
    return (text || el.getAttribute('data-pin')).slice(0, 80);
  }
  function sendRects() {
    var rects = {};
    var nodes = document.querySelectorAll('[data-pin]');
    for (var i = 0; i < nodes.length; i++) {
      var id = nodes[i].getAttribute('data-pin');
      if (wanted.indexOf(id) !== -1) rects[id] = rectOf(nodes[i]);
    }
    send({ type: 'wyld:pin:rects', rects: rects });
  }
  function scheduleRects() {
    if (pending || wanted.length === 0) return;
    pending = true;
    requestAnimationFrame(function () { pending = false; sendRects(); });
  }
  document.addEventListener('click', function (event) {
    if (!on) return;
    var el = event.target && event.target.closest ? event.target.closest('[data-pin]') : null;
    if (!el) return;
    event.preventDefault(); event.stopPropagation();
    send({ type: 'wyld:pin:pick', element: el.getAttribute('data-pin'), label: labelOf(el), rect: rectOf(el) });
  }, true);
  window.addEventListener('keydown', function (event) { if (modifierHeld(event)) reportHeld(true); });
  window.addEventListener('keyup', function (event) { if (!modifierHeld(event)) reportHeld(false); });
  window.addEventListener('blur', function () { reportHeld(false); });
  document.addEventListener('visibilitychange', function () { if (document.hidden) reportHeld(false); });
  window.addEventListener('message', function (event) {
    var data = event.data;
    if (!data || typeof data !== 'object') return;
    if (event.source !== parentWindow) {
      if (data.type !== 'wyld:demo:capture:result' || !Object.prototype.hasOwnProperty.call(captures, data.id)) return;
      clearTimeout(captures[data.id]); delete captures[data.id];
      send({ type: 'wyld:pin:capture:result', id: data.id, capture: { screenshot: data.screenshot, state: data.state } });
      return;
    }
    if (data.type === 'wyld:pin:hello') {
      ready();
    } else if (data.type === 'wyld:pin:mode') {
      on = data.on === true; document.documentElement.classList.toggle('wyld-pin-mode', on);
    } else if (data.type === 'wyld:pin:locate') {
      wanted = Array.isArray(data.elements) ? data.elements : []; sendRects();
    } else if (data.type === 'wyld:pin:capture') {
      var nodes = document.querySelectorAll('[data-pin]'); var el = null;
      for (var j = 0; j < nodes.length; j++) if (nodes[j].getAttribute('data-pin') === String(data.element)) { el = nodes[j]; break; }
      var embed = el && (el.matches('iframe[data-wyld-demo]') ? el : el.querySelector('iframe[data-wyld-demo]'));
      if (!embed || !embed.contentWindow) { send({ type: 'wyld:pin:capture:result', id: data.id, capture: null }); return; }
      captures[data.id] = setTimeout(function () { delete captures[data.id]; send({ type: 'wyld:pin:capture:result', id: data.id, capture: null }); }, 2000);
      embed.contentWindow.postMessage({ type: 'wyld:demo:capture', id: data.id }, '*');
    }
  });
  window.addEventListener('resize', scheduleRects);
  window.addEventListener('scroll', scheduleRects, true);
  var style = document.createElement('style');
  style.textContent = '.wyld-pin-mode [data-pin]{outline:2px dashed #bd93f9;outline-offset:2px;cursor:crosshair}' + '.wyld-pin-mode [data-pin]:hover{outline-style:solid;background:rgba(189,147,249,0.12)}' + 'iframe[data-wyld-demo]{display:block;width:100%;border:0;background:#000;max-width:100%}' + 'iframe[data-wyld-demo="landscape"]{aspect-ratio:16/9}' + 'iframe[data-wyld-demo="portrait"]{aspect-ratio:9/16;width:auto;height:auto;max-height:70svh;margin-inline:auto}' + '.wyld-pin-mode iframe[data-wyld-demo]{pointer-events:none}';
  document.head.appendChild(style);
  function ready() { send({ type: 'wyld:pin:ready' }); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready); else ready();
  window.addEventListener('load', ready);
})();`;

export const PIN_BRIDGE_SNIPPET = `<script>\n${PIN_BRIDGE_SOURCE}\n</script>`;

export type PinRect = { x: number; y: number; w: number; h: number };
export type PinPick = { element: string; label: string; rect: PinRect };
export type PinCapture = { screenshot: string | null; state: unknown };

export function pinModifierHeld(event: { metaKey: boolean; ctrlKey: boolean }): boolean {
  return navigator.userAgent.includes('Mac') ? event.metaKey : event.ctrlKey;
}

const plain = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const rect = (value: unknown): value is PinRect =>
  plain(value) &&
  ['x', 'y', 'w', 'h'].every(
    (key) => typeof value[key] === 'number' && Number.isFinite(value[key]),
  );

export function createPinBridge(options: {
  frame: { contentWindow: Window | null } & Partial<
    Pick<HTMLIFrameElement, 'addEventListener' | 'removeEventListener'>
  >;
  onReady: () => void;
  onKeyHold: (held: boolean) => void;
  onPick: (pick: PinPick) => void;
  onRects: (rects: Record<string, PinRect>) => void;
  target?: Window;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (timer: unknown) => void;
}) {
  const target = options.target ?? window;
  const setTimer = options.setTimer ?? setTimeout;
  const clearTimer =
    options.clearTimer ??
    ((timer: unknown) => clearTimeout(timer as ReturnType<typeof setTimeout>));
  let captureId = 0;
  const captures = new Map<
    number,
    { resolve: (capture: PinCapture | null) => void; timer: unknown }
  >();
  const receive = (event: MessageEvent) => {
    const source = options.frame.contentWindow;
    if (source === null || event.source !== source || !plain(event.data)) return;
    const data = event.data;
    if (typeof data.type !== 'string' || !data.type.startsWith('wyld:pin:')) return;
    if (data.type === 'wyld:pin:capture:result' && typeof data.id === 'number') {
      const pending = captures.get(data.id);
      if (!pending) return;
      captures.delete(data.id);
      clearTimer(pending.timer);
      if (!plain(data.capture)) pending.resolve(null);
      else
        pending.resolve({
          screenshot:
            typeof data.capture.screenshot === 'string' &&
            /^data:image\/(jpeg|png);base64,/.test(data.capture.screenshot)
              ? data.capture.screenshot
              : null,
          state: data.capture.state,
        });
    } else if (data.type === 'wyld:pin:ready') options.onReady();
    else if (data.type === 'wyld:pin:key' && typeof data.held === 'boolean')
      options.onKeyHold(data.held);
    else if (
      data.type === 'wyld:pin:pick' &&
      typeof data.element === 'string' &&
      data.element.length > 0 &&
      typeof data.label === 'string' &&
      data.label.trim().length > 0 &&
      rect(data.rect)
    )
      options.onPick({ element: data.element, label: data.label, rect: data.rect });
    else if (data.type === 'wyld:pin:rects' && plain(data.rects))
      options.onRects(
        Object.fromEntries(
          Object.entries(data.rects).filter((entry): entry is [string, PinRect] => rect(entry[1])),
        ),
      );
  };
  const post = (message: object) => options.frame.contentWindow?.postMessage(message, '*');
  const hello = () => post({ type: 'wyld:pin:hello' });
  target.addEventListener('message', receive);
  hello();
  if (typeof options.frame.addEventListener === 'function')
    options.frame.addEventListener('load', hello);
  return {
    setMode: (on: boolean) => post({ type: 'wyld:pin:mode', on }),
    locate: (elements: string[]) => post({ type: 'wyld:pin:locate', elements }),
    capture: (element: string) =>
      new Promise<PinCapture | null>((resolve) => {
        const id = ++captureId;
        const timer = setTimer(() => {
          captures.delete(id);
          resolve(null);
        }, 3000);
        captures.set(id, { resolve, timer });
        post({ type: 'wyld:pin:capture', id, element });
      }),
    stop: () => {
      target.removeEventListener('message', receive);
      if (typeof options.frame.removeEventListener === 'function')
        options.frame.removeEventListener('load', hello);
      for (const pending of captures.values()) {
        clearTimer(pending.timer);
        pending.resolve(null);
      }
      captures.clear();
    },
  };
}
