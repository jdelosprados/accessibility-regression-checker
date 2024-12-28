const sqlite3 = require('sqlite3').verbose();
const path = require('path');
require('dotenv').config();


const dbPath = process.env.DB_PATH;
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Error connecting to the database:', err.message);
    process.exit(1);
  }
  console.log('Connected to SQLite database.');
});

const createTables = `
CREATE TABLE IF NOT EXISTS inspections (
    inspection_id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT NOT NULL,
    environment TEXT,
    inspected_on DATETIME DEFAULT CURRENT_TIMESTAMP,
    is_baseline TEXT
);

CREATE TABLE IF NOT EXISTS barriers (
    barrier_id INTEGER PRIMARY KEY AUTOINCREMENT,
    inspection_id INTEGER NOT NULL,
    url TEXT NOT NULL,
    rule TEXT,
    impact TEXT,
    description TEXT,
    wcag_tags TEXT,
    wcag_or_best_practice TEXT,
    affected_user_groups TEXT,
    help_url TEXT,
    node_targets TEXT,
    html TEXT,
    FOREIGN KEY (inspection_id) REFERENCES inspections (inspection_id)
);
`;

db.exec(createTables, (err) => {
  if (err) {
    console.error('Error creating tables:', err.message);
  } else {
    console.log('Tables created successfully.');
  }
  db.close((err) => {
    if (err) {
      console.error('Error closing the database:', err.message);
    } else {
      console.log('Database connection closed.');
    }
  });
});
