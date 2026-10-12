const {test}=require('node:test');
const assert=require('node:assert/strict');
const Model=require('../src/model.js');
const Store=require('../lib/store.cjs');
const {apply}=require('../lib/commands.cjs');
test('macro analytics excludes incomplete days independently for each nutrient',()=>{
 const state=Model.initialState();
 state.entries=[{date:'2026-10-11',servings:2,meal:{id:'a',name:'A',ingredients:[{amount:1,calories:200,protein:4,carbs:39,fat:2.5}]}},
 {date:'2026-10-12',servings:1,meal:{id:'b',name:'B',ingredients:[{amount:1,calories:100,protein:null,carbs:20,fat:null}]}}];
 const {macros}=Model.historySummary(state,{today:'2026-10-12'});
 assert.deepEqual(macros.carbs,{average:49,days:2,partialDays:0});
 assert.deepEqual(macros.fat,{average:5,days:1,partialDays:1});
 assert.deepEqual(macros.protein,{average:8,days:1,partialDays:1});
});
test('weight history converts mixed units and respects selected periods without food logs',()=>{
 const state=Model.enrichNutrition(Model.initialState());state.weightUnit='lb';
 state.weighIns={'2026-09-23':{value:175,unit:'lb'},'2026-10-12':{value:178,unit:'lb'},'2026-10-11':{value:80,unit:'kg'},'2026-11-01':{value:180,unit:'lb'}};
 const summary=Model.activitySummary(state,{today:'2026-10-12'});
 assert.equal(summary.latestWeight.value,178);assert.equal(summary.weightChange,3);assert.equal(summary.weights.length,3);
 assert.ok(Math.abs(summary.weights[1].value-176.36981)<.0001);
 assert.equal(Model.activitySummary(state,{days:7,today:'2026-10-12'}).weights.length,2);
 state.weighIns={};assert.equal(Model.activitySummary(state).weightChange,null);
});
test('workout create, retry, edit, remove and validation preserve nutrition snapshots',()=>{
 const state=Model.enrichNutrition(Model.initialState());state.entries=[{id:'meal',date:'2026-10-12',servings:1,category:'Lunch',meal:state.meals[0]}];
 const item={id:'lift-12',name:'Upper body',date:'2026-10-12',type:'Strength',minutes:45,notes:'Felt good',exercises:[{name:'Bench press',sets:3,reps:8,weight:95,unit:'lb'}]};
 let next=apply(state,[{type:'workout.put',item}]).state;
 next=apply(next,[{type:'workout.put',item}]).state;assert.equal(next.workouts.length,1);
 next=apply(next,[{type:'workout.put',item:{...item,minutes:null}}]).state;assert.equal(next.workouts[0].minutes,null);
 const summary=Model.activitySummary(next,{today:'2026-10-12'});assert.equal(summary.workoutDays,1);assert.equal(summary.minutes,0);assert.equal(summary.timedWorkouts,0);
 assert.deepEqual(next.entries,state.entries);assert.equal(state.workouts.length,0);
 assert.throws(()=>apply(next,[{type:'workout.put',item:{...item,minutes:-1}}]),/minutes/);
 assert.throws(()=>apply(next,[{type:'workout.put',item:{...item,date:'2026-02-30'}}]),/Date/);
 assert.throws(()=>Store.validate({...next,workouts:[item,item]}),/unique/);
 assert.throws(()=>Store.workout({...item,exercises:[{name:'Squat',sets:1.5,unit:'lb'}]}),/whole number/);
 assert.equal(apply(next,[{type:'workout.remove',id:item.id}]).state.workouts.length,0);
});
