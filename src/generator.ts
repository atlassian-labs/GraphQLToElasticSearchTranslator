import { ApolloError } from "apollo-server-express";
import { Bodybuilder } from "bodybuilder";

import { Stack, getDepth } from "./util";
import { QueryBuilder as helper } from "./helper";

import type { FilterConfig } from "./types";

const DEFAULT_ARRAY_LIMIT = 150;

export class QueryGenerator {
    maxFilterDepth: number;
    arrayLimit: number;
    
    filterDepth: number;

    /**
     * For each graphql query:
     *  - Maintain stack to store nested path and dict to store the count level to store at which nested level the query is
     */
    nestedPath: Stack<string>;
    nestedDict: { [k: string]: number };
    nestedLevel: number;

    /**
     * flag to check the combination of nested and non-nested within an or/and inner loop
     */
    nonNestedField: boolean;
    

    constructor(maxFilterDepth: number = 3, arrayLimit: number = DEFAULT_ARRAY_LIMIT) {
        this.maxFilterDepth = maxFilterDepth;
        this.arrayLimit = arrayLimit;
        
        this.filterDepth = 0;

        this.nestedPath = new Stack<string>();
        this.nestedDict = {};
        this.nestedLevel = 0;
        this.nonNestedField = false;

    }

    /**
     * Function to map sort fields from elastic search to graphQL
     * @param {*} sort
     * @param {FilterConfig} filterConfig
     * @returns Sort Object
     */
    getSortObject(sort: any, filterConfig: FilterConfig): any {
        const dbSort: { [k: string]: any } = {};
        Object.keys(sort).forEach((field) => {
            const key = helper.getDBFieldName(field, filterConfig);
            if (key !== undefined) {
                dbSort[key] = sort[field];
            }
        });
        return dbSort;
    }

    /**
     * Function to parse the where clause and build queries
     * @param {*} query
     * @param {*} value
     * @param {*} filterConfig
     */
    getFilterQuery(query: Bodybuilder, value: any, filterConfig: FilterConfig) {
        this.filterDepth = getDepth(value) - 1;
        Object.keys(value).forEach((operator) => {
            switch (operator) {
                case "and":
                    query = this.buildBoolANDQuery(query, value[operator], filterConfig);
                    break;
                case "or":
                    query = this.buildBoolORQuery(query, value[operator], filterConfig);
                    break;
                case "not":
                    query = this.buildBoolNOTQuery(query, value[operator], filterConfig);
                    break;
                case "isNotNull":
                    query = this.buildBoolISNOTNULLQuery(query, value[operator], filterConfig);
                    break;
                case "isNull":
                    query = this.buildBoolISNULLQuery(query, value[operator], filterConfig);
                    break;
                default:
                    query = this.buildBoolANDQuery(query, value, filterConfig);
                    break;
            }
        });
        return query;
    }

    // function to build AND query === MUST
    buildBoolANDQuery(query: Bodybuilder, expression: any, filterConfig: FilterConfig) {
        if (Array.isArray(expression)) {
            expression.forEach((exp) => {
                if (Object.keys(exp).length > 1) {
                    throw new ApolloError(`Expected one key par object in "AND" array`, "BAD REQUEST", {
                        statusCode: 400,
                    });
                }
            });
        }
        let must = [];
        must = this.buildFilterQueries(query, expression, filterConfig);
        query = query.query("bool", "must", must);
        return query;
    }

    // function to build OR query === Should
    buildBoolORQuery(query: Bodybuilder, expression: any, filterConfig: FilterConfig) {
        if (Array.isArray(expression)) {
            expression.forEach((exp) => {
                if (Object.keys(exp).length > 1) {
                    throw new ApolloError(`Expected one key par object in "OR" array`, "BAD REQUEST", {
                        statusCode: 400,
                    });
                }
            });
        }
        let should = [];
        should = this.buildFilterQueries(query, expression, filterConfig);
        query = query.query("bool", "should", should);
        return query;
    }

    // function to build NOT query === MUST_NOT
    buildBoolNOTQuery(query: Bodybuilder, expression: any, filterConfig: FilterConfig) {
        if (Array.isArray(expression)) {
            expression.forEach((exp) => {
                if (Object.keys(exp).length > 1) {
                    throw new ApolloError(`Expected one key par object in "NOT" array`, "BAD REQUEST", {
                        statusCode: 400,
                    });
                }
            });
        }
        let must_not = [];
        must_not = this.buildFilterQueries(query, expression, filterConfig);
        query = query.query("bool", "must_not", must_not);
        return query;
    }

    // to build isNull query === MUST_NOT_EXIST
    buildBoolISNULLQuery(query: Bodybuilder, expression: any, filterConfig: FilterConfig) {
        const must_not_exists = [];
        if (helper.validateField("isNull", expression, filterConfig)) {
            // get DB fieldname
            const key = helper.getDBFieldName(expression, filterConfig);
            must_not_exists.push({ exists: { field: key } });
        }
        query = query.query("bool", "must_not", must_not_exists);
        return query;
    }

    // to build isNotNull query === MUST_EXIST
    buildBoolISNOTNULLQuery(query: Bodybuilder, expression: any, filterConfig: FilterConfig) {
        const must_exists = [];
        if (helper.validateField("isNotNull", expression, filterConfig)) {
            // get DB fieldname
            const key = helper.getDBFieldName(expression, filterConfig);
            must_exists.push({ exists: { field: key } });
        }
        query = query.query("bool", "must", must_exists);
        return query;
    }

    // functions to build nested queries
    nestedQuery(pathToValues: string) {
        return {
            nested: {
                path: pathToValues,
                query: [],
            },
        };
    }

    buildSubQuery(query: any) {
        let nested_query: { [k: string]: any } = {};
        // pop the path and decrement the level
        const path = this.nestedPath.pop();
        // only decrement the level if the query has inner or/and condition
        if (this.nestedLevel > 0) {
            this.nestedLevel--;
        }
        if (path !== "underflow") {
            // for nested type, decrement the count since the item has been removed
            this.nestedDict[path] = this.nestedDict[path] - 1;
            // use nested base query if this is the last nested path removed
            if (this.nestedDict[path] < 0) {
                nested_query = this.nestedQuery(path);
                nested_query.nested.query.push(query);
                return nested_query;
            }
            // This conditional block handles the case:
            // if we have recurrsed back to first inner or/and condition but the stack is not empty
            // empty the stack and decrement the count until we have popped the last element
            if (this.nestedLevel === 0 && !this.nestedPath.isEmpty()) {
                while (!this.nestedPath.isEmpty()) {
                    const subPath = this.nestedPath.pop();
                    this.nestedDict[subPath] = this.nestedDict[subPath] - 1;
                    // use nested base query if this is the last nested path removed
                    if (this.nestedDict[subPath] < 0) {
                        nested_query = this.nestedQuery(subPath);
                        nested_query.nested.query.push(query);
                        return nested_query;
                    }
                }
            }
        }
        // if not return the bool query
        return query;
    }

    buildFilterQueries(query: Bodybuilder, expression: any, filterConfig: FilterConfig) {
        let basefilter: any[] = [];
        // initialize this to false for every expression
        this.nonNestedField = false;
        if (Array.isArray(expression)) {
            expression.forEach((exp) => {
                basefilter = this.buildMetaQueries(query, exp, filterConfig, basefilter);
            });
        } else {
            basefilter = this.buildMetaQueries(query, expression, filterConfig, basefilter);
        }
        return basefilter;
    }

    buildMetaQueries(query: Bodybuilder, exp: any, filterConfig: FilterConfig, basefilter: any[]) {
        const expression: { [k: string]: any } = {};
        // validate that arguments are in camelCase
        if (!helper.validateGraphQLStandard(Object.keys(exp)[0])) {
            throw new ApolloError(`Argument ${Object.keys(exp)[0]} needs to be in camelCase`, "BAD REQUEST", {
                statusCode: 400,
            });
        }
        // get key, value and db_type from the exp
        const key = helper.getDBFieldName(Object.keys(exp)[0], filterConfig);
        if (key === undefined) {
            throw new Error(`${key} is undefined`);
        }

        const value = exp[Object.keys(exp)[0]];
        const db_type = helper.getDBFieldType(Object.keys(exp)[0], filterConfig);
        // for nested type, maintain the path in stack and count in Dict
        if (db_type === "nested") {
            // Notify users that one cannot pass nested type along with non-nested type in the nested level
            // For example: `query{where:{and:[or:[{nested_type}{non-nested-type}]]}}` is not supported
            // If nestedLevel>0 and nonNested flag is set to true (i.e a non-nested type already exists), throw an error
            if (this.nestedLevel > 0 && this.nonNestedField) {
                throw new ApolloError(
                    `Argument ${
                        Object.keys(exp)[0]
                    } is a nested type and hence conflicts with existing non-nested type conditions query{where:{and:[or:[{nested_type}{non-nested-type}]]}} is not supported`,
                    "BAD REQUEST",
                    { statusCode: 400 },
                );
            }
            // get path
            const pos = key.indexOf(".");
            const path = key.substring(0, pos);
            // push to stack
            this.nestedPath.push(path);
            // increment the count
            this.nestedDict[path] = this.nestedDict[path] + 1 || 0;
        } else {
            // Notify users that one cannot pass non-nested type along with nested type in the nested level
            // For example: `query{where:{and:[or:[{nested_type}{non-nested-type}]]}}` is not supported
            // If nestedLevel>0 and nestedPath stack is not empty i.e (a nested type already exists), throw an error
            if (db_type !== "None" && this.nestedLevel > 0) {
                if (!this.nestedPath.isEmpty()) {
                    throw new ApolloError(
                        `Argument ${
                            Object.keys(exp)[0]
                        } is not a nested type and hence conflicts with existing nested type conditions query{where:{and:[or:[{nested_type}{non-nested-type}]]}} is not supported`,
                        "BAD REQUEST",
                        { statusCode: 400 },
                    );
                } else {
                    // set this flag if non-nested field is first expresson followed by nested-type within same or/and block
                    this.nonNestedField = true;
                }
            }
        }
        // check if filterDepth is greater than max allowed
        if (this.filterDepth > this.maxFilterDepth) {
            throw new ApolloError(`Exceeded the max allowed depth ${this.maxFilterDepth}`, "BAD REQUEST", {
                statusCode: 400,
            });
        } else {
            // parse arguments and build ES queries
            if (Object.keys(exp)[0].includes("IsLte")) {
                expression[key] = { lte: value };
                const subQuery = { range: expression };
                // call buildSubQuery for nested types if not used within nested and/or
                if (db_type === "nested" && this.nestedLevel < 1) {
                    const sub_query = this.buildSubQuery(subQuery);
                    basefilter.push(sub_query);
                } else {
                    basefilter.push(subQuery);
                }
            } else if (Object.keys(exp)[0].includes("IsGte")) {
                expression[key] = { gte: value };
                const subQuery = { range: expression };
                // call buildSubQuery for nested types if not used within nested and/or
                if (db_type === "nested" && this.nestedLevel < 1) {
                    const sub_query = this.buildSubQuery(subQuery);
                    basefilter.push(sub_query);
                } else {
                    basefilter.push(subQuery);
                }
            } else if (Object.keys(exp)[0] === "or") {
                // increment level since its nested or
                this.nestedLevel++;
                const or_query = this.buildFilterQueries(query, value, filterConfig);
                const should_query = {
                    bool: { should: or_query },
                };
                const sub_query = this.buildSubQuery(should_query);
                basefilter.push(sub_query);
            } else if (Object.keys(exp)[0] === "and") {
                // increment level since its nested and
                this.nestedLevel++;
                const and_query = this.buildFilterQueries(query, value, filterConfig);
                const must_query = { bool: { must: and_query } };
                const sub_query = this.buildSubQuery(must_query);
                basefilter.push(sub_query);
            } else if (Object.keys(exp)[0] === "not") {
                // increment level since its nested not
                this.nestedLevel++;
                const not_query = this.buildFilterQueries(query, value, filterConfig);
                const must_not_query = { bool: { must_not: not_query } };
                const sub_query = this.buildSubQuery(must_not_query);
                basefilter.push(sub_query);
            } else if (Object.keys(exp)[0] === "isNotNull") {
                if (helper.validateField("isNotNull", value, filterConfig)) {
                    // get DB fieldname
                    const db_field = helper.getDBFieldName(value, filterConfig);
                    basefilter.push({ exists: { field: db_field } });
                }
            } else if (Object.keys(exp)[0] === "isNull") {
                const q = [];
                if (helper.validateField("isNull", value, filterConfig)) {
                    // get DB fieldname
                    const db_field = helper.getDBFieldName(value, filterConfig);
                    q.push({ exists: { field: db_field } });
                }
                basefilter.push({
                    bool: { must_not: q },
                });
            } else if (Object.keys(exp)[0].includes("IsNotIn")) {
                const q = [];
                if (value.length > this.arrayLimit) {
                    throw new ApolloError(`${key} has a max limit of ${this.arrayLimit}`, "BAD REQUEST", {
                        statusCode: 400,
                    });
                }
                expression[key] = value;
                if (db_type === "nested") {
                    const nested_type = helper.getNestedType(Object.keys(exp)[0], filterConfig);
                    let subQuery = {};
                    if (nested_type === "text") {
                        subQuery = helper.getMatchItemsQuery(value, key);
                    } else {
                        subQuery = { terms: expression };
                    }
                    // call buildSubQuery for nested types if not used within nested and/or
                    if (this.nestedLevel < 1) {
                        const sub_query = this.buildSubQuery(subQuery);
                        q.push(sub_query);
                    } else {
                        q.push(subQuery);
                    }
                } else if (db_type === "keyword") {
                    q.push({ terms: expression });
                } else {
                    q.push(helper.getMatchItemsQuery(value, key));
                }
                basefilter.push({
                    bool: { must_not: q },
                });
            } else if (Object.keys(exp)[0].includes("IsIn")) {
                if (value.length > this.arrayLimit) {
                    throw new ApolloError(`${key} has a max limit of ${this.arrayLimit}`, "BAD REQUEST", {
                        statusCode: 400,
                    });
                } else if (value.length === 0) {
                    throw new ApolloError(
                        `Atleast 1 value should be passed for ${Object.keys(exp)[0]}`,
                        "BAD REQUEST",
                        { statusCode: 400 },
                    );
                }
                expression[key] = value;
                if (db_type === "nested") {
                    const nested_type = helper.getNestedType(Object.keys(exp)[0], filterConfig);
                    let subQuery = {};
                    if (nested_type === "text") {
                        subQuery = helper.getMatchItemsQuery(value, key);
                    } else {
                        subQuery = { terms: expression };
                    }
                    // call buildSubQuery for nested types if not used within nested and/or
                    if (this.nestedLevel < 1) {
                        const sub_query = this.buildSubQuery(subQuery);
                        basefilter.push(sub_query);
                    } else {
                        basefilter.push(subQuery);
                    }
                } else if (db_type === "keyword") {
                    basefilter.push({ terms: expression });
                } else {
                    const q = helper.getMatchItemsQuery(value, key);
                    basefilter.push(q);
                }
            } else if (Object.keys(exp)[0].includes("MultiMatch")) {
                const filter = filterConfig.filter.arguments[Object.keys(exp)[0]];
                const subQuery: { [k: string]: any } = {};
                subQuery.fields = filter.fields;
                subQuery.query = value;
                if (filter.query_type) {
                    subQuery.type = filter.query_type;
                }
                if (filter.operator) {
                    subQuery.operator = filter.operator;
                }
                basefilter.push({ multi_match: subQuery });
            } else if (db_type === "match_phrase") {
                basefilter.push({ match_phrase: expression });
            } else if (Object.keys(exp)[0].includes("Prefix")) {
                const filter = filterConfig.filter.arguments[Object.keys(exp)[0]];
                if (filter.prefix_type === "reverse") {
                    // We need to reverse the value because of how it is indexed.
                    // E.g. 0009 is indexed as 9000 so if we search 0009 it won't
                    // find any results.
                    expression[key] = value.split("").reverse().join("");
                } else {
                    expression[key] = value;
                }
                basefilter.push({
                    prefix: expression,
                });
            } else if (Object.keys(exp)[0].includes("Boost")) {
                const v = value.fieldValue;
                const b = value.boostRelevance;
                if (db_type === "text") {
                    expression[key] = {
                        query: v,
                        boost: b,
                    };
                    basefilter.push({ match: expression });
                } else {
                    expression[key] = {
                        value: v,
                        boost: b,
                    };
                    basefilter.push({ term: expression });
                }
            } else {
                expression[key] = value;
                if (db_type === "nested") {
                    const nested_type = helper.getNestedType(Object.keys(exp)[0], filterConfig);
                    let nested_query = {};
                    if (nested_type === "match_phrase") {
                        nested_query = { match_phrase: expression };
                    } else if (nested_type === "keyword") {
                        nested_query = { term: expression };
                    } else {
                        nested_query = { match: expression };
                    }
                    // call buildSubQuery for nested types if not used within nested and/or
                    if (this.nestedLevel < 1) {
                        const sub_query = this.buildSubQuery(nested_query);
                        basefilter.push(sub_query);
                    } else {
                        basefilter.push(nested_query);
                    }
                } else if (db_type === "keyword") {
                    basefilter.push({ term: expression });
                } else {
                    basefilter.push({ match: expression });
                }
            }
        }
        return basefilter;
    }

    // function to build Aggregation query
    getAggregationsQuery(query: Bodybuilder, expression: any, filterConfig: FilterConfig) {
        if (filterConfig.aggregate === undefined) {
            return query;
        }

        const db_fields_map = filterConfig.aggregate.db_field_mappings;
        Object.keys(expression).forEach((type) => {
            expression[type].forEach((field: any) => {
                let options: { [k: string]: any } = {};
                let db_field: any = null;
                let agg_name: any = null;
                let agg_type: any = null;
                let db_field_name: any = null;
                switch (type) {
                    case "sum":
                        agg_type = "sum";
                        break;
                    case "count":
                        agg_type = "terms";
                        options.size = 10000;
                        break;
                    case "range":
                        agg_type = "range";
                        options.keyed = true;
                        options.ranges = Object.values(field)[0];
                        field = Object.keys(field)[0];
                        break;
                    case "nestedSum":
                        db_field_name = db_fields_map[field];
                        agg_type = "nested";
                        db_field = {
                            path: db_field_name.split(".")[0],
                        };
                        agg_name = agg_type + "_AggOf_" + db_field_name.split(".")[1];
                        // eslint-disable-next-line no-unused-vars
                        options = () => bodybuilder().aggregation("sum", db_field_name, agg_name);
                        break;
                    default:
                        break;
                }
                db_field = db_field === null ? db_fields_map[field] : db_field;
                // agg_name is also used as Final ES Output Variable (as @resolveAS arg in typedefs )
                // splitting by '.' in case we use fields with multiple types ex: raw and text
                agg_name = agg_name === null ? agg_type + "_AggOf_" + db_field.split(".")[0] : agg_name;
                query = query.aggregation(agg_type, db_field, agg_name, options);
            });
        });
        delete expression.aggregate;
        return query;
    }
}
