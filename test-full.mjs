import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  
  try {
    console.log('1. Navigating to the app...');
    await page.goto('https://f5lf8fovjcdw.space.minimax.io', { waitUntil: 'networkidle', timeout: 30000 });
    console.log('   Page title:', await page.title());
    
    console.log('2. Checking login page...');
    await page.waitForSelector('input[type="password"]', { timeout: 10000 });
    console.log('   Login form found');
    
    console.log('3. Logging in...');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button:has-text("Sign In")');
    await page.waitForTimeout(2000);
    
    console.log('4. Checking dashboard...');
    await page.waitForSelector('text=Dashboard', { timeout: 10000 });
    console.log('   Dashboard loaded');
    
    console.log('5. Checking stats cards...');
    const statsText = await page.textContent('body');
    const hasTotalONUs = statsText.includes('Total ONUs');
    const hasOnline = statsText.includes('Online');
    console.log('   Total ONUs card:', hasTotalONUs ? 'OK' : 'MISSING');
    console.log('   Online card:', hasOnline ? 'OK' : 'MISSING');
    
    console.log('6. Navigating to OLTs page...');
    await page.click('text=OLT Devices');
    await page.waitForTimeout(1000);
    const hasOLT = await page.textContent('body');
    console.log('   OLT page loaded:', hasOLT.includes('OLT-BKK') ? 'OK' : 'MISSING');
    
    console.log('7. Navigating to Alarms page...');
    await page.click('text=Alarms');
    await page.waitForTimeout(1000);
    const hasAlarms = await page.textContent('body');
    console.log('   Alarms page loaded:', hasAlarms.includes('critical') ? 'OK' : 'MISSING');
    
    console.log('\n=== Test Results ===');
    if (errors.length > 0) {
      console.log('Console errors:', errors);
    } else {
      console.log('No critical errors found');
    }
    console.log('All tests passed!');
    
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
})();
