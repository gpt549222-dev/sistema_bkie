import { Offer, Product, PriceCalculation, OfferStatus } from '../types';

/**
 * Determines the true dynamic status of an offer based on current time and configured status.
 */
export function getComputedOfferStatus(offer: Offer, currentDate = new Date()): OfferStatus {
  if (offer.status === 'paused') {
    return 'paused';
  }

  const now = currentDate.getTime();
  const start = new Date(offer.start_date).getTime();
  const end = new Date(offer.end_date).getTime();

  if (now < start) {
    return 'scheduled';
  }
  if (now > end) {
    return 'finished';
  }
  return 'active';
}

/**
 * Checks if a specific offer is applicable to a given product at the given moment.
 */
export function isOfferApplicable(offer: Offer, product: Product, currentDate = new Date()): boolean {
  const currentStatus = getComputedOfferStatus(offer, currentDate);
  if (currentStatus !== 'active') {
    return false;
  }

  // Check global flag
  if (offer.is_global) {
    return true;
  }

  // Check product specific
  if (offer.product_ids && offer.product_ids.length > 0) {
    if (offer.product_ids.includes(product.id)) {
      return true;
    }
  }

  // Check category specific
  if (product.category_id && offer.category_ids && offer.category_ids.length > 0) {
    if (offer.category_ids.includes(product.category_id)) {
      return true;
    }
  }

  return false;
}

/**
 * Computes the raw discount amount in FCFA for a given offer on a base price.
 */
export function calculateDiscountForOffer(offer: Offer, originalPrice: number): number {
  const value = Number(offer.value) || 0;
  let discount = 0;

  if (offer.type === 'percentage') {
    discount = (originalPrice * value) / 100;
  } else if (offer.type === 'fixed_discount') {
    discount = value;
  } else if (offer.type === 'special_price') {
    if (value < originalPrice) {
      discount = originalPrice - value;
    }
  }

  return Math.min(originalPrice, Math.max(0, discount));
}

/**
 * The single source of truth for computing product price across Storefront, Cart, Checkout, POS, Invoices & Orders.
 * Rule: Highest priority wins. On priority tie, highest discount wins.
 */
export function calculateProductPrice(
  product: Product,
  offers: Offer[] = [],
  _quantity = 1,
  currentDate = new Date()
): PriceCalculation {
  const originalPrice = Number(product.price) || 0;
  if (originalPrice <= 0) {
    return {
      originalPrice: 0,
      finalPrice: 0,
      discountAmount: 0,
      discountPercentage: 0,
      appliedOffer: null,
    };
  }

  // Find all active applicable offers
  const applicableOffers = offers.filter((offer) =>
    isOfferApplicable(offer, product, currentDate)
  );

  if (applicableOffers.length === 0) {
    return {
      originalPrice,
      finalPrice: originalPrice,
      discountAmount: 0,
      discountPercentage: 0,
      appliedOffer: null,
    };
  }

  // Sort applicable offers by priority (descending), then by computed discount amount (descending)
  const sortedOffers = [...applicableOffers].sort((a, b) => {
    const priorityA = a.priority ?? 0;
    const priorityB = b.priority ?? 0;

    if (priorityB !== priorityA) {
      return priorityB - priorityA;
    }

    const discountA = calculateDiscountForOffer(a, originalPrice);
    const discountB = calculateDiscountForOffer(b, originalPrice);
    return discountB - discountA;
  });

  const bestOffer = sortedOffers[0];
  const discountAmount = calculateDiscountForOffer(bestOffer, originalPrice);
  const finalPrice = Math.max(0, originalPrice - discountAmount);
  const discountPercentage =
    originalPrice > 0 ? Math.round((discountAmount / originalPrice) * 100) : 0;

  return {
    originalPrice,
    finalPrice,
    discountAmount,
    discountPercentage,
    appliedOffer: discountAmount > 0 ? bestOffer : null,
  };
}
