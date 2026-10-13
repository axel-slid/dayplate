let mobileJournalPage=0,mobileMealPage=0,mobileJournalDate=date;
const isPhone=()=>window.matchMedia('(max-width:700px)').matches;
const pager=(kind,page,total,size)=>`<div class="mobile-pager"><button data-mobile-page="${kind}" data-page-step="-1" aria-label="Previous page" ${page===0?'disabled':''}>‹</button><span>${total?`${page+1} / ${Math.ceil(total/size)}`:'—'}</span><button data-mobile-page="${kind}" data-page-step="1" aria-label="Next page" ${(page+1)*size>=total?'disabled':''}>›</button></div>`;
function renderMobileJournal(){
  if(mobileJournalDate!==date){mobileJournalDate=date;mobileJournalPage=0;}
  const entries=state.entries.filter(e=>e.date===date);
  mobileJournalPage=Math.min(mobileJournalPage,Math.max(0,Math.ceil(entries.length/3)-1));
  $('#mobile-journal').innerHTML=`<div class="section-heading"><h2>Meals</h2><button class="primary mobile-add" data-mobile-food aria-label="Add food">＋</button></div><div class="mobile-day-list">${entries.slice(mobileJournalPage*3,mobileJournalPage*3+3).map(e=>`<button class="mobile-entry" data-action="edit-entry" data-id="${esc(e.id)}"><span class="entry-emoji">${foodIcon(e.meal.emoji)}</span><span><strong>${esc(e.meal.name)}</strong><small>${esc(e.category)}</small></span><b>${fmt(entryCalories(e))}<small>kcal</small></b><span aria-hidden="true">↗</span></button>`).join('')||'<div class="mobile-empty">—</div>'}</div>${pager('journal',mobileJournalPage,entries.length,3)}`;
}
function mobileFoodPicker(category='Lunch'){
  let tab='meals',page=0;
  modal('Add food',`<input id="mobile-food-search" type="search" placeholder="Search" aria-label="Search food"><div class="food-tabs"><button data-picker-tab="meals" aria-selected="true">Meals</button><button data-picker-tab="foods" aria-selected="false">Ingredients</button></div><div id="mobile-food-choices"></div><div id="mobile-food-pages"></div><div class="modal-actions"><button class="text-button" data-picker-new>＋ New</button><button class="text-button" data-action="close">×</button></div>`);
  const show=()=>{const matches=state[tab].filter(m=>m.name.toLowerCase().includes($('#mobile-food-search').value.toLowerCase()));page=Math.min(page,Math.max(0,Math.ceil(matches.length/5)-1));
    $('#mobile-food-choices').innerHTML=matches.slice(page*5,page*5+5).map(m=>`<button class="meal-choice" data-action="log" data-id="${m.id}" data-category="${category}"><span class="food-icon">${foodIcon(m.emoji)}</span><strong>${esc(m.name)}</strong><span>${fmt(mealCalories(m))} →</span></button>`).join('')||'<div class="mobile-empty">—</div>';
    $('#mobile-food-pages').innerHTML=pager('picker',page,matches.length,5);};
  show();$('#mobile-food-search').oninput=()=>{page=0;show();};
  $('#modal-content').addEventListener('click',function handle(event){const b=event.target.closest('button');if(!b)return;
    if(b.dataset.pickerTab){tab=b.dataset.pickerTab;page=0;document.querySelectorAll('[data-picker-tab]').forEach(t=>t.setAttribute('aria-selected',t===b));show();}
    if(b.dataset.mobilePage==='picker'){page+=Number(b.dataset.pageStep);show();}
    if(b.hasAttribute('data-picker-new')){tab==='foods'?editFood():editMeal();}
  },{signal:mobilePickerController().signal});
}
let pickerController;
function mobilePickerController(){pickerController?.abort();pickerController=new AbortController();return pickerController;}
document.addEventListener('click',event=>{const b=event.target.closest('button');if(!b)return;
  if(b.hasAttribute('data-mobile-food'))mobileFoodPicker();
  if(b.dataset.mobilePage==='journal'){mobileJournalPage+=Number(b.dataset.pageStep);renderMobileJournal();}
  if(b.dataset.mobilePage==='meals'){mobileMealPage+=Number(b.dataset.pageStep);renderLibrary();renderMobileMealPages();}
});
function renderMobileMealPages(){
  let target=$('#mobile-meal-pages');if(!target){$('#meals-view').insertAdjacentHTML('beforeend','<div id="mobile-meal-pages"></div>');target=$('#mobile-meal-pages');}
  const count=state.meals.filter(m=>m.name.toLowerCase().includes($('#meal-search').value.toLowerCase())).length;
  target.innerHTML=pager('meals',mobileMealPage,count,4);
}
$('#meal-search').addEventListener('input',()=>{mobileMealPage=0;renderLibrary();renderMobileMealPages();});
window.addEventListener('resize',()=>{renderLibrary();renderMobileMealPages();renderMobileJournal();if(view==='analytics')renderAnalytics();});
renderMobileJournal();renderMobileMealPages();
