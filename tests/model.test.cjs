const test = require('node:test');
const assert = require('node:assert/strict');
const {initialState,mealCalories,entryCalories,dateKey}=require('../src/model.js');
test('usual meals and exact supplied Kraft calories',()=>{const s=initialState();assert.equal(s.meals.length,6);assert.equal(mealCalories(s.meals.find(m=>m.id==='kraft')),1100);assert.equal(s.goal,3000);});
test('fractional portions scale every ingredient',()=>{const m=initialState().meals.find(m=>m.id==='dinner');assert.equal(mealCalories(m),898);assert.equal(entryCalories({meal:m,servings:.5}),449);});
test('local dates remain calendar dates',()=>assert.equal(dateKey(new Date(2026,8,22,23,59)),'2026-09-22'));
test('recipe correction migrates once and preserves history and custom portions',()=>{
 const {migrateState}=require('../src/model.js');
 const s=initialState();s.version=2;
 s.meals.find(m=>m.id==='katora').ingredients=s.meals.find(m=>m.id==='katora').ingredients.slice(0,3);
 const t=s.meals.find(m=>m.id==='tenders');t.ingredients=[{name:'Chicken tenders',amount:5,unit:'pieces',calories:120}];
 s.entries=[{meal:structuredClone(t),servings:1}];
 migrateState(s);assert.equal(mealCalories(t),750);assert.equal(entryCalories(s.entries[0]),600);
 assert.equal(mealCalories(s.meals.find(m=>m.id==='katora')),1230);
 migrateState(s);assert.equal(s.meals.find(m=>m.id==='katora').ingredients.length,6);
});
test('protein scales with portions and unknown values stay unknown',()=>{
 const {mealProtein,entryProtein,missingProtein,enrichNutrition}=require('../src/model.js');
 const s=enrichNutrition(initialState());
 assert.equal(s.proteinGoal,150);
 assert.equal(mealProtein(s.meals.find(m=>m.id==='dinner')),88.5);
 assert.equal(entryProtein({meal:s.foods.find(f=>f.id==='food-milk'),servings:2}),16);
 const custom={id:'custom',ingredients:[{name:'Mystery',amount:2,calories:10}]};
 s.meals.push(custom);delete s.nutritionVersion;enrichNutrition(s);
 assert.equal(custom.ingredients[0].protein,null);assert.equal(missingProtein(custom),true);
});
test('carbs and fat scale with portions while older meals remain unknown',()=>{
 const {mealCarbs,entryCarbs,mealFat,entryFat,missingCarbs,missingFat}=require('../src/model.js');
 const meal={ingredients:[{amount:2,carbs:43,fat:2},{amount:1.5,carbs:2,fat:2.5}]};
 assert.equal(mealCarbs(meal),89);
 assert.equal(mealFat(meal),7.75);
 assert.equal(entryCarbs({meal,servings:.5}),44.5);
 assert.equal(entryFat({meal,servings:.5}),3.875);
 assert.equal(missingCarbs(meal),false);
 assert.equal(missingFat(initialState().meals[0]),true);
});
test('analytics uses snapshots, logged days, and complete protein days',()=>{
 const {historySummary}=require('../src/model.js');
 const s=initialState();s.proteinGoal=10;s.goal=200;
 const meal={id:'rice',name:'Rice cup',ingredients:[{amount:1,calories:200,protein:4,carbs:39,fat:2.5}]};
 s.entries=[{date:'2026-10-01',meal,servings:.5},{date:'2026-10-01',meal,servings:1},
  {date:'2026-10-03',meal:{id:'custom',name:'Unknown',ingredients:[{amount:1,calories:100,protein:null}]},servings:1},
  {date:'2026-10-15',meal,servings:1}];
 const before=JSON.stringify(s);
 const result=historySummary(s,{today:'2026-10-11'});
 assert.equal(result.totalCalories,400);assert.equal(result.averageCalories,200);
 assert.equal(result.history.length,2);assert.equal(result.entryCount,3);
 assert.equal(result.averageProtein,6);assert.equal(result.proteinDays,1);assert.equal(result.partialProteinDays,1);
 assert.equal(result.calorieGoalDays,1);assert.equal(result.proteinGoalDays,0);
 assert.deepEqual(result.topMeal,{name:'Rice cup',count:2});
 assert.equal(result.history[0].complete.carbs,false);assert.equal(JSON.stringify(s),before);
});
test('analytics ranges include their first day and cross month boundaries',()=>{
 const {historySummary}=require('../src/model.js');const s=initialState();
 s.entries=['2026-09-24','2026-09-25','2026-10-01'].map(date=>({date,meal:s.meals[5],servings:.5}));
 const result=historySummary(s,{days:7,today:'2026-10-01'});
 assert.equal(result.start,'2026-09-25');assert.equal(result.history.length,2);assert.equal(result.averageCalories,550);
 const empty=historySummary(s,{days:7,today:'2026-11-01'});
 assert.equal(empty.averageCalories,null);assert.equal(empty.averageProtein,null);assert.equal(empty.topMeal,null);
});
