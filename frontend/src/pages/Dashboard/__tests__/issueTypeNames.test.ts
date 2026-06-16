import { describe, expect, it } from "vitest";
import { ISSUE_TYPE_NAMES } from "../types";

describe("ISSUE_TYPE_NAMES", () => {
	it("labels scanner vulnerability categories", () => {
		expect(ISSUE_TYPE_NAMES.sql_injection).toBe("SQL注入");
		expect(ISSUE_TYPE_NAMES.xss).toBe("XSS跨站脚本");
		expect(ISSUE_TYPE_NAMES.ssrf).toBe("SSRF服务端请求伪造");
		expect(ISSUE_TYPE_NAMES.command_injection).toBe("命令注入");
		expect(ISSUE_TYPE_NAMES.path_traversal).toBe("路径遍历");
		expect(ISSUE_TYPE_NAMES.hardcoded_secret).toBe("硬编码密钥");
		expect(ISSUE_TYPE_NAMES.weak_crypto).toBe("弱加密");
		expect(ISSUE_TYPE_NAMES.resource_leak).toBe("资源未释放");
	});
});
