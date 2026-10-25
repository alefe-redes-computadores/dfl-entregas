const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const scheduled = [];
let permission = 'granted';
let failSchedule = false;
const cache = new Map();
class Clock extends Date {
  constructor(...args) { super(...(args.length ? args : ['2026-10-15T12:00:00Z'])); }
  static now() { return new Date('2026-10-15T12:00:00Z').getTime(); }
}
function load(file) {
  if (cache.has(file)) return cache.get(file).exports;
  const module = { exports: {} }; cache.set(file, module);
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText, {
    module, exports: module.exports, Date: Clock, Intl,
    console: { ...console, error: () => {} },
    require(id) {
      if (id === '@capacitor/core') return { Capacitor: { isNativePlatform: () => true, getPlatform: () => 'android' } };
      if (id === '@capacitor/app') return { App: { getState: async () => ({ isActive: false }) } };
      if (id === '@capacitor/local-notifications') return { LocalNotifications: {
        createChannel: async () => {}, checkPermissions: async () => ({ display: permission }),
        getPending: async () => ({ notifications: [] }), cancel: async () => {},
        schedule: async ({ notifications }) => { if (failSchedule) throw Error('offline plugin'); scheduled.push(...notifications); },
      } };
      if (id.startsWith('@/')) return load(id.slice(2) + '.ts');
      throw Error(id);
    },
  }, { filename: file });
  return module.exports;
}
async function run() {
  const n = load('lib/native/notifications.ts');
  assert.equal(await n.notifyIfoodRoutePending('disabled', 'Rota', 2, { enabled: false }), false);
  assert.equal(await n.notifyIfoodRoutePending('disabled-category', 'Rota', 2, { ifoodPending: false }), false);
  assert.equal(scheduled.length, 0);
  const concurrent = await Promise.all([n.notifyIfoodRoutePending('mixed route', 'Rota', 2), n.notifyIfoodRoutePending('mixed route', 'Rota', 2)]);
  assert.equal(concurrent.filter(Boolean).length, 1);
  assert.equal(scheduled.length, 1);
  assert.equal(scheduled[0].extra.href, '/confirmacoes?route=mixed%20route');
  failSchedule = true;
  assert.equal(await n.notifyIfoodRoutePending('retry', 'Rota', 1), false);
  failSchedule = false;
  assert.equal(await n.notifyIfoodRoutePending('retry', 'Rota', 1), true);
  const preferences = Object.fromEntries(Object.keys(n.DEFAULT_NOTIFICATION_PREFERENCES).map(key => [key, false]));
  Object.assign(preferences, { enabled: true, ifoodAdsBeforeOpen: true, ifoodAdsAfterClose: true });
  const settings = { notificationPreferences: preferences, schedule: { 4: { active: true, shifts: [{ start: '18:00', end: '01:00' }] } } };
  scheduled.length = 0;
  await n.syncShiftNotifications(settings);
  assert.equal(scheduled.length, 6); // three Thursdays, two reminders each
  assert.equal(scheduled[0].schedule.at.toISOString(), '2026-10-15T20:55:00.000Z');
  assert.equal(scheduled[1].schedule.at.toISOString(), '2026-10-16T04:15:00.000Z');
  assert.equal(new Set(scheduled.map(item => item.id)).size, scheduled.length);
  scheduled.length = 0;
  await n.syncShiftNotifications({ ...settings, pauses: [{ start_date: '2026-10-15', end_date: '2026-11-10' }] });
  assert.equal(scheduled.length, 0);
  await n.syncShiftNotifications({ ...settings, holidaysOverrides: { '2026-10-15': { active: false } } });
  assert.equal(scheduled.length, 4);
  scheduled.length = 0; permission = 'denied';
  await n.syncShiftNotifications(settings);
  assert.equal(scheduled.length, 0);

  const { customerDuplicateCandidates } = load('lib/customer-duplicates.ts');
  const identity = load('lib/customer-identity.ts');
  const customers = Array.from({ length: 120 }, (_, i) => ({
    id: String(i), name: ['Ana Silva', 'Ana Silva (2)', 'João Santos', 'Joao Santos', 'Maria Luz', ''][i % 6],
    address: 'Rua das Flores, ' + (i % 7 + 1), phone: i % 3 ? '3499999000' + (i % 5) : '',
  }));
  const expected = [];
  for (let i = 0; i < customers.length; i++) for (let j = i + 1; j < customers.length; j++) {
    const left=customers[i], right=customers[j];
    if (!identity.normalizeCustomerName(left.name) || identity.normalizeCustomerName(left.name) !== identity.normalizeCustomerName(right.name)) continue;
    const lp=identity.normalizeCustomerPhone(left.phone), rp=identity.normalizeCustomerPhone(right.phone);
    if (lp.length < 10 || lp !== rp) continue;
    const sameAddress=identity.sameCustomerAddress(left.address,right.address);
    expected.push({left:left.id,right:right.id,score:sameAddress?99:97});
  }
  expected.sort((a,b)=>b.score-a.score);
  const actual=customerDuplicateCandidates(customers, []).map(({left,right,score})=>({left:left.id,right:right.id,score}));
  assert.equal(JSON.stringify(actual),JSON.stringify(expected),'V80: identidade estrita exige nome-base e telefone compartilhado');
  const fixtures=[
    {id:'a',name:'Wesley Silva',phone:'34998887766',address:'Rua Central 10'},
    {id:'b',name:'Wesley Silva (2)',phone:'(34) 99888-7766',address:'Rua Central 50'},
    {id:'c',name:'Wesley Silva',phone:'34990001122',address:'Rua Central 10'},
    {id:'d',name:'Maria Silva',phone:'34998887766',address:'Rua Central 10'},
  ];
  const fixturePairs=customerDuplicateCandidates(fixtures, []);
  assert.equal(fixturePairs.length,1,'V80: somente nome e telefone iguais podem sugerir');
  assert.equal(fixturePairs[0].left.id,'a');
  assert.equal(fixturePairs[0].right.id,'b');
  assert.equal(fixturePairs[0].score,97,'V80: endereco distinto preserva sugestao, sem fusao automatica');
  const store = fs.readFileSync('store/useAppStore.ts', 'utf8');
  assert.match(store, /notifyIfoodRoutePending\([\s\S]{0,180}get\(\)\.storeSettings.notificationPreferences/);
  const page = fs.readFileSync('app/mais/notificacoes/page.tsx', 'utf8');
  assert.ok(page.includes('if (saveLock.current) return false'));
  assert.ok(page.includes('if (saved) toast.success'));
  assert.ok(page.includes('role="switch"'));
  console.log('V80 OK: preferências, concorrência, retry, deep link, turnos noturnos, pausas, exceções e equivalência de duplicados');
}
run().catch(error => { console.error(error); process.exitCode = 1; });
