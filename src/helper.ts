import type { FilterConfig } from "./types";
import { ApolloError } from "apollo-server-express";

/**
 * Helper class to get corresponding DB fields mapping
 */
export class QueryBuilder {
    static getDBFieldName(str: string, filterConfig: FilterConfig) {
        // defalut sorting is by _score, just returned the field as is
        if (str === "_score") {
            return str;
        }
        if (str in filterConfig.filter.arguments) {
            return filterConfig.filter.arguments[str].db_field_name;
        }
        return undefined;
    }

    static getDBFieldType(str: string, filterConfig: FilterConfig) {
        if (str in filterConfig.filter.arguments) {
            return filterConfig.filter.arguments[str].db_type;
        }
        return undefined;
    }

    static getNestedType(str: string, filterConfig: FilterConfig) {
        if (str in filterConfig.filter.arguments) {
            return filterConfig.filter.arguments[str].nested_type;
        }
        return undefined;
    }

    static getMatchItemsQuery(searchItems: { [k: string]: any }, key: string) {
        const queryItems = searchItems.map((item: any) => {
            return {
                match: {
                    [key]: item,
                },
            };
        });
        return {
            bool: { should: queryItems },
        };
    }

    static validateField(operation: string, fieldName: string, filterConfig: FilterConfig) {
        let valid = false;
        switch (operation) {
            case "isNull":
                if (filterConfig.filter.isNull.includes(fieldName)) {
                    valid = true;
                } else {
                    throw new ApolloError(`${fieldName} not allowed in the null list`, "BAD REQUEST", {
                        statusCode: 400,
                    });
                }
                break;
            case "isNotNull":
                if (filterConfig.filter.isNotNull.includes(fieldName)) {
                    valid = true;
                } else {
                    throw new ApolloError(`${fieldName} not allowed in the not null list`, "BAD REQUEST", {
                        statusCode: 400,
                    });
                }
                break;
            default:
                throw new ApolloError("Operation not found in the config", "ERROR", { statusCode: 500 });
        }
        return valid;
    }

    static isCamelCase(arg: string) {
        return /^[a-z][A-Za-z0-9]*$/.test(arg);
    }

    /**
     * Validate the graphQL naming convention
     * @param arg
     */
    static validateGraphQLStandard(arg: string) {
        return this.isCamelCase(arg);
    }

    static getAggsField(str: string, filterConfig: FilterConfig) {
        if (str in filterConfig.filter.arguments) {
            return filterConfig.filter.arguments[str].aggs_field;
        }
        return undefined;
    }

    static getAggsName(str: string, filterConfig: FilterConfig) {
        if (str in filterConfig.filter.arguments) {
            return filterConfig.filter.arguments[str].aggs_name;
        }
        return undefined;
    }

    static getAggsType(str: string, filterConfig: FilterConfig) {
        if (str in filterConfig.filter.arguments) {
            return filterConfig.filter.arguments[str].aggs_type;
        }
        return undefined;
    }
}
