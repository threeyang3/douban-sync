import {prepareTemplatePreview, renderTemplatePreview} from '../src/org/wanxp/douban/setting/TemplatePreview';
import SettingsManager from '../src/org/wanxp/douban/setting/SettingsManager';
import {DEFAULT_SETTINGS} from '../src/org/wanxp/constant/DefaultSettings';
import {TemplateKey} from '../src/org/wanxp/constant/Constsant';
import {getDefaultTemplateContent} from '../src/org/wanxp/constant/DefaultTemplateContent';

jest.mock('obsidian', () => ({...jest.requireActual('./mocks/obsidian'), moment: require('moment')}));

describe('template preview', () => {
	it.each(Object.values(TemplateKey))('renders %s with the import formatter without fetching or writing', async templateKey => {
		const settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
		const plugin = {app: {}, settings, netFileHandler: {downloadDBFile: jest.fn()}, userComponent: {isLogin: () => false}};
		const manager = new SettingsManager(plugin.app as any, plugin as any);
		const before = JSON.stringify(settings);
		const result = await renderTemplatePreview(getDefaultTemplateContent(templateKey, true), templateKey, manager);
		expect(result.yamlError).toBeUndefined();
		expect(result.unresolved).toEqual([]);
		expect(result.properties.title).toBeTruthy();
		expect(result.markdown).not.toContain('`= this.');
		expect(result.markdown).toContain('[!douban-info]');
		expect(plugin.netFileHandler.downloadDBFile).not.toHaveBeenCalled();
		expect(JSON.stringify(settings)).toBe(before);
	});

	it('keeps property types and substitutes simple field references', () => {
		const result = prepareTemplatePreview('---\ngenre: [剧情, 生活]\nscore: 8.6\n---\n\n`= this.genre` / `= this.score`');
		expect(result.properties.score).toBe(8.6);
		expect(result.markdown.trim()).toBe('剧情、生活 / 8.6');
	});

	it('reports invalid YAML while preserving the preview body', () => {
		const result = prepareTemplatePreview('---\ntitle: [bad\n---\n# Preview');
		expect(result.yamlError).toBeTruthy();
		expect(result.markdown).toBe('# Preview');
	});

	it('reports unknown placeholders and disables executable query blocks', () => {
		const result = prepareTemplatePreview('# {{unknown}}\n```dataviewjs\nthrow new Error()\n```\n> ~~~dataview\n> LIST\n> ~~~');
		expect(result.unresolved).toEqual(['{{unknown}}']);
		expect(result.markdown).toContain('```text');
		expect(result.markdown).toContain('> ~~~text');
	});

	it('leaves unsupported inline queries inert', () => {
		const result = prepareTemplatePreview('`$= window.runScript()` / `= customFunction()`');
		expect(result.markdown).not.toContain('`$=');
		expect(result.markdown).not.toContain('`=');
		expect(result.markdown).toContain('window.runScript()');
	});
});
