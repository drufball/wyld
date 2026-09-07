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

  function send(message) { parentWindow.postMessage(message, '*'); }
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
  window.addEventListener('message', function (event) {
    if (event.source !== parentWindow) return;
    var data = event.data;
    if (!data || typeof data !== 'object') return;
    if (data.type === 'wyld:pin:hello') {
      ready();
    } else if (data.type === 'wyld:pin:mode') {
      on = data.on === true; document.documentElement.classList.toggle('wyld-pin-mode', on);
    } else if (data.type === 'wyld:pin:locate') {
      wanted = Array.isArray(data.elements) ? data.elements : []; sendRects();
    }
  });
  window.addEventListener('resize', scheduleRects);
  window.addEventListener('scroll', scheduleRects, true);
  var style = document.createElement('style');
  style.textContent = '.wyld-pin-mode [data-pin]{outline:2px dashed #bd93f9;outline-offset:2px;cursor:crosshair}' + '.wyld-pin-mode [data-pin]:hover{outline-style:solid;background:rgba(189,147,249,0.12)}';
  document.head.appendChild(style);
  function ready() { send({ type: 'wyld:pin:ready' }); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', ready); else ready();
  window.addEventListener('load', ready);
})();`;

export const PIN_BRIDGE_SNIPPET = `<script>\n${PIN_BRIDGE_SOURCE}\n</script>`;

export type PinRect = { x: number; y: number; w: number; h: number };
export type PinPick = { element: string; label: string; rect: PinRect };

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
  onPick: (pick: PinPick) => void;
  onRects: (rects: Record<string, PinRect>) => void;
  target?: Window;
}) {
  const target = options.target ?? window;
  const receive = (event: MessageEvent) => {
    const source = options.frame.contentWindow;
    if (source === null || event.source !== source || !plain(event.data)) return;
    const data = event.data;
    if (typeof data.type !== 'string' || !data.type.startsWith('wyld:pin:')) return;
    if (data.type === 'wyld:pin:ready') options.onReady();
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
    stop: () => {
      target.removeEventListener('message', receive);
      if (typeof options.frame.removeEventListener === 'function')
        options.frame.removeEventListener('load', hello);
    },
  };
}
