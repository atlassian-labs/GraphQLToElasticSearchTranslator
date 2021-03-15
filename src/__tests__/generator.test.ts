import { QueryGenerator } from "../index";
import { FilterConfig } from "../types";
import { Stack } from "../util";
const bodybuilder = require('bodybuilder');


const testFilterConfig: FilterConfig  = {
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

describe('Elasticsearch QueryGenerator tests', () => {
    it("Default QueryGenerator Constructor", () => {
        const qg = new QueryGenerator();
        expect(qg.filterDepth).toBe(0);
        expect(qg.maxFilterDepth).toBe(3);
    
        expect(qg.nestedPath).toBeInstanceOf(Stack);
        expect(qg.nestedPath.isEmpty()).toBe(true);
        expect(qg.nestedDict).toMatchObject({});
    });

    it('should return correctly formatted queries given a email', () => {
        let args = {
            email:'test@test.com'
        };
        let query = bodybuilder();
        let boolquery = new QueryGenerator().getFilterQuery(
            query,
            args,
            testFilterConfig
        );
        expect(boolquery.build()).toMatchSnapshot();
    });

    it('should return correctly formatted queries given an AND operator', () => {
        let args = {
            and: [{ id: '123' }, { email: 'test@test.com' }]
        };
        let query = bodybuilder();
        let boolquery = new QueryGenerator().getFilterQuery(
            query,
            args,
            testFilterConfig
        );
        expect(boolquery.build()).toMatchSnapshot();
    });

    it('should return correctly formatted queries given an OR operator', () => {
        let args = {
            or: [{ id: '123' }, { email: 'test@test.com' }]
        };
        let query = bodybuilder();
        let boolquery = new QueryGenerator().getFilterQuery(
            query,
            args,
            testFilterConfig
        );
        expect(boolquery.build()).toMatchSnapshot();
    });

    it('should return correctly formatted queries given an isNull operator', () => {
        let args = {
            isNull: 'id'
        };
        let query = bodybuilder();
        let boolquery = new QueryGenerator().getFilterQuery(
            query,
            args,
            testFilterConfig
        );
        expect(boolquery.build()).toMatchSnapshot();
    });

    it('should return correctly formatted queries given an isNull operator', () => {
        let args = {
            isNotNull: 'email'
        };
        let query = bodybuilder();
        let boolquery = new QueryGenerator().getFilterQuery(
            query,
            args,
            testFilterConfig
        );
        expect(boolquery.build()).toMatchSnapshot();
    });
});