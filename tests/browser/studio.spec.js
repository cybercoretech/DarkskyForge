import {test,expect} from '@playwright/test';
import fs from 'node:fs';
import {unzipSync,strFromU8} from 'fflate';
import * as ot from 'opentype.js/dist/opentype.mjs';

test('Composer, exports, glyphs, themes, and local persistence work',async({page},info)=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await expect(page.locator('body')).toHaveAttribute('data-ready','true');
 await expect(page.locator('#engine-state')).toContainText('ENGINE READY');
 await expect(page.locator('#logo-preview svg')).toBeVisible();
 await expect(page.locator('#logo-preview path')).not.toHaveCount(0);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await page.screenshot({path:`test-results/${info.project.name}-composer.png`,fullPage:true});
 await page.locator('#wordmark').fill('NIGHT');await page.locator('#tagline').fill('AFTER DARK');await page.locator('#wordmark').blur();
 await page.reload();await expect(page.locator('#wordmark')).toHaveValue('NIGHT');
 await page.locator('#transparent').check();await page.locator('#export-format').selectOption('pack');
 const download=page.waitForEvent('download');await page.locator('#export-logo').click();const file=await download;const files=unzipSync(fs.readFileSync(await file.path()));
 expect(Object.keys(files)).toEqual(expect.arrayContaining(['night.svg','night.png','night.darksky.json','OFL.txt']));
 expect(strFromU8(files['night.svg'])).not.toContain('<rect');expect(files['night.png'].length).toBeGreaterThan(1000);
 await page.getByRole('button',{name:/02 Glyph lab/}).click();
 await page.locator('#glyph-character').fill('N');
 await expect(page.locator('.glyph-point').first()).toBeVisible();
 const before=await page.locator('#glyph-canvas g > path').first().getAttribute('d');
 await page.locator('.glyph-point').first().click({force:true});
 await page.locator('#point-x').fill('50');await page.locator('#apply-point').click();
 expect(await page.locator('#glyph-canvas g > path').first().getAttribute('d')).not.toBe(before);
 await page.locator('#font-name').fill('Monaspace Custom');await page.locator('#export-font').click();await expect(page.locator('#status')).toContainText('new font name');
 await page.locator('#font-name').fill('Night Custom');const fontDownload=page.waitForEvent('download');await page.locator('#export-font').click();const fontFiles=unzipSync(fs.readFileSync(await (await fontDownload).path()));
 const fontBytes=fontFiles['night-custom.otf'];const parsed=ot.parse(fontBytes.buffer.slice(fontBytes.byteOffset,fontBytes.byteOffset+fontBytes.byteLength));expect(parsed.names.windows.fontFamily.en).toBe('Night Custom');
 await page.screenshot({path:`test-results/${info.project.name}-glyph.png`,fullPage:true});
 await page.getByRole('button',{name:/03 Theme studio/}).click();
 await page.locator('#theme-name').fill('Night test');await page.locator('#save-theme').click();
 await expect(page.locator('#theme-select')).toHaveValue('custom-night-test');
 const themeDownload=page.waitForEvent('download');await page.locator('#export-theme').click();const themeFiles=unzipSync(fs.readFileSync(await (await themeDownload).path()));expect(strFromU8(themeFiles['dark.css'])).toContain('--');
 await page.locator('#theme-appearance').selectOption('light');await page.locator('input[aria-label="bg"]').fill('#eeeeee');await expect(page.locator('#contrast-report')).toContainText('Explicit light');
 await page.screenshot({path:`test-results/${info.project.name}-themes.png`,fullPage:true});
 const invalid=JSON.stringify({version:1,color:'bad'});await page.locator('#project-file').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from(invalid)});await expect(page.locator('#status')).toContainText('Invalid');
 expect(errors).toEqual([]);
});

test('Typography controls compile spacing, ligatures, SVG glyphs and direct saves',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await expect(page.locator('body')).toHaveAttribute('data-ready','true');
 await page.getByRole('button',{name:/02 Glyph lab/}).click();
 await page.locator('#glyph-character').fill('A');await page.locator('#left-bearing').fill('80');await page.locator('#left-bearing').blur();await expect(page.locator('#left-bearing')).toHaveValue('80');
 await page.locator('#right-bearing').fill('95');await page.locator('#right-bearing').blur();await expect(page.locator('#right-bearing')).toHaveValue('95');
 await page.locator('#kern-value').fill('-120');await page.locator('#kern-value').blur();
 await page.locator('#ligature-from').fill('fi');await page.locator('#ligature-to').fill('D');await page.locator('#add-ligature').click();await expect(page.locator('#ligature-map')).toContainText('fi → D');
 await expect(page.locator('#font-testbed')).toHaveText('AVATAR Type fi NIGHT');
 expect(await page.locator('#font-testbed').evaluate(el=>document.fonts.check('24px '+getComputedStyle(el).fontFamily))).toBe(true);
 await page.locator('#glyph-character').fill('★');
 await page.locator('#svg-file').setInputFiles({name:'icon.svg',mimeType:'image/svg+xml',buffer:Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><path d="M0 0 L100 0 L50 100 Z"/></svg>')});
 await expect(page.locator('#status')).toContainText('SVG outline imported');
 await page.locator('#font-name').fill('Metrics Test');const dl=page.waitForEvent('download');await page.locator('#export-font').click();const files=unzipSync(fs.readFileSync(await(await dl).path()));const bytes=files['metrics-test.otf'];const font=ot.parse(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength));
 expect(font.getKerningValue(font.charToGlyph('A'),font.charToGlyph('V'))).toBe(-120);expect(font.charToGlyph('A').advanceWidth-font.charToGlyph('A').getBoundingBox().x2).toBe(95);expect(font.charToGlyphIndex('★')).toBeGreaterThan(0);expect(font.stringToGlyphs('fi').length).toBe(1);
 await page.getByRole('button',{name:/01 Logo composer/}).click();
 await page.evaluate(()=>{window.savedProject=null;window.pickCount=0;window.showSaveFilePicker=async()=>{window.pickCount++;return{name:'test.darksky.json',createWritable:async()=>({write:async text=>window.savedProject=text,close:async()=>{}})}};});
 await page.locator('#save-local').click();await expect(page.locator('#status')).toContainText('Saved to your local');await page.locator('#save-local').click();expect(await page.evaluate(()=>window.pickCount)).toBe(1);expect(await page.evaluate(()=>JSON.parse(window.savedProject).kerning.AV)).toBe(-120);
 expect(errors).toEqual([]);
});

test('Imported OFL font projects reopen, invalid fonts and theme packs do not mutate state',async({page})=>{
 await page.goto('/');await expect(page.locator('body')).toHaveAttribute('data-ready','true');
 await page.locator('#import-font').click();await page.locator('#custom-font-file').setInputFiles('public/fonts/jetbrains-bold.ttf');await page.locator('#custom-license-file').setInputFiles({name:'license.txt',mimeType:'text/plain',buffer:Buffer.from('All rights reserved')});await page.locator('#load-custom-font').click();await expect(page.locator('#font-import-error')).toContainText('full SIL');
 await page.locator('#custom-license-file').setInputFiles('public/fonts/OFL-JetBrains.txt');await page.locator('#load-custom-font').click();await expect(page.locator('#font-select')).toHaveValue('custom');
 const dl=page.waitForEvent('download');await page.locator('#save-project').click();const path=await(await dl).path();await page.reload();await page.locator('#project-file').setInputFiles(path);await expect(page.locator('#font-select')).toHaveValue('custom');await expect(page.locator('#logo-preview svg')).toBeVisible();
 await page.getByRole('button',{name:/03 Theme studio/}).click();await expect(page.locator('#engine-state')).toContainText('ENGINE READY');const before=await page.locator('#theme-select option').count();await page.locator('#pack-file').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{"format_version":999}')});await expect(page.locator('#status')).not.toBeEmpty();expect(await page.locator('#theme-select option').count()).toBe(before);
});

test('Font export writes OTF, TTF and WOFF2 that the browser font sanitizer accepts',async({page})=>{
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('/');await expect(page.locator('body')).toHaveAttribute('data-ready','true');
 await page.getByRole('button',{name:/02 Glyph lab/}).click();
 await page.locator('#font-name').fill('Format Test');
 for(const id of ['#format-otf','#format-ttf','#format-woff2'])await page.locator(id).uncheck();
 await page.locator('#export-font').click();await expect(page.locator('#status')).toContainText('at least one font format');
 for(const id of ['#format-otf','#format-ttf','#format-woff2'])await page.locator(id).check();
 const dl=page.waitForEvent('download');await page.locator('#export-font').click();
 const files=unzipSync(fs.readFileSync(await(await dl).path()));
 expect(Object.keys(files)).toEqual(expect.arrayContaining(['format-test.otf','format-test.ttf','format-test.woff2','format-test.css','OFL.txt']));
 expect(strFromU8(files['format-test.css'])).toMatch(/url\("format-test\.woff2"\) format\("woff2"\)/);
 const ttf=files['format-test.ttf'];expect(ot.parse(ttf.buffer.slice(ttf.byteOffset,ttf.byteOffset+ttf.byteLength)).outlinesFormat).toBe('truetype');
 // Chrome runs every web font through its OTS sanitizer and rejects malformed files.
 for(const [name,type] of [['format-test.ttf','font/ttf'],['format-test.woff2','font/woff2']]){
  const result=await page.evaluate(async([b64,label])=>{const bytes=Uint8Array.from(atob(b64),c=>c.charCodeAt(0));const face=new FontFace(label,bytes);try{await face.load();}catch(e){return 'rejected: '+e.message;}document.fonts.add(face);
   const c=document.createElement('canvas').getContext('2d');c.font=`48px "${label}", monospace`;const ours=c.measureText('DARKSKY').width;c.font='48px monospace';return face.status+' '+(ours!==c.measureText('DARKSKY').width);},[Buffer.from(files[name]).toString('base64'),'Check'+type.replace(/\W/g,'')]);
  expect(result,`${name} must load as a web font`).toBe('loaded true');
 }
 expect(errors).toEqual([]);
});
