import {VariableUtil} from '../src/org/wanxp/utils/VariableUtil';
import {DataField} from '../src/org/wanxp/utils/model/DataField';
import {DataValueType, SupportType} from '../src/org/wanxp/constant/Constsant';
import {DEFAULT_SETTINGS_ARRAY_NAME} from '../src/org/wanxp/douban/setting/model/ArraySetting';

describe('Array length limits', () => {
	const actorValues = ['actor-a', 'actor-b', 'actor-c', 'actor-d'];
	const createContext = (limits: any[]) => ({
		manager: {
			getSetting: (key: string) => key === 'arrayLengthLimits' ? limits : undefined,
			getArraySetting: (name: string) => name === DEFAULT_SETTINGS_ARRAY_NAME
				? {
					arrayName: name,
					arrayStart: '',
					arrayElementStart: '',
					arraySpiltV2: '、',
					arrayElementEnd: '',
					arrayEnd: '',
					index: 0,
				}
				: null,
		} as any,
	});

	it('applies the strictest matching rule without changing origin data', () => {
		const {manager} = createContext([
			{type: SupportType.all, field: 'actor', limit: 3},
			{type: SupportType.book, field: 'actor', limit: 2},
			{type: SupportType.movie, field: 'actor', limit: 1},
		]);
		const actorField = new DataField('actor', DataValueType.array, actorValues, actorValues);
		const map = new Map<string, any>([['actor', actorField]]);

		expect(VariableUtil.replaceSubject(
			map,
			'{{actor}}',
			SupportType.book,
			manager,
			'text',
		)).toBe('actor-a、actor-b');
		expect(actorValues).toEqual(['actor-a', 'actor-b', 'actor-c', 'actor-d']);
	});

	it('treats zero as unlimited and leaves short arrays unchanged', () => {
		const {manager} = createContext([
			{type: SupportType.all, field: 'actor', limit: 0},
		]);
		const map = new Map<string, any>([
			['actor', new DataField('actor', DataValueType.array, actorValues, actorValues)],
		]);

		expect(VariableUtil.replaceSubject(map, '{{actor}}', SupportType.movie, manager, 'text'))
			.toBe('actor-a、actor-b、actor-c、actor-d');
	});
});
