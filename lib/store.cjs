const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const {randomUUID} = require('node:crypto');
const Model = require('../src/model.js');

const defaultDirectory = () => process.env.DAYPLATE_DATA_DIR || process.env.DAYPLATE_TEST_DATA || path.join(os.homedir(), 'Library', 'Application Support', 'dayplate');
const filename = dir => path.join(dir, 'journal.json');
function read(dir) {
  try {
    const data = JSON.parse(fs.readFileSync(filename(dir), 'utf8'));
    if (!Number.isInteger(data.revision) || data.revision < 1) throw new Error('Invalid journal revision');
    validate(data.state);
    return data;
  } catch (error) {
    if (error.code === 'ENOENT') return {revision:0, state:null};
    throw error;
  }
}
function number(value, label, positive=false) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || (positive && value === 0)) throw new Error(`${label} must be a finite ${positive?'positive':'nonnegative'} number`);
}
function day(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || new Date(value+'T12:00:00Z').toISOString().slice(0,10) !== value) throw new Error('Date must be a real YYYY-MM-DD date');
  return value;
}
function meal(value) {
  if (!value || typeof value.id !== 'string' || !value.id || typeof value.name !== 'string' || !value.name.trim() || !Array.isArray(value.ingredients) || !value.ingredients.length) throw new Error('Meal requires id, name, and ingredients');
  for (const i of value.ingredients) {
    if (typeof i.name !== 'string' || !i.name.trim() || typeof i.unit !== 'string' || !i.unit.trim()) throw new Error('Ingredient requires name and unit');
    number(i.amount,'Ingredient amount',true); number(i.calories,'Calories');
    for (const field of ['protein','carbs','fat']) if (i[field] != null) number(i[field], field);
  }
  category(value.category);
}
function category(value) { if (!['Breakfast','Lunch','Dinner','Snack'].includes(value)) throw new Error('Category must be Breakfast, Lunch, Dinner, or Snack'); }
function workout(value) {
  if(!value || typeof value.id!=='string' || !value.id || typeof value.name!=='string' || !value.name.trim() || value.name.length>100)throw new Error('Workout requires an ID and name (up to 100 characters)');
  day(value.date);
  if(!['Strength','Cardio','Sport','Walking','Other'].includes(value.type))throw new Error('Invalid workout type');
  if(value.minutes!=null)number(value.minutes,'Workout minutes',true);
  if(value.notes!=null&&(typeof value.notes!=='string'||value.notes.length>3000))throw new Error('Workout notes must be text up to 3000 characters');
  if(value.exercises!=null){
    if(!Array.isArray(value.exercises))throw new Error('Workout exercises must be an array');
    for(const exercise of value.exercises){
      if(typeof exercise.name!=='string'||!exercise.name.trim()||exercise.name.length>100)throw new Error('Exercise requires a name');
      for(const key of ['sets','reps'])if(exercise[key]!=null){number(exercise[key],key,true);if(!Number.isInteger(exercise[key]))throw new Error(key+' must be a whole number');}
      if(exercise.weight!=null)number(exercise.weight,'Exercise weight');
      if(!['lb','kg'].includes(exercise.unit))throw new Error('Exercise weight unit must be lb or kg');
    }
  }
}
function validate(state) {
  if (!state || !['meals','foods','entries'].every(key=>Array.isArray(state[key]))) throw new Error('Invalid journal state');
  for (const m of [...state.meals,...state.foods]) meal(m);
  const ids = new Set();
  for (const e of state.entries) {
    if (typeof e.id !== 'string' || !e.id || ids.has(e.id)) throw new Error('Entry IDs must be unique');
    ids.add(e.id); day(e.date); meal(e.meal); category(e.category); number(e.servings,'Servings',true);
  }
  if (state.goal != null) number(state.goal,'Calorie goal',true);
  if (state.proteinGoal != null) number(state.proteinGoal,'Protein goal',true);
  for (const [date,w] of Object.entries(state.weighIns || {})) { day(date); number(w.value,'Weight',true); if (!['lb','kg'].includes(w.unit)) throw new Error('Weight unit must be lb or kg'); }
  if(state.workouts!==undefined&&!Array.isArray(state.workouts))throw new Error('Workouts must be an array');
  const workoutIds=new Set();
  for(const w of state.workouts||[]){workout(w);if(workoutIds.has(w.id))throw new Error('Workout IDs must be unique');workoutIds.add(w.id);}
}
function transaction(dir, change) {
  fs.mkdirSync(dir,{recursive:true,mode:0o700});
  const lock = path.join(dir,'journal.lock');
  let fd;
  try { fd = fs.openSync(lock,'wx',0o600); } catch (e) { if(e.code==='EEXIST') { e.message='Journal is busy. Retry in a moment.'; e.code='EBUSY'; } throw e; }
  let temp;
  try {
    const current = read(dir), result = change(current);
    if (!result || !result.state) return result;
    validate(result.state);
    const next = {revision:current.revision+1,state:result.state};
    temp = filename(dir)+'.'+randomUUID()+'.tmp';
    const dataFd=fs.openSync(temp,'wx',0o600);
    try { fs.writeFileSync(dataFd,JSON.stringify(next,null,2)+'\n'); fs.fsyncSync(dataFd); } finally { fs.closeSync(dataFd); }
    if (current.state) fs.copyFileSync(filename(dir), filename(dir)+'.backup');
    fs.renameSync(temp,filename(dir)); temp=null;
    return {...next,result:result.result};
  } finally {
    if(temp) fs.rmSync(temp,{force:true}); fs.closeSync(fd); fs.unlinkSync(lock);
  }
}
function replace(dir, state, revision) {
  return transaction(dir, current=> {
    if (current.revision !== revision) { const error = new Error('Journal changed. Review the latest entries and retry your edit.'); error.code='ECONFLICT'; throw error; }
    return {state};
  });
}
function summary(state,date) {
  const entries=state.entries.filter(e=>e.date===day(date));
  const total = (fn) => Math.round(entries.reduce((n,e)=>n+fn(e),0)*10)/10;
  return {date,calories:total(Model.entryCalories),protein:total(Model.entryProtein),carbs:total(Model.entryCarbs),fat:total(Model.entryFat),complete:entries.every(e=>!Model.missingProtein(e.meal)&&!Model.missingCarbs(e.meal)&&!Model.missingFat(e.meal)),entries};
}
module.exports={defaultDirectory,filename,read,transaction,replace,validate,day,number,meal,category,workout,summary};
