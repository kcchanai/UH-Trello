import {test, expect} from '@playwright/test';
import {readdirSync} from 'node:fs';

const builtLifecycleAsset = () => `/UH-Trello/assets/${readdirSync('dist/assets').find(file => file.startsWith('workspace-lifecycle-ui-') && file.endsWith('.js'))}`;
const builtCloudWorkspaceAsset = () => `/UH-Trello/assets/${readdirSync('dist/assets').find(file => file.startsWith('cloud-workspace-ui-') && file.endsWith('.js'))}`;
const builtCloudSyncAsset = () => `/UH-Trello/assets/${readdirSync('dist/assets').find(file => file.startsWith('cloud-sync-controller-') && file.endsWith('.js'))}`;

test('critical local-first card workflow persists after reload', async ({page}) => {
  await page.goto('/UH-Trello/');
  await expect(page.getByRole('heading', {level: 1})).toContainText('Website Launch');
  const firstList = page.locator('.list').first();
  await firstList.getByRole('button', {name: /add a card/i}).click();
  const title = `Release smoke ${Date.now()}`;
  await firstList.getByLabel('New card title').fill(title);
  await firstList.getByRole('button', {name: 'Add card'}).click();
  const createdCard = page.locator('.card-open').filter({hasText: title});
  await expect(createdCard).toBeVisible();
  await page.reload();
  await expect(page.locator('.card-open').filter({hasText: title})).toBeVisible();
});

test('card detail dialog closes with Escape and returns focus', async ({page}) => {
  await page.goto('/UH-Trello/');
  const card = page.locator('.card-open').first();
  await card.focus();
  await card.click();
  const dialog = page.locator('#card-dialog');
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(card).toBeFocused();
});

test('viewer card dialog close button remains enabled and returns focus', async ({page}) => {
  await page.goto('/UH-Trello/');
  await page.waitForFunction(() => globalThis.FlowboardApp && globalThis.FlowboardState);
  await page.evaluate(() => FlowboardApp.openCloudPreview(FlowboardState.makeWorkspace(), {id:'viewer-test', name:'Viewer test', role:'viewer'}));
  const card = page.locator('.card-open').first();
  await card.click();
  const dialog = page.locator('#card-dialog'), close = dialog.getByRole('button', {name:'Close card details'});
  await expect(dialog).toBeVisible();
  await expect(close).toBeEnabled();
  await close.click();
  await expect(dialog).toBeHidden();
  await expect(card).toBeFocused();
});

test('workspace root rename converges and archive returns the cloud session to local mode', async ({page}) => {
  await page.goto('/UH-Trello/');
  await page.waitForFunction(() => globalThis.FlowboardApp && globalThis.FlowboardState);
  await expect(page.locator('#cloud-status')).toHaveText('Google sign-in available');
  await page.evaluate(async asset => {
    const {initializeCloudSyncController} = await import(asset);
    let listener, subscriptions = 0, stops = 0;
    const adapter = {
      verifyWorkspaceAccess:async () => 'owner',
      subscribeWorkspace:async options => { listener = options; subscriptions += 1; return () => { stops += 1; }; }
    };
    FlowboardApp.openCloudWorkspace(FlowboardState.makeWorkspace(), {id:'root-listener-fixture', name:'Before root rename', role:'owner'});
    initializeCloudSyncController(adapter).setSession({uid:'owner'});
    globalThis.lifecycleRootProbe = {
      ready:() => Boolean(listener),
      rename:() => listener.onWorkspace({status:'ready', name:'After root rename'}),
      archive:() => listener.onWorkspace({status:'archived', name:'After root rename'}),
      late:() => listener.onWorkspace({status:'ready', name:'Late root rename'}),
      counts:() => ({subscriptions, stops})
    };
  }, builtCloudSyncAsset());
  await page.waitForFunction(() => lifecycleRootProbe.ready());
  await page.evaluate(() => lifecycleRootProbe.rename());
  await expect.poll(() => page.evaluate(() => FlowboardApp.getMode().name)).toBe('After root rename');
  await page.evaluate(() => lifecycleRootProbe.archive());
  await expect.poll(() => page.evaluate(() => FlowboardApp.getMode().kind)).toBe('local');
  await page.evaluate(() => { lifecycleRootProbe.late(); window.dispatchEvent(new Event('online')); });
  await expect.poll(() => page.evaluate(() => lifecycleRootProbe.counts())).toEqual({subscriptions:1, stops:1});
  await expect(page.getByText('Local owner · owner · local-only')).toBeVisible();
});

test('Google account dialog preserves an explicit local-only boundary', async ({page}) => {
  await page.goto('/UH-Trello/');
  await expect(page.locator('#cloud-status')).toHaveText('Google sign-in available');
  const account = page.getByRole('button', {name: 'Sign in with Google'});
  await account.click();
  const dialog = page.getByRole('dialog', {name: 'Google sign-in'});
  await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("Signing in does not upload, merge, replace, or delete this browser's workspace.");
  await expect(dialog.getByRole('button', {name: 'Continue with Google'})).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(account).toBeFocused();
});

test('owner workspace lifecycle dialog renames, archives, restores, and returns focus', async ({page}) => {
  await page.goto('/UH-Trello/');
  await page.evaluate(async asset => {
    const {createWorkspaceLifecycleControls} = await import(asset);
    const fixture = document.createElement('section'), openButton = document.createElement('button');
    const title = document.createElement('strong'), detail = document.createElement('span'), status = document.createElement('output');
    fixture.className = 'lifecycle-fixture'; openButton.textContent = 'Open fixture'; title.textContent = 'Lifecycle fixture';
    fixture.append(openButton, title, detail, status); document.body.prepend(fixture);
    const entry = {id:'fixture', name:'Lifecycle fixture', ownerUid:'owner', role:'owner', status:'ready', migration:{state:'verified'}};
    let revision=0;
    const mutate=options=>{if(options.expectedRevision!==revision)throw Object.assign(new Error('This workspace changed in another session. Refresh and try again.'),{code:'REVISION_CONFLICT'});return ++revision;};
    globalThis.advanceLifecycleRevision=()=>++revision;
    const adapter = {
      renameWorkspace:async options => ({name:options.name.trim(),lifecycleRevision:mutate(options)}),
      archiveWorkspace:async options => ({status:'archived',lifecycleRevision:mutate(options)}),
      restoreWorkspace:async options => ({status:'ready',lifecycleRevision:mutate(options)})
    };
    fixture.append(createWorkspaceLifecycleControls({entry, session:{uid:'owner'}, cloudAdapter:adapter, openButton, title, detail, lifecycleStatus:status}));
    const nonOwner = document.createElement('section'), nonOwnerOpen = document.createElement('button');
    nonOwner.className = 'non-owner-lifecycle-fixture';
    nonOwner.append(nonOwnerOpen, createWorkspaceLifecycleControls({entry:{...entry, role:'editor'}, session:{uid:'editor'}, cloudAdapter:adapter, openButton:nonOwnerOpen, title:document.createElement('strong'), detail:document.createElement('span'), lifecycleStatus:document.createElement('output')}));
    document.body.prepend(nonOwner);
  }, builtLifecycleAsset());

  const fixture = page.locator('.lifecycle-fixture');
  await expect(page.locator('.non-owner-lifecycle-fixture').getByRole('button')).toHaveCount(1);
  await fixture.getByRole('button', {name:'Rename'}).click();
  const rename = page.getByRole('dialog', {name:'Rename cloud workspace'});
  await rename.getByLabel('Workspace name').fill('Renamed lifecycle fixture');
  await rename.getByRole('button', {name:'Save name'}).click();
  await expect(fixture.locator('strong')).toHaveText('Renamed lifecycle fixture');

  const archiveButton = fixture.getByRole('button', {name:'Archive'});
  await archiveButton.click();
  const archive = page.getByRole('dialog', {name:'Archive cloud workspace?'});
  await expect(archive).toContainText('contents will be retained');
  await page.keyboard.press('Escape');
  await expect(archiveButton).toBeFocused();
  await archiveButton.click();
  await archive.getByRole('button', {name:'Archive workspace'}).click();
  await expect(fixture.getByRole('button', {name:'Open fixture'})).toBeHidden();
  await expect(fixture).toContainText('archived · retained');
  await fixture.getByRole('button', {name:'Restore'}).click();
  await expect(fixture.getByRole('button', {name:'Open fixture'})).toBeVisible();
  await page.evaluate(()=>globalThis.advanceLifecycleRevision());
  await fixture.getByRole('button', {name:'Rename'}).click();
  await rename.getByLabel('Workspace name').fill('Stale lifecycle fixture');
  await rename.getByRole('button', {name:'Save name'}).click();
  await expect(rename).toBeVisible();
  await expect(rename.getByRole('status')).toHaveText('This workspace changed in another session. Refresh and try again.');
  await expect(rename.getByRole('button', {name:'Save name'})).toBeEnabled();
  await expect(fixture.locator('strong')).toHaveText('Renamed lifecycle fixture');
  await rename.getByRole('button', {name:'Cancel'}).click();
});

test('owner can retry an interrupted migration and the workspace list refreshes to editable', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto('/UH-Trello/');
  await page.evaluate(async asset => {
    document.body.innerHTML = `<dialog id="account-dialog"></dialog><button id="open-cloud-migration"></button><dialog id="cloud-migration-dialog"><button id="close-cloud-migration"></button><input id="cloud-workspace-name"><dl id="cloud-migration-summary"></dl><p id="cloud-migration-status"></p><button id="download-migration-backup"></button><button id="create-cloud-workspace"></button></dialog><button id="open-cloud-workspaces">Cloud workspaces</button><dialog id="cloud-workspaces-dialog"><button id="close-cloud-workspaces"></button><div id="cloud-workspaces-list"></div><p id="cloud-workspaces-status"></p><button id="return-to-local-workspace"></button><button id="migrate-cloud-workspace">Migrate cloud format</button><button id="export-cloud-workspace"></button></dialog><div id="announcer"></div>`;
    let verified = false;
    const entry = () => ({id:'retry-fixture',name:'Interrupted fixture',ownerUid:'owner',role:'owner',status:verified?'ready':'migrating',migration:{state:verified?'verified':'migrating'}});
    const archivedEntry = {id:'archived-fixture',name:'Archived fixture',ownerUid:'owner',role:'owner',status:'archived',migration:{state:'verified'}};
    const cloudAdapter = {
      listWorkspaces:async()=>[entry(),archivedEntry],
      fetchWorkspace:async()=>{if(!verified)throw new Error('interrupted');return {schemaVersion:4,activeBoardId:'board',boards:[]};},
      migrateWorkspaceToGranular:async()=>{verified=true;return {boards:1,lists:1,cards:1};},
      renameWorkspace:async()=>({}),archiveWorkspace:async()=>({}),restoreWorkspace:async()=>({lifecycleRevision:1})
    };
    globalThis.FlowboardApp={getMode:()=>({kind:'local'}),openCloudPreview:()=>{},returnToLocal:()=>{},exportCloudPreview:()=>{}};
    const {initializeCloudWorkspaceUI}=await import(asset);
    initializeCloudWorkspaceUI({localAdapter:{},cloudAdapter}).setSession({uid:'owner'});
  }, builtCloudWorkspaceAsset());
  await page.getByRole('button',{name:'Cloud workspaces'}).click();
  const archivedRow=page.locator('.workspace-entry').filter({hasText:'Archived fixture'});
  await expect(archivedRow).toContainText('Cloud workspace · archived · retained');
  await expect(archivedRow.getByRole('button',{name:/Open|Rename|Archive/})).toHaveCount(0);
  await expect(archivedRow.getByRole('button',{name:'Restore'})).toBeVisible();
  const [summaryBox,restoreBox]=await Promise.all([archivedRow.locator('.workspace-board').boundingBox(),archivedRow.getByRole('button',{name:'Restore'}).boundingBox()]);
  expect(restoreBox.y).toBeGreaterThanOrEqual(summaryBox.y+summaryBox.height-1);
  await archivedRow.getByRole('button',{name:'Restore'}).click();
  await expect(archivedRow).toContainText('Cloud workspace · owner · editable');
  await expect(archivedRow.getByRole('button',{name:'Open Archived fixture'})).toBeVisible();
  await expect(archivedRow.getByRole('button',{name:'Rename'})).toBeVisible();
  await expect(archivedRow.getByRole('button',{name:'Archive',exact:true})).toBeVisible();
  await expect(archivedRow.getByRole('button',{name:'Restore'})).toHaveCount(0);
  await page.getByRole('button',{name:/Interrupted fixture/}).click();
  await expect(page.locator('#cloud-workspaces-status')).toContainText('migration was interrupted');
  await page.getByRole('button',{name:'Migrate cloud format'}).click();
  await expect(page.locator('#cloud-workspaces-list')).toContainText('owner · editable');
});

test('compact cloud-copy status fits the responsive top bar', async ({page}) => {
  await page.setViewportSize({width: 573, height: 500});
  await page.goto('/UH-Trello/');
  const status = page.locator('#cloud-status');
  await status.evaluate(element => { element.textContent = 'Cloud copy · local'; });
  const dimensions = await status.evaluate(element => ({clientWidth:element.clientWidth, scrollWidth:element.scrollWidth}));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth);
});

test('responsive widths confine horizontal scrolling to the board lane', async ({page}) => {
  await page.goto('/UH-Trello/');
  for (const width of [1280, 700, 440, 320]) {
    await page.setViewportSize({width, height:720});
    const layout = await page.evaluate(() => {
      const root = document.documentElement, board = document.querySelector('#board');
      return {
        pageFits:root.scrollWidth <= root.clientWidth,
        boardOverflow:getComputedStyle(board).overflowX,
        boardScrollable:board.scrollWidth > board.clientWidth
      };
    });
    expect(layout.pageFits, `page overflow at ${width}px`).toBe(true);
    expect(layout.boardOverflow).toBe('auto');
    if (width === 320) expect(layout.boardScrollable).toBe(true);
  }
});

test('forced colors and reduced motion retain borders, focus, and bounded motion', async ({page}) => {
  await page.emulateMedia({forcedColors:'active', reducedMotion:'reduce'});
  await page.goto('/UH-Trello/');
  await page.keyboard.press('Tab');
  const card = page.locator('.card').first();
  const evidence = await card.evaluate(element => {
    const cardStyle = getComputedStyle(element), focusStyle = getComputedStyle(document.activeElement);
    return {
      forcedColors:matchMedia('(forced-colors: active)').matches,
      reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches,
      borderStyle:cardStyle.borderStyle,
      transitionSeconds:Math.max(...cardStyle.transitionDuration.split(',').map(value => parseFloat(value) || 0)),
      focusVisible:focusStyle.outlineStyle !== 'none' && parseFloat(focusStyle.outlineWidth) > 0
    };
  });
  expect(evidence.forcedColors).toBe(true);
  expect(evidence.reducedMotion).toBe(true);
  expect(evidence.borderStyle).toBe('solid');
  expect(evidence.transitionSeconds).toBeLessThanOrEqual(0.001);
  expect(evidence.focusVisible).toBe(true);
});
