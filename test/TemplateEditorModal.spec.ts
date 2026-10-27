import {MarkdownRenderer} from 'obsidian';
import {TemplateEditorModal} from '../src/org/wanxp/douban/component/TemplateEditorModal';
import {TemplateKey} from '../src/org/wanxp/constant/Constsant';
import {prepareTemplatePreview} from '../src/org/wanxp/douban/setting/TemplatePreview';

jest.mock('obsidian', () => ({
	...jest.requireActual('./mocks/obsidian'), Modal: class {},
	Component: class { load() {} unload() {} },
	MarkdownRenderer: {renderMarkdown: jest.fn()},
}));

function editor() {
	const pending: Array<{markdown: string, finish: () => void}> = [];
	(MarkdownRenderer.renderMarkdown as jest.Mock).mockImplementation((markdown: string, body: {rendered: string}) => {
		body.rendered = markdown;
		return new Promise<void>(resolve => pending.push({markdown, finish: resolve}));
	});
	const preview = {scrollTop: 0, replaceChildren: jest.fn(), empty: jest.fn(),
		ownerDocument: {createElement: () => {
			const node: any = {className: '', createDiv: () => node, createEl: () => node};
			return node;
		}}};
	const modal = new TemplateEditorModal({} as any, TemplateKey.movieTemplateFile, 'first', {
		onPreview: async content => prepareTemplatePreview(content),
	}) as any;
	modal.opened = true;
	modal.previewEl = preview;
	modal.statusEl = {setText: jest.fn()};
	modal.contentEl = {empty: jest.fn()};
	return {modal, preview, pending};
}

describe('live preview lifecycle', () => {
	it('does not let an older asynchronous render replace newer edits', async () => {
		const {modal, preview, pending} = editor();
		modal.revision = 1;
		const oldRender = modal.renderPreview(1);
		await Promise.resolve();
		modal.content = 'newest';
		modal.revision = 2;
		const newRender = modal.renderPreview(2);
		await Promise.resolve();
		pending[1].finish();
		await newRender;
		pending[0].finish();
		await oldRender;
		expect(preview.replaceChildren).toHaveBeenCalledTimes(1);
		expect(preview.replaceChildren.mock.calls[0][0].rendered).toBe('newest');
	});

	it('does not update the DOM after the editor closes', async () => {
		const {modal, preview, pending} = editor();
		modal.revision = 1;
		const render = modal.renderPreview(1);
		await Promise.resolve();
		modal.onClose();
		pending[0].finish();
		await render;
		expect(preview.replaceChildren).not.toHaveBeenCalled();
	});
});
