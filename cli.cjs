#!/usr/bin/env node
const fs=require('node:fs');
const Store=require('./lib/store.cjs');
const {apply}=require('./lib/commands.cjs');
const {dateKey}=require('./src/model.js');
const help=`Dayplate CLI — local food journal (also available as openplate)
Usage:
  dayplate day [--date YYYY-MM-DD]
  dayplate list [--search text]
  dayplate export
  dayplate log --meal ID_OR_NAME --date YYYY-MM-DD [--servings 1] [--category Dinner] [--id UNIQUE_ID]
  dayplate add --date YYYY-MM-DD --item 'MEAL[=SERVINGS][@CATEGORY]' [--item ...] [--category Dinner] [--id BATCH_ID] [--dry-run]
  dayplate food --name NAME --unit UNIT --calories N [--protein N --carbs N --fat N] [--id ID] [--source TEXT]
  dayplate apply --file operations.json [--dry-run]
  dayplate apply --stdin [--dry-run]
All results are JSON. --data-dir PATH uses an isolated journal.
apply accepts {"operations":[...]} or an operations array. Types:
food.put, meal.put (item: saved recipe with ingredients), log, entry.update,
macros.fill (rules matched by name + unit; optional dates, library, overwrite),
goals.set, weight.set, workout.put, workout.remove. Ingredient nutrition is PER UNIT; amounts and servings scale it.
Explicit entry IDs make log retries idempotent. Edits to recipes preserve past entries.
For add, each --item uses a saved food or meal ID or exact name. --id gives the batch
stable entry IDs (BATCH_ID-1, BATCH_ID-2, ...), so the same command is retryable.
Data: ~/Library/Application Support/dayplate/journal.json
Open Dayplate once after upgrading to migrate its existing journal. No network needed.
`;
async function main(args) {
  const command=args.shift()||'help', opts={};
  const allowed=new Set(['date','search','meal','servings','category','id','name','unit','calories','protein','carbs','fat','source','file','stdin','dry-run','data-dir','help','item']);
  while(args.length) {
    const flag=args.shift(); if(!flag.startsWith('--')||!allowed.has(flag.slice(2)))throw new Error(`Unknown option: ${flag}`);
    const key=flag.slice(2);
    if(['stdin','dry-run','help'].includes(key))opts[key]=true;
    else {if(!args.length||args[0].startsWith('--'))throw new Error(`Missing value for ${flag}`);const value=args.shift();if(key==='item')(opts.item ||= []).push(value);else opts[key]=value;}
  }
  if(command==='help'||opts.help){console.log(help);return;}
  const dir=opts['data-dir']||Store.defaultDirectory();
  const current=Store.read(dir);if(!current.state)throw new Error('Journal is not initialized. Open Dayplate once to migrate your existing entries.');
  let result,operations;
  if(command==='day')result=Store.summary(current.state,opts.date||dateKey());
  else if(command==='export')result=current;
  else if(command==='list')result=[...current.state.meals,...current.state.foods].filter(m=>!opts.search||m.name.toLowerCase().includes(opts.search.toLowerCase()));
  else if(command==='log') {
    if(!opts.meal||!opts.date)throw new Error('log requires --meal and --date');
    operations=[{type:'log',meal:opts.meal,date:opts.date,servings:opts.servings===undefined?1:Number(opts.servings),category:opts.category,id:opts.id}];
  } else if(command==='add') {
    if(!opts.date||!opts.item?.length)throw new Error('add requires --date and at least one --item');
    if(opts.id && !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(opts.id))throw new Error('Batch ID must use letters, numbers, dots, underscores, or hyphens');
    operations=opts.item.map((spec,index)=>{
      const at=spec.lastIndexOf('@');
      const category=at<0?opts.category:spec.slice(at+1);
      const item=at<0?spec:spec.slice(0,at);
      const equal=item.lastIndexOf('=');
      const meal=equal<0?item:item.slice(0,equal);
      const servings=equal<0?1:Number(item.slice(equal+1));
      if(!meal.trim()||!Number.isFinite(servings)||servings<=0)throw new Error(`Invalid item: ${spec}`);
      if(category)Store.category(category);
      return {type:'log',meal:meal.trim(),date:opts.date,servings,category,id:opts.id?`${opts.id}-${index+1}`:undefined};
    });
  } else if(command==='food') {
    if(!opts.name||!opts.unit||opts.calories===undefined)throw new Error('food requires --name, --unit and --calories');
    const ingredient={name:opts.name,unit:opts.unit,amount:1,calories:Number(opts.calories)};
    for(const field of ['protein','carbs','fat'])ingredient[field]=opts[field]===undefined?null:Number(opts[field]);
    operations=[{type:'food.put',item:{id:opts.id,name:opts.name,source:opts.source,ingredients:[ingredient]}}];
  } else if(command==='apply') {
    if(Boolean(opts.file)===Boolean(opts.stdin))throw new Error('apply requires exactly one of --file or --stdin');
    const input=JSON.parse(fs.readFileSync(opts.file||0,'utf8')); operations=Array.isArray(input)?input:input.operations;
  } else throw new Error(`Unknown command: ${command}`);
  if(operations) {
    if(opts['dry-run'])result={dryRun:true,...apply(current.state,operations)};
    else {
      let updated;
      for(let attempt=0;attempt<40;attempt++) {
        try{updated=Store.transaction(dir,latest=>{if(!latest.state)throw new Error('Journal not initialized');return apply(latest.state,operations);});break;}
        catch(e){if(e.code!=='EBUSY'||attempt===39)throw e;await new Promise(resolve=>setTimeout(resolve,50));}
      }
      result={revision:updated.revision,results:updated.result};
    }
  }
  console.log(JSON.stringify(result,null,2));
}
if(require.main===module)main(process.argv.slice(2)).catch(error=>{console.error(JSON.stringify({error:error.message}));process.exitCode=1;});
module.exports={main};
