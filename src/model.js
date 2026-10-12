(function(root) {
  const mealCalories = meal => meal.ingredients.reduce((sum, item) => sum + Number(item.amount) * Number(item.calories), 0);
  const entryCalories = entry => mealCalories(entry.meal) * Number(entry.servings);
  const mealProtein = meal => meal.ingredients.reduce((sum, item) => sum + Number(item.amount) * Number(item.protein || 0), 0);
  const entryProtein = entry => mealProtein(entry.meal) * Number(entry.servings);
  const missingProtein = meal => meal.ingredients.some(item => item.protein == null);
  const mealCarbs = meal => meal.ingredients.reduce((sum, item) => sum + Number(item.amount) * Number(item.carbs || 0), 0);
  const entryCarbs = entry => mealCarbs(entry.meal) * Number(entry.servings);
  const mealFat = meal => meal.ingredients.reduce((sum, item) => sum + Number(item.amount) * Number(item.fat || 0), 0);
  const entryFat = entry => mealFat(entry.meal) * Number(entry.servings);
  const missingCarbs = meal => meal.ingredients.some(item => item.carbs == null);
  const missingFat = meal => meal.ingredients.some(item => item.fat == null);
  const proteinEstimates = {'Rice':4.3,'Chicken tikka masala (with sauce)':25,'Chole':7,'Samosas':3,'Naan':8,'Chutney':0,'Philly cheesesteak':35,'Fries':4,'Breaded fried chicken tenders':12,'Chicken':.31,'Sauce':0,'Chicken (40 g protein)':40,'Refried beans':21,'Eggs':6,'Shredded cheese':28,'Kraft mac & cheese':30,'Cheese':28,'Salsa':0,'Milk':8};
  const dateKey = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
  const ingredient = (name, amount, unit, calories) => ({name, amount, unit, calories, protein:proteinEstimates[name] ?? null});
  const initialFoods = () => [
    {id:'food-eggs',name:'Eggs',emoji:'eggs',unit:'egg',calories:72},
    {id:'food-cheese',name:'Cheese',emoji:'cheese',unit:'cup',calories:440},
    {id:'food-beans',name:'Refried beans',emoji:'beans',unit:'can',calories:350},
    {id:'food-salsa',name:'Salsa',emoji:'salsa',unit:'tbsp',calories:5},
    {id:'food-milk',name:'Milk',emoji:'milk',unit:'glass (8 fl oz)',calories:150}
  ].map(f=>({id:f.id,name:f.name,emoji:f.emoji,category:'Snack',isFood:true,source:'Estimate',ingredients:[ingredient(f.name,1,f.unit,f.calories)]}));
  const initialState = () => ({version: 3, goal: 3000, foods: initialFoods(), entries: [], meals: [
    {id:'katora', name:'Katora bowl', category:'Lunch', emoji:'bowl', source:'Monsoon · estimate', ingredients:[ingredient('Rice', 1, 'cup', 205), ingredient('Chicken tikka masala (with sauce)', 1, 'cup', 350), ingredient('Chole', .5, 'cup', 150), ingredient('Samosas', 2, 'pieces', 150), ingredient('Naan', 1, 'piece', 260), ingredient('Chutney', 2, 'tbsp', 20)]},
    {id:'philly', name:'Philly & fries', category:'Lunch', emoji:'sandwich', source:'GBC · estimate', ingredients:[ingredient('Philly cheesesteak', 1, 'sandwich', 700), ingredient('Fries', 1, 'portion', 365)]},
    {id:'tenders', name:'Chicken tenders', category:'Lunch', emoji:'chicken', source:'GBC · estimate', ingredients:[ingredient('Breaded fried chicken tenders', 4, 'pieces', 150)]},
    {id:'gateway', name:'Mediterranean bowl', category:'Lunch', emoji:'bowl', source:'Gateway · estimate', ingredients:[ingredient('Rice', 1, 'cup', 205), ingredient('Chicken', 150, 'g', 1.65), ingredient('Sauce', 2, 'tbsp', 70)]},
    {id:'dinner', name:'Usual dinner', category:'Dinner', emoji:'eggs', source:'Home · estimate', ingredients:[ingredient('Chicken (40 g protein)', 1, 'portion', 215), ingredient('Refried beans', .5, 'can', 350), ingredient('Eggs', 4, 'eggs', 72), ingredient('Shredded cheese', .5, 'cup', 440)]},
    {id:'kraft', name:'Kraft mac & cheese', category:'Snack', emoji:'pasta', source:'Kraft · protein estimate', ingredients:[ingredient('Kraft mac & cheese', 1, 'box', 1100)]}
  ]});
  function migrateState(state) {
    if ((state.version || 2) >= 3) return state;
    const katora = state.meals.find(m => m.id === 'katora');
    if (katora) {
      const tikka = katora.ingredients.find(i => i.name === 'Chicken tikka masala');
      if (tikka) tikka.name = 'Chicken tikka masala (with sauce)';
      for (const item of initialState().meals.find(m => m.id === 'katora').ingredients.slice(3)) {
        if (!katora.ingredients.some(i => i.name.toLowerCase().includes(item.name.toLowerCase()))) katora.ingredients.push(item);
      }
    }
    const tenders = state.meals.find(m => m.id === 'tenders');
    const chicken = tenders?.ingredients.find(i => i.name === 'Chicken tenders');
    if (chicken) {
      chicken.name = 'Breaded fried chicken tenders';
      if (chicken.calories === 120) chicken.calories = 150;
    }
    state.version = 3;
    return state;
  }
  function enrichNutrition(state) {
    state.workouts ||= [];
    state.weighIns ||= {};
    state.weightUnit ||= 'lb';
    state.proteinGoal ??= 150;
    if (!state.nutritionVersion) {
      const defaults = [...initialState().meals, ...initialFoods()];
      for (const meal of [...state.meals, ...(state.foods || []), ...state.entries.map(e=>e.meal)]) {
        const original = defaults.find(m=>m.id === meal.id);
        for (const item of meal.ingredients) {
          if (item.protein !== undefined) continue;
          const match = original?.ingredients.find(i=>i.name === item.name && i.unit === item.unit);
          item.protein = match?.protein ?? null;
        }
      }
      state.nutritionVersion = 1;
    }
    return state;
  }
  function historySummary(state, {days = null, today = dateKey()} = {}) {
    const startDate = new Date(today+'T12:00:00');
    if (days) startDate.setDate(startDate.getDate() - days + 1);
    const start = days ? dateKey(startDate) : null;
    const entries = state.entries.filter(e => e.date <= today && (!start || e.date >= start));
    const grouped = new Map(), meals = new Map();
    for (const entry of entries) {
      if (!grouped.has(entry.date)) grouped.set(entry.date, {date:entry.date, calories:0, protein:0, carbs:0, fat:0, complete:{protein:true, carbs:true, fat:true}, entries:[]});
      const day = grouped.get(entry.date);
      day.calories += entryCalories(entry);
      for (const [metric, value, missing] of [['protein',entryProtein,missingProtein],['carbs',entryCarbs,missingCarbs],['fat',entryFat,missingFat]]) {
        day[metric] += value(entry);
        day.complete[metric] &&= !missing(entry.meal);
      }
      day.entries.push(entry);
      const key = entry.meal.id || entry.meal.name;
      const meal = meals.get(key) || {name:entry.meal.name, count:0};
      meal.count++; meals.set(key, meal);
    }
    const history = [...grouped.values()].sort((a,b)=>b.date.localeCompare(a.date));
    const totalCalories = history.reduce((sum,day)=>sum+day.calories,0);
    const proteinDays = history.filter(day=>day.complete.protein);
    const averageProtein = proteinDays.length ? proteinDays.reduce((sum,day)=>sum+day.protein,0)/proteinDays.length : null;
    const macros = Object.fromEntries(['protein','carbs','fat'].map(metric=>{
      const completeDays=history.filter(day=>day.complete[metric]);
      return [metric,{average:completeDays.length?completeDays.reduce((sum,day)=>sum+day[metric],0)/completeDays.length:null,days:completeDays.length,partialDays:history.length-completeDays.length}];
    }));
    return {history, entryCount:entries.length, totalCalories, averageCalories:history.length ? totalCalories/history.length : null,
      macros,
      averageProtein, proteinDays:proteinDays.length, partialProteinDays:history.length-proteinDays.length,
      calorieGoalDays:state.goal ? history.filter(day=>day.calories>=state.goal).length : null,
      proteinGoalDays:state.proteinGoal ? proteinDays.filter(day=>day.protein>=state.proteinGoal).length : null,
      topMeal:[...meals.values()].sort((a,b)=>b.count-a.count || a.name.localeCompare(b.name))[0] || null,
      start:start || history.at(-1)?.date || today, end:today};
  }
  function activitySummary(state,{days=null,today=dateKey()}={}) {
    const from=new Date(today+'T12:00:00');if(days)from.setDate(from.getDate()-days+1);
    const start=days?dateKey(from):null;
    const includes=date=>date<=today&&(!start||date>=start);
    const unit=state.weightUnit||'lb';
    const weights=Object.entries(state.weighIns||{}).filter(([date])=>includes(date)).sort(([a],[b])=>a.localeCompare(b)).map(([date,w])=>({date,value:w.unit===unit?w.value:unit==='lb'?w.value*2.2046226218:w.value/2.2046226218,unit}));
    const workouts=(state.workouts||[]).filter(w=>includes(w.date)).sort((a,b)=>b.date.localeCompare(a.date));
    return {weights,unit,latestWeight:weights.at(-1)||null,weightChange:weights.length>1?weights.at(-1).value-weights[0].value:null,workouts,
      workoutDays:new Set(workouts.map(w=>w.date)).size,minutes:workouts.reduce((sum,w)=>sum+(w.minutes||0),0),timedWorkouts:workouts.filter(w=>w.minutes!=null).length};
  }
  const api = {activitySummary, historySummary, mealCalories, entryCalories, mealProtein, entryProtein, missingProtein, mealCarbs, entryCarbs, mealFat, entryFat, missingCarbs, missingFat, enrichNutrition, dateKey, initialState, initialFoods, migrateState};
  if (typeof module !== 'undefined') module.exports = api; else root.Model = api;
})(globalThis);
