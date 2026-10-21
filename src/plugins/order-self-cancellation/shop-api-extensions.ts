import gql from 'graphql-tag';

export const shopApiExtensions = gql`
    extend type Mutation {
        """
        Lets a customer cancel their own order within 1 hour of placing it, as long as it has
        not shipped. A paid order is refunded (or its authorization voided) in the same operation.
        """
        cancelMyOrder(orderCode: String!): CancelMyOrderResult!
    }

    union CancelMyOrderResult = Order | CancelMyOrderError

    enum CancelMyOrderErrorReason {
        NOT_CANCELLABLE
        WINDOW_EXPIRED
        ALREADY_SHIPPED
    }

    # No "extend enum ErrorCode" needed: Vendure generates ErrorCode values automatically from
    # every type that implements ErrorResult (CancelMyOrderError -> CANCEL_MY_ORDER_ERROR).
    type CancelMyOrderError implements ErrorResult {
        errorCode: ErrorCode!
        message: String!
        reason: CancelMyOrderErrorReason!
    }
`;
