import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    console.log('Navigating to the app...');
    await page.goto('https://f5lf8fovjcdw.space.minimax.io', { waitUntil: 'networkidle', timeout: 30000 });
    
    console.log('Page title:', await page.title());
    
    // Check if the page loaded
    const content = await page.content();
    console.log('Page has content:', content.length > 0);
    
    // Check for critical errors in console
    page.on('console', msg => {
      if (msg.type() === 'error') {
        console.log('Console error:', msg.text());
      }
    });
    
    console.log('App loaded successfully!');
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    await browser.close();
  }
})();
