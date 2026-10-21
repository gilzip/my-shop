import { Args, Mutation, ResolveField, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, Permission, RequestContext, Transaction } from '@vendure/core';

import { WaitlistService } from './waitlist.service';

@Resolver()
export class WaitlistShopResolver {
    constructor(private waitlistService: WaitlistService) {}

    @Transaction()
    @Mutation()
    @Allow(Permission.Public)
    joinBackInStockWaitlist(
        @Ctx() ctx: RequestContext,
        @Args() args: { productVariantId: ID; emailAddress?: string | null },
    ) {
        return this.waitlistService.join(ctx, args.productVariantId, args.emailAddress);
    }

    @Transaction()
    @Mutation()
    @Allow(Permission.Public)
    async leaveBackInStockWaitlist(
        @Ctx() ctx: RequestContext,
        @Args() args: { productVariantId: ID; emailAddress: string },
    ) {
        await this.waitlistService.leave(ctx, args.productVariantId, args.emailAddress);
        return true;
    }
}

/** Resolves the JoinBackInStockWaitlistResult union from the __typename the service sets. */
@Resolver('JoinBackInStockWaitlistResult')
export class JoinWaitlistResultResolver {
    @ResolveField('__resolveType')
    resolveType(value: { __typename?: string }) {
        return value.__typename === 'WaitlistError' ? 'WaitlistError' : 'WaitlistJoined';
    }
}
