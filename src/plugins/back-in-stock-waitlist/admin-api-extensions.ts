import gql from 'graphql-tag';

export const adminApiExtensions = gql`
    extend type Query {
        """
        How many people are currently waiting for each variant. Numbers only, never addresses.
        Variants nobody waits for return 0. At most 500 ids per call.
        """
        backInStockWaitlistCounts(productVariantIds: [ID!]!): [BackInStockWaitlistCount!]!
    }

    type BackInStockWaitlistCount {
        productVariantId: ID!
        waiting: Int!
    }
`;
