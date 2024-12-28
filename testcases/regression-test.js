const fs = require('fs');
const { exec } = require('child_process');
const path = require('path');

// Paths
const noBarriersPath = path.resolve(__dirname, '../testcases/no-barriers.html');
const barriersPath = path.resolve(__dirname, '../testcases/barriers.html');
const backupPath = path.resolve(__dirname, '../testcases/no-barriers-backup.html');

// Helper function to execute a command
function runCommand(command) {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        console.error(`Error: ${error.message}`);
        return reject(error);
      }
      if (stderr) console.error(`Stderr: ${stderr}`);
      resolve(stdout.trim());
    });
  });
}

(async () => {
  try {

    // Backup
    fs.copyFileSync(noBarriersPath, backupPath);
    
    console.log('Step 1: Run baseline scan on no-barriers.html');
    await runCommand('node inspections/scan-website.js testcases/no-barriers.html --baseline --no-sandbox');
    
    console.log('Step 2: Update no-barriers.html with barriers.html content');
    const barriersContent = fs.readFileSync(barriersPath, 'utf-8');
    fs.writeFileSync(noBarriersPath, barriersContent);

    console.log('Step 3: Run non-baseline scan on updated no-barriers.html');
    const output = await runCommand('node inspections/scan-website.js testcases/no-barriers.html --no-sandbox');

    console.log('Step 4: Verify regression detection');
    if (output.includes('Regression notification sent successfully')) {
      console.log('✅ Test passed: Regression detected as expected.');
    } else {
      console.error('❌ Test failed: No regression detected.');
      process.exit(1);
    }

    // Restore
    fs.copyFileSync(backupPath, noBarriersPath);
    
  } catch (error) {
    console.error('Test failed with error:', error.message);
    process.exit(1);
  }
})();
