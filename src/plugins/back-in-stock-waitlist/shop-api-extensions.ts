import gql from 'graphql-tag';

export const shopApiExtensions = gql`
    extend type Mutation {
        """
        Join the waitlist for an out-of-stock variant. A logged-in customer may omit the address.
        Joining again is not an error: it returns WaitlistJoined with alreadyOnList = true.
        """
        joinBackInStockWaitlist(productVariantId: ID!, emailAddress: String): JoinBackInStockWaitlistResult!

        """
        Leave a waitlist. Always returns true, whether or not the address was on the list, so it
        cannot be used to discover who is waiting. Never sends an email.
        """
        leaveBackInStockWaitlist(productVariantId: ID!, emailAddress: String!): Boolean!
    }

    union JoinBackInStockWaitlistResult = WaitlistJoined | WaitlistError

    type WaitlistJoined {
        alreadyOnList: Boolean!
    }

    enum WaitlistErrorReason {
        VARIANT_IN_STOCK
        VARIANT_NOT_FOUND
        INVALID_EMAIL
        EMAIL_REQUIRED
    }

    # No "extend enum ErrorCode": Vendure generates ErrorCode values from every ErrorResult implementer.
    type WaitlistError implements ErrorResult {
        errorCode: ErrorCode!
        message: String!
        reason: WaitlistErrorReason!
    }
`;
