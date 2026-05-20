import { UserDataMerger } from '../src/org/wanxp/douban/userdata/UserDataMerger';

describe('UserDataMerger', () => {
	const merger = new UserDataMerger();

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
