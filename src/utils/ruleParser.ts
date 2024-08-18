interface Base {
	maxValues: number;
}

interface NonTypedMappingRule extends Base {
	values: (string | [string, number])[];
	parse?: (value: any) => any | Promise<any>;
};

interface TypedMappingRule extends Base{
	options: MappingRules;
	type: "array";
};

type MappingRule = NonTypedMappingRule | TypedMappingRule

interface MappingRules {
	[key: string]: MappingRule | MappingRules;
}

function isTypedRule(rule: MappingRule | MappingRules): rule is TypedMappingRule {
	return "type" in rule;
}

function isNonTypedRule(rule: MappingRule | MappingRules): rule is NonTypedMappingRule {
	return !isTypedRule(rule);
}


const getParentPath = (path: string): string => {
	const keys = path.split(".");
	keys.pop();
	return keys.join(".");
}

const getLastPathSegment = (path: string): string => {
	const keys = path.split(".");
	return keys[keys.length - 1];
}

const getValueFromPath = (data: any, path: string): any => {
	const keys = path.split(".");
	let value = data;
	for (const key of keys) {
		if (value === undefined) {
			break;
		}
		value = value[key];
	}
	return value;
}

const extractAllValues = (data: any, paths: (string | [string, number])[]): any[] =>{
	const results: any[] = [];

	for (const path of paths) {
		if (Array.isArray(path)) {
			const [basePath, index] = path;
			const parentValue = getValueFromPath(data, getParentPath(basePath));

			if (Array.isArray(parentValue)) {
				if (index === -1) {
					results.push(...parentValue.map((item) => getValueFromPath(item, getLastPathSegment(basePath))));
				} else if (parentValue[index] !== undefined) {
					results.push(getValueFromPath(parentValue[index], getLastPathSegment(basePath)));
				}
			}
		} else {
			const parentValue = getValueFromPath(data, getParentPath(path));
			if (Array.isArray(parentValue)) {
				results.push(...parentValue.map((item) => getValueFromPath(item, getLastPathSegment(path))));
			} else {
				results.push(getValueFromPath(data, path));
			}
		}
	}

	return results;
}

const parseMapping =(rules: MappingRules, data: any): any => {
	const result: Record<string, any> = {};

	for (const key of Object.keys(rules)) {
		const rule = rules[key];

		if (isTypedRule(rule)) {
			const { options, maxValues = 0 } = rule;

			const extractedFields: Record<string, any[]> = {};

			for (const fieldKey in options) {
				const fieldRule = options[fieldKey] as MappingRule;
				extractedFields[fieldKey] =
					"type" in fieldRule
						? parseMapping(fieldRule as unknown as MappingRules, data)
						: extractAllValues(data, fieldRule.values!)
								.filter((v) => v !== undefined)
								.slice(0, maxValues as number)
								.map((value) => (fieldRule.parse ? fieldRule.parse(value) : value));
			}

			const groupedItems: Record<string, any>[] = [];
			const maxLength = Math.max(...Object.values(extractedFields).map((arr) => arr.length));
			for (let i = 0; i < maxLength; i++) {
				const groupedItem: Record<string, any> = {};
				for (const fieldKey in extractedFields) {
					groupedItem[fieldKey] = extractedFields[fieldKey][i];
				}
				groupedItems.push(groupedItem);
			}

			result[key] = groupedItems.slice(0, maxValues as number);
		} else if (typeof rule === "object" && rule.values === undefined) {
			result[key] = parseMapping(rule as unknown as MappingRules, data);
		} else if (isNonTypedRule(rule)) {
			const { values, maxValues, parse } = rule;

			const extractedValues = extractAllValues(data, values!)
				.filter((v) => v !== undefined)
				.slice(0, maxValues);

			if (extractedValues.length > 0) {
				result[key] = parse ? parse(extractedValues[0]) : extractedValues[0];
			}
		}
	}

	return result;
}


export {
    type Base,
    type NonTypedMappingRule,
    type TypedMappingRule,
    type MappingRule,
    type MappingRules,
    isTypedRule,
    isNonTypedRule,
    parseMapping,
    extractAllValues
}
