require('dotenv').config();
const sqlite3 = require('sqlite3').verbose();
const axios = require('axios');

// Database configuration
const dbPath = process.env.DB_PATH;
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error(`[${new Date().toISOString()}] ERROR: Error connecting to database:`, err.message);
    process.exit(1);
  }
});

// Close the database connection
const closeDatabase = () => {
  db.close((err) => {
    if (err) console.error(`[${new Date().toISOString()}] ERROR: Error closing the database:`, err.message);
  });
};

// Environment variables
const webhookUrl = process.env.WEBHOOK_URL;
const authToken = process.env.WEBHOOK_SERVER_AUTH_TOKEN;

if (!webhookUrl || !authToken) {
  console.error(`[${new Date().toISOString()}] ERROR: Environment variables WEBHOOK_URL or WEBHOOK_SERVER_AUTH_TOKEN are missing.`);
  process.exit(1);
}

// Check arguments
if (process.argv.length < 3) {
  console.error(`[${new Date().toISOString()}] ERROR: Usage: node compare-baseline.js <url>`);
  process.exit(1);
}

const url = process.argv[2];

// Helper functions for database queries
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

// Helper function for generating HTML content for barriers
const generateBarrierHTML = (barrier) => {
  return `
    <hr>
    <p><strong>URL:</strong> ${barrier.url || 'N/A'}</p>
    <p><strong>Rule Violated:</strong> ${barrier.rule || 'N/A'}</p>
    <p><strong>WCAG Guideline or Best Practice:</strong> ${barrier.wcag_or_best_practice || 'N/A'}</p>
    <p><strong>Page Element:</strong> ${barrier.node_targets || 'N/A'}</p>
    <p><strong>More Rule Info:</strong> 
    <a href="${barrier.help_url || '#'}" target="_blank">${barrier.help_url || 'N/A'}</a>
    </p>
    <p><strong>Impact:</strong> ${barrier.impact || 'N/A'}</p>
    <p><strong>Description:</strong> ${barrier.description || 'N/A'}</p>
    <p><strong>HTML:</strong> ${barrier.html || 'N/A'}</p>
  `;
};

(async () => {
  try {
    console.log(`[${new Date().toISOString()}] INFO: Starting baseline comparison for URL: ${url}`);

    // Fetch baseline barriers
    const baselineBarriers = await runQuery(
      `SELECT b.* FROM barriers b
       INNER JOIN inspections i ON b.inspection_id = i.inspection_id
       WHERE i.is_baseline = 'true' AND i.url = ?`,
      [url]
    );
    console.log(`[${new Date().toISOString()}] INFO: Found ${baselineBarriers.length} baseline barriers.`);

    // Fetch latest non-baseline inspection ID
    const latestInspectionId = await runSingleQuery(
      `SELECT inspection_id 
       FROM inspections 
       WHERE is_baseline = 'false' AND url = ?
       ORDER BY inspected_on DESC 
       LIMIT 1`,
      [url]
    );

    if (!latestInspectionId) {
      console.log(`[${new Date().toISOString()}] INFO: No non-baseline inspections found for URL: ${url}.`);
      return closeDatabase();
    }

    // Fetch barriers for the latest non-baseline inspection
    const nonBaselineBarriers = await runQuery(
      `SELECT b.* 
       FROM barriers b
       WHERE b.inspection_id = ?`,
      [latestInspectionId.inspection_id]
    );
    console.log(`[${new Date().toISOString()}] INFO: Found ${nonBaselineBarriers.length} non-baseline barriers.`);

    // Filter WCAG guidelines
    const nonBaselineGuidelines = nonBaselineBarriers.filter(
      (barrier) => barrier.wcag_or_best_practice === 'WCAG Guideline'
    );
    console.log(`[${new Date().toISOString()}] INFO: Found ${nonBaselineGuidelines.length} WCAG guideline barriers.`);

    // Identify new barriers
    const newBarriers = nonBaselineGuidelines.filter((nonBaselineBarrier) => {
      return !baselineBarriers.some(
        (baselineBarrier) =>
          baselineBarrier.rule === nonBaselineBarrier.rule &&
          baselineBarrier.node_targets === nonBaselineBarrier.node_targets &&
          baselineBarrier.url === nonBaselineBarrier.url
      );
    });

    if (newBarriers.length > 0) {
      // Build the HTML content
      let htmlContent = `
        <h1>Accessibility Regression Test Failed</h1>
        <p>A past client has made changes to their website that have resulted in their website falling out of compliance.</p>
      `;

      newBarriers.forEach((barrier) => {
        htmlContent += generateBarrierHTML(barrier);
      });

      const payload = {
        htmlContent: htmlContent.trim(),
      };

      // Notify webhook-server.js
      await axios.post(webhookUrl, payload, { headers: { 'x-auth-token': authToken } });
      console.log(`[${new Date().toISOString()}] INFO: Regression notification sent successfully.`);
    } else {
      console.log(`[${new Date().toISOString()}] INFO: No regressions detected for URL: ${url}.`);
    }
  } catch (error) {
    console.error(`[${new Date().toISOString()}] ERROR: Error during baseline comparison for URL "${url}":`, error.message);
  } finally {
    closeDatabase();
  }
})();
