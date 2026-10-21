import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { internal_getRequestContext, OrderService, parseContext, UserInputError } from '@vendure/core';
import { Observable } from 'rxjs';

import { hasShipped, normalizeGiftMessage } from './gift-message-rules';

const ORDER_CUSTOM_FIELD_MUTATIONS = ['setOrderCustomFields', 'setDraftOrderCustomFields'];

/**
 * Applies the gift-message rules that the custom field's own `validate` hook cannot:
 * - normalizes a whitespace-only message to `null` ("no message"), in both APIs;
 * - refuses staff edits (Admin `setOrderCustomFields`) once any fulfillment has shipped.
 *   This is judged from fulfillments, not `order.state`, because a shipped order can
 *   later move to `Modifying`.
 * Customers can only edit their active (not yet placed) order; Vendure enforces that.
 */
@Injectable()
export class GiftMessageInterceptor implements NestInterceptor {
    constructor(private orderService: OrderService) {}

    async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
        const parsed = parseContext(context);
        if (!parsed.isGraphQL || !ORDER_CUSTOM_FIELD_MUTATIONS.includes(parsed.info.fieldName)) {
            return next.handle();
        }
        const args = GqlExecutionContext.create(context).getArgs();
        const customFields = args.input?.customFields;
        if (!customFields || !Object.prototype.hasOwnProperty.call(customFields, 'giftMessage')) {
            return next.handle();
        }
        customFields.giftMessage = normalizeGiftMessage(customFields.giftMessage);

        const ctx = internal_getRequestContext(parsed.req);
        if (ctx.apiType === 'admin' && parsed.info.fieldName === 'setOrderCustomFields' && args.input.id != null) {
            const order = await this.orderService.findOne(ctx, args.input.id);
            if (order) {
                const fulfillments = await this.orderService.getOrderFulfillments(ctx, order);
                if (hasShipped(fulfillments.map(f => f.state))) {
                    throw new UserInputError('Gift message cannot be changed after the order has shipped.');
                }
            }
        }
        return next.handle();
    }
}
