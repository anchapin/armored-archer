import { Runtime } from "../types/nakama-runtime";

export interface ${ModuleName}Data {
	// Define data structure here
	field1: string;
	field2: number;
	field3?: any;
}

export interface ${ModuleName}Config {
	// Define configuration options here
	option1: string;
	option2: boolean;
}

const DEFAULT_CONFIG: ${ModuleName}Config = {
	option1: "default_value",
	option2: true
};

export function initialize${ModuleName}(nk: Runtime.Nakama, userId: string, config?: Partial<${ModuleName}Config>): ${ModuleName}Data {
	const finalConfig = { ...DEFAULT_CONFIG, ...config };
	
	const data: ${ModuleName}Data = {
		field1: finalConfig.option1,
		field2: 0,
		field3: null
	};
	
	return data;
}

export function update${ModuleName}(nk: Runtime.Nakama, userId: string, data: ${ModuleName}Data): void {
	
}

export function get${ModuleName}(nk: Runtime.Nakama, userId: string): ${ModuleName}Data | null {
	const objects = nk.storageRead([
		{
			collection: "module_name",
			key: userId,
			userId: userId
		}
	]);
	
	if (objects.length === 0 || !objects[0].value) {
		return null;
	}
	
	return JSON.parse(objects[0].value) as ${ModuleName}Data;
}

export function save${ModuleName}(nk: Runtime.Nakama, userId: string, data: ${ModuleName}Data): void {
	nk.storageWrite([
		{
			collection: "module_name",
			key: userId,
			userId: userId,
			value: JSON.stringify(data)
		}
	]);
}
