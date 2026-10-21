import { Args, Mutation, ResolveField, Resolver } from '@nestjs/graphql';
import {
    Allow,
    ConfigService,
    Ctx,
    ForbiddenError,
    idsAreEqual,
    InternalServerError,
    isGraphQlErrorResult,
    LogLevel,
    OrderService,
    Permission,
    RequestContext,
    Transaction,
} from '@vendure/core';

const CANCELLATION_WINDOW_MS = 60 * 60 * 1000; // 1 hour from Order.orderPlacedAt
const SHIPPED_STATES = ['Shipped', 'PartiallyShipped', 'Delivered', 'PartiallyDelivered'];
const CANCEL_REASON = 'Customer self-cancellation';

type CancelMyOrderErrorReason = 'NOT_CANCELLABLE' | 'WINDOW_EXPIRED' | 'ALREADY_SHIPPED';

/**
 * Typed result returned for the guard failures. These are all evaluated BEFORE anything is
 * written, so returning (rather than throwing) is safe - nothing needs rolling back.
 */
function cancelMyOrderError(reason: CancelMyOrderErrorReason) {
    return {
        __typename: 'CancelMyOrderError',
        errorCode: 'CANCEL_MY_ORDER_ERROR',
        message: 'CANCEL_MY_ORDER_ERROR',
        reason,
    };
}

@Resolver()
export class OrderSelfCancellationResolver {
    constructor(private orderService: OrderService, private configService: ConfigService) {}

    @Transaction()
    @Mutation()
    @Allow(Permission.Owner)
    async cancelMyOrder(@Ctx() ctx: RequestContext, @Args() args: { orderCode: string }) {
        const order = await this.orderService.findOneByCode(ctx, args.orderCode, ['customer', 'customer.user']);

        // Identify and authorize the order exactly the way the Shop API's own `orderByCode` does,
        // including its anti-enumeration behaviour: a missing order and someone else's order are
        // indistinguishable to the caller. Works for logged-in customers and for guests.
        if (
            !order ||
            !(await this.configService.orderOptions.orderByCodeAccessStrategy.canAccessOrder(ctx, order))
        ) {
            throw new ForbiddenError(LogLevel.Verbose);
        }

        // canAccessOrder lets ANYONE holding the code in for 2h when there is no logged-in user.
        // That is right for reading a guest's order (a guest has no other identity), but this is a
        // destructive action: for an order that belongs to a registered customer the caller must be
        // that logged-in user, not merely someone who has seen the code. Guest orders (no linked
        // user) keep code-based access.
        const ownerUserId = order.customer?.user?.id;
        if (ownerUserId != null && !idsAreEqual(ctx.activeUserId, ownerUserId)) {
            throw new ForbiddenError(LogLevel.Verbose);
        }

        // Guards - all read-only, so a failure here leaves the order untouched.
        if (!order.orderPlacedAt || order.state === 'Cancelled') {
            return cancelMyOrderError('NOT_CANCELLABLE');
        }
        if (Date.now() - +order.orderPlacedAt >= CANCELLATION_WINDOW_MS) {
            return cancelMyOrderError('WINDOW_EXPIRED');
        }
        if (SHIPPED_STATES.includes(order.state)) {
            return cancelMyOrderError('ALREADY_SHIPPED');
        }

        // From here on we write. Any failure must THROW (not return an error result): the
        // @Transaction() wrapper only rolls back on a thrown error, and a returned error result
        // would commit a cancelled order with its payment still charged.
        const cancelResult = await this.orderService.cancelOrder(ctx, {
            orderId: order.id,
            reason: CANCEL_REASON,
        });
        if (isGraphQlErrorResult(cancelResult)) {
            throw new InternalServerError(`Could not cancel order ${order.code}: ${cancelResult.errorCode}`);
        }

        // Cancel the order first, then deal with the money: refundOrder rejects orders that are
        // still PaymentAuthorized, and an Authorized payment has captured nothing to refund anyway.
        const payments = await this.orderService.getOrderPayments(ctx, order.id);
        for (const payment of payments) {
            if (payment.state === 'Authorized') {
                const voided = await this.orderService.cancelPayment(ctx, payment.id);
                if (isGraphQlErrorResult(voided)) {
                    throw new InternalServerError(
                        `Could not void payment ${payment.id} for order ${order.code}: ${voided.errorCode}`,
                    );
                }
            } else if (payment.state === 'Settled') {
                // `shipping`, `adjustment` and `lines` are explicit zeros/empty on purpose: the Admin
                // GraphQL layer normally defaults them, but calling the service directly doesn't, and
                // the Refund entity's NOT NULL `shipping` column rejects an undefined value.
                const refund = await this.orderService.refundOrder(ctx, {
                    paymentId: payment.id,
                    amount: payment.amount,
                    reason: CANCEL_REASON,
                    lines: [],
                    shipping: 0,
                    adjustment: 0,
                });
                if (isGraphQlErrorResult(refund)) {
                    throw new InternalServerError(
                        `Could not refund payment ${payment.id} for order ${order.code}: ${refund.errorCode}`,
                    );
                }
            }
            // Declined / Error / Cancelled payments hold no money - nothing to do.
        }

        return this.orderService.findOne(ctx, order.id);
    }
}

/**
 * Resolves the CancelMyOrderResult union: our typed error carries its own __typename,
 * anything else is the Order entity.
 */
@Resolver('CancelMyOrderResult')
export class CancelMyOrderResultResolver {
    @ResolveField('__resolveType')
    resolveType(value: { __typename?: string }) {
        return value.__typename === 'CancelMyOrderError' ? 'CancelMyOrderError' : 'Order';
    }
}
