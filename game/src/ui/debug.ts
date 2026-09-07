type DebugCommand = { help: string; run(args: string[]): string };

type DebugConsoleOptions = { seed: number; available?: boolean };

const createDebugConsole = ({
  seed,
  available = import.meta.env.DEV ||
    new URLSearchParams(window.location.search).get('debug') === '1',
}: DebugConsoleOptions) => {
  const commands = new Map<string, DebugCommand>();
  let open = false;
  let overlay: HTMLDivElement | undefined;
  let scrollback: HTMLDivElement | undefined;
  let input: HTMLInputElement | undefined;

  const registerCommand = (name: string, command: DebugCommand): void => {
    commands.set(name.toLowerCase(), command);
  };
  const run = (source: string): string => {
    if (!available) return 'debug console disabled';
    const [name = '', ...args] = source.trim().split(/\s+/);
    if (!name) return '';
    return commands.get(name.toLowerCase())?.run(args) ?? `unknown command: ${name}`;
  };
  registerCommand('help', {
    help: 'list available commands',
    run: () => [...commands].map(([name, command]) => `${name} — ${command.help}`).join('\n'),
  });
  registerCommand('seed', { help: 'show the current world seed', run: () => `seed: ${seed}` });

  const append = (line: string): void => {
    if (!scrollback) return;
    scrollback.textContent += `${line}\n`;
    scrollback.scrollTop = scrollback.scrollHeight;
  };
  const setOpen = (next: boolean): void => {
    open = next;
    if (!overlay || !input) return;
    overlay.hidden = !open;
    if (open) input.focus();
  };
  const keyDown = (event: KeyboardEvent): void => {
    if (event.code !== 'Backquote') return;
    event.preventDefault();
    setOpen(!open);
  };
  if (available) {
    overlay = document.createElement('div');
    overlay.hidden = true;
    overlay.style.cssText =
      'position:fixed;z-index:10;left:5vw;right:5vw;top:5vh;max-height:45vh;padding:14px;background:repeating-linear-gradient(#f5f0dc 0,#f5f0dc 25px,#c9c1a4 26px);color:#25291f;border:1px solid #55584b;box-shadow:0 5px 24px #0008;font:14px/26px ui-monospace,monospace';
    scrollback = document.createElement('div');
    scrollback.style.cssText = 'height:30vh;overflow:auto;white-space:pre-wrap';
    input = document.createElement('input');
    input.setAttribute('aria-label', 'Debug command');
    input.spellcheck = false;
    input.style.cssText =
      'box-sizing:border-box;width:100%;height:28px;border:1px solid #777;background:#fffbea;color:#25291f;font:inherit;outline:none';
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' && input) {
        const source = input.value;
        append(`> ${source}\n${run(source)}`);
        input.value = '';
      }
    });
    overlay.append(scrollback, input);
    document.body.append(overlay);
    window.addEventListener('keydown', keyDown);
  }
  return {
    available,
    get isOpen(): boolean {
      return open;
    },
    registerCommand,
    run,
    dispose(): void {
      window.removeEventListener('keydown', keyDown);
      overlay?.remove();
    },
  };
};

export { createDebugConsole };
export type { DebugCommand, DebugConsoleOptions };
