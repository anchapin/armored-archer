import { Runtime } from "../types/nakama-runtime";

export interface ${RequestName}Request {
	// Add request fields here
	field1: string;
	field2: number;
}

export interface ${RequestName}Response {
	success: boolean;
	error?: string;
	// Add response fields here
	data?: any;
}

export function registerRpc${RequestName}(initializer: Runtime.Initializer): void {
	initializer.registerRpc("armored_archer/${rpc_name}", rpc${RequestName});
}

function rpc${RequestName}(ctx: Runtime.Context, logger: Runtime.Logger, nk: Runtime.Nakama, payload: string): string {
	logger.info("${rpc_name} called for user: %s", ctx.userId);
	
	const request: ${RequestName}Request = JSON.parse(payload);
	
	try {
		
		const response: ${RequestName}Response = {
			success: true,
			data: {}
		};
		
		logger.info("${rpc_name} completed successfully for user: %s", ctx.userId);
		return JSON.stringify(response);
		
	} catch (error) {
		logger.error("Error in ${rpc_name}: %s", error);
		
		const errorResponse: ${RequestName}Response = {
			success: false,
			error: error instanceof Error ? error.message : "Unknown error"
		};
		
		return JSON.stringify(errorResponse);
	}
}
