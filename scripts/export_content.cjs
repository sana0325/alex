// Витягує тексти з www/js/data.js у content.json для озвучення
const fs = require('fs'), vm = require('vm'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../www/js/data.js'), 'utf8');
const c = {}; vm.createContext(c);
vm.runInContext(src + ';this.out={EX,SESSIONS,BOOKS,CUES};', c);
const {EX, SESSIONS, BOOKS, CUES} = c.out;
const out = {
  exercises: Object.fromEntries(Object.entries(EX).map(([k, e]) => [k, {n: e.n, d: e.d}])),
  sessions: SESSIONS.map(s => ({id: s.id, mood: s.mood, voice: s.voice, hypno: !!s.hypno, lines: s.lines})),
  books: BOOKS.map(b => ({id: b.id, ch: b.ch})),
  cues: CUES,
};
fs.writeFileSync(process.argv[2] || 'content.json', JSON.stringify(out, null, 1));
console.log('exercises', Object.keys(out.exercises).length, 'sessions', out.sessions.length, 'books', out.books.length);
