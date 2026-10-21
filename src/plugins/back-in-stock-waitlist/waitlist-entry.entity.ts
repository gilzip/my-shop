import { DeepPartial, EntityId, ID, VendureEntity } from '@vendure/core';
import { Column, Entity, Index } from 'typeorm';

/**
 * One row means "this address is still waiting for this variant". A notified or removed person
 * has no row, so counts and the stock watcher never need a status filter.
 *
 * `productVariantId` is a plain id column with no foreign key: Vendure soft-deletes variants, so a
 * cascade would never fire. Clean-up on variant deletion is done by event instead.
 */
@Entity()
@Index(['productVariantId', 'emailAddress'], { unique: true })
export class WaitlistEntry extends VendureEntity {
    constructor(input?: DeepPartial<WaitlistEntry>) {
        super(input);
    }

    @EntityId()
    productVariantId: ID;

    /** Stored trimmed and lower-cased. */
    @Column()
    emailAddress: string;
}
