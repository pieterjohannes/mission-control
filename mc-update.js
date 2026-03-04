const Database = require('better-sqlite3');
const db = new Database('/Users/pieter/clawd/data/mission-control.db');
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 5000');

const subtasks = JSON.stringify([
  {title: 'Detect geolocation permission and request on first use', done: false},
  {title: 'Calculate distances from user position to all ferry terminals', done: false},
  {title: 'Auto-select nearest terminal and highlight in UI', done: false},
  {title: 'Show distance indicator near terminal selector', done: false},
  {title: 'Persist last-known terminal as fallback', done: false},
  {title: 'Add manual override if GPS unavailable', done: false}
]);

db.prepare('UPDATE issues SET status = ?, subtasks = ?, updated_at = datetime(\'now\') WHERE id = ?').run('in_progress', subtasks, 'ferr-0d423d07');
db.prepare('INSERT INTO activity_log (agent, action, detail, issue_id, created_at) VALUES (?, ?, ?, ?, datetime(\'now\'))').run('kai', 'picked_up', 'Moved to in_progress with subtasks', 'ferr-0d423d07');

// Log heartbeat
db.prepare('INSERT INTO activity_log (agent, action, detail, issue_id, created_at) VALUES (?, ?, ?, NULL, datetime(\'now\'))').run('kai', 'heartbeat', 'Loop ran: 0 urgent/high issues, picked up ferr-0d423d07 GPS feature');

db.close();
console.log('Done');
