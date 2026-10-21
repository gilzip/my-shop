import { Args, Query, Resolver } from '@nestjs/graphql';
import { Allow, Ctx, ID, Permission, RequestContext, UserInputError } from '@vendure/core';

import { WaitlistService } from './waitlist.service';

const MAX_IDS = 500;

@Resolver()
export class WaitlistAdminResolver {
    constructor(private waitlistService: WaitlistService) {}

    @Query()
    @Allow(Permission.ReadCatalog)
    backInStockWaitlistCounts(@Ctx() ctx: RequestContext, @Args() args: { productVariantIds: ID[] }) {
        if (args.productVariantIds.length > MAX_IDS) {
            throw new UserInputError(`At most ${MAX_IDS} variant ids per call`);
        }
        return this.waitlistService.counts(ctx, args.productVariantIds);
    }
}
