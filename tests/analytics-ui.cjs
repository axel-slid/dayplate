const {_electron:electron}=require('@playwright/test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const Model=require('../src/model.js');
const Store=require('../lib/store.cjs');
(async()=>{
 const data=await fs.mkdtemp(path.join(os.tmpdir(),'dayplate-analytics-test-'));
 let app;
 try {
  const state=Model.enrichNutrition(Model.initialState());
  const today=new Date();today.setHours(12,0,0,0);
  const dates=[];
  for(let offset=0;offset<=40;offset+=2){
   const d=new Date(today);d.setDate(d.getDate()-offset);const date=Model.dateKey(d);dates.push(date);
   state.entries.push({id:`test-${offset}`,date,category:'Lunch',servings:(offset/2)%3+1,
    meal:{id:'rice',name:'Rice cup',category:'Lunch',ingredients:[{name:'Rice',amount:1,unit:'cup',calories:200,protein:offset===2?null:4,carbs:39,fat:2.5}]}});
  }
  Store.replace(data,state,0);
  app=await electron.launch({args:[path.join(__dirname,'..')],env:{...process.env,DAYPLATE_TEST_DATA:data}});
  const page=await app.firstWindow();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.getByRole('button',{name:'Analytics',exact:true}).click();
  assert.equal(await page.locator('#page-title').textContent(),'Analytics');
  assert.equal(await page.locator('#header-add').isVisible(),false);
  assert.equal(await page.locator('#analytics-average-calories').textContent(),'400');
  assert.equal(await page.locator('#analytics-total-calories').textContent(),'8,400');
  assert.equal(await page.locator('#analytics-average-protein').textContent(),'8');
  assert.equal(await page.locator('#analytics-days').textContent(),'21');
  assert.equal(await page.locator('.analytics-history tbody tr').count(),15);
  await page.getByRole('button',{name:'Next',exact:true}).click();
  assert.equal(await page.locator('.analytics-history tbody tr').count(),6);
  await page.locator('[data-analytics-range="7"]').click();
  assert.equal(await page.locator('#analytics-average-calories').textContent(),'350');
  assert.equal(await page.locator('#analytics-average-protein').textContent(),'6.7');
  assert.equal(await page.locator('#analytics-days').textContent(),'4');
  await page.locator('[data-analytics-metric="protein"]').click();
  assert.equal(await page.locator('.analytics-bar.partial').count(),1);
  assert.equal(await page.locator('.analytics-bar.unlogged').count(),3);
  await page.locator('[data-analytics-range="30"]').click();
  assert.equal(await page.locator('#analytics-days').textContent(),'15');
  await page.locator('[data-analytics-range="all"]').click();
  await page.waitForTimeout(650);await page.screenshot({path:path.join(os.tmpdir(),'dayplate-analytics-preview.png')});
  await page.setViewportSize({width:940,height:780});
  await page.waitForTimeout(650);await page.screenshot({path:path.join(os.tmpdir(),'dayplate-analytics-narrow.png')});
  await page.locator('.analytics-history [data-history-date]').first().click();
  assert.equal(await page.locator('#journal-date').inputValue(),dates[0]);
  assert.equal(await page.locator('#consumed').textContent(),'200');
  await page.getByRole('button',{name:'Analytics',exact:true}).click();
  await page.getByRole('button',{name:'Next',exact:true}).click();
  Store.transaction(data,({state})=>{state.entries=[];return{state};});
  await page.waitForSelector('.analytics-empty');
  assert.equal(await page.locator('#analytics-average-calories').textContent(),'—');
  assert.equal(await page.locator('#analytics-average-protein').textContent(),'—');
  assert.deepEqual(errors,[]);
  console.log('Passed: analytics totals, complete protein averages, periods, pagination, chart gaps, day navigation, external updates and empty history.');
 } finally {if(app)await app.close();await fs.rm(data,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
