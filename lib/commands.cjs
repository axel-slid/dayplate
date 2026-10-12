const {randomUUID} = require('node:crypto');
const Store = require('./store.cjs');
function findMeal(state, ref) {
  const all=[...state.meals,...state.foods];
  const match=all.find(m=>m.id===ref); if(match) return match;
  const matches=all.filter(m=>m.name.toLowerCase()===String(ref).toLowerCase());
  if(matches.length!==1) throw new Error(matches.length?'Ambiguous meal name; use its ID':`Unknown meal: ${ref}`);
  return matches[0];
}
function apply(state, ops) {
  if(!Array.isArray(ops)||!ops.length) throw new Error('Supply a nonempty operations array');
  const next=structuredClone(state), results=[];
  for(const op of ops) {
    if(!op || typeof op.type!=='string') throw new Error('Operation requires type');
    if(op.type==='food.put'||op.type==='meal.put') {
      const item=structuredClone(op.item); if(!item)throw new Error('Operation requires item');
      item.id ||= randomUUID(); item.category ||= op.type==='food.put'?'Snack':'Dinner'; item.emoji ||= 'bowl'; item.source ||= 'CLI · estimate';
      if(op.type==='food.put') {item.isFood=true;if(item.ingredients?.length!==1)throw new Error('Food must have one ingredient');}
      Store.meal(item); const list=next[op.type==='food.put'?'foods':'meals'];
      const index=list.findIndex(m=>m.id===item.id);
      if(index<0) list.push(item); else list[index]=item;
      results.push({type:op.type,id:item.id,name:item.name});
    } else if(op.type==='log') {
      const item=op.meal ? findMeal(next,op.meal) : op.item;
      if(!item)throw new Error('Log requires meal ID/name or item');
      const entry={id:op.id||randomUUID(),date:Store.day(op.date),category:op.category||item.category,servings:op.servings??1,meal:structuredClone(item)};
      const existing=next.entries.find(e=>e.id===entry.id);
      if(existing) {
        if(JSON.stringify(existing)!==JSON.stringify(entry))throw new Error('Entry ID already exists with different data');
        results.push({type:'log',id:existing.id,alreadyLogged:true});continue;
      }
      next.entries.push(entry);results.push({type:'log',id:entry.id});
    } else if(op.type==='entry.update') {
      const entry=next.entries.find(e=>e.id===op.id); if(!entry)throw new Error('Unknown entry ID');
      for(const key of ['date','category','servings','meal']) if(op[key]!==undefined) entry[key]=structuredClone(op[key]);
      results.push({type:op.type,id:entry.id});
    } else if(op.type==='macros.fill') {
      if(!Array.isArray(op.rules))throw new Error('Macros require rules');
      let count=0;
      const meals=[...(op.library===false?[]:[...next.meals,...next.foods]),...next.entries.filter(e=>!op.dates||op.dates.includes(e.date)).map(e=>e.meal)];
      for(const m of meals) for(const i of m.ingredients) {
        const rule=op.rules.find(r=>r.name===i.name&&r.unit===i.unit&&(r.calories===undefined||r.calories===i.calories)&&(r.existingProtein===undefined||r.existingProtein===i.protein)); if(!rule)continue;
        let changed=false;
        for(const key of ['protein','carbs','fat']) if(rule[key]!==undefined&&(op.overwrite||i[key]==null)) {Store.number(rule[key],key);i[key]=rule[key];changed=true;}
        if(changed){i.nutritionSource=rule.source||'Estimated macros';count++;}
      }
      results.push({type:op.type,ingredientsUpdated:count});
    } else if(op.type==='goals.set') {
      if(op.calories!==undefined)next.goal=op.calories;
      if(op.protein!==undefined)next.proteinGoal=op.protein;
      results.push({type:op.type});
    } else if(op.type==='workout.put') {
      const item=structuredClone(op.item);if(!item)throw new Error('Workout requires item');
      item.id ||= randomUUID();item.type ||= 'Other';Store.workout(item);
      next.workouts ||= [];const index=next.workouts.findIndex(w=>w.id===item.id);
      if(index<0)next.workouts.push(item);else next.workouts[index]=item;
      results.push({type:op.type,id:item.id});
    } else if(op.type==='workout.remove') {
      if(!(next.workouts||[]).some(w=>w.id===op.id))throw new Error('Unknown workout ID');
      next.workouts=next.workouts.filter(w=>w.id!==op.id);results.push({type:op.type,id:op.id});
    } else if(op.type==='weight.set') {
      next.weighIns ||= {}; next.weighIns[Store.day(op.date)]={value:op.value,unit:op.unit||'lb'};
      results.push({type:op.type});
    } else throw new Error(`Unknown operation: ${op.type}`);
  }
  Store.validate(next);return {state:next,result:results};
}
module.exports={apply,findMeal};
