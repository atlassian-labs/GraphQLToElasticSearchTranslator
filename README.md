# GraphQL to ElasticSearch Library

This is an implementation for translating GraphQL Queries to Elasticsearch DSL

# Usage guide
## Install the library:

```
npm install --save graphql-elasticsearch
```

# Development guide

## Install dependencies

```
npm install
```

## Useful commands

```
# Run all checks
npm test

```
## How to use the filter
```
import { QueryGenerator } from 'graphql-elasticsearch';

let args = {email:'test@test.com'};  // Graphql query args
const testFilterConfig: any  = {
    filter: {
        isNull: ['id'],
        isNotNull: ['email'],
        arguments: {
            id: {
                description: 'Unique Identifier',
                db_field_name: 'id',
                db_type: 'keyword',
                type: 'string'
            },
            email: {
                description:
                    'This endpoint takes a contact (email) and returns all link documents for that contact.',
                db_field_name: 'email.raw',
                db_type: 'keyword',
                type: 'string'
            },
            and: {
                description: 'AND operator',
                db_field_name: 'None',
                db_type: 'None',
                type: 'array'
            },
            or: {
                description: 'OR operator',
                db_field_name: 'None',
                db_type: 'None',
                type: 'array'
            },
            not: {
                description: 'NOT operator',
                db_field_name: 'None',
                db_type: 'None',
                type: 'array'
            },
            isNotNull: {
                description: 'field name is not null',
                db_field_name: 'None',
                db_type: 'None',
                type: 'string'
            },
            isNull: {
                description: 'field name is null',
                db_field_name: 'None',
                db_type: 'None',
                type: 'string'
            }
        }
    }
};

let query = bodybuilder();
query = new QueryGenerator().getFilterQuery(query,args,filterConfig);

ES query: 
"query": {
    "bool": {
      "must": [{
            "term": {
                "email.raw": "test@test.com"
            }
        }]   
    }
}
```