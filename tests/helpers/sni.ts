export interface Command {
  Opcode: string;
  Space: string;
  Operands?: string[];
}

export class FakeSniSocket {
  static readonly CONNECTING = 0;
  static readonly OPEN = 1;
  static readonly CLOSING = 2;
  static readonly CLOSED = 3;
  static instances: FakeSniSocket[] = [];
  static failConstruction = false;
  readyState = FakeSniSocket.CONNECTING;
  binaryType = '';
  onopen: ((event: Event) => void) | null = null;
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  onclose: ((event: CloseEvent) => void) | null = null;
  sent: { command: Command; time: number }[] = [];
  closeCount = 0;

  constructor(public url: string) {
    if (FakeSniSocket.failConstruction) throw new Error('Bridge unavailable');
    FakeSniSocket.instances.push(this);
  }

  send(message: string) {
    if (this.readyState !== FakeSniSocket.OPEN) throw new Error('Socket not open');
    this.sent.push({ command: JSON.parse(message) as Command, time: Date.now() });
  }

  open() {
    this.readyState = FakeSniSocket.OPEN;
    this.onopen?.(new Event('open'));
  }

  message(data: string | ArrayBuffer) {
    this.onmessage?.(new MessageEvent('message', { data }));
  }

  fail() { this.onerror?.(new Event('error')); }

  close() {
    this.closeCount += 1;
    this.readyState = FakeSniSocket.CLOSED;
    this.onclose?.(new CloseEvent('close', { reason: 'Fixture closed' }));
  }

  get lastCommand() { return this.sent.at(-1)?.command; }
}

export function memoryFrame(overrides: Partial<{
  maxChecks: number; checkCount: number; bonks: number; chestTurns: number;
  deaths: number; rupees: number; screens: number; damage: number; magic: number;
}> = {}) {
  const bytes = new Uint8Array(0x4FF);
  const stats = { maxChecks: 216, checkCount: 0, bonks: 0, chestTurns: 0, deaths: 0, rupees: 0, screens: 0, damage: 0, magic: 0, ...overrides };
  for (const [offset, value] of [
    [0x33E, stats.maxChecks], [0x423, stats.checkCount], [0x42B, stats.rupees],
    [0x43C, stats.screens], [0x46A, stats.damage], [0x46C, stats.magic],
  ]) {
    bytes[offset] = value % 256;
    bytes[offset + 1] = Math.floor(value / 256);
  }
  bytes[0x420] = stats.bonks;
  bytes[0x468] = stats.chestTurns;
  bytes[0x449] = stats.deaths;
  return bytes.buffer;
}