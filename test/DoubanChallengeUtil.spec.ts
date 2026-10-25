import {DoubanChallengeUtil} from '../src/org/wanxp/utils/DoubanChallengeUtil';

describe('DoubanChallengeUtil', () => {
	const challengeHtml = `
		<html><body>
			<form id="sec" action="/c" method="post">
				<input name="tok" value="token">
				<input name="cha" value="challenge">
				<input name="red" value="https://book.douban.com/subject/1/">
				<input name="sol">
			</form>
			<script>difficulty = 2;</script>
		</body></html>`;

	it('parses a supported challenge page', () => {
		expect(DoubanChallengeUtil.parse(challengeHtml)).toEqual({
			token: 'token',
			challenge: 'challenge',
			redirectUrl: 'https://book.douban.com/subject/1/',
			difficulty: 2,
		});
		expect(DoubanChallengeUtil.parse(challengeHtml.replace('difficulty = 2', 'difficulty = 99'))?.difficulty)
			.toBe(6);
	});

	it('ignores unknown or incomplete challenge pages', () => {
		expect(DoubanChallengeUtil.parse('<html><body>normal page</body></html>')).toBeNull();
		expect(DoubanChallengeUtil.parse('<form id="sec"><input name="cha" value="x"></form>')).toBeNull();
	});

	it('solves the proof of work and builds a form body', async () => {
		const challenge = {
			token: 'token',
			challenge: 'challenge',
			redirectUrl: 'https://example.com/',
			difficulty: 1,
		};
		const solution = await DoubanChallengeUtil.solve(challenge);
		const {createHash} = require('crypto');
		const hash = createHash('sha512').update(`challenge${solution}`).digest('hex');

		expect(solution).toBeGreaterThan(0);
		expect(hash.startsWith('0')).toBe(true);
		expect(DoubanChallengeUtil.buildRequestBody(challenge, solution)).toContain('sol=');
	});
});
