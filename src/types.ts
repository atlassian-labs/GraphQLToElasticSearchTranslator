export type ElasticSearchConfig = {
    description: string;
    db_field_name: string;
    db_type: "keyword" | "text" | "boolean" | "long" | "nested" | "match_phrase" | "None";
    type: "string" | "array";

    query_type?: "phrase" | "cross_fields";
    prefix_type?: "reverse";
    nested_type?: "text" | "keyword" | "match_phrase";
    aggs_field?: string;
    aggs_name?: string;
    aggs_type?: string;

    // Used in MultiMatch
    fields?: string[];
    operator?: any;
};

export type FilterConfig = {
    filter: {
        isNull: string[];
        isNotNull: string[];
        arguments: {
            [key: string]: ElasticSearchConfig;
        };
    };

    aggregate?: {
        description: string;
        db_field_mappings: { [k: string]: string };
    };
};

export type WhereFilterObject = {
    and?: WhereFilterObject[];
    or?: WhereFilterObject[];
    not?: WhereFilterObject[];
    isNull?: string;
    isNotNull?: string;
    [k: string]: any;
};
