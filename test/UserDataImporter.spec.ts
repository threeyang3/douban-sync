import {UserDataImporter} from '../src/org/wanxp/douban/userdata/UserDataImporter';
import {ImportPreviewModal} from '../src/org/wanxp/douban/userdata/ImportPreviewModal';
import {UserDataExport} from '../src/org/wanxp/douban/userdata/types';

jest.mock('obsidian', () => ({...jest.requireActual('./mocks/obsidian'), Modal: class {}}));

function fixture(frontmatter: Record<string, unknown> = {}, body = '') {
	let content = `---\ndoubanId: 123\nrating: local\n---\n\n${body}`;
	const file = {path: 'book/demo.md'};
	const app = {
		vault: {
			getMarkdownFiles: () => [file],
			read: jest.fn(async () => content),
			process: jest.fn(async (_file, update) => { content = update(content); }),
		},
		metadataCache: {getFileCache: () => ({frontmatter: {doubanId: '123', ...frontmatter}})},
	};
	const data = (customProperties = {}, bodySections = {}): UserDataExport => ({
		version: '1.0', exportTime: '', subjectType: 'book', totalCount: 1,
		items: {'123': {identifier: {doubanId: '123', title: 'Demo', type: 'book'}, customProperties, bodySections}},
	});
	return {app, importer: new UserDataImporter(app as any), data, content: () => content};
}

describe('user data import preview', () => {
	it('maps an import alias to the local field instead of creating the source field', async () => {
		const f = fixture({rating: 'local'});
		const diffs = await f.importer.buildDiffs(f.data({评语: 'import'}), {ignoredFields: [], fieldAliases: {评语: ' rating '}});
		expect(diffs[0].fieldDiffs).toEqual([{fieldName: 'rating', localValue: 'local', importValue: 'import', strategy: 'smart_merge'}]);
		await f.importer.applyDiffs(diffs);
		expect(f.content()).toContain('rating: local / import');
		expect(f.content()).not.toContain('评语:');
	});

	it('honors ignored aliases and prevents an alias overwriting Douban identifiers', async () => {
		const f = fixture();
		const diffs = await f.importer.buildDiffs(f.data({ignored: 'x', custom: '999'}), {
			ignoredFields: ['ignored'], fieldAliases: {ignored: 'rating', custom: 'doubanId'},
		});
		expect(diffs[0].identical).toBe(true);
	});

	it('merges against the latest file content without discarding edits made after preview', async () => {
		const f = fixture({rating: 'local'});
		const diffs = await f.importer.buildDiffs(f.data({rating: 'import'}));
		await f.app.vault.process({} as any, () => '---\ndoubanId: 123\nrating: newer\n---\n\nNew local body');
		await f.importer.applyDiffs(diffs);
		expect(f.content()).toContain('rating: newer / import');
		expect(f.content()).toContain('New local body');
	});

	it.each(['overwrite', 'smart_merge', 'keep_local'] as const)('previews and applies body sections with %s', async strategy => {
		const f = fixture({}, '## 记录\n\nLocal record\n\n## 感想\n\nLocal thoughts\n');
		const diffs = await f.importer.buildDiffs(f.data({}, {record: 'Imported record', thoughts: 'Imported thoughts'}));
		expect(diffs[0].identical).toBe(false);
		expect(diffs[0].fieldDiffs.map(d => d.sectionName)).toEqual(['记录', '感想']);
		diffs[0].fieldDiffs.forEach(d => { d.strategy = strategy; });
		const result = await f.importer.applyDiffs(diffs);
		if (strategy === 'keep_local') {
			expect(result.skipped).toBe(1);
			expect(f.content()).not.toContain('Imported');
		} else {
			expect(result.success).toBe(1);
			expect(f.content()).toContain('Imported record');
			expect(f.content()).toContain('Imported thoughts');
			expect(f.content().includes('Local record')).toBe(strategy === 'smart_merge');
		}
	});

	it('preserves unchecked entries when the overview is rebuilt for the next step', async () => {
		const f = fixture({rating: 'local'});
		const modal = new ImportPreviewModal(f.app as any) as any;
		modal.importData = f.data({rating: 'import'});
		await modal.rebuildDiffs();
		modal.diffs[0].selected = false;
		const originalEntry = modal.diffs[0];
		await modal.rebuildDiffs();
		expect(modal.diffs[0]).toBe(originalEntry);
		expect(modal.diffs[0].selected).toBe(false);
		await f.importer.applyDiffs(modal.diffs);
		expect(f.app.vault.process).not.toHaveBeenCalled();
	});

	it.each(['null', '{}', '{"items":[]}', '{"items":{"123":null}}'])('rejects invalid import data: %s', text => {
		const f = fixture();
		expect(() => f.importer.parseImportContent('test.json', text)).toThrow();
	});
});
