const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawnSync,spawn}=require('node:child_process');
const Store=require('../lib/store.cjs');
const {apply}=require('../lib/commands.cjs');
const Model=require('../src/model.js');
const cli=path.join(__dirname,'../cli.cjs');
function setup(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'dayplate-cli-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));const state=Model.enrichNutrition(Model.initialState());Store.replace(dir,state,0);return dir;}
function run(dir,...args){return spawnSync(process.execPath,[cli,...args,'--data-dir',dir],{encoding:'utf8'});}
test('food creation, dated fractional logging, snapshots and idempotent retry',t=>{
  const dir=setup(t);
  assert.equal(run(dir,'food','--id','beer','--name','Beer','--unit','12 fl oz','--calories','150','--protein','1.6','--carbs','12.6','--fat','0').status,0);
  const args=['log','--meal','Beer','--date','2026-09-25','--servings','7.5','--id','beers-25'];
  assert.equal(run(dir,...args).status,0);assert.equal(run(dir,...args).status,0);
  const day=JSON.parse(run(dir,'day','--date','2026-09-25').stdout);
  assert.equal(day.calories,1125);assert.equal(day.protein,12);assert.equal(day.carbs,94.5);assert.equal(day.fat,0);assert.equal(day.complete,true);assert.equal(day.entries.length,1);
  assert.equal(run(dir,'food','--id','beer','--name','Beer','--unit','12 fl oz','--calories','200').status,0);
  assert.equal(JSON.parse(run(dir,'day','--date','2026-09-25').stdout).calories,1125);
  assert.notEqual(run(dir,...args).status,0);
});
test('quick add logs multiple portions atomically and retries by batch ID',t=>{
  const dir=setup(t);
  const args=['add','--date','2026-09-29','--item','katora@Lunch','--item','food-eggs=4@Dinner','--item','food-milk','--category','Dinner','--id','sept29-foods'];
  assert.equal(run(dir,...args,'--dry-run').status,0);
  assert.equal(Store.read(dir).state.entries.length,0);
  assert.equal(run(dir,...args).status,0);
  assert.equal(run(dir,...args).status,0);
  const day=JSON.parse(run(dir,'day','--date','2026-09-29').stdout);
  assert.deepEqual(day.entries.map(e=>[e.id,e.category,e.servings]),[
    ['sept29-foods-1','Lunch',1],['sept29-foods-2','Dinner',4],['sept29-foods-3','Dinner',1]
  ]);
  const before=fs.readFileSync(Store.filename(dir),'utf8');
  assert.notEqual(run(dir,'add','--date','2026-09-29','--item','food-cheese','--item','missing','--id','bad-batch').status,0);
  assert.equal(fs.readFileSync(Store.filename(dir),'utf8'),before);
});
test('batch rollback, dry run, invalid date/nutrition and stale UI protection',t=>{
  const dir=setup(t), before=fs.readFileSync(Store.filename(dir),'utf8');
  const ops=[{type:'log',meal:'kraft',date:'2026-09-26',id:'test'},{type:'log',meal:'missing',date:'2026-09-26'}];
  assert.throws(()=>Store.transaction(dir,data=>apply(data.state,ops)),/Unknown meal/);
  assert.equal(fs.readFileSync(Store.filename(dir),'utf8'),before);
  assert.notEqual(run(dir,'log','--meal','kraft','--date','2026-02-30').status,0);
  assert.notEqual(run(dir,'food','--name','Invalid','--unit','g','--calories','NaN').status,0);
  assert.notEqual(run(dir,'log','--meal','kraft','--date','2026-09-26','--servings','0').status,0);
  const input=path.join(dir,'ops.json');fs.writeFileSync(input,JSON.stringify([{type:'log',meal:'kraft',date:'2026-09-26'}]));
  assert.equal(run(dir,'apply','--file',input,'--dry-run').status,0);
  assert.equal(fs.readFileSync(Store.filename(dir),'utf8'),before);
  const stale=Store.read(dir);assert.equal(run(dir,'apply','--file',input).status,0);
  assert.throws(()=>Store.replace(dir,stale.state,stale.revision),/Journal changed/);
  assert.equal(Store.read(dir).state.entries.length,1);
  assert.ok(fs.existsSync(Store.filename(dir)+'.backup'));
});
test('macro fill updates scoped snapshots without changing known values',t=>{
  const dir=setup(t);
  const data=Store.read(dir);
  const logged=apply(data.state,[{type:'log',meal:'food-eggs',date:'2026-09-25'},{type:'log',meal:'food-eggs',date:'2026-09-26'}]);
  const filled=apply(logged.state,[{type:'macros.fill',library:false,dates:['2026-09-26'],rules:[{name:'Eggs',unit:'egg',protein:999,carbs:0.4,fat:5,source:'Estimate'}]}]);
  assert.equal(filled.state.entries[0].meal.ingredients[0].fat,undefined);
  assert.equal(filled.state.entries[1].meal.ingredients[0].fat,5);
  assert.equal(filled.state.entries[1].meal.ingredients[0].protein,6);
  assert.equal(filled.state.foods[0].ingredients[0].fat,undefined);
});
test('parallel CLI logging preserves every entry',async t=>{
  const dir=setup(t);
  await Promise.all(Array.from({length:8},(_,i)=>new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,[cli,'log','--meal','kraft','--date','2026-09-26','--id',`parallel-${i}`,'--data-dir',dir],{stdio:'pipe'});
    let error='';child.stderr.on('data',chunk=>error+=chunk);child.on('error',reject);child.on('exit',code=>code?reject(new Error(error)):resolve());
  })));
  assert.equal(Store.read(dir).state.entries.length,8);
});
test('macro rules distinguish older calorie/protein snapshots',t=>{
  const dir=setup(t),state=Store.read(dir).state;
  const newer=apply(state,[{type:'log',meal:'katora',date:'2026-09-25'}]).state;
  newer.entries[0].meal.ingredients[0].calories=200;
  const filled=apply(newer,[{type:'macros.fill',rules:[
    {name:'Rice',unit:'cup',calories:205,existingProtein:4.3,carbs:44.5,fat:0.5},
    {name:'Rice',unit:'cup',calories:200,existingProtein:4.3,carbs:43.4,fat:1}
  ]}]).state;
  assert.equal(filled.meals[0].ingredients[0].carbs,44.5);
  assert.equal(filled.entries[0].meal.ingredients[0].carbs,43.4);
});
test('corrupt journal fails closed and leaves data intact',t=>{
  const dir=setup(t);fs.writeFileSync(Store.filename(dir),'broken');
  assert.notEqual(run(dir,'log','--meal','kraft','--date','2026-09-26').status,0);
  assert.equal(fs.readFileSync(Store.filename(dir),'utf8'),'broken');
});
