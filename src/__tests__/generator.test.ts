import { QueryGenerator } from "../index";
import { Stack } from "../util";

test("Default QueryGenerator Constructor", () => {
    const qg = new QueryGenerator();
    expect(qg.filterDepth).toBe(0);
    expect(qg.maxFilterDepth).toBe(3);

    expect(qg.nestedPath).toBeInstanceOf(Stack);
    expect(qg.nestedPath.isEmpty()).toBe(true);
    expect(qg.nestedDict).toMatchObject({});
});
