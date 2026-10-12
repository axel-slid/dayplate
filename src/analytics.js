let analyticsRange = 'all', analyticsMetric = 'calories', analyticsPage = 0, analyticsPane='intake', weightPage=0;
const analyticsDate = key => new Date(key+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});
const decimal = value => Number(value.toFixed(1)).toLocaleString();
function renderAnalytics() {
  const summary = Model.historySummary(state, {days:analyticsRange==='all'?null:Number(analyticsRange)});
  const {history} = summary;
  const activity = Model.activitySummary(state,{days:analyticsRange==='all'?null:Number(analyticsRange)});
  const count = history.length;
  const phone=window.matchMedia('(max-width:700px)').matches;
  const pageSize=phone?5:15;
  analyticsPage = Math.min(analyticsPage, Math.max(0, Math.ceil(count/pageSize)-1));
  const stat = (label,value,unit,note,id) => `<article class="analytics-stat"><span class="section-label">${label}${id.startsWith('analytics-average')?'<span class="stat-info" title="Per logged day. Each macro uses days with complete values." aria-label="Average calculation"> ⓘ</span>':''}</span><div><strong id="${id}">${value}</strong> <span>${unit}</span></div><small>${note}</small></article>`;
  $('#analytics-view').innerHTML = `<div class="analytics-toolbar"><span></span><div class="analytics-ranges" role="group" aria-label="Analytics period">${[['7','7 days'],['30','30 days'],['all','All history']].map(([key,label])=>`<button data-analytics-range="${key}" aria-pressed="${analyticsRange===key}">${phone?(key==='all'?'∞':key+'d'):label}</button>`).join('')}</div><div class="analytics-pane-tabs" role="group" aria-label="Analytics screen">${[['intake','▥','Intake'],['history','▦','History'],['weight','⚖','Weight']].map(([key,icon,label])=>`<button data-analytics-pane="${key}" aria-label="${label}" title="${label}" aria-pressed="${analyticsPane===key}">${icon}</button>`).join('')}</div></div>
    <div class="analytics-stats">${stat('Average calories',summary.averageCalories===null?'—':fmt(summary.averageCalories),'kcal / day',`${count} d`,'analytics-average-calories')}${stat('Average protein',summary.averageProtein===null?'—':decimal(summary.averageProtein),'g / day',`${summary.proteinDays} / ${count} d`,'analytics-average-protein')}${['carbs','fat'].map(metric=>stat('Average '+metric,summary.macros[metric].average===null?'—':decimal(summary.macros[metric].average),'g / day',`${summary.macros[metric].days} / ${count} d`,`analytics-average-${metric}`)).join('')}${stat('Total calories',fmt(summary.totalCalories),'kcal',`${fmt(summary.entryCount)} entries`,'analytics-total-calories')}${stat('Days logged',fmt(count),'days',count?`${analyticsDate(history.at(-1).date)} – ${analyticsDate(history[0].date)}`:'—','analytics-days')}</div>

    ${count ? `<section class="analytics-panel intake-panel"><div class="section-heading"><div><h2>Daily intake</h2><p class="muted">${analyticsDate(summary.start)} – ${analyticsDate(summary.end)}</p></div><div class="analytics-ranges" role="group" aria-label="Chart nutrient">${['calories','protein','carbs','fat'].map(metric=>`<button data-analytics-metric="${metric}" aria-pressed="${analyticsMetric===metric}">${metric[0].toUpperCase()+metric.slice(1)}</button>`).join('')}</div></div><div id="analytics-chart"></div></section>
    <div class="analytics-insights"><article class="analytics-panel"><span class="section-label">Calorie target</span><strong>${summary.calorieGoalDays===null?'—':`${summary.calorieGoalDays} / ${count} d`}</strong><p>${state.goal?`≥ ${fmt(state.goal)} kcal`:'—'}</p></article><article class="analytics-panel"><span class="section-label">Protein target</span><strong>${summary.proteinGoalDays===null?'—':`${summary.proteinGoalDays} / ${summary.proteinDays} d`}</strong><p>${state.proteinGoal?`≥ ${fmt(state.proteinGoal)} g`:'—'}</p></article><article class="analytics-panel"><span class="section-label">Most logged</span><strong>${esc(summary.topMeal.name)}</strong><p>× ${summary.topMeal.count}</p></article></div>
    <section class="analytics-panel analytics-history"><div class="section-heading"><h2>Daily history</h2><span>${count} d ↓</span></div><div class="history-scroll"><table><thead><tr><th scope="col">Date</th><th scope="col">Calories</th><th scope="col">Protein</th><th scope="col">Carbs</th><th scope="col">Fat</th><th scope="col">Entries</th></tr></thead><tbody>${history.slice(analyticsPage*pageSize,analyticsPage*pageSize+pageSize).map(day=>`<tr><th scope="row"><button data-history-date="${day.date}">${analyticsDate(day.date)} <span aria-hidden="true">↗</span></button></th><td>${fmt(day.calories)} kcal</td>${['protein','carbs','fat'].map(metric=>`<td${day.complete[metric]?'':' class="incomplete"'} title="${day.complete[metric]?'Complete total':'Known total; some values are missing'}">${day.complete[metric]?decimal(day[metric])+' g':day[metric]?decimal(day[metric])+' g + ?':'Unknown'}</td>`).join('')}<td>${day.entries.length}</td></tr>`).join('')}</tbody></table></div><div class="history-pagination"><span>${analyticsPage*pageSize+1}–${Math.min(analyticsPage*pageSize+pageSize,count)} of ${count} days</span><div><button data-history-page="prev" ${analyticsPage===0?'disabled':''}>Previous</button><button data-history-page="next" ${(analyticsPage+1)*pageSize>=count?'disabled':''}>Next</button></div></div></section>` : '<div class="analytics-empty"><span aria-hidden="true">◒</span><h2>No entries</h2><button class="primary" data-analytics-journal>Open journal</button></div>'}`;
  $('#analytics-view').insertAdjacentHTML('beforeend',analyticsActivity(activity));
  if(count) renderAnalyticsChart(summary);
  if(phone){
    for(const [selector,pane] of [['.analytics-stats','intake'],['.intake-panel','intake'],['.analytics-history','history'],['.weight-analytics','weight']]){const el=$('#analytics-view '+selector);if(el)el.hidden=analyticsPane!==pane;}
    for(const selector of ['.analytics-insights','.movement-analytics','.analytics-empty']){const el=$('#analytics-view '+selector);if(el)el.hidden=selector!=='.analytics-empty'||analyticsPane!=='intake';}
  }
}
function renderAnalyticsChart(summary) {
  const byDate = new Map(summary.history.map(day=>[day.date,day]));
  const days=[];
  const cursor=new Date(summary.start+'T12:00:00');
  while(dateKey(cursor)<=summary.end){days.push(dateKey(cursor));cursor.setDate(cursor.getDate()+1);}
  const metric=analyticsMetric, unit=metric==='calories'?'kcal':'g';
  const goal=metric==='calories'?state.goal:metric==='protein'?state.proteinGoal:null;
  const max=Math.max(goal||0,...summary.history.map(day=>day[metric]),1)*1.12;
  $('#analytics-chart').innerHTML=`<div class="analytics-chart-scale"><span>${metric==='calories'?fmt(max):decimal(max)} ${unit}</span><span>0</span></div><div class="analytics-chart-scroll"><div class="analytics-chart-bars" style="min-width:${Math.max(480,days.length*19)}px">${goal?`<div class="analytics-goal" style="bottom:${goal/max*100}%"><span>${fmt(goal)} ${unit}</span></div>`:''}${days.map((key,i)=>{
    const day=byDate.get(key), partial=day && metric!=='calories' && !day.complete[metric];
    const label=`${analyticsDate(key)}: ${day?`${metric==='calories'?fmt(day[metric]):decimal(day[metric])} ${unit}${partial?' + unknown':''}`:'Not logged'}`;
    return `<button class="analytics-bar ${partial?'partial':''} ${day?'':'unlogged'}" data-history-date="${key}" aria-label="${label}" title="${label}"><span style="height:${day?day[metric]/max*100:0}%"></span>${i%Math.max(1,Math.ceil(days.length/9))===0?`<small${i===days.length-1?' style="left:auto;right:0"':''}>${new Date(key+'T12:00:00').toLocaleDateString(undefined,{month:'short',day:'numeric'})}</small>`:''}</button>`;
  }).join('')}</div></div>`;
}
$('#analytics-view').addEventListener('click',event=>{
  const button=event.target.closest('button'); if(!button)return;
  if(button.dataset.analyticsRange){analyticsRange=button.dataset.analyticsRange;analyticsPage=0;weightPage=0;renderAnalytics();}
  else if(button.dataset.analyticsPane){analyticsPane=button.dataset.analyticsPane;renderAnalytics();}
  else if(button.dataset.weightPage){weightPage+=Number(button.dataset.weightPage);renderAnalytics();}
  else if(button.dataset.analyticsMetric){analyticsMetric=button.dataset.analyticsMetric;renderAnalytics();}
  else if(button.hasAttribute('data-add-weight')){date=dateKey();$('#weigh-in').click();}
  else if(button.dataset.weightDate){date=button.dataset.weightDate;$('#weigh-in').click();}
  else if(button.dataset.historyDate){date=button.dataset.historyDate;switchView('journal');render();window.scrollTo(0,0);}
  else if(button.dataset.historyPage){analyticsPage+=button.dataset.historyPage==='next'?1:-1;renderAnalytics();}
  else if(button.hasAttribute('data-analytics-journal')){switchView('journal');render();}
});

function analyticsActivity(activity) {
  const {weights,unit,latestWeight,weightChange}=activity;
  const change=weightChange===null?'—':`${weightChange>0?'+':''}${decimal(weightChange)}`;
  let chart='';
  if(weights.length){
    const min=Math.min(...weights.map(w=>w.value)),max=Math.max(...weights.map(w=>w.value));
    const spread=Math.max(max-min,2),low=min-spread*.2,high=max+spread*.2;
    const first=new Date(weights[0].date+'T12:00:00'),last=new Date(weights.at(-1).date+'T12:00:00');
    const point=w=>[weights.length===1?270:48+(new Date(w.date+'T12:00:00')-first)/Math.max(last-first,1)*452,145-(w.value-low)/(high-low)*116];
    const points=weights.map(point);
    chart=`<svg class="weight-trend" viewBox="0 0 550 185" role="img" aria-label="Weight history in ${unit}, ${analyticsDate(weights[0].date)} to ${analyticsDate(weights.at(-1).date)}"><line x1="48" x2="505" y1="145" y2="145" stroke="#e7dcc0"/><line x1="48" x2="505" y1="30" y2="30" stroke="#eee5d1" stroke-dasharray="4 5"/><text x="0" y="34">${decimal(high)}</text><text x="0" y="149">${decimal(low)}</text>${weights.length>1?`<polyline class="weight-line" points="${points.map(p=>p.join(',')).join(' ')}" fill="none" stroke="#b88d24" stroke-width="3" stroke-linejoin="round" pathLength="1"/>`:''}${weights.map((w,i)=>`<circle class="weight-point" cx="${points[i][0]}" cy="${points[i][1]}" r="5" fill="#edc444" stroke="#fffdf8" stroke-width="2"><title>${analyticsDate(w.date)}: ${decimal(w.value)} ${unit}</title></circle>`).join('')}<text x="48" y="178">${analyticsDate(weights[0].date)}</text>${weights.length>1?`<text x="500" y="178" text-anchor="end">${analyticsDate(weights.at(-1).date)}</text>`:''}</svg>`;
  }
  weightPage=Math.min(weightPage,Math.max(0,Math.ceil(weights.length/4)-1));
  return `<section class="analytics-panel weight-analytics"><div class="section-heading"><div><h2>Weight</h2></div><button class="primary" data-add-weight aria-label="Add weigh-in">＋</button></div><div class="weight-overview"><div><span class="section-label">Latest weight</span><strong id="analytics-latest-weight">${latestWeight?decimal(latestWeight.value)+' <small>'+unit+'</small>':'—'}</strong><p>${latestWeight?analyticsDate(latestWeight.date):'—'}</p></div><div><span class="section-label">Change in period</span><strong id="analytics-weight-change">${change} <small>${weightChange===null?'':unit}</small></strong><p>${weights.length>1?'Δ first → last':'—'}</p></div><div><span class="section-label">Weigh-ins</span><strong>${weights.length}</strong></div></div>${chart||''}${weights.length?`<details class="weight-history-details"><summary>${weights.length} weigh-ins</summary><div class="weight-history">${[...weights].reverse().map(w=>`<div><button data-weight-date="${w.date}">${analyticsDate(w.date)} ↗</button><strong>${decimal(w.value)} ${unit}</strong></div>`).join('')}</div></details>`:''}<div class="mobile-weight-history"><div class="weight-history">${[...weights].reverse().slice(weightPage*4,weightPage*4+4).map(w=>`<div><button data-weight-date="${w.date}">${analyticsDate(w.date)} ↗</button><strong>${decimal(w.value)} ${unit}</strong></div>`).join('')}</div><div class="mobile-pager"><button data-weight-page="-1" aria-label="Previous weigh-ins" ${weightPage===0?'disabled':''}>‹</button><span>${weights.length?`${weightPage+1} / ${Math.ceil(weights.length/4)}`:'—'}</span><button data-weight-page="1" aria-label="Next weigh-ins" ${(weightPage+1)*4>=weights.length?'disabled':''}>›</button></div></div></section><section class="analytics-panel movement-analytics"><div class="section-heading"><h2>Movement</h2><button class="text-button" data-view="workouts">View workouts ↗</button></div><div class="weight-overview"><div><span class="section-label">Workouts</span><strong id="analytics-workout-count">${activity.workouts.length}</strong></div><div><span class="section-label">Active days</span><strong>${activity.workoutDays}</strong></div><div><span class="section-label">Time logged</span><strong>${decimal(activity.minutes)} <small>min</small></strong></div></div></section>`;
}
