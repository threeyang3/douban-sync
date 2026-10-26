import UserComponent from '../src/org/wanxp/douban/user/UserComponent';
import User from '../src/org/wanxp/douban/user/User';

describe('UserComponent QR login credentials', () => {
	it('stores a confirmed dbcl2 cookie without claiming profile verification', async () => {
		const updateSetting = jest.fn().mockResolvedValue(undefined);
		const component = new UserComponent({updateSetting} as any);
		const cookie = 'bid=abc; dbcl2="123:token"';

		const user = await component.acceptQrLoginCookie(cookie);

		expect(updateSetting).toHaveBeenCalledWith('loginCookiesContent', cookie);
		expect(user.login).toBe(true);
		expect(component.isLogin()).toBe(true);
		expect(component.isVerified()).toBe(false);
	});

	it('rejects cookies without dbcl2', async () => {
		const updateSetting = jest.fn().mockResolvedValue(undefined);
		const component = new UserComponent({updateSetting} as any);

		expect(await component.acceptQrLoginCookie('bid=abc')).toBeNull();
		expect(updateSetting).not.toHaveBeenCalled();
	});

	it('does not overwrite saved credentials when profile verification fails', async () => {
		const updateSetting = jest.fn().mockResolvedValue(undefined);
		const manager = {
			updateSetting,
			getHeadersByCookie: (cookie: string) => ({Cookie: cookie}),
			debug: jest.fn(),
		};
		const component = new UserComponent(manager as any);
		jest.spyOn(component, 'loadUserInfoByHeaders').mockResolvedValue(new User());

		const user = await component.loginCookie('bid=new; dbcl2=new');

		expect(user).toBeNull();
		expect(component.isLogin()).toBeFalsy();
		expect(updateSetting).not.toHaveBeenCalled();
	});

	it('saves verified cookie credentials', async () => {
		const updateSetting = jest.fn().mockResolvedValue(undefined);
		const manager = {
			updateSetting,
			getHeadersByCookie: (cookie: string) => ({Cookie: cookie}),
			debug: jest.fn(),
		};
		const component = new UserComponent(manager as any);
		jest.spyOn(component, 'loadUserInfoByHeaders').mockResolvedValue({
			id: '1234567',
			name: 'tester',
			url: 'https://www.douban.com/people/1234567/',
			login: true,
		});

		const user = await component.loginCookie('bid=new; dbcl2=new');

		expect(user.id).toBe('1234567');
		expect(component.isVerified()).toBe(true);
		expect(updateSetting).toHaveBeenCalledWith('loginHeadersContent', expect.any(String));
		expect(updateSetting).toHaveBeenCalledWith('loginCookiesContent', 'bid=new; dbcl2=new');
	});
});
