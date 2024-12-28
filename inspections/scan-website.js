require('dotenv').config();
const puppeteer = require('puppeteer');
const axe = require('axe-core');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

// Database configuration
const dbPath = process.env.DB_PATH;
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error(`[${new Date().toISOString()}] ERROR: Error connecting to database:`, err.message);
    process.exit(1);
  }
});

// Mapping of WCAG tags to affected user groups
const wcagToUserGroups = {
  'wcag111': ['Blind', 'Low Vision'],
  'wcag131': ['Cognitive Disabilities'],
  'wcag244': ['Motor Impairments'],
  'wcag412': ['Low Vision', 'Cognitive Disabilities'],
};

// Helper functions
const getAffectedUserGroups = (tags) => {
  const userGroups = new Set();
  tags.forEach((tag) => {
    if (wcagToUserGroups[tag]) {
      wcagToUserGroups[tag].forEach((group) => userGroups.add(group));
    }
  });
  return Array.from(userGroups);
};

const escapeHtml = (html) => {
  return html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

const runQuery = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

const runSingleQuery = (query, params = []) => {
  return new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
};

const insertBarrier = (params) => {
  const barrierQuery = `
    INSERT INTO barriers (
      inspection_id, url, rule, impact, description, 
      wcag_tags, wcag_or_best_practice, affected_user_groups, 
      help_url, node_targets, html
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  return new Promise((resolve, reject) => {
    db.run(barrierQuery, params, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
};

const closeDatabase = () => {
  db.close((err) => {
    if (err) console.error(`[${new Date().toISOString()}] ERROR: Error closing the database:`, err.message);
  });
};

// Command-line arguments
if (process.argv.length < 3) {
  console.error(`[${new Date().toISOString()}] ERROR: Usage: node scan-website.js <url_or_filepath> [--baseline]`);
  process.exit(1);
}

let urlOrFilePath = process.argv[2];
const isBaseline = process.argv.includes('--baseline');
const isLocalFile = fs.existsSync(urlOrFilePath);

if (isLocalFile) {
  urlOrFilePath = `file://${path.resolve(urlOrFilePath)}`;
}

(async () => {
  const browser = await puppeteer.launch();
  try {
    const page = await browser.newPage();
    console.log(`[${new Date().toISOString()}] INFO: Analyzing accessibility for: ${urlOrFilePath}`);
    await page.goto(urlOrFilePath);

    // Inject axe-core and run analysis
    await page.addScriptTag({ path: require.resolve('axe-core') });
    const results = await page.evaluate(async () => {
      return await axe.run();
    });

    if (!isBaseline) {
      const baselineExists = await runSingleQuery(
        `SELECT 1 FROM inspections WHERE url = ? AND is_baseline = 'true'`,
        [urlOrFilePath]
      );

      if (!baselineExists) {
        console.error(`[${new Date().toISOString()}] ERROR: No baseline exists for ${urlOrFilePath}. Please run a baseline scan first.`);
        return;
      }
    }

    const environment = isLocalFile ? 'local' : 'production';
    const inspectionQuery = `INSERT INTO inspections (url, environment, is_baseline) VALUES (?, ?, ?)`;
    const inspectionParams = [urlOrFilePath, environment, isBaseline ? 'true' : 'false'];

    const inspectionId = await new Promise((resolve, reject) => {
      db.run(inspectionQuery, inspectionParams, function (err) {
        if (err) reject(err);
        else resolve(this.lastID);
      });
    });

    for (const violation of results.violations) {
      const wcagTags = violation.tags.filter((tag) => tag.startsWith('wcag'));
      const wcagOrBestPractice = wcagTags.length ? 'WCAG Guideline' : 'Best Practice Only';
      const affectedUserGroups = getAffectedUserGroups(wcagTags);

      for (const node of violation.nodes) {
        const nodeTargets = node.target.join(', ');
        const escapedHtml = escapeHtml(node.html);

        const barrierExists = await runSingleQuery(
          `SELECT 1 FROM barriers WHERE rule = ? AND node_targets = ? AND url = ?`,
          [violation.id, nodeTargets, urlOrFilePath]
        );

        if (!barrierExists) {
          await insertBarrier([
            inspectionId,
            urlOrFilePath,
            violation.id,
            violation.impact,
            violation.description,
            wcagTags.join(', ') || 'None',
            wcagOrBestPractice,
            affectedUserGroups.join(', ') || 'None',
            violation.helpUrl,
            nodeTargets,
            escapedHtml,
          ]);
        } else {
          console.log(`[${new Date().toISOString()}] INFO: Skipping duplicate barrier: ${violation.id} on target ${nodeTargets}`);
        }
      }
    }

    console.log(`[${new Date().toISOString()}] INFO: ${isBaseline ? 'Baseline scan' : 'Scan'} completed for ${urlOrFilePath}.`);

    if (!isBaseline) {
      console.log(`[${new Date().toISOString()}] INFO: Invoking baseline comparison for ${urlOrFilePath}`);
      const compareProcess = spawn('node', ['inspections/compare-baseline.js', urlOrFilePath], {
        stdio: 'inherit',
      });

      compareProcess.on('close', (code) => {
        if (code !== 0) {
          console.error(`[${new Date().toISOString()}] ERROR: compare-baseline.js exited with code ${code}`);
        } else {
          console.log(`[${new Date().toISOString()}] INFO: Baseline comparison complete for ${urlOrFilePath}`);
        }
      });
    }
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ERROR: Error analyzing ${urlOrFilePath}:`, error);
  } finally {
    await browser.close();
    closeDatabase();
  }
})();
