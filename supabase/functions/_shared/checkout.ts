// Pure checkout logic (no network). Shared by create-checkout and the tests.
export const MAX_ITEMS = 20;

export interface CartItemInput { cardId?: unknown; to?: unknown; message?: unknown; from?: unknown }
export interface CardRow { id: string; title: string; occasion: string; price_cents: number; published: boolean }
export interface OrderLine { card_id: string; title: string; price_cents: number; recipient_name: string; message: string; sender_name: string }

const clean = (v: unknown, max: number): string | null => {
	if (v === undefined || v === null) return "";
	if (typeof v !== "string") return null;
	const s = v.trim();
	return s.length > max ? null : s;
};

/** Validates the cart and prices it from the database rows. The browser never supplies a price. */
export function buildOrder(items: unknown, cards: CardRow[]): { lines: OrderLine[]; total: number } | { error: string } {
	if (!Array.isArray(items) || items.length === 0) return { error: "Your cart is empty." };
	if (items.length > MAX_ITEMS) return { error: `You can send up to ${MAX_ITEMS} cards at once.` };
	const byId = new Map(cards.filter(c => c.published).map(c => [c.id, c]));
	const lines: OrderLine[] = [];
	for (const raw of items as CartItemInput[]) {
		if (!raw || typeof raw !== "object" || typeof raw.cardId !== "string") return { error: "One of the cards is not valid." };
		const card = byId.get(raw.cardId);
		if (!card) return { error: "One of the cards is no longer available." };
		const to = clean(raw.to, 40), from = clean(raw.from, 40), message = clean(raw.message, 400);
		if (to === null || from === null || message === null) return { error: "A name or message is too long." };
		if (!message) return { error: "Every card needs a message." };
		lines.push({ card_id: card.id, title: `${card.title} (${card.occasion})`, price_cents: card.price_cents, recipient_name: to, message, sender_name: from });
	}
	const total = lines.reduce((sum, l) => sum + l.price_cents, 0);
	return { lines, total };
}
