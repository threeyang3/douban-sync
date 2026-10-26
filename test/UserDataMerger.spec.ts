import { UserDataMerger } from '../src/org/wanxp/douban/userdata/UserDataMerger';

describe('UserDataMerger', () => {
	const merger = new UserDataMerger();

	it('updating an empty field preserves the following property', () => {
		const result = merger.updateFrontmatterField('---\nrating:\nother: keep\n---\n', 'rating', 'new');
		expect(result).toBe('---\nrating: new\nother: keep\n---\n');
	});

	it('replaces an entire block value and leaves its following field intact', () => {
		const result = merger.updateFrontmatterField('---\nnote: |\n  old first\n  old second\nother: keep\n---\n', 'note', 'new\ntext');
		expect(result).toContain('other: keep');
		expect(result).not.toContain('old');
		expect(require('js-yaml').load(result.split('---')[1]).note).toBe('new\ntext');
	});

	it.each(['true', '123', '2026-10-27', '', 'a\\b', '$&', 'a\nb'])('preserves the string value %j in YAML', value => {
		const result = merger.updateFrontmatterField('---\nnote: old\n---\n', 'note', value);
		expect(require('js-yaml').load(result.split('---')[1]).note).toBe(value);
	});

	it('handles quoted keys and CRLF without duplicating or deleting fields', () => {
		const result = merger.updateFrontmatterField('---\r\n"my:note":\r\nother: keep\r\n---\r\n', 'my:note', 'new');
		expect(require('js-yaml').load(result.split('---')[1])).toEqual({'my:note': 'new', other: 'keep'});
	});

	it('preserves custom properties and body sections', () => {
		const newContent = `---
doubanId: 123
title: Demo
---

# Demo

## 记录

new record
`;
		const merged = merger.mergeUserData(newContent, {
			identifier: { doubanId: '123', title: 'Demo', type: 'movie' },
			customProperties: {
				tags: ['a', 'b'],
				aliases: ['old'],
			},
			bodySections: {
				record: 'old record',
				thoughts: 'old thoughts',
			},
		});

		expect(merged).toContain('tags: \n  - a\n  - b');
		expect(merged).toContain('aliases: \n  - old');
		expect(merged).toContain('## 记录\n\nold record');
		expect(merged).toContain('## 感想\n\nold thoughts');
	});

	it('does not overwrite existing frontmatter field values', () => {
		const content = `---
doubanId: 123
tags:
  - existing
---
`;

		const merged = merger.mergeCustomProperties(content, { tags: ['new'] });
		expect(merged).toContain('  - existing');
		expect(merged).not.toContain('  - new');
	});
});
