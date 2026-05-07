import type {
  Offer,
  OfferEvent,
  OfferEventSeed,
  OfferPatch,
  OfferSeed,
} from "@/core/entities/offer";

export interface OfferRepository {
  create(seed: OfferSeed): Promise<Offer>;
  findById(id: string): Promise<Offer | null>;
  findBySlug(slug: string): Promise<Offer | null>;
  listByOwnerUserId(ownerUserId: string): Promise<Offer[]>;
  listPublishedPublic(): Promise<Offer[]>;
  update(id: string, patch: OfferPatch): Promise<Offer | null>;
  createEvent(seed: OfferEventSeed): Promise<OfferEvent>;
  listEventsByOfferId(offerId: string): Promise<OfferEvent[]>;
}
