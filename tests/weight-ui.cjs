const {_electron:electron}=require('@playwright/test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');const path=require('node:path');const os=require('node:os');
const Store=require('../lib/store.cjs');const Model=require('../src/model.js');
(async()=>{
 const data=await fs.mkdtemp(path.join(os.tmpdir(),'dayplate-workouts-test-'));let app;
 const launch=()=>electron.launch({args:[path.join(__dirname,'..')],env:{...process.env,DAYPLATE_TEST_DATA:data}});
 try{
  const state=Model.enrichNutrition(Model.initialState());state.weighIns[Model.dateKey()]={value:170,unit:'lb'};Store.replace(data,state,0);
  app=await launch();let page=await app.firstWindow();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.getByRole('button',{name:'Analytics',exact:true}).click();
  assert.match(await page.locator('#analytics-latest-weight').textContent(),/170/);
  assert.equal(await page.locator('#analytics-average-carbs').textContent(),'—');
  assert.equal(await page.locator('#analytics-average-fat').textContent(),'—');
  assert.equal(await page.locator('[data-view="workouts"], #journal-workouts, .movement-analytics, .analytics-history').count(),0);
  await page.getByRole('button',{name:'Journal',exact:true}).click();
  assert.equal(await page.locator('#consumed').textContent(),'0');
  assert.equal(await page.locator('#calorie-ring-fill').evaluate(el=>el.style.opacity),'0');
  assert.equal(await page.locator('#protein-ring-fill').evaluate(el=>el.style.opacity),'0');
  await app.evaluate(({BrowserWindow})=>{const win=BrowserWindow.getAllWindows()[0];win.setMinimumSize(320,500);win.setSize(390,844);});
  await page.waitForTimeout(300);
  assert.equal(await page.locator('.nav').count(),3);
  await page.getByRole('button',{name:'Analytics',exact:true}).click();
  assert.equal(await page.locator('[data-analytics-pane="history"]').count(),0);
  await page.locator('[data-analytics-pane="weight"]').click();
  assert.match(await page.locator('#analytics-latest-weight').textContent(),/170/);
  assert.equal(await page.locator('.weight-analytics').isVisible(),true);
  assert.deepEqual(errors,[]);
  console.log('Passed: weight with no food logs, empty nutrition rings, simplified desktop and phone navigation.');
 }finally{if(app)await app.close();await fs.rm(data,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
