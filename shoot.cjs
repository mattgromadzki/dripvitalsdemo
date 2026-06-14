const { chromium, devices } = require('playwright');
(async () => {
  const iPhone = devices['iPhone 13'];
  const b = await chromium.launch();
  const ctx = await b.newContext({ ...iPhone });
  const p = await ctx.newPage();
  const log = (...a)=>console.log(...a);

  await p.goto('http://localhost:3111/patient-portal', { waitUntil:'networkidle' });
  await p.waitForTimeout(1500);
  await p.screenshot({ path:'shots/01-login.png' });
  log('login shot done');

  try {
    await p.fill('.login-input[type=email]', 'mattgromadzki@gmail.com');
    await p.fill('.login-input[type=password]', 'demo1234');
    await p.click('.login-btn');
    await p.waitForTimeout(4000);
  } catch(e){ log('login err', e.message); }

  const marker = await p.locator('.mob-tabbar, .main-body').first().count().catch(()=>0);
  log('post-login marker:', marker);
  const err = await p.locator('.login-err, .auth-err').first().innerText().catch(()=>'');
  if (err) log('auth error text:', err);
  await p.screenshot({ path:'shots/02-home.png' });
  await p.screenshot({ path:'shots/02b-home-full.png', fullPage:true });

  const names = ['treatments','shots','shop','account'];
  const btns = p.locator('.mob-tab');
  const n = await btns.count().catch(()=>0);
  log('mob-tab count:', n);
  for (let i=0;i<names.length && n>i+1;i++){
    try { await btns.nth(i+1).click(); await p.waitForTimeout(1300); await p.screenshot({ path:`shots/0${i+3}-${names[i]}.png` }); log('tab', names[i]); }
    catch(e){ log('tab err', names[i], e.message); }
  }
  await b.close();
  log('DONE');
})();
