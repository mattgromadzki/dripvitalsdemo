import { chromium, devices } from 'playwright';
const iPhone = devices['iPhone 13'];
const b = await chromium.launch();
const ctx = await b.newContext({ ...iPhone });
const p = await ctx.newPage();
const log = (...a)=>console.log(...a);

await p.goto('http://localhost:3111/patient-portal', { waitUntil:'networkidle' });
await p.waitForTimeout(1500);
await p.screenshot({ path:'shots/01-login.png' });
log('login shot done');

// demo login
try {
  await p.fill('.login-input[type=email]', 'mattgromadzki@gmail.com');
  await p.fill('.login-input[type=password]', 'demo1234');
  await p.click('.login-btn');
  await p.waitForTimeout(3500);
} catch(e){ log('login interaction err', e.message); }

const loggedIn = await p.locator('.mob-tabbar, .main-body, .sidebar').first().count().catch(()=>0);
log('post-login marker count:', loggedIn);
await p.screenshot({ path:'shots/02-home.png' });
await p.screenshot({ path:'shots/02b-home-full.png', fullPage:true });

// try tabs via bottom nav
const tabs = await p.locator('.mob-tab').count().catch(()=>0);
log('mob-tab count:', tabs);
const names = ['treatments','shots','shop','account'];
for (let i=0;i<names.length;i++){
  try {
    const btns = p.locator('.mob-tab');
    const n = await btns.count();
    if (n > i+1){ await btns.nth(i+1).click(); await p.waitForTimeout(1200); await p.screenshot({ path:`shots/0${i+3}-${names[i]}.png` }); log('tab shot', names[i]); }
  } catch(e){ log('tab err', names[i], e.message); }
}
await b.close();
log('DONE');
