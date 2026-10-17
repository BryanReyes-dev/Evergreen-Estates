/**
 * Test the integrity of the seed fixtures in src/db/seed/data.ts.
 *
 * These tests do not connect to or modify the database.
 */

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  seedListings,
  seedReviews,
  seedSellerReviews,
  seedSellers,
  validateSeedData,
} from "../src/db/seed/data";

describe("Evergreen Estates seed fixtures", () => {
  it("passes the fixture relationship validator", () => {
    expect(() => validateSeedData()).not.toThrow();
  });

  it("contains four sellers, twelve listings, and 48 reviews", () => {
    expect(seedSellers).toHaveLength(4);
    expect(seedListings).toHaveLength(12);
    expect(seedReviews).toHaveLength(48);
    expect(seedSellerReviews).toHaveLength(48);
  });

  it("assigns exactly three listings to every seller", () => {
    for (const seller of seedSellers) {
      const ownedListings = seedListings.filter(
        (listing) => listing.sellerKey === seller.key,
      );

      expect(ownedListings).toHaveLength(3);
    }
  });

  it("gives every listing one review from each seller", () => {
    const expectedReviewerKeys = seedSellers
      .map((seller) => seller.key)
      .sort();

    for (const listing of seedListings) {
      const actualReviewerKeys = seedSellerReviews
        .filter((review) => review.listingId === listing.id)
        .map((review) => review.reviewerKey)
        .sort();

      expect(actualReviewerKeys).toEqual(expectedReviewerKeys);
    }
  });

  it("has unique listing IDs, review IDs, seller emails, and listing-reviewer pairs", () => {
    const listingIds = seedListings.map((listing) => listing.id);
    const reviewIds = seedReviews.map((review) => review.id);
    const sellerEmails = seedSellers.map(
      (seller) => seller.email.toLowerCase(),
    );

    const listingReviewerPairs = seedReviews.map(
      (review) => `${review.listingId}:${review.reviewerKey}`,
    );

    expect(new Set(listingIds).size).toBe(listingIds.length);
    expect(new Set(reviewIds).size).toBe(reviewIds.length);
    expect(new Set(sellerEmails).size).toBe(sellerEmails.length);
    expect(new Set(listingReviewerPairs).size).toBe(
      listingReviewerPairs.length,
    );
  });

  it("uses valid ratings and existing reviewer identities", () => {
    const reviewerKeys = new Set(
      seedSellers.map((seller) => seller.key),
    );

    const listingIds = new Set(
      seedListings.map((listing) => listing.id),
    );

    for (const review of seedReviews) {
      expect(listingIds.has(review.listingId)).toBe(true);
      expect(reviewerKeys.has(review.reviewerKey)).toBe(true);
      expect(Number.isInteger(review.rating)).toBe(true);
      expect(review.rating).toBeGreaterThanOrEqual(1);
      expect(review.rating).toBeLessThanOrEqual(5);
    }
  });

  it("requires each seller's preferred contact field", () => {
    for (const seller of seedSellers) {
      if (seller.profile.preferredContactMethod === "email") {
        expect(seller.profile.contactEmail?.trim()).toBeTruthy();
      } else {
        expect(seller.profile.contactPhone?.trim()).toBeTruthy();
      }
    }
  });

  it("does not create reviews before their listings", () => {
    for (const review of seedReviews) {
      const listing = seedListings.find(
        (candidate) => candidate.id === review.listingId,
      );

      expect(listing).toBeDefined();

      if (!listing) {
        throw new Error(
          `Missing listing for review ${review.id}`,
        );
      }

      expect(Date.parse(review.createdAt)).toBeGreaterThan(
        Date.parse(listing.createdAt),
      );
    }
  });

  it("can find every referenced listing media file locally", () => {
    for (const listing of seedListings) {
      for (const filename of listing.media) {
        const mediaPath = resolve(
          process.cwd(),
          "seed",
          "images",
          "listings",
          listing.id,
          filename,
        );

        expect(
          existsSync(mediaPath),
          `Missing media file: ${mediaPath}`,
        ).toBe(true);
      }
    }
  });
});