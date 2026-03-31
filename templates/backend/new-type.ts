export interface ${TypeName} {
	id: string;
	name: string;
	// Add additional fields
	field1: string;
	field2: number;
	field3?: any;
}

export interface ${TypeName}Request {
	// Add request fields
	param1: string;
}

export interface ${TypeName}Response {
	success: boolean;
	error?: string;
	data?: ${TypeName}[];
}
