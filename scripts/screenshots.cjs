// Reproducible screenshots using fictional data in a temporary journal.
const {_electron: electron} = require('@playwright/test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const Model = require('../src/model.js');
const Store = require('../lib/store.cjs');

(async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'dayplate-demo-'));
  const output = path.join(__dirname, '..', 'screenshots');
  let app;
  try {
    const state = Model.enrichNutrition(Model.initialState());
    state.meals = [
      ['oats', 'Overnight oats', 'Breakfast', 'bowl', 450, 27, 53, 15],
      ['chicken', 'Chicken rice bowl', 'Lunch', 'bowl', 680, 45, 84, 18],
      ['salmon', 'Salmon & potatoes', 'Dinner', 'dinner', 910, 52, 101, 33],
      ['yogurt', 'Greek yogurt', 'Snack', 'milk', 300, 24, 29, 10]
    ].map(([id, name, category, emoji, calories, protein, carbs, fat]) => ({
      id, name, category, emoji, source: 'Fictional demo meal',
      ingredients: [{name, amount: 1, unit: 'portion', calories, protein, carbs, fat}]
    }));
    const today = new Date(); today.setHours(12, 0, 0, 0);
    for (let offset = 0; offset < 30; offset++) {
      const day = new Date(today); day.setDate(day.getDate() - offset);
      const date = Model.dateKey(day);
      for (const [index, meal] of state.meals.entries()) {
        state.entries.push({id: `demo-${offset}-${index}`, date, category: meal.category,
          servings: offset === 0 ? 1 : [.9, 1, 1.15, 1.25, .95][offset % 5], meal: structuredClone(meal)});
      }
      if (offset % 3 === 0) state.weighIns[date] = {value: Number((170.2 + offset * .09 + Math.sin(offset) * .2).toFixed(1)), unit: 'lb'};
      if (offset % 2 === 0) state.workouts.push({id: `demo-workout-${offset}`, date,
        name: ['Upper body', 'Evening run', 'Lower body'][offset / 2 % 3],
        type: offset / 2 % 3 === 1 ? 'Cardio' : 'Strength', minutes: [50, 32, 45][offset / 2 % 3],
        exercises: offset / 2 % 3 === 0 ? [{name: 'Bench press', sets: 3, reps: 8, weight: 95, unit: 'lb'}] : [], notes: ''});
    }
    Store.replace(directory, state, 0);
    await fs.mkdir(output, {recursive: true});
    app = await electron.launch({args: [path.join(__dirname, '..')], env: {...process.env, DAYPLATE_TEST_DATA: directory}});
    const page = await app.firstWindow();
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    const shot = async name => {await page.waitForTimeout(1200); await page.screenshot({path: path.join(output, `${name}.png`)});};
    await shot('desktop-journal');
    await page.getByRole('button', {name: 'Analytics', exact: true}).click();
    await page.locator('[data-analytics-range="30"]').click();
    await shot('desktop-analytics');
    await app.evaluate(({BrowserWindow}) => {
      const window = BrowserWindow.getAllWindows()[0];
      window.setMinimumSize(320, 500); window.setSize(390, 844);
    });
    const fits = async () => {
      const layout = await page.evaluate(() => {
        const main = document.querySelector('main');
        const section = [...main.querySelectorAll(':scope > section')].find(el => !el.hidden);
        return {scrollHeight: main.scrollHeight, clientHeight: main.clientHeight,
          bottom: section.getBoundingClientRect().bottom, navTop: document.querySelector('.sidebar').getBoundingClientRect().top};
      });
      assert.ok(layout.scrollHeight <= layout.clientHeight + 1, `Phone page overflows: ${JSON.stringify(layout)}`);
      assert.ok(layout.bottom <= layout.navTop + 1, `Phone page overlaps navigation: ${JSON.stringify(layout)}`);
    };
    await page.getByRole('button', {name: 'Journal', exact: true}).click();
    await shot('mobile-journal'); await fits();
    await page.locator('[data-mobile-page="journal"][data-page-step="1"]').click();
    assert.equal(await page.locator('.mobile-entry').count(), 1);
    await page.getByRole('button', {name: 'Analytics', exact: true}).click();
    await shot('mobile-analytics'); await fits();
    await page.locator('[data-analytics-pane="history"]').click();
    await page.waitForTimeout(500); await fits();
    assert.equal(await page.locator('.analytics-history tbody tr').count(), 5);
    await page.locator('[data-analytics-pane="weight"]').click();
    await shot('mobile-weight'); await fits();
    await page.getByRole('button', {name: 'Workouts', exact: true}).click();
    await shot('mobile-workouts'); await fits();
    await page.getByRole('button', {name: 'Next workouts', exact: true}).click();
    assert.equal(await page.locator('#workouts-view .workout-card').count(), 3);
    await page.getByRole('button', {name: 'Meals', exact: true}).click();
    await page.waitForTimeout(500); await fits();
    // Exercise the space reserved for an iPhone's status bar and home indicator.
    const css = await fs.readFile(path.join(__dirname, '..', 'src', 'polish.css'), 'utf8');
    await page.addStyleTag({content: css.replaceAll('env(safe-area-inset-top)', '59px').replaceAll('env(safe-area-inset-bottom)', '34px')});
    for (const name of ['Journal', 'Meals', 'Workouts', 'Analytics']) {
      await page.getByRole('button', {name, exact: true}).click();
      if (name === 'Journal') await page.locator('[data-mobile-page="journal"][data-page-step="-1"]').click();
      await page.waitForTimeout(500); await fits();
    }
    for (const pane of ['intake', 'history', 'weight']) {
      await page.locator(`[data-analytics-pane="${pane}"]`).click();
      await page.waitForTimeout(500); await fits();
    }
    assert.deepEqual(errors, []);
    console.log('Saved six screenshots with fictional data; populated phone pages fit without vertical scrolling.');
  } finally {
    if (app) await app.close();
    await fs.rm(directory, {recursive: true, force: true});
  }
})().catch(error => {console.error(error); process.exitCode = 1;});
