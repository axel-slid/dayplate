function foodIcon(kind) {
 const art = {
 cheese:'<path d="m9 31 37-17 10 16v23H9Z" fill="#ecc363"/><path d="m9 31 37-17 10 16Z" fill="#f6d985"/><g fill="#d8a44c"><circle cx="21" cy="41" r="4"/><circle cx="43" cy="45" r="5"/><circle cx="35" cy="25" r="3"/></g>',
 beans:'<path d="M15 16h34v35q-17 10-34 0Z" fill="#d4b260"/><ellipse cx="32" cy="16" rx="17" ry="7" fill="#e9debd"/><ellipse cx="32" cy="16" rx="12" ry="4" fill="#886247"/><path d="M24 31c-7 8 3 16 12 10s0-16-7-11" fill="#bc8e66"/>',
 milk:'<path d="m16 10 5 44h22l5-44Z" fill="#eee8d7"/><path d="m20 24 4 26h16l4-26Z" fill="#fffaf0"/><ellipse cx="32" cy="10" rx="16" ry="4" fill="#d9cfae"/>',
 salsa:'<path d="M10 30h44c-3 17-11 23-22 23S13 47 10 30Z" fill="#c8a577"/><ellipse cx="32" cy="30" rx="22" ry="8" fill="#c57454"/><path d="m20 29 5-3m10 6 5-3" stroke="#bf963b" stroke-width="4" stroke-linecap="round"/>',

 bowl:'<ellipse cx="32" cy="29" rx="23" ry="10" fill="#f3d488"/><path d="M9 29h46c-2 19-12 25-23 25S11 48 9 29Z" fill="#d4b260"/><path d="m19 25 5-7 8 4 6-6 8 9" fill="none" stroke="#bb783f" stroke-width="7" stroke-linecap="round"/>',
 sandwich:'<path d="M10 27Q10 12 32 12t22 15Z" fill="#e6b96d"/><path d="m11 32 10 5 10-5 10 5 12-5" fill="none" stroke="#c7a047" stroke-width="7"/><path d="M12 39h40v9H12Z" fill="#b97d53"/><path d="M10 48h44q-1 10-22 10T10 48Z" fill="#e6b96d"/>',
 chicken:'<path d="m40 38 11 11m-2-2 5-1m-5 1-1 6" stroke="#f1e4c6" stroke-width="8" stroke-linecap="round"/><path d="M16 13c15-9 33 10 26 22s-17 14-26 2-11-17 0-24Z" fill="#d6a05b"/><path d="m17 22 4-3m3 14 4-2" stroke="#b78043" stroke-width="3" stroke-linecap="round"/>',
 eggs:'<path d="M13 14c10-7 22-1 22 7 14-5 25 10 17 21-5 16-22 8-29 11C7 54 3 41 9 32 2 24 6 17 13 14Z" fill="#fff9e5"/><circle cx="30" cy="33" r="11" fill="#edbe55"/><path d="M25 29q2-4 6-3" fill="none" stroke="#ffe29a" stroke-width="3" stroke-linecap="round"/>',
 pasta:'<path d="M8 32h48c-3 18-14 23-24 23S11 50 8 32Z" fill="#d0a56f"/><g fill="none" stroke="#f0c85a" stroke-width="8" stroke-linecap="round"><path d="M13 25q0-9 9-9m5 9q0-9 9-9m5 11q0-9 9-9"/></g>'
 };
 return `<svg viewBox="0 0 64 64" aria-hidden="true">${art[kind]||art.bowl}</svg>`;
}
const {mealCalories, entryCalories, mealProtein, entryProtein, missingProtein, mealCarbs, entryCarbs, mealFat, entryFat, missingCarbs, missingFat, enrichNutrition, dateKey, initialState, initialFoods, migrateState} = Model;
const $ = selector => document.querySelector(selector);
const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt = value => Math.round(value).toLocaleString();
const categories = ['Breakfast','Lunch','Dinner','Snack'];
const icons = ['☀','◒','☾','♡'];
let state, date = dateKey(), view = 'journal', foodTab = 'meals', toastTimer, revision=0;
const nativeStore=window.dayplateStore;
const persisted=nativeStore?.load();
if(persisted?.error)throw new Error('Unable to read journal: '+persisted.error);
revision=persisted?.revision||0;
try { state = persisted?.state || JSON.parse(localStorage.getItem('dayplate-v2')) || initialState(); } catch { state = initialState(); }
state = migrateState(state);
if (!state.foods) state.foods = initialFoods();
enrichNutrition(state);
const kraft=state.meals.find(m=>m.id==='kraft');if(kraft?.source==='Your label · 1,100 kcal / box')kraft.source='Kraft · protein estimate';
if (state.goal === null) state.goal = 3000;
function save() {
  try {
    if(nativeStore){const result=nativeStore.save(state,revision);if(!result.ok){if(result.state){state=result.state;revision=result.revision;}toast(result.error);return false;}revision=result.revision;}
    // Keep the old storage as a compatibility copy after successful native writes.
    try{localStorage.setItem('dayplate-v2', JSON.stringify(state));}catch(error){if(!nativeStore)throw error;}
    return true;
  } catch { toast('Unable to save. Device storage may be full.'); return false; }
}
function toast(message) { $('#toast').textContent=message; $('#toast').classList.add('visible'); clearTimeout(toastTimer); toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),3000); }
function commit(message) { if(save()) toast(message); render(); }
function dayTitle() { return new Date(date+'T12:00:00').toLocaleDateString(undefined, {weekday:'long'}); }
function render() {
  if (view === 'journal') $('#page-title').textContent = dayTitle();
  const entries = state.entries.filter(e=>e.date===date), total=entries.reduce((s,e)=>s+entryCalories(e),0);
  $('#journal-date').value=date; $('#consumed').textContent=fmt(total); $('#goal-label').textContent=state.goal?fmt(state.goal):'—'; $('#edit-goal').title=state.goal?'Edit goal':'Set goal';
  $('#remaining').textContent=!state.goal?'—':total<=state.goal?`${fmt(state.goal-total)} kcal remaining`:`+${fmt(total-state.goal)} kcal`;
  const ratio=state.goal?Math.min(total/state.goal,1):0;
  $('#calorie-ring-fill').style.strokeDashoffset=1-ratio;$('#calorie-ring-fill').style.opacity=ratio>0?1:0;
  $('.calorie-ring').setAttribute('aria-label',`${fmt(total)} kcal eaten${state.goal?`, target ${fmt(state.goal)} kcal`:''}`);
  $('.calorie-ring-wrap').classList.toggle('over-goal',Boolean(state.goal&&total>state.goal));
  $('#progress-fill').style.width=`${state.goal?Math.min(total/state.goal*100,100):0}%`;
  $('#logged-count').textContent=`${entries.length} meal${entries.length===1?'':'s'} logged`;
  $('#meal-count').textContent=state.meals.length;
  $('#protein-total').textContent=Number(entries.reduce((sum,e)=>sum+entryProtein(e),0).toFixed(1));
  $('#protein-goal').textContent=state.proteinGoal;
  const protein=entries.reduce((sum,e)=>sum+entryProtein(e),0);
  $('#protein-remaining').textContent=protein<=state.proteinGoal?`${Number((state.proteinGoal-protein).toFixed(1))} g remaining`:`${Number((protein-state.proteinGoal).toFixed(1))} g above goal`;
  $('#protein-ring-fill').style.strokeDashoffset=1-Math.min(protein/(state.proteinGoal||1),1);$('#protein-ring-fill').style.opacity=protein>0?1:0;
  $('.protein-ring').setAttribute('aria-label',`${Number(protein.toFixed(1))} g protein, target ${state.proteinGoal} g`);
  $('#protein-note').textContent=entries.some(e=>missingProtein(e.meal))?'?':'';
  const hasCarbs=entries.some(e=>!missingCarbs(e.meal)), hasFat=entries.some(e=>!missingFat(e.meal));
  $('#carbs-total').textContent=hasCarbs?`${Number(entries.reduce((sum,e)=>sum+entryCarbs(e),0).toFixed(1))} g`:'—';
  $('#fat-total').textContent=hasFat?`${Number(entries.reduce((sum,e)=>sum+entryFat(e),0).toFixed(1))} g`:'—';
  $('#macro-note').textContent=entries.some(e=>missingCarbs(e.meal)||missingFat(e.meal))?'?':'';
  const weight=state.weighIns[date];$('#weight-value').textContent=weight?`${weight.value} ${weight.unit}`:'＋ Add';
  $('#journal-list').innerHTML=categories.map((category,i)=>{
    const group=entries.filter(e=>e.category===category);
    return `<div class="meal-group" data-drop-category="${category}"><div class="group-header"><span class="group-icon">${icons[i]}</span><strong>${category}</strong><small>${fmt(group.reduce((s,e)=>s+entryCalories(e),0))} kcal</small><button class="add-small" data-action="choose" data-category="${category}" aria-label="Add ${category}">＋</button></div>${group.length?group.map(e=>`<div class="entry" draggable="true" data-drag-kind="entry" data-drag-id="${e.id}" title="Drag to move"><span class="entry-emoji">${foodIcon(e.meal.emoji)}</span><div class="entry-info"><strong>${esc(e.meal.name)}</strong><small>${e.servings} ${e.meal.isFood?esc(e.meal.ingredients[0].unit):`serving${e.servings===1?'':'s'} · ${e.meal.ingredients.length} ingredients`}</small></div><span class="entry-calories">${fmt(entryCalories(e))} kcal<small>${Number(entryProtein(e).toFixed(1))} g protein${missingProtein(e.meal)?' + ?':''}${missingCarbs(e.meal)?'':` · ${Number(entryCarbs(e).toFixed(1))} g carbs`}${missingFat(e.meal)?'':` · ${Number(entryFat(e).toFixed(1))} g fat`}</small></span><button class="icon-button" data-action="edit-entry" data-id="${e.id}" aria-label="Edit ${esc(e.meal.name)}">✎</button><button class="icon-button" data-action="delete-entry" data-id="${e.id}" aria-label="Remove ${esc(e.meal.name)}">×</button></div>`).join(''):`<div class="empty-meal">No meals yet.</div>`}</div>`;
  }).join('');
  $('#new-meal').textContent=foodTab==='foods'?'＋ Ingredient':'＋ Meal';
  $('#quick-meals').innerHTML=state[foodTab].map(m=>`<div class="quick-meal" draggable="true" data-drag-kind="meal" data-drag-id="${m.id}" title="Drag to a meal"><div class="food-icon">${foodIcon(m.emoji)}</div><div><strong>${esc(m.name)}</strong><small>${m.isFood?esc(m.ingredients[0].unit):esc(m.source||m.category)} · ${fmt(mealCalories(m))} kcal · ${Number(mealProtein(m).toFixed(1))} g protein${missingProtein(m)?' + ?':''}</small></div>${m.isFood?`<button data-action="edit-food" data-id="${m.id}" aria-label="Edit ${esc(m.name)}">✎</button>`:''}<button data-action="log" data-id="${m.id}" aria-label="Log ${esc(m.name)}">＋</button></div>`).join('') || '<p class="muted">Save your first meal.</p>';
  renderLibrary();
  if (view === 'analytics') renderAnalytics();
  if (view === 'workouts') renderWorkouts();
  if (typeof renderWorkoutDay === 'function') renderWorkoutDay();
  if (typeof renderMobileJournal === 'function') renderMobileJournal();
}
function renderLibrary() {
  const term=$('#meal-search').value.toLowerCase();
  $('#meal-library').innerHTML=state.meals.filter(m=>m.name.toLowerCase().includes(term)).filter((m,i)=>typeof mobileMealPage==='undefined'||!window.matchMedia('(max-width:700px)').matches||Math.floor(i/4)===mobileMealPage).map(m=>`<article class="meal-card"><div class="food-icon">${foodIcon(m.emoji)}</div><h3>${esc(m.name)}</h3><p>${esc(m.source||m.category)} · ${fmt(mealCalories(m))} kcal · ${Number(mealProtein(m).toFixed(1))} g protein${missingProtein(m)?' + ?':''} per serving<br>${m.ingredients.map(i=>esc(i.name)).join(' · ')}</p><div class="actions"><button class="text-button" data-action="edit-meal" data-id="${m.id}">Edit</button><button class="text-button" data-action="delete-meal" data-id="${m.id}">Delete</button><button class="primary" data-action="log" data-id="${m.id}">＋ Log</button></div></article>`).join('') || '<p class="muted">No meals found. Create one to get started.</p>';
}
function switchView(next) { view=next; for (const name of ['journal','meals','analytics','workouts']) $(`#${name}-view`).hidden=view!==name; document.querySelectorAll('.nav').forEach(n=>n.classList.toggle('active',n.dataset.view===view)); $('#page-title').textContent=view==='journal'?dayTitle():view==='analytics'?'Analytics':view==='workouts'?'Workouts':'Meals'; $('#header-add').hidden=!['meals','workouts'].includes(view); $('#header-add').textContent=view==='workouts'?'＋ Workout':'＋ Meal'; if(view==='analytics')renderAnalytics(); if(view==='workouts')renderWorkouts(); window.scrollTo(0,0); }
function modal(title, body) { $('#modal-content').innerHTML=`<div class="modal-header"><h2>${title}</h2><button class="icon-button" data-action="close" aria-label="Close dialog">×</button></div>${body}`; if(!$('#modal').open) $('#modal').showModal(); }
function close() { $('#modal').close(); }
function options(selected) { return categories.map(c=>`<option ${c===selected?'selected':''}>${c}</option>`).join(''); }
function chooseMeal(category) {
  modal('Log a meal', `<p class="modal-description">Pick your usual.</p><input type="search" id="choose-search" placeholder="Find a meal…" aria-label="Find a meal" style="width:100%"><div id="choices"></div><button class="wide-button" id="choose-create">＋ Meal</button>`);
  const show=()=>{$('#choices').innerHTML=state.meals.filter(m=>m.name.toLowerCase().includes($('#choose-search').value.toLowerCase())).map(m=>`<button class="meal-choice" data-action="log" data-id="${m.id}" data-category="${category||m.category}"><span class="food-icon">${foodIcon(m.emoji)}</span>${esc(m.name)}<span>${fmt(mealCalories(m))} kcal →</span></button>`).join('') || '<p class="muted">No matching meals yet.</p>';};
  show(); $('#choose-search').oninput=show; $('#choose-create').onclick=()=>editMeal(null,true,category);
}
function logMeal(meal, category, entry) {
  modal(entry?'Edit portion':'Log meal', `<p class="modal-description">Logging for ${esc(new Date(date+'T12:00:00').toLocaleDateString(undefined,{month:'long',day:'numeric',year:'numeric'}))}</p><div class="portion-preview"><span class="food-icon">${foodIcon(meal.emoji)}</span><div><strong>${esc(meal.name)}</strong><p id="portion-ingredients"></p><small class="muted">${esc(meal.source||'Custom')}</small></div></div><form id="log-form"><div class="form-row"><label class="field">${meal.isFood?esc(meal.ingredients[0].unit):'Servings'}<input id="servings" type="number" min="0.01" max="100" step="any" value="${entry?.servings||1}" required></label><label class="field">Meal<select id="log-category">${options(category||meal.category)}</select></label></div><div class="calculated"><span>Total calories</span><strong id="portion-calories"></strong></div><div class="calculated protein-result"><span>Protein</span><strong id="portion-protein"></strong></div><div class="calculated protein-result"><span>Carbs</span><strong id="portion-carbs"></strong></div><div class="calculated protein-result"><span>Fat</span><strong id="portion-fat"></strong></div><div class="modal-actions"><button type="button" class="text-button" data-action="close">Cancel</button><button class="primary">${entry?'Save':'Log'}</button></div></form>`);
  const update=()=>{const amount=Number($('#servings').value)||0; $('#portion-calories').textContent=`${fmt(mealCalories(meal)*amount)} kcal`; $('#portion-protein').textContent=`${Number((mealProtein(meal)*amount).toFixed(1))} g${missingProtein(meal)?' + unknown':''}`; $('#portion-carbs').textContent=missingCarbs(meal)?'Unknown':`${Number((mealCarbs(meal)*amount).toFixed(1))} g`; $('#portion-fat').textContent=missingFat(meal)?'Unknown':`${Number((mealFat(meal)*amount).toFixed(1))} g`; $('#portion-ingredients').textContent=meal.ingredients.map(i=>`${Number((i.amount*amount).toFixed(2))} ${i.unit} ${i.name.toLowerCase()}`).join(' · ');};
  update(); $('#servings').oninput=update;
  $('#log-form').onsubmit=e=>{e.preventDefault(); const item={id:entry?.id||crypto.randomUUID(), date:entry?.date||date, meal:structuredClone(meal), servings:Number($('#servings').value), category:$('#log-category').value}; if(entry) state.entries[state.entries.findIndex(x=>x.id===entry.id)]=item; else state.entries.push(item); close(); commit(entry?'Portion updated':'Meal added to your journal');};
}
function editMeal(meal, logAfter=false, category) {
  modal(meal?'Edit meal':'New meal', `<form id="meal-form" class="studio-form"><div class="form-hero"><span class="food-icon">${foodIcon(meal?.emoji||'bowl')}</span><label class="field">Meal name<input id="meal-name" maxlength="80" value="${esc(meal?.name||'')}" placeholder="My favorite bowl" required></label></div><div class="form-row"><label class="field">Meal<select id="meal-category">${options(meal?.category||category||'Breakfast')}</select></label><label class="field">Icon<select id="meal-emoji">${['bowl','sandwich','chicken','eggs','pasta','cheese','beans','milk','salsa'].map(em=>`<option ${em===meal?.emoji?'selected':''}>${em}</option>`).join('')}</select></label></div><div class="builder-label">Ingredients <small>Build one serving</small></div><div class="ingredient-picker"><label class="field">Saved ingredient<select id="saved-ingredient"><option value="">Choose an ingredient</option>${state.foods.map(f=>`<option value="${esc(f.id)}">${esc(f.name)} · ${esc(f.ingredients[0].unit)}</option>`).join('')}</select></label><button type="button" class="primary" id="pick-ingredient" disabled>Add</button></div><div id="ingredients"></div><button type="button" class="wide-button" id="add-ingredient">＋ Custom ingredient</button><p class="error" id="meal-error" hidden>Add at least one ingredient.</p><div class="nutrition-totals"><div><span>Calories / serving</span><strong id="meal-total">0 kcal</strong></div><div><span>Protein / serving</span><strong id="meal-protein">0 g</strong></div></div><div class="modal-actions"><button type="button" class="text-button" data-action="close">Cancel</button><button class="primary">${logAfter?'Save & log':'Save'}</button></div></form>`);
  $('#meal-protein').parentElement.insertAdjacentHTML('afterend', '<div><span>Carbs / serving</span><strong id="meal-carbs">—</strong></div><div><span>Fat / serving</span><strong id="meal-fat">—</strong></div>');
  const addRow=(item={name:'',amount:1,unit:'g',calories:'',protein:null})=>{
    const row=document.createElement('div'); row.className='ingredient-row';
    row.innerHTML=`<div class="ingredient-top"><label class="field">Ingredient<input aria-label="Ingredient name" class="i-name" value="${esc(item.name)}" placeholder="e.g. Chicken" maxlength="70" required></label><button type="button" class="icon-button" aria-label="Remove ingredient">×</button></div><div class="ingredient-values"><label class="field">Amount<input aria-label="Ingredient amount" class="i-amount" type="number" min="0.01" max="100000" step="any" value="${item.amount}" required></label><label class="field">Unit<input aria-label="Ingredient unit" class="i-unit" value="${esc(item.unit)}" maxlength="25" required></label><label class="field nutrition-field">Calories / unit<div class="unit-input"><input aria-label="Calories per unit" class="i-calories" type="number" min="0" max="100000" step="any" value="${item.calories}" placeholder="0" required><span>kcal</span></div></label><label class="field nutrition-field">Protein / unit<div class="unit-input"><input aria-label="Protein per unit" class="i-protein" type="number" min="0" max="100000" step="any" value="${item.protein??''}" placeholder="—"><span>g</span></div></label></div>`;
    row.querySelector('.ingredient-values').insertAdjacentHTML('beforeend', `<label class="field nutrition-field">Carbs / unit<div class="unit-input"><input aria-label="Carbs per unit" class="i-carbs" type="number" min="0" max="100000" step="any" value="${item.carbs??''}" placeholder="—"><span>g</span></div></label><label class="field nutrition-field">Fat / unit<div class="unit-input"><input aria-label="Fat per unit" class="i-fat" type="number" min="0" max="100000" step="any" value="${item.fat??''}" placeholder="—"><span>g</span></div></label>`);
    row.querySelector('button').onclick=()=>{row.remove();update();}; $('#ingredients').append(row); row.oninput=update;
  };
  const readIngredients=()=>Array.from(document.querySelectorAll('.ingredient-row')).map(r=>({name:r.querySelector('.i-name').value.trim(),amount:Number(r.querySelector('.i-amount').value),unit:r.querySelector('.i-unit').value.trim(),calories:Number(r.querySelector('.i-calories').value),protein:r.querySelector('.i-protein').value===''?null:Number(r.querySelector('.i-protein').value),carbs:r.querySelector('.i-carbs').value===''?null:Number(r.querySelector('.i-carbs').value),fat:r.querySelector('.i-fat').value===''?null:Number(r.querySelector('.i-fat').value)}));
  const update=()=>{const m={ingredients:readIngredients()};$('#meal-total').textContent=`${fmt(mealCalories(m))} kcal`;$('#meal-protein').textContent=`${Number(mealProtein(m).toFixed(1))} g${missingProtein(m)?' + ?':''}`;$('#meal-carbs').textContent=missingCarbs(m)?'Unknown':`${Number(mealCarbs(m).toFixed(1))} g`;$('#meal-fat').textContent=missingFat(m)?'Unknown':`${Number(mealFat(m).toFixed(1))} g`;};
  (meal?.ingredients||[]).forEach(addRow); update(); $('#add-ingredient').onclick=()=>{addRow();update();};
  $('#saved-ingredient').onchange=()=>$('#pick-ingredient').disabled=!$('#saved-ingredient').value;
  $('#pick-ingredient').onclick=()=>{const food=state.foods.find(f=>f.id===$('#saved-ingredient').value);if(!food)return;addRow(structuredClone(food.ingredients[0]));update();$('#saved-ingredient').value='';$('#pick-ingredient').disabled=true;$('#meal-error').hidden=true;};
  $('#meal-form').onsubmit=e=>{e.preventDefault(); const ingredients=readIngredients(); if(!ingredients.length){$('#meal-error').hidden=false;return;} if(!$('#meal-name').value.trim()||ingredients.some(i=>!i.name||!i.unit)){toast('Enter a name and ingredient details');return;} const saved={id:meal?.id||crypto.randomUUID(),name:$('#meal-name').value.trim(),emoji:$('#meal-emoji').value,category:$('#meal-category').value,ingredients,source:meal?.source||'Custom'}; if(meal)state.meals[state.meals.findIndex(m=>m.id===meal.id)]=saved;else state.meals.push(saved);close();commit('Meal saved');if(logAfter)logMeal(saved,category);};
}
document.addEventListener('click', event=>{
 const button=event.target.closest('button');if(!button)return;const {action,id,category}=button.dataset;
 if(button.dataset.view) switchView(button.dataset.view);
 if(action==='close')close();
 if(action==='choose')chooseMeal(category);
 if(action==='log')logMeal([...state.meals,...state.foods].find(m=>m.id===id),category);
 if(action==='edit-food')editFood(state.foods.find(f=>f.id===id));
 if(button.dataset.foodTab){foodTab=button.dataset.foodTab;document.querySelectorAll('[data-food-tab]').forEach(b=>b.setAttribute('aria-selected',String(b.dataset.foodTab===foodTab)));render();}
 if(action==='edit-meal')editMeal(state.meals.find(m=>m.id===id));
 if(action==='edit-entry'){const e=state.entries.find(x=>x.id===id);logMeal(e.meal,e.category,e);}
 if(action==='delete-entry'){state.entries=state.entries.filter(x=>x.id!==id);commit('Meal removed from this day');}
 if(action==='delete-meal') {state.meals=state.meals.filter(x=>x.id!==id);commit('Saved meal removed');}
});
$('#header-add').onclick=()=>view==='workouts'?editWorkout(null,dateKey()):view==='journal'?chooseMeal():editMeal();$('#new-meal').onclick=()=>foodTab==='foods'?editFood():editMeal();
$('#meal-search').oninput=renderLibrary;
$('#journal-date').onchange=e=>{if(e.target.value){date=e.target.value;render();}};
function moveDate(offset){const d=new Date(date+'T12:00:00');d.setDate(d.getDate()+offset);date=dateKey(d);render();}
$('#prev-date').onclick=()=>moveDate(-1);$('#next-date').onclick=()=>moveDate(1);$('#today').onclick=()=>{date=dateKey();render();};
$('#edit-goal').onclick=()=>{modal('Daily goal',`<p class="modal-description">Your target for your bulk.</p><form id="goal-form"><label class="field">Daily calories<input id="goal-input" type="number" min="1" max="100000" step="1" value="${state.goal||''}" placeholder="kcal" required></label><label class="field">Daily protein (g)<input id="protein-goal-input" type="number" min="1" max="1000" step="1" value="${state.proteinGoal}" required></label><div class="modal-actions"><button type="button" class="text-button" data-action="close">Cancel</button><button class="primary">Save</button></div></form>`);$('#goal-form').onsubmit=e=>{e.preventDefault();state.goal=Number($('#goal-input').value);state.proteinGoal=Number($('#protein-goal-input').value);close();commit('Daily goal updated');};};
render();
save();
nativeStore?.onChange(data=>{
  if(data.revision<=revision)return;
  state=data.state;revision=data.revision;
  try{localStorage.setItem('dayplate-v2',JSON.stringify(state));}catch{}
  if($('#modal').open)close();
  render();toast('Journal updated');
});

let draggedMeal = null;
function clearDrag() {
  draggedMeal = null;
  document.body.classList.remove('dragging-meal');
  document.querySelectorAll('.drop-active, .drag-source').forEach(el => el.classList.remove('drop-active', 'drag-source'));
}
document.addEventListener('dragstart', event => {
  const source = event.target.closest('[data-drag-kind]');
  if (!source || event.target.closest('button')) { event.preventDefault(); return; }
  draggedMeal = {kind: source.dataset.dragKind, id: source.dataset.dragId};
  event.dataTransfer.setData('application/x-dayplate-meal', JSON.stringify(draggedMeal));
  event.dataTransfer.effectAllowed = draggedMeal.kind === 'meal' ? 'copy' : 'move';
  source.classList.add('drag-source');
  document.body.classList.add('dragging-meal');
});
document.addEventListener('dragover', event => {
  const target = event.target.closest('[data-drop-category]');
  if (!draggedMeal || !target) return;
  event.preventDefault();
  event.dataTransfer.dropEffect = draggedMeal.kind === 'meal' ? 'copy' : 'move';
  document.querySelectorAll('.drop-active').forEach(el => {if (el !== target) el.classList.remove('drop-active');});
  target.classList.add('drop-active');
});
document.addEventListener('dragleave', event => {
  const target = event.target.closest('[data-drop-category]');
  if (target && !target.contains(event.relatedTarget)) target.classList.remove('drop-active');
});
document.addEventListener('drop', event => {
  const target = event.target.closest('[data-drop-category]');
  if (!draggedMeal) return;
  event.preventDefault();
  const payload = draggedMeal;
  clearDrag();
  const category = target?.dataset.dropCategory;
  if (!categories.includes(category)) return;
  if (payload.kind === 'meal') {
    const meal = [...state.meals,...state.foods].find(m => m.id === payload.id);
    if (!meal) return;
    state.entries.push({id:crypto.randomUUID(), date, meal:structuredClone(meal), servings:1, category});
    commit(`Added to ${category.toLowerCase()}`);
  } else {
    const entry = state.entries.find(e => e.id === payload.id && e.date === date);
    if (!entry || entry.category === category) return;
    entry.category = category;
    commit(`Moved to ${category.toLowerCase()}`);
  }
});
document.addEventListener('dragend', clearDrag);
window.addEventListener('blur', clearDrag);

function showCalendar(monthDate = new Date(date+'T12:00:00')) {
  const year = monthDate.getFullYear(), month = monthDate.getMonth();
  const first = new Date(year, month, 1, 12);
  const count = new Date(year, month + 1, 0, 12).getDate();
  const totals = {}, proteinTotals = {}, incomplete = {};
  for (const entry of state.entries) {
    totals[entry.date] = (totals[entry.date] || 0) + entryCalories(entry);
    proteinTotals[entry.date] = (proteinTotals[entry.date] || 0) + entryProtein(entry);
    incomplete[entry.date] = incomplete[entry.date] || missingProtein(entry.meal);
  }
  const today = dateKey();
  const days = Array.from({length:first.getDay()},()=>'<span></span>');
  for (let day=1;day<=count;day++) {
    const key=dateKey(new Date(year,month,day,12));
    days.push(`<button class="calendar-day ${key===date?'selected':''} ${key===today?'is-today':''}" data-calendar-date="${key}" aria-label="${esc(new Date(year,month,day,12).toLocaleDateString(undefined,{dateStyle:'full'}))}${totals[key]!==undefined?', '+fmt(totals[key])+' kcal':''}" ${key===date?'aria-pressed="true"':'aria-pressed="false"'}><span>${day}</span><small>${totals[key]!==undefined?fmt(totals[key])+' kcal':''}</small></button>`);
  }
  const monthPrefix=`${year}-${String(month+1).padStart(2,'0')}-`;
  function chart(metric, label, values, goal, unit) {
    const number=value=>metric==='protein'?String(Number(value.toFixed(1))):fmt(value);
    const maximum=Math.max(goal||0,...Object.entries(values).filter(([key])=>key.startsWith(monthPrefix)).map(([,total])=>total),1);
    const bars=Array.from({length:count},(_,i)=>{
      const key=dateKey(new Date(year,month,i+1,12)),total=values[key],partial=metric==='protein' && incomplete[key];
      const description=total===undefined?'Not logged':`${number(total)} ${unit}${partial?' + unknown':''}`;
      return `<button class="hist-day ${total===undefined?'unlogged':''} ${partial?'partial':''}" data-calendar-date="${key}" title="${i+1}: ${description}" aria-label="${key}: ${description}"><span class="hist-bar" style="height:${total===undefined?0:total/maximum*100}%"></span><small>${i+1}</small></button>`;
    }).join('');
    return `<section class="calendar-chart" data-metric="${metric}"><div class="hist-heading"><strong>${label}</strong><small>0–${number(maximum)} ${unit}</small></div><div class="histogram" aria-label="Daily ${label.toLowerCase()} for selected month">${goal?`<div class="hist-goal" style="bottom:${goal/maximum*100}%"><span>${number(goal)} ${unit} goal</span></div>`:''}${bars}</div></section>`;
  }
  const histogram=chart('calories','Calories',totals,state.goal,'kcal')+chart('protein','Protein',proteinTotals,state.proteinGoal,'g')+'<p class="hist-note">Day of month · blank = not logged · dashed = incomplete protein</p>';
  modal('Calendar', `<div class="calendar-month"><button class="icon-button" id="calendar-prev" aria-label="Previous month">‹</button><strong>${first.toLocaleDateString(undefined,{month:'long',year:'numeric'})}</strong><button class="icon-button" id="calendar-next" aria-label="Next month">›</button></div>${histogram}<div class="calendar-grid"><div class="calendar-weekday">Sun</div><div class="calendar-weekday">Mon</div><div class="calendar-weekday">Tue</div><div class="calendar-weekday">Wed</div><div class="calendar-weekday">Thu</div><div class="calendar-weekday">Fri</div><div class="calendar-weekday">Sat</div>${days.join('')}</div><div class="modal-actions"><button class="text-button" id="calendar-today">Today</button></div>`);
  $('#calendar-prev').onclick=()=>showCalendar(new Date(year,month-1,1,12));
  $('#calendar-next').onclick=()=>showCalendar(new Date(year,month+1,1,12));
  $('#calendar-today').onclick=()=>{date=dateKey();close();render();};
  document.querySelectorAll('[data-calendar-date]').forEach(button=>button.onclick=()=>{date=button.dataset.calendarDate;close();render();});
}
$('#open-calendar').onclick=()=>showCalendar();

function editFood(food) {
 const item = food?.ingredients[0];
 modal(food?'Edit ingredient':'New ingredient', `<form id="food-form" class="studio-form"><div class="form-hero"><span class="food-icon">${foodIcon(food?.emoji||'bowl')}</span><label class="field">Name<input id="food-name" maxlength="70" value="${esc(food?.name||'')}" placeholder="What’s on your plate?" required></label></div><label class="field">Per one<input id="food-unit" maxlength="25" value="${esc(item?.unit||'piece')}" placeholder="egg, can, glass…" required></label><div class="nutrition-inputs"><label class="field nutrition-field">Calories<div class="unit-input"><input id="food-calories" type="number" min="0" max="100000" step="any" value="${item?.calories??''}" placeholder="0" required><span>kcal</span></div></label><label class="field nutrition-field">Protein<div class="unit-input"><input id="food-protein" type="number" min="0" max="100000" step="any" value="${item?.protein??''}" placeholder="—"><span>g</span></div></label></div><p class="footnote">Per unit · use your label. Blank protein = unknown.</p><div class="modal-actions"><button type="button" class="text-button" data-action="close">Cancel</button><button class="primary">Save</button></div></form>`);
 $('.nutrition-inputs').insertAdjacentHTML('beforeend', `<label class="field nutrition-field">Carbs<div class="unit-input"><input id="food-carbs" type="number" min="0" max="100000" step="any" value="${item?.carbs??''}" placeholder="—"><span>g</span></div></label><label class="field nutrition-field">Fat<div class="unit-input"><input id="food-fat" type="number" min="0" max="100000" step="any" value="${item?.fat??''}" placeholder="—"><span>g</span></div></label>`);
 $('#food-form .footnote').textContent='Per unit · use your label. Blank macros are unknown.';
 $('#food-form').onsubmit=event=>{
  event.preventDefault();const name=$('#food-name').value.trim(), unit=$('#food-unit').value.trim();
  if(!name||!unit)return;
  const saved={id:food?.id||crypto.randomUUID(),name,emoji:food?.emoji||'bowl',category:'Snack',isFood:true,source:'Custom',ingredients:[{name,amount:1,unit,calories:Number($('#food-calories').value),protein:$('#food-protein').value===''?null:Number($('#food-protein').value),carbs:$('#food-carbs').value===''?null:Number($('#food-carbs').value),fat:$('#food-fat').value===''?null:Number($('#food-fat').value)}]};
  if(food)state.foods[state.foods.findIndex(f=>f.id===food.id)]=saved;else state.foods.push(saved);
  close();commit('Ingredient saved');
 };
}
$('#weigh-in').onclick=()=>{
 const current=state.weighIns[date];
 const history=Object.entries(state.weighIns).sort(([a],[b])=>b.localeCompare(a)).slice(0,7);
 modal('Weigh-in',`<form id="weight-form" class="studio-form"><p class="modal-description">${esc(new Date(date+'T12:00:00').toLocaleDateString(undefined,{dateStyle:'medium'}))}</p><div class="weight-input-row"><label class="field nutrition-field">Weight<input id="weight-input" type="number" min="0.1" max="2000" step="0.1" value="${current?.value||''}" placeholder="0.0" required></label><label class="field">Unit<select id="weight-unit"><option ${((current?.unit||state.weightUnit)==='lb')?'selected':''}>lb</option><option ${((current?.unit||state.weightUnit)==='kg')?'selected':''}>kg</option></select></label></div><div class="weight-history">${history.map(([day,w])=>`<div><span>${esc(new Date(day+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'}))}</span><strong>${w.value} ${w.unit}</strong></div>`).join('')}</div><div class="modal-actions">${current?'<button type="button" class="text-button" id="delete-weight">Remove</button>':''}<button type="button" class="text-button" data-action="close">Cancel</button><button class="primary">Save</button></div></form>`);
 $('#weight-form').onsubmit=e=>{e.preventDefault();state.weightUnit=$('#weight-unit').value;state.weighIns[date]={value:Number($('#weight-input').value),unit:state.weightUnit};close();commit('Weight saved');};
 if(current)$('#delete-weight').onclick=()=>{delete state.weighIns[date];close();commit('Weigh-in removed');};
};
